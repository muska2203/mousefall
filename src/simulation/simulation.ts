import {
    ActionPreview,
    Actor,
    AiActor,
    Entity,
    EntityId,
    FactionId,
    GameState,
    Intent,
    PlayerEntity,
    Position,
    Simulation,
    SimulationResult,
    StatActor,
    TurnPhase,
    ValidationError,
    ValidationResult,
} from "@simulation/types.ts";
import {
    type ActionPointCostResolver,
    DefaultActionPointCostResolver
} from "@simulation/systems/action-cost-resolver.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import {getSkillExecutor} from "@simulation/skills/skillExecutor";
import {runActionHandler} from "@simulation/systems/actions/action-utils.ts";
import {createStairs, generateMap} from "@simulation/systems/mapgen.ts";
import {INTERACTION_RADIUS, MAX_FLOOR} from "@utils/constants.ts";
import {
    createBoolGrid,
    createInitialPlayer,
    createNewGameState,
    buildEntityPositionIndex,
    ensureDefeatedBossIds,
    findAllAliveActorsOfFaction,
    findAllEntitiesAt,
    findFirstAttackableEntityAt,
    findInteractableEntitiesAround,
    findStairsAt,
    isActor,
    isDamageable,
    isEntityConcealedFrom,
    isTerrainWalkable,
    terrainHasTag,
    type EntityPositionIndex
} from "@simulation/state.ts";
import {isStunned} from "@simulation/systems/stun-helper.ts";
import {isBulwarked} from "@simulation/systems/bulwark-helper.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";
import {attackEntity} from "@simulation/systems/actions/attack-action.ts";
import {endTurnEntity} from "@simulation/systems/actions/end-turn-action.ts";
import {useAbilityAction} from "@simulation/systems/actions/use-ability-action.ts";
import {equipEntity} from "@simulation/systems/actions/equip-action.ts";
import {unequipEntity} from "@simulation/systems/actions/unequip-action.ts";
import {useItemAction, getConsumableThrowRange} from "@simulation/systems/actions/use-item-action.ts";
import {interactAction} from "@simulation/systems/actions/interact-action.ts";
import {resolvePoiChoiceAction} from "@simulation/systems/actions/resolve-poi-choice-action.ts";
import {createDebugAddItemActionHandler, DebugContext} from "@simulation/systems/actions/debug-add-item-action.ts";
import {createDebugSpawnEntityActionHandler} from "@simulation/systems/actions/debug-spawn-entity-action.ts";
import {createDebugSpawnTileEffectActionHandler} from "@simulation/systems/actions/debug-spawn-tile-effect-action.ts";
import {createDebugSetTerrainActionHandler} from "@simulation/systems/actions/debug-set-terrain-action.ts";
import {getStrategy} from "@simulation/ai/strategy-registry.ts";
import {isEnemyEntity} from "@simulation/ai/ai-state.ts";
import {cancelPreparedAbility} from "@simulation/ai/ai-helpers.ts";
import "@simulation/ai/hunter-strategy.ts";
import "@simulation/ai/simple-boss-strategy.ts";
import "@simulation/ai/guardian-boss-strategy.ts";
import type {ItemTemplate, MapParams} from "@content/schemas";
import type {DamageRange, GameplayTag, TargetMode} from "@simulation/core-types.ts";
import {getVisiblePositionsWithinRange, getPositionsInRadius} from "@simulation/skills/targeting";
import {applyCharacterConfig, type CharacterConfig} from "@simulation/characterCreation.ts";
import {createStartingEquipment} from "@simulation/systems/starting-equipment.ts";
import {grantStarterRelic} from "@simulation/systems/starting-relic.ts";
import {computeFOV, updateFOV} from "@simulation/systems/fov.ts";
import {applyDamageModifiers, getEffectiveWeaponDamageRange,} from "@simulation/systems/stats/effective-stats.ts";
import {getEffectiveBaseStats} from "@simulation/systems/stats/base-resolver.ts";
import {getEffectiveMaxAp} from "@simulation/systems/stats/effective-stats.ts";
import {addModifier} from "@simulation/systems/stats/modifier-engine.ts";
import {recalculateActorStats} from "@simulation/systems/stats/recalculate.ts";
import {collectFixedStatModifiers} from "@simulation/systems/item-affix-roll.ts";
import {getWeaponDamageDistribution, getWeaponWeightForTag} from "@simulation/systems/tags/weapon-tags.ts";
import {getWeaponAttackLosRadius, getWeaponAttackRange, isInWeaponRange} from "@simulation/systems/stats/weapon-range.ts";
import {getAbilityTags} from "@simulation/systems/tags/ability-tags.ts";
import {meetsWeaponRequirements} from "@simulation/systems/abilities/ability-requirements.ts";
import {getItem, tryGetAbility, tryGetItem, tryGetPlayerTemplate, tryGetRelic} from "@content/registry";
import {tickEntityStatusEffects, tickObjectStatusEffects} from "@simulation/systems/status-effect-ticker.ts";
import {executeIntent} from "@simulation/systems/intents/execute-intent.ts";
import {resolveInteraction} from "@simulation/systems/interactions/resolve-interaction.ts";
import {
    ensureFeatureFlags,
    setContentRulesEnabled as setContentRulesEnabledFlag,
} from "@simulation/content-rules/feature-flags.ts";
import {ensureRuntimeRng} from "@simulation/content-rules/runtime-rng.ts";
import {findPath, posEqual} from "@utils/math.ts";

export {findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt, buildEntityPositionIndex};
export type {EntityPositionIndex};

/** Состояние конечного автомата хода. */
type TurnState =
  | { phase: 'idle' }
  | { phase: 'faction-setup'; factionId: FactionId }
  | { phase: 'actor-turn'; factionId: FactionId; actorId: EntityId }
  | { phase: 'environment-turn' }
  | { phase: 'round-recovery' };

/** Предел итераций A* при поиске пути для игрока (защита от разрастания open-set). */
const MAX_PATH_STEPS = 500;

export class GameSimulation implements Simulation {

    constructor(
        private state: GameState,
        private readonly actionHandlerRegistry: ActionHandlerRegistry,
        private readonly apCostResolver: ActionPointCostResolver = new DefaultActionPointCostResolver(),
        private readonly debugContext: DebugContext = { enabled: false },
    ) {}

    /** Конечный автомат хода: фракционный сетап, ход актора или восстановление раунда. */
    private turnState: TurnState = { phase: 'idle' };

    /** Акторы, закончившие ход в текущем раунде. Сбрасывается в ROUND_RECOVERY. */
    private actorsDoneThisRound: Set<EntityId> = new Set();

    /** Счётчик глубины рекурсии для защиты от бесконечного цикла в step(). */
    private stepDepth = 0;

    /** Фиксированный порядок фракций в раунде. */
    private readonly FACTION_ORDER: FactionId[] = ['player', 'allies', 'enemies', 'neutrals'];

    /**
     * Включить или выключить debug-режим для текущей симуляции.
     * Изменение применяется к уже зарегистрированным обработчикам.
     */
    setDebugEnabled(enabled: boolean): void {
        this.debugContext.enabled = enabled;
    }

    /**
     * Включает или выключает новую систему декларативных контентных правил.
     */
    setContentRulesEnabled(enabled: boolean): void {
        setContentRulesEnabledFlag(this.state, enabled);
    }

    /**
     * true, если сейчас ожидается ввод игрока.
     */
    isPlayerTurn(): boolean {
        return this.turnState.phase === 'actor-turn' && this.turnState.actorId === this.state.player.id;
    }

    /**
     * Инициализирует внутренний turnState для тестов.
     * Только для тестов: не используйте в production-коде.
     */
    initializeTestTurnState(factionId: FactionId, actorId: EntityId): void {
        this.turnState = { phase: 'actor-turn', factionId, actorId };
        this.actorsDoneThisRound = new Set();
    }

    /**
     * Возвращает живых акторов фракции, отсортированных по id.
     */
    private getAliveActorsOfFactionSorted(factionId: FactionId) {
        return findAllAliveActorsOfFaction(this.state, factionId);
    }

    /**
     * true, если актор уже закончил ход в текущем раунде.
     */
    private isActorDone(actorId: EntityId): boolean {
        return this.actorsDoneThisRound.has(actorId);
    }

    /**
     * Переходит к следующему актору текущей фракции или к следующей фракции.
     */
    private advanceActor(): void {
        if (this.turnState.phase !== 'actor-turn') return;

        const turnState = this.turnState;
        const currentFactionId = turnState.factionId;
        const currentActorId = turnState.actorId;
        const actors = this.getAliveActorsOfFactionSorted(currentFactionId);
        const currentIndex = actors.findIndex(a => a.id === currentActorId);
        const nextActor = actors.slice(currentIndex + 1).find(a => !this.actorsDoneThisRound.has(a.id));

        if (nextActor) {
            this.turnState = { phase: 'actor-turn', factionId: currentFactionId, actorId: nextActor.id };
        } else {
            this.advanceFaction();
        }
    }

    /**
     * Переходит к следующей фракции или к фазе восстановления раунда.
     */
    private advanceFaction(): void {
        if (this.turnState.phase !== 'actor-turn' && this.turnState.phase !== 'faction-setup') return;

        const currentFactionId = this.turnState.factionId;
        const currentIndex = this.FACTION_ORDER.indexOf(currentFactionId);
        const nextFactionId = this.FACTION_ORDER[currentIndex + 1];

        if (nextFactionId) {
            this.turnState = { phase: 'faction-setup', factionId: nextFactionId };
        } else {
            this.turnState = { phase: 'environment-turn' };
        }
    }

    /**
     * Возвращает стоимость действия в AP с учётом текущего состояния.
     * Используется UI для отображения стоимости действий.
     */
    getActionCost(action: GameAction): number {
        return this.apCostResolver.getCost(action, this.state);
    }

    /**
     * Фабрика новой игры.
     * Создаёт состояние, применяет конфиг персонажа, генерирует этаж и возвращает готовую симуляцию.
     */
    static createNewGame(
        seed: number,
        config: CharacterConfig,
        mapParams: MapParams,
        debugEnabled: boolean = false,
    ): GameSimulation {
        const state = createNewGameState(seed, mapParams, config.templateId);
        applyCharacterConfig(state.player, config);
        createStartingEquipment(state, state.player, config.startingEquipment);
        // Стартовая реликвия выдаётся после applyCharacterConfig — тот сбрасывает player.relics.
        grantStarterRelic(state, state.player, config);
        const debugContext: DebugContext = { enabled: debugEnabled };
        const simulation = new GameSimulation(state, defaultActionHandlerRegistry(debugContext), new DefaultActionPointCostResolver(), debugContext);
        simulation.generateMap(mapParams);
        return simulation;
    }


    /**
     * Фабрика загруженной игры.
     * Оборачивает десериализованное состояние в симуляцию без повторной генерации карты.
     */
    static loadSavedGame(state: GameState, debugEnabled: boolean = false): GameSimulation {
        ensureFeatureFlags(state);
        ensureRuntimeRng(state);
        ensureDefeatedBossIds(state);
        const debugContext: DebugContext = { enabled: debugEnabled };
        const simulation = new GameSimulation(state, defaultActionHandlerRegistry(debugContext), new DefaultActionPointCostResolver(), debugContext);
        // Загруженная игра должна продолжаться с хода игрока, если он жив.
        if (state.phase === 'playing' && state.player.isAlive) {
            simulation.turnState = {
                phase: 'actor-turn',
                factionId: 'player',
                actorId: state.player.id,
            };
        }
        return simulation;
    }

    /**
     * Предпросмотр характеристик персонажа на основе конфига создания.
     * Создаёт временного игрока, применяет конфиг и возвращает snapshot.
     * Не создаёт полноценную симуляцию и не мутирует глобальное состояние.
     */
    static previewCharacterStats(
        config: CharacterConfig,
    ): import("@simulation/types.ts").PlayerStatsSnapshot {
        const player = createInitialPlayer(config.templateId);
        applyCharacterConfig(player, config);

        // Применяем стартовую экипировку для корректного превью характеристик.
        // Клонируем массив модификаторов, чтобы не мутировать shared-референс от createInitialPlayer.
        player.statModifiers = [...player.statModifiers];
        for (const templateId of config.startingEquipment) {
            const template = getItem(templateId);
            if (template.type === 'weapon') {
                player.equippedWeaponId = templateId;
            } else if (template.type === 'armor') {
                player.equippedArmorId = templateId;
            } else if (template.type === 'amulet') {
                player.equippedAmuletId = templateId;
            }
            // Фирменные stat-модификаторы предмета (из fixedModifiers шаблона).
            for (const mod of collectFixedStatModifiers(template)) {
                addModifier(player, { ...mod, source: `preview_${templateId}` });
            }
        }

        // Стартовая реликвия: учитываем постоянные модификаторы шаблона в превью,
        // если выбранный ID входит в starterRelicPool шаблона игрока.
        if (config.starterRelicId) {
            const pool = tryGetPlayerTemplate(config.templateId)?.starterRelicPool ?? [];
            const relic = pool.includes(config.starterRelicId) ? tryGetRelic(config.starterRelicId) : undefined;
            if (relic) {
                for (const mod of relic.statModifiers) {
                    addModifier(player, { ...mod, source: `preview_relic_${relic.id}` });
                }
            }
        }

        recalculateActorStats(player);
        const effective = getEffectiveBaseStats(player);
        return {
            hp: player.hp,
            maxHp: player.maxHp,
            ap: player.ap,
            maxAp: player.maxAp,
            baseStats: player.baseStats,
            effectiveStats: effective,
            damage: player.damage,
            armor: player.armor,
            critMultiplier: player.critMultiplier,
        };
    }

    dispatch(action: GameAction): SimulationResult {

        if (this.state.phase !== 'playing') {
            return this.reject('game_not_playing', action);
        }

        if (this.turnState.phase !== 'actor-turn') {
            return this.reject('not_actor_turn', action);
        }

        if (this.turnState.actorId !== action.entityId) {
            return this.reject('wrong_actor', action);
        }

        const actor = this.getActor(action.entityId);
        if (!actor || !actor.isAlive) {
            return this.reject('actor_dead', action);
        }

        if (action.type === 'END_TURN') {
            this.actorsDoneThisRound.add(actor.id);
            const phase = this.buildEndTurnPhase(actor);
            return {
                success: true,
                // stateChanged зависит от наличия дочерних событий:
                // оглушение добавляет SKIP_STUNNED_TURN, иначе только TURN_ENDED.
                stateChanged: phase.actions[0]!.children.length > 0,
                phases: [phase],
                hasMoreSteps: true,
            };
        }

        if (isStunned(actor)) {
            return this.reject('actor_stunned', action);
        }

        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action,
        });

        return this.executeActionInContext(actor, action, builder, builder.root);
    }

    step(): SimulationResult {
        // Сбрасываем счётчик глубины на каждый внешний вызов,
        // чтобы защита от бесконечной рекурсии работала в рамках одной цепочки.
        this.stepDepth = 0;
        return this.runStep();
    }

    private runStep(): SimulationResult {
        if (this.state.phase !== 'playing') {
            return {
                success: true,
                stateChanged: false,
                phases: [],
                hasMoreSteps: false,
            };
        }

        // Защита от бесконечной рекурсии: если step() вызывается слишком много раз
        // без прогресса (например, при зацикленной очереди пустых фаз),
        // прерываем цепочку и возвращаем пустой результат.
        this.stepDepth++;
        if (this.stepDepth > 50) {
            return {
                success: false,
                stateChanged: false,
                phases: [],
                hasMoreSteps: false,
            };
        }

        // Пропускаем мёртвых или уже закончивших ход акторов.
        while (this.turnState.phase === 'actor-turn') {
            const actor = this.getActor(this.turnState.actorId);
            if (!actor || !actor.isAlive || this.isActorDone(actor.id)) {
                this.advanceActor();
            } else {
                break;
            }
        }

        switch (this.turnState.phase) {
            case 'idle': {
                this.turnState = { phase: 'faction-setup', factionId: 'player' };
                return this.runStep();
            }

            case 'faction-setup': {
                const factionId = this.turnState.factionId;
                const phase = this.runFactionSetup(factionId);
                const actors = this.getAliveActorsOfFactionSorted(factionId);

                if (actors.length > 0) {
                    this.turnState = {
                        phase: 'actor-turn',
                        factionId,
                        actorId: actors[0]!.id,
                    };
                } else {
                    this.advanceFaction();
                }

                const nextActorIsPlayer = actors.length > 0 && actors[0]!.id === this.state.player.id;
                const transitionedToRoundRecovery = this.isRoundOver();

                return {
                    success: true,
                    stateChanged: phase.actions.length > 0 && phase.actions.some(a => a.children.length > 0),
                    phases: [phase],
                    hasMoreSteps: transitionedToRoundRecovery || !nextActorIsPlayer,
                };
            }

            case 'actor-turn': {
                const actor = this.getActor(this.turnState.actorId);

                if (!actor || !actor.isAlive) {
                    this.advanceActor();
                    return this.runStep();
                }

                if (actor.id === this.state.player.id) {
                    return {
                        success: true,
                        stateChanged: false,
                        phases: [],
                        hasMoreSteps: false,
                    };
                }

                return this.runAiAction(actor);
            }

            case 'environment-turn': {
                const phase = this.runEnvironmentTurn();
                this.turnState = { phase: 'round-recovery' };
                const stateChanged = phase.actions.length > 0 && phase.actions.some(a => a.children.length > 0);
                return {
                    success: true,
                    stateChanged,
                    phases: [phase],
                    hasMoreSteps: true,
                };
            }

            case 'round-recovery': {
                const phase = this.runRoundRecovery();
                this.turnState = { phase: 'faction-setup', factionId: 'player' };
                this.actorsDoneThisRound.clear();
                // После восстановления раунда нужно ещё выполнить FACTION_SETUP игрока:
                // восстановить AP, тикнуть статусы/кулдауны и перевести turnState в actor-turn.
                const stateChanged = phase.actions[0]!.children.length > 0;
                return {
                    success: true,
                    stateChanged,
                    phases: [phase],
                    hasMoreSteps: true,
                };
            }
        }
    }

    /**
     * true, если раунд завершён и симуляция перешла к восстановлению.
     */
    private isRoundOver(): boolean {
        return this.turnState.phase === 'round-recovery';
    }

    getState(): Readonly<GameState> {
        return this.state;
    }

    /**
     * Выполняет одно действие актора в контексте переданного ExecutionBuilder.
     * Используется dispatch для игрока и runAiAction для AI.
     */
    private executeActionInContext(
        actor: Actor,
        action: GameAction,
        builder: ExecutionBuilder,
        root: ExecutionNode,
    ): SimulationResult {
        const success = this.executeAction(actor, action, builder, root);

        if (!success) {
            return {
                success: false,
                stateChanged: false,
                phases: [{ side: actor.factionId, actions: [root] }],
                hasMoreSteps: false,
            };
        }

        if (actor.id === this.state.player.id) {
            const fovEvents = updateFOV(this.state);
            for (const event of fovEvents) {
                builder.addChild(root, event);
            }
        }

        if (actor.ap <= 0 || action.type === 'END_TURN') {
            this.actorsDoneThisRound.add(actor.id);
        }

        return {
            success: true,
            stateChanged: true,
            phases: [{ side: actor.factionId, actions: [root] }],
            hasMoreSteps: actor.id !== this.state.player.id,
        };
    }

    /**
     * Возвращает фазу завершения хода актора.
     * Для оглушённого актора дополнительно тикает stunned.
     */
    private buildEndTurnPhase(actor: Actor): TurnPhase {
        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action: { type: 'END_TURN', entityId: actor.id },
        });
        const root = builder.root;

        if (isStunned(actor)) {
            executeIntent(this.state, { type: 'SKIP_STUNNED_TURN', entityId: actor.id }, builder, root);
        }

        builder.addChild(root, {
            type: 'TURN_ENDED', isFieldEvent: false,
            turnNumber: this.state.turn.round,
        });

        return { side: actor.factionId, actions: [root] };
    }

    /**
     * Выполняет сетап фракции в начале её хода: тик статусов, восстановление AP, тик кулдаунов.
     */
    private runFactionSetup(factionId: FactionId): TurnPhase {
        // Временный placeholder-корень: реальное событие TURN_BEGAN создаётся
        // единственный раз через BEGIN_TURN intent и заменяет корень фазы.
        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action: { type: 'END_TURN', entityId: factionId },
        });
        const turnBeganNode = executeIntent(this.state, { type: 'BEGIN_TURN', side: factionId }, builder, builder.root);
        const root = turnBeganNode ?? builder.root;
        if (turnBeganNode) {
            turnBeganNode.parent = null;
        }

        const actors = this.getAliveActorsOfFactionSorted(factionId);

        // Сначала восстанавливаем AP, затем тикаем статусы.
        // Это нужно, чтобы эффект `dazed` (−1 AP при восстановлении) ещё был активен.
        for (const actor of actors) {
            executeIntent(this.state, { type: 'RESTORE_AP', entityId: actor.id }, builder, root);
        }

        for (const actor of actors) {
            const intents = tickEntityStatusEffects(actor, factionId);
            for (const intent of intents) {
                executeIntent(this.state, intent, builder, root);
            }
            // Снятие истёкших — отдельным интентом ПОСЛЕ реакций на STATUS_TICKED
            // (см. executeRemoveExpiredStatusEffectsIntent): иначе правила ruleIds
            // статуса вырезаются из activeRules до срабатывания последнего тика.
            if (intents.length > 0) {
                executeIntent(this.state, { type: 'REMOVE_EXPIRED_STATUS_EFFECTS', entityId: actor.id }, builder, root);
            }
        }

        for (const actor of actors) {
            if (!('abilities' in actor)) continue;
            for (const ability of actor.abilities) {
                if (ability.currentCooldown > 0) {
                    executeIntent(
                        this.state,
                        { type: 'TICK_COOLDOWN', entityId: actor.id, abilityId: ability.templateId },
                        builder,
                        root,
                    );
                }
            }
        }

        return { side: factionId, actions: [root] };
    }

    /**
     * Выполняет ход окружения: тик статусов у всех живых не-акторов.
     * Происходит после ходов всех фракций и перед восстановлением раунда.
     */
    private runEnvironmentTurn(): TurnPhase {
        // Placeholder-корень: реальное событие TURN_BEGAN создаётся
        // единственный раз через BEGIN_TURN intent и заменяет корень фазы.
        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action: { type: 'END_TURN', entityId: 'environment' },
        });
        const turnBeganNode = executeIntent(this.state, { type: 'BEGIN_TURN', side: 'environment' }, builder, builder.root);
        const root = turnBeganNode ?? builder.root;
        if (turnBeganNode) {
            turnBeganNode.parent = null;
        }

        // Тик тайловых эффектов: уменьшение длительности и удаление истёкших.
        executeIntent(this.state, { type: 'TICK_TILE_EFFECTS' }, builder, root);

        // Тик статусов не-акторов (дверей, пропов), например горение.
        for (const { entity, intents } of tickObjectStatusEffects(this.state, 'environment')) {
            for (const intent of intents) {
                executeIntent(this.state, intent, builder, root);
            }
            // Снятие истёкших — отдельным интентом после реакций на STATUS_TICKED,
            // как и для акторов в runFactionSetup.
            if (intents.length > 0) {
                executeIntent(this.state, { type: 'REMOVE_EXPIRED_STATUS_EFFECTS', entityId: entity.id }, builder, root);
            }
        }

        return { side: 'environment', actions: [root] };
    }

    /**
     * Выполняет восстановление раунда: удаление мёртвых сущностей.
     * Счётчик раунда увеличивается в начале следующего хода игрока (BEGIN_TURN 'player').
     */
    private runRoundRecovery(): TurnPhase {
        const builder = new ExecutionBuilder({
            type: 'TURN_BEGAN', isFieldEvent: false,
            side: 'round_recovery',
            round: this.state.turn.round,
            actorId: null,
        });
        const root = builder.root;

        executeIntent(this.state, { type: 'CLEANUP_DEAD_ENTITIES' }, builder, root);

        return { side: 'round_recovery', actions: [root] };
    }

    /**
     * Выполняет одно действие AI-актора.
     * Если актор оглушён — пропускает ход. Иначе запрашивает действие у стратегии.
     */
    private runAiAction(actor: Actor): SimulationResult {

        if (isStunned(actor)) {
            const action: GameAction = { type: 'END_TURN', entityId: actor.id };
            const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', isFieldEvent: false, action });
            const root = builder.root;
            const result = this.executeActionInContext(actor, action, builder, root);

            if (isEnemyEntity(actor)) {
                const prepared = cancelPreparedAbility(actor);
                if (prepared) {
                    builder.addChild(root, {
                        type: 'ABILITY_PREPARED_CANCELLED', isFieldEvent: false,
                        entityId: actor.id,
                        abilityId: prepared.abilityId,
                        targets: prepared.targets,
                        from: { x: actor.x, y: actor.y },
                    });
                }
            }

            return result;
        }

        const aiActor = actor as AiActor;
        const strategy = getStrategy(aiActor.aiStrategyId);
        strategy.updateState?.(aiActor, this.state);

        // Builder создаётся до decideAction, потому что стратегия может
        // эмитить события (например, ABILITY_PREPARED) как side-effect.
        // Корневое событие заменяется на реальное действие после решения стратегии.
        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action: { type: 'END_TURN', entityId: actor.id },
        });
        const root = builder.root;

        const action = strategy.decideAction(aiActor, this.state, builder, root);

        // Подменяем placeholder на реальное действие перед исполнением.
        builder.root.event = { type: 'ACTION_APPLIED', isFieldEvent: false, action };

        const result = this.executeActionInContext(actor, action, builder, root);

        // Fallback: если AI выбрала невыполнимое действие, завершаем ход.
        if (!result.success) {
            const endTurnBuilder = new ExecutionBuilder({
                type: 'ACTION_APPLIED', isFieldEvent: false,
                action: { type: 'END_TURN', entityId: actor.id },
            });
            return this.executeActionInContext(
                actor,
                { type: 'END_TURN', entityId: actor.id },
                endTurnBuilder,
                endTurnBuilder.root,
            );
        }

        return result;
    }

    /**
     * Возвращает актора по id или null, если сущность не является актором.
     */
    private getActor(actorId: EntityId): Actor | null {
        const entity = this.state.entities.get(actorId);
        if (!entity || !isActor(entity)) {
            return null;
        }
        return entity;
    }

    /**
     * Вспомогательный метод для формирования отказа в dispatch.
     */
    private reject(reasonCode: string, action: GameAction): SimulationResult {
        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED', isFieldEvent: false,
            action,
        });
        builder.addChild(builder.root, {
            type: 'ACTION_REJECTED', isFieldEvent: false,
            errors: [{ code: reasonCode }],
        });
        return {
            success: false,
            stateChanged: false,
            phases: [{ side: 'player', actions: [builder.root] }],
            hasMoreSteps: false,
        };
    }

    preview(action: GameAction): ActionPreview {

        const handler =
            this.actionHandlerRegistry.get(action.type);

        if (!handler) {
            return {
                valid: false,
                intents: [],
                errors: [
                    {
                        code: 'handler_not_found',
                    },
                ],
            };
        }

        const validationResult =
            handler.validate(this.state, action);

        const intents = validationResult.ok
            ? handler.resolve(this.state, action)
            : [];

        const errors: ValidationError[] =
            validationResult.ok
                ? []
                : [
                    {
                        code: validationResult.reasonCode,
                    },
                ];

        return {
            valid: validationResult.ok,
            intents,
            errors,
        };
    }

    generateMap(params: MapParams): void {
        const generatedMap = generateMap(params, this.state, this.state.floor, MAX_FLOOR);

        this.state.map = generatedMap.map;

        // Пересоздаём сетки видимости/разведки под фактический размер сгенерированной карты,
        // так как tree-стратегия может расширять карту за пределы mapParams.width/height.
        this.state.visible = createBoolGrid(generatedMap.map.width, generatedMap.map.height, false);
        this.state.explored = createBoolGrid(generatedMap.map.width, generatedMap.map.height, false);
        // Новая карта — сетка тайловых эффектов из генерации (начальные лужи комнат).
        this.state.tileEffects = generatedMap.tileEffects;

        this.state.player.x =
            generatedMap.playerStart.x;

        this.state.player.y =
            generatedMap.playerStart.y;

        this.state.player.ap =
            this.state.player.maxAp;

        this.state.entities.set(
            this.state.player.id,
            this.state.player,
        );

        this.state.turn = {
            activeSide: 'player',
            round: 1,
        };

        this.turnState = {
            phase: 'actor-turn',
            factionId: 'player',
            actorId: this.state.player.id,
        };

        generatedMap.enemies.forEach(e => this.state.entities.set(e.id, e));
        generatedMap.items.forEach(e => this.state.entities.set(e.id, e));
        generatedMap.doors.forEach(d => this.state.entities.set(d.id, d));
        generatedMap.pois.forEach(p => this.state.entities.set(p.id, p));
        generatedMap.props.forEach(p => this.state.entities.set(p.id, p));
        generatedMap.traps.forEach(t => this.state.entities.set(t.id, t));

        // Лестницы
        if (generatedMap.stairsDown && this.state.floor < MAX_FLOOR) {
            const stairsDown = createStairs(this.state, 'stairs_down', 'down', generatedMap.stairsDown.x, generatedMap.stairsDown.y);
            this.state.entities.set(stairsDown.id, stairsDown);
        }
        if (generatedMap.stairsUp && this.state.floor > 1) {
            const stairsUp = createStairs(this.state, 'stairs_up', 'up', generatedMap.stairsUp.x, generatedMap.stairsUp.y);
            this.state.entities.set(stairsUp.id, stairsUp);
        }

        // Начальный расчёт поля зрения
        updateFOV(this.state);
    }

    /**
     * Перегенерировать текущий этаж, заменив карту и все объекты на ней.
     * Игрок сохраняется со своим инвентарём и характеристиками.
     * Используется только в debug-режиме.
     */
    regenerateMap(): void {
        if (!this.debugContext.enabled) {
            return;
        }

        // Оставляем только игрока
        this.state.entities = new Map([[this.state.player.id, this.state.player]]);

        // Сбрасываем видимость и разведку под старую сетку (будет пересоздана в generateMap)
        this.state.visible = createBoolGrid(this.state.map.width, this.state.map.height, false);
        this.state.explored = createBoolGrid(this.state.map.width, this.state.map.height, false);

        this.generateMap(this.state.mapParams);
    }

    // =========================================================
    // ВЫПОЛНЕНИЕ ДЕЙСТВИЯ
    // =========================================================

    private executeAction(
        actor: Actor,
        action: GameAction,
        executionBuilder: ExecutionBuilder,
        parentNode: ExecutionNode,
    ): boolean {

        const actionCost = this.apCostResolver.getCost(action, this.state);

        if (!this.canActorAct(actor, action, actionCost)) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED', isFieldEvent: false,
                errors: [{ code: 'actor_cannot_act' }],
            });
            return false;
        }

        if (actor.ap < actionCost) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED', isFieldEvent: false,
                errors: [{ code: 'not_enough_ap' }],
            });
            return false;
        }

        // Оглушённый актор пропускает ход: тикаем stunned и обнуляем AP.
        // Разрешено только действие END_TURN (см. canActorAct), остальные отклонены выше.
        if (isStunned(actor)) {
            executeIntent(this.state, { type: 'SKIP_STUNNED_TURN', entityId: actor.id }, executionBuilder, parentNode);
            return true;
        }

        const handler =
            this.actionHandlerRegistry.get(action.type);

        if (!handler) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED', isFieldEvent: false,
                errors: [{ code: 'handler_not_found' }],
            });
            return false;
        }

        const validation: ValidationResult = runActionHandler(
            this.state,
            handler,
            action,
            executionBuilder,
            parentNode,
        );

        if (!validation.ok) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED', isFieldEvent: false,
                errors: [{ code: validation.reasonCode }],
            });
            return false;
        }

        executeIntent(this.state, { type: 'CONSUME_AP', entityId: actor.id, amount: actionCost }, executionBuilder, parentNode);

        return true;
    }

    // =========================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // =========================================================

    private canActorAct(actor: Actor, action: GameAction, actionCost: number): boolean {

        // Действия с нулевой стоимостью (DEBUG_*) доступны даже при 0 AP.
        if (actor.ap <= 0 && actionCost > 0) {
            return false;
        }

        if (isStunned(actor)) {
            // Оглушённый актор может только явно завершить ход (END_TURN).
            return action.type === 'END_TURN';
        }

        if (isBulwarked(actor)) {
            // Носитель «Глухой обороны» может только явно завершить ход (END_TURN).
            // В отличие от оглушения: ход не пропускается (без SKIP_STUNNED_TURN)
            // и подготовленный скилл не сбрасывается.
            return action.type === 'END_TURN';
        }

        return true;
    }

    getPlayerStats() {
        const p = this.state.player;
        const effective = getEffectiveBaseStats(p);
        return {
            hp: p.hp,
            maxHp: p.maxHp,
            ap: p.ap,
            maxAp: getEffectiveMaxAp(p),
            baseStats: p.baseStats,
            effectiveStats: effective,
            damage: p.damage,
            armor: p.armor,
            critMultiplier: p.critMultiplier,
        };
    }

    getAbilityTargetMode(abilityId: string) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return null;
        return executor.getTargetMode(this.state, this.state.player);
    }

    getAbilityValidTargets(abilityId: string) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        return executor.getValidTargets(this.state, this.state.player);
    }

    getAbilityCastableCells(abilityId: string) {
        const executor = getSkillExecutor(abilityId);
        if (!executor?.getCastableCells) return [];
        return executor.getCastableCells(this.state, this.state.player);
    }

    getAbilityPreview(
        abilityId: string,
        selectedTargets: Position[],
        hoveredTarget: Position | null,
    ) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        return executor.preview(this.state, this.state.player, selectedTargets, hoveredTarget);
    }

    /**
     * Клетка для мгновенного применения способности без выбора цели, либо null.
     * Правило: единственная валидная цель — клетка самого игрока, и способность
     * не задевает ничего, кроме этой клетки (небоевые self-скиллы: поиск, бафы
     * на себя). Self-скиллы с зоной поражения (groundSlam) сюда не попадают.
     * Будущие скиллы «на себя/союзника» подчиняются тому же правилу: без
     * союзников в радиусе валидная цель одна — каст на себя мгновенный.
     */
    getAbilityAutoSelfTarget(abilityId: string): Position | null {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return null;
        const player = this.state.player;
        const selfPos: Position = { x: player.x, y: player.y };
        const isSelfCell = (p: Position) => p.x === selfPos.x && p.y === selfPos.y;

        const validTargets = executor.getValidTargets(this.state, player);
        const target = validTargets[0];
        if (validTargets.length !== 1 || !target || !isSelfCell(target)) return null;

        const affected = executor.getAffectedPositions(this.state, player, [selfPos], null);
        const affectedCell = affected[0];
        if (affected.length !== 1 || !affectedCell || !isSelfCell(affectedCell)) return null;

        return selfPos;
    }

    getAbilityAffectedPositions(
        abilityId: string,
        entityId: string,
        selectedTargets: Position[],
        hoveredTarget: Position | null,
    ) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        const entity = this.state.entities.get(entityId) ??
            (entityId === this.state.player.id ? this.state.player : undefined);
        if (!entity) return [];
        return executor.getAffectedPositions(this.state, entity, selectedTargets, hoveredTarget);
    }

    getAbilityIntents(
        abilityId: string,
        entityId: string,
        targets: Position[],
    ): Intent[] {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        const entity = this.state.entities.get(entityId);
        if (!entity) return [];

        // Проверяем требования к оружию, если сущность владеет способностью.
        if ('abilities' in entity) {
            const runtimeAbility = entity.abilities.find(a => a.templateId === abilityId);
            if (!runtimeAbility) return [];
            if (!meetsWeaponRequirements(entity, runtimeAbility)) return [];
        }

        return executor.resolve(this.state, entity, targets);
    }

    getAbilityInfo(abilityId: string) {
        try {
            const template = tryGetAbility(abilityId);
            if (!template) return null;
            const runtime = this.state.player.abilities.find((a) => a.templateId === abilityId);
            return {
                spriteId: template.spriteId,
                cooldown: template.cooldown,
                currentCooldown: runtime?.currentCooldown ?? 0,
                apCost: template.apCost,
                tags: getAbilityTags(abilityId),
            };
        } catch {
            return null;
        }
    }

    getConsumableTargetMode(templateId: string): TargetMode | null {
        const template = tryGetItem(templateId);
        if (!template || template.type !== 'consumable' || !template.consumable) return null;
        if (template.consumable.effect !== 'spawn_tile_effect' && template.consumable.effect !== 'damage') return null;
        return { type: 'single', range: getConsumableThrowRange(template, this.state.player) };
    }

    getConsumableValidTargets(templateId: string): Position[] {
        const template = tryGetItem(templateId);
        if (!template || template.type !== 'consumable' || !template.consumable) return [];
        if (template.consumable.effect !== 'spawn_tile_effect' && template.consumable.effect !== 'damage') return [];
        const range = getConsumableThrowRange(template, this.state.player);
        return getVisiblePositionsWithinRange(this.state, this.state.player, range);
    }

    /**
     * Режим таргетинга базовой атаки оружием игрока: {single, range} из шаблона
     * экипированного оружия (для безоружной атаки — range 1).
     */
    getBasicAttackTargetMode(): TargetMode {
        const { range } = getWeaponAttackRange(this.state.player);
        return { type: 'single', range };
    }

    /**
     * Валидные клетки позиционной базовой атаки игрока: damageable-сущности в LOS,
     * удовлетворяющие общему предикату дальности `isInWeaponRange`
     * (чебышёвская дистанция ∈ [minRange, range]).
     * Скрытые сущности (concealing-клетка, дистанция > 1) исключаются.
     */
    getBasicAttackValidTargets(): Position[] {
        const player = this.state.player;
        const attackRange = getWeaponAttackRange(player);
        const losSet = new Set(
            computeFOV(this.state, player.x, player.y, getWeaponAttackLosRadius(attackRange))
                .map(pos => `${pos.x},${pos.y}`),
        );
        const targets: Position[] = [];
        for (const entity of this.state.entities.values()) {
            if (entity.id === player.id) continue;
            if (!isDamageable(entity)) continue;
            if (!isInWeaponRange(attackRange, player, entity)) continue;
            if (!losSet.has(`${entity.x},${entity.y}`)) continue;
            if (isEntityConcealedFrom(this.state, entity, player)) continue;
            targets.push({ x: entity.x, y: entity.y });
        }
        return targets;
    }

    /**
     * Все клетки зоны досягаемости базовой атаки игрока по предикату `isInWeaponRange`
     * (без LOS и без требования сущности) — для подсветки радиуса в режиме таргетинга.
     * Клетки ближе minRange не включаются.
     */
    getBasicAttackRangeCells(): Position[] {
        const player = this.state.player;
        const attackRange = getWeaponAttackRange(player);
        const { width, height } = this.state.map;
        const cells: Position[] = [];
        // Чебышёвская дистанция не превышает range ⇒ bounding box [±range] покрывает всю зону.
        for (let dy = -attackRange.range; dy <= attackRange.range; dy++) {
            for (let dx = -attackRange.range; dx <= attackRange.range; dx++) {
                const pos = { x: player.x + dx, y: player.y + dy };
                if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) continue;
                if (isInWeaponRange(attackRange, player, pos)) {
                    cells.push(pos);
                }
            }
        }
        return cells;
    }

    getConsumablePreview(
        templateId: string,
        hoveredTarget: Position | null,
    ): Intent[] {
        if (!hoveredTarget) return [];
        return this.getConsumableAffectedPositions(templateId, this.state.player.id, hoveredTarget)
            .map(pos => ({
                type: 'SPAWN_TILE_EFFECT' as const,
                effectType: this.getSpawnTileEffectType(templateId) ?? '',
                position: pos,
            }));
    }

    getConsumableAffectedPositions(
        templateId: string,
        entityId: string,
        hoveredTarget: Position | null,
    ): Position[] {
        if (!hoveredTarget) return [];
        const template = tryGetItem(templateId);
        if (!template || template.type !== 'consumable' || !template.consumable) return [];
        if (template.consumable.effect !== 'spawn_tile_effect') return [];
        const radius = template.consumable.radius ?? 1;
        const entity = this.state.entities.get(entityId) ??
            (entityId === this.state.player.id ? this.state.player : undefined);
        if (!entity) return [];
        return getPositionsInRadius(this.state, hoveredTarget, radius)
            .filter(pos => terrainHasTag(this.state.map.tiles[pos.y]?.[pos.x], 'ground'));
    }

    private getSpawnTileEffectType(templateId: string): string | null {
        const template = tryGetItem(templateId);
        if (!template || template.type !== 'consumable' || !template.consumable) return null;
        if (template.consumable.effect !== 'spawn_tile_effect') return null;
        return template.consumable.tileEffectType ?? null;
    }

    getWeaponDamageRange(player: PlayerEntity): DamageRange {
        return getEffectiveWeaponDamageRange(player);
    }

    getWeaponDamageDistribution(player: PlayerEntity): Array<{ damageTag: GameplayTag; weight: number }> {
        return getWeaponDamageDistribution(player);
    }

    getWeaponDamageRangeByTag(player: PlayerEntity, tag: GameplayTag): DamageRange {
        const range = getEffectiveWeaponDamageRange(player);
        const weight = getWeaponWeightForTag(player, tag);
        return {
            min: Math.round(range.min * weight),
            max: Math.round(range.max * weight),
        };
    }

    /**
     * Считает effective рейнж урона для конкретного шаблона оружия и конкретного типа урона.
     * Формула: рейнж шаблона × вес типа × модификаторы актора (по каждому концу).
     */
    getEffectiveWeaponDamageRangeForTemplate(
        actor: StatActor,
        template: ItemTemplate,
        tag: GameplayTag,
    ): DamageRange {
        const base = template.weapon?.damage ?? { min: 1, max: 1 };
        const weight = template.weapon?.damageDistribution?.find(entry => entry.damageTag === tag)?.weight ?? 0;
        return applyDamageModifiers(actor, {
            min: base.min * weight,
            max: base.max * weight,
        });
    }

    /** Проверяет, может ли игрок переместиться на указанный тайл с учётом видимости.
     *  Невидимые объекты не блокируют путь. */
    isTileWalkableForPlayer(pos: Position, index?: EntityPositionIndex): boolean {
        const state = this.state;
        if (pos.x < 0 || pos.x >= state.map.width || pos.y < 0 || pos.y >= state.map.height) return false;
        if (!isTerrainWalkable(state.map.tiles[pos.y]?.[pos.x])) return false;
        if (!state.visible[pos.y]?.[pos.x]) return true;
        return !findAllEntitiesAt(state, pos.x, pos.y, index).some((entity) => entity.blocksMovement);
    }

    /** Ищет кратчайший путь для игрока от start до target. */
    findPathForPlayer(start: Position, target: Position): Position[] | null {
        // Позиционный индекс строится один раз на поиск пути:
        // проверка проходимости вызывается для каждой клетки A*.
        const index = buildEntityPositionIndex(this.state.entities);
        if (posEqual(start, target)) {
            return this.isTileWalkableForPlayer(target, index) ? [] : null;
        }
        const path = findPath(
            start,
            target,
            (pos) => this.isTileWalkableForPlayer(pos, index),
            MAX_PATH_STEPS,
            true,
        );
        if (!path) return null;
        if (!this.isTileWalkableForPlayer(target, index)) return null;
        return path;
    }

    /**
     * Ищет ближайшую к игроку «атакующую клетку» для базовой атаки по цели:
     * проходимую для игрока клетку, с которой экипированное оружие достаёт цель
     * (чебышёвская дистанция ∈ [minRange, range], предикат `isInWeaponRange`)
     * и есть прямая видимость на цель.
     *
     * Возвращает клетку и кратчайший путь до неё (без стартовой клетки игрока).
     * Если игрок уже стоит на атакующей клетке — возвращает её с пустым путём.
     * Если подходящих клеток нет (цель недосягаема текущим оружием) — null.
     *
     * LOS проверяется из клетки-кандидата тем же FOV, что и валидация
     * позиционной атаки: shadowcasting не гарантирует симметрию видимости,
     * поэтому FOV от позиции цели не используется.
     * Приоритет выбора: визуально ближайшая к игроку клетка (евклидова
     * дистанция), при равенстве — кратчайший путь, затем координаты (y, x).
     * Длина пути намеренно вторична: клетка с чуть более коротким путём,
     * но визуально далёкая от персонажа, выглядит для игрока нелогично.
     */
    findNearestAttackPosition(target: Position): { position: Position; path: Position[] } | null {
        const player = this.state.player;
        const attackRange = getWeaponAttackRange(player);
        const losRadius = getWeaponAttackLosRadius(attackRange);
        const {width, height} = this.state.map;
        // Позиционный индекс строится один раз на весь перебор кандидатов:
        // проверки проходимости идут поклеточно в A*.
        const index = buildEntityPositionIndex(this.state.entities);

        // LOS из клетки на цель — тем же FOV, что при валидации позиционной атаки.
        const hasLosToTarget = (from: Position): boolean =>
            computeFOV(this.state, from.x, from.y, losRadius)
                .some(pos => pos.x === target.x && pos.y === target.y);

        // Игрок уже стоит на атакующей клетке — возвращаем её с пустым путём.
        if (isInWeaponRange(attackRange, player, target) && hasLosToTarget(player)) {
            return {position: {x: player.x, y: player.y}, path: []};
        }

        // Кандидаты: клетки квадратной окрестности цели в зоне досягаемости оружия.
        // Порядок перебора — одновременно приоритет выбора: визуально ближние
        // к игроку (квадрат евклидовой дистанции) первыми, далее по координатам.
        const candidates: Position[] = [];
        for (let dy = -attackRange.range; dy <= attackRange.range; dy++) {
            for (let dx = -attackRange.range; dx <= attackRange.range; dx++) {
                const pos = {x: target.x + dx, y: target.y + dy};
                if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) continue;
                if (isInWeaponRange(attackRange, pos, target)) {
                    candidates.push(pos);
                }
            }
        }
        const dist2FromPlayer = (pos: Position): number =>
            (pos.x - player.x) ** 2 + (pos.y - player.y) ** 2;
        candidates.sort((a, b) =>
            dist2FromPlayer(a) - dist2FromPlayer(b) || a.y - b.y || a.x - b.x);

        let best: { position: Position; path: Position[] } | null = null;
        let bestDist2 = Infinity;
        for (const pos of candidates) {
            const dist2 = dist2FromPlayer(pos);
            // Кандидаты отсортированы по дистанции: дальше идут только визуально
            // более далёкие клетки, которые уже не могут улучшить результат.
            if (best && dist2 > bestDist2) break;
            if (!this.isTileWalkableForPlayer(pos, index)) continue;
            if (!hasLosToTarget(pos)) continue;
            const path = findPath(
                player,
                pos,
                (p) => this.isTileWalkableForPlayer(p, index),
                MAX_PATH_STEPS,
                true,
            );
            if (!path) continue;
            // При равной визуальной дистанции выигрывает кратчайший путь.
            if (best && dist2 === bestDist2 && path.length >= best.path.length) continue;
            best = {position: pos, path};
            bestDist2 = dist2;
        }
        return best;
    }

    /** Возвращает первую сущность на тайле, удовлетворяющую фильтру. */
    findEntityAt(pos: Position, filter?: (entity: Entity) => boolean, index?: EntityPositionIndex): Entity | null {
        const entities = findAllEntitiesAt(this.state, pos.x, pos.y, index);
        return filter ? entities.find(filter) ?? null : entities[0] ?? null;
    }

    /** Возвращает все сущности на тайле, удовлетворяющие фильтру. */
    findEntitiesAt(pos: Position, filter?: (entity: Entity) => boolean, index?: EntityPositionIndex): Entity[] {
        const entities = findAllEntitiesAt(this.state, pos.x, pos.y, index);
        return filter ? entities.filter(filter) : entities;
    }

    /** Возвращает разрешённое взаимодействие для целевой сущности от лица актора. */
    resolveInteraction(entity: Entity, actor: Entity) {
        return resolveInteraction(this.state, entity, actor);
    }

    /** Возвращает все интерактивные сущности в радиусе от актора (Chebyshev distance). */
    findInteractableEntitiesAround(actor: Entity, radius: number): Entity[] {
        return findInteractableEntitiesAround(this.state, actor, radius);
    }

    /** Возвращает радиус, в котором игрок может взаимодействовать с объектами. */
    getInteractionRadius(): number {
        return INTERACTION_RADIUS;
    }
}

export class ActionHandlerRegistry {
    private readonly handlers = new Map<
        GameAction['type'],
        ActionHandler
    >();

    register(
        type: GameAction['type'],
        handler: ActionHandler,
    ): void {
        this.handlers.set(type, handler);
    }

    get(
        type: GameAction['type'],
    ): ActionHandler | undefined {
        return this.handlers.get(type);
    }
}

export function defaultActionHandlerRegistry(debugContext: DebugContext = { enabled: false }): ActionHandlerRegistry {
    const registry = new ActionHandlerRegistry();

    registry.register('MOVE', moveEntity);
    registry.register('ATTACK', attackEntity);
    registry.register('END_TURN', endTurnEntity);
    registry.register('USE_ABILITY', useAbilityAction);
    registry.register('EQUIP', equipEntity);
    registry.register('UNEQUIP', unequipEntity);
    registry.register('USE_ITEM', useItemAction);
    registry.register('INTERACT', interactAction);
    registry.register('RESOLVE_POI_CHOICE', resolvePoiChoiceAction);
    registry.register('DEBUG_ADD_ITEM', createDebugAddItemActionHandler(debugContext));
    registry.register('DEBUG_SPAWN_ENTITY', createDebugSpawnEntityActionHandler(debugContext));
    registry.register('DEBUG_SPAWN_TILE_EFFECT', createDebugSpawnTileEffectActionHandler(debugContext));
    registry.register('DEBUG_SET_TERRAIN', createDebugSetTerrainActionHandler(debugContext));
    return registry;
}

