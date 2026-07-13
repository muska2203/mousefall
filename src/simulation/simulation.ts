import {
    ActionPreview,
    Actor,
    AiActor,
    EnemyEntity,
    Entity,
    EntityId,
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
    FactionId,
} from "@simulation/types.ts";
import {DefaultActionPointCostResolver, type ActionPointCostResolver} from "@simulation/systems/action-cost-resolver.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import { getSkillExecutor } from "@simulation/skills/skillExecutor";
import {runActionHandler} from "@simulation/systems/actions/action-utils.ts";
import {generateMap, createStairs} from "@simulation/systems/mapgen.ts";
import {MAX_FLOOR} from "@utils/constants.ts";
import {findAllAliveActorsOfFaction, isActor, createBoolGrid, findInteractableEntitiesAround} from "@simulation/state.ts";
import {isStunned} from "@simulation/systems/stun-helper.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";
import {attackEntity} from "@simulation/systems/actions/attack-action.ts";
import {endTurnEntity} from "@simulation/systems/actions/end-turn-action.ts";
import {useAbilityAction} from "@simulation/systems/actions/use-ability-action.ts";
import {equipEntity} from "@simulation/systems/actions/equip-action.ts";
import {unequipEntity} from "@simulation/systems/actions/unequip-action.ts";
import {useItemAction} from "@simulation/systems/actions/use-item-action.ts";
import {interactAction} from "@simulation/systems/actions/interact-action.ts";
import {createDebugAddItemActionHandler, DebugContext} from "@simulation/systems/actions/debug-add-item-action.ts";
import {createDebugSpawnEntityActionHandler} from "@simulation/systems/actions/debug-spawn-entity-action.ts";
import {getStrategy} from "@simulation/ai/strategy-registry.ts";
import { isEnemyEntity } from "@simulation/ai/ai-state.ts";
import { cancelPreparedAbility } from "@simulation/ai/ai-helpers.ts";
import "@simulation/ai/hunter-strategy.ts";
import "@simulation/ai/simple-boss-strategy.ts";
import type {ItemTemplate, MapParams} from "@content/schemas";
import type { GameplayTag } from "@simulation/core-types.ts";
import {createNewGameState, findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt, createInitialPlayer} from "@simulation/state.ts";
import {applyCharacterConfig, type CharacterConfig} from "@simulation/characterCreation.ts";
import {createStartingEquipment} from "@simulation/systems/starting-equipment.ts";
import {updateFOV} from "@simulation/systems/fov.ts";
import {
  getEffectiveDodgeChance,
  getEffectiveAccuracy,
  getEffectiveCritChance,
  getEffectiveCritMultiplier,
  getEffectiveWeaponDamage,
} from "@simulation/systems/stats/effective-stats.ts";
import { getEffectiveBaseStats } from "@simulation/systems/stats/base-resolver.ts";
import { getWeaponDamage } from "@simulation/systems/stats/weapon-formulas.ts";
import { applyModifiers } from "@simulation/systems/stats/modifier-engine.ts";
import { recalculateActorStats } from "@simulation/systems/stats/recalculate.ts";
import { getWeaponDamageDistribution, getWeaponWeightForTag } from "@simulation/systems/tags/weapon-tags.ts";
import { getAbilityTags } from "@simulation/systems/tags/ability-tags.ts";
import { meetsWeaponRequirements } from "@simulation/systems/abilities/ability-requirements.ts";
import { initSkillRegistry } from "@simulation/skills/index.ts";
import { tryGetAbility, getItem } from "@content/registry";
import { addModifier } from "@simulation/systems/stats/modifier-engine.ts";
import { tickEntityStatusEffects } from "@simulation/systems/status-effect-ticker.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";
import { resolveInteraction } from "@simulation/systems/interactions/resolve-interaction.ts";
import {
  ensureFeatureFlags,
  setContentRulesEnabled as setContentRulesEnabledFlag,
} from "@simulation/content-rules/feature-flags.ts";
import { ensureRuntimeRng } from "@simulation/content-rules/runtime-rng.ts";
import { findPath, posEqual } from "@utils/math.ts";

export {findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt};

/** Состояние конечного автомата хода. */
type TurnState =
  | { phase: 'idle' }
  | { phase: 'faction-setup'; factionId: FactionId }
  | { phase: 'actor-turn'; factionId: FactionId; actorId: EntityId }
  | { phase: 'environment-turn' }
  | { phase: 'round-recovery' };

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
        const debugContext: DebugContext = { enabled: debugEnabled };
        const simulation = new GameSimulation(state, defaultActionHandlerRegistry(debugContext), new DefaultActionPointCostResolver(), debugContext);
        // Загруженная игра должна продолжаться с хода игрока, если он жив.
        if (state.phase === 'playing' && state.player.isAlive !== false) {
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
            for (const mod of template.equipModifiers ?? []) {
                addModifier(player, { ...mod, source: `preview_${templateId}` });
            }
        }

        recalculateActorStats(player);
        const effective = getEffectiveBaseStats(player);
        return {
            level: player.level,
            xp: player.xp,
            hp: player.hp,
            maxHp: player.maxHp,
            ap: player.ap,
            maxAp: player.maxAp,
            baseStats: player.baseStats,
            effectiveStats: effective,
            damage: player.damage,
            armor: player.armor,
            dodgeChance: player.dodgeChance,
            accuracy: player.accuracy,
            critChance: player.critChance,
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
        if (!actor || actor.isAlive === false) {
            return this.reject('actor_dead', action);
        }

        if (action.type === 'END_TURN') {
            this.actorsDoneThisRound.add(actor.id);
            const phase = this.buildEndTurnPhase(actor);
            const result: SimulationResult = {
                success: true,
                // stateChanged зависит от наличия дочерних событий:
                // оглушение добавляет SKIP_STUNNED_TURN, иначе только TURN_ENDED.
                stateChanged: phase.actions[0]!.children.length > 0,
                phases: [phase],
                hasMoreSteps: true,
            };
            return result;
        }

        if (isStunned(actor)) {
            return this.reject('actor_stunned', action);
        }

        const builder = new ExecutionBuilder({
            type: 'ACTION_APPLIED',
            action,
        });

        const result = this.executeActionInContext(actor, action, builder, builder.root);
        return result;
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
            if (!actor || actor.isAlive === false || this.isActorDone(actor.id)) {
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

                const result: SimulationResult = {
                    success: true,
                    stateChanged: phase.actions.length > 0 && phase.actions.some(a => a.children.length > 0),
                    phases: [phase],
                    hasMoreSteps: transitionedToRoundRecovery || !nextActorIsPlayer,
                };
                return result;
            }

            case 'actor-turn': {
                const actor = this.getActor(this.turnState.actorId);

                if (!actor || actor.isAlive === false) {
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
            type: 'ACTION_APPLIED',
            action: { type: 'END_TURN', entityId: actor.id },
        });
        const root = builder.root;

        if (isStunned(actor)) {
            executeIntent(this.state, { type: 'SKIP_STUNNED_TURN', entityId: actor.id }, builder, root);
        }

        builder.addChild(root, {
            type: 'TURN_ENDED',
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
            type: 'ACTION_APPLIED',
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
            type: 'ACTION_APPLIED',
            action: { type: 'END_TURN', entityId: 'environment' },
        });
        const turnBeganNode = executeIntent(this.state, { type: 'BEGIN_TURN', side: 'environment' }, builder, builder.root);
        const root = turnBeganNode ?? builder.root;
        if (turnBeganNode) {
            turnBeganNode.parent = null;
        }

        const entities = Array.from(this.state.entities.values()).sort((a, b) => a.id.localeCompare(b.id));
        for (const entity of entities) {
            if (!('statusEffects' in entity)) continue;
            if (isActor(entity)) continue;
            if ('isAlive' in entity && entity.isAlive === false) continue;

            const intents = tickEntityStatusEffects(entity, 'environment');
            for (const intent of intents) {
                executeIntent(this.state, intent, builder, root);
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
            type: 'TURN_BEGAN',
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
            const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action });
            const root = builder.root;
            const result = this.executeActionInContext(actor, action, builder, root);

            if (isEnemyEntity(actor)) {
                const prepared = cancelPreparedAbility(actor);
                if (prepared) {
                    builder.addChild(root, {
                        type: 'ABILITY_PREPARED_CANCELLED',
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
            type: 'ACTION_APPLIED',
            action: { type: 'END_TURN', entityId: actor.id },
        });
        const root = builder.root;

        const action = strategy.decideAction(aiActor, this.state, builder, root);

        // Подменяем placeholder на реальное действие перед исполнением.
        builder.root.event = { type: 'ACTION_APPLIED', action };

        const result = this.executeActionInContext(actor, action, builder, root);

        // Fallback: если AI выбрала невыполнимое действие, завершаем ход.
        if (!result.success) {
            const endTurnBuilder = new ExecutionBuilder({
                type: 'ACTION_APPLIED',
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
            type: 'ACTION_APPLIED',
            action,
        });
        builder.addChild(builder.root, {
            type: 'ACTION_REJECTED',
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
                type: 'ACTION_REJECTED',
                errors: [{ code: 'actor_cannot_act' }],
            });
            return false;
        }

        if (actor.ap < actionCost) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED',
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
                type: 'ACTION_REJECTED',
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
                type: 'ACTION_REJECTED',
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

        return true;
    }

    getPlayerStats() {
        const p = this.state.player;
        const effective = getEffectiveBaseStats(p);
        return {
            level: p.level,
            xp: p.xp,
            hp: p.hp,
            maxHp: p.maxHp,
            ap: p.ap,
            maxAp: p.maxAp,
            baseStats: p.baseStats,
            effectiveStats: effective,
            damage: p.damage,
            armor: p.armor,
            dodgeChance: p.dodgeChance,
            accuracy: p.accuracy,
            critChance: p.critChance,
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

    getAbilityPreview(
        abilityId: string,
        selectedTargets: Position[],
        hoveredTarget: Position | null,
    ) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        return executor.preview(this.state, this.state.player, selectedTargets, hoveredTarget);
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

    getWeaponDamage(player: PlayerEntity): number {
        return getEffectiveWeaponDamage(player);
    }

    getWeaponDamageDistribution(player: PlayerEntity): Array<{ damageTag: GameplayTag; weight: number }> {
        return getWeaponDamageDistribution(player);
    }

    getWeaponDamageByTag(player: PlayerEntity, tag: GameplayTag): number {
        const total = getEffectiveWeaponDamage(player);
        const weight = getWeaponWeightForTag(player, tag);
        return Math.round(total * weight);
    }

    /**
     * Считает effective урон для конкретного шаблона оружия и конкретного типа урона.
     * Формула: базовый урон по формуле предмета × вес типа × модификаторы актора.
     */
    getEffectiveWeaponDamageForTemplate(
        actor: StatActor,
        template: ItemTemplate,
        tag: GameplayTag,
    ): number {
        const baseDamage = getWeaponDamage(actor, template);
        const weight = template.weapon?.damageDistribution?.find(entry => entry.damageTag === tag)?.weight ?? 0;
        const weighted = baseDamage * weight;
        return Math.round(applyModifiers(actor, 'damage', weighted).total);
    }

    /** Проверяет, может ли игрок переместиться на указанный тайл с учётом видимости.
     *  Невидимые объекты не блокируют путь. */
    isTileWalkableForPlayer(pos: Position): boolean {
        const state = this.state;
        if (pos.x < 0 || pos.x >= state.map.width || pos.y < 0 || pos.y >= state.map.height) return false;
        const tile = state.map.tiles[pos.y]?.[pos.x];
        if (tile === 'wall') return false;
        if (!state.visible[pos.y]?.[pos.x]) return true;
        return !findAllEntitiesAt(state, pos.x, pos.y).some((entity) => entity.blocksMovement);
    }

    /** Ищет кратчайший путь для игрока от start до target. */
    findPathForPlayer(start: Position, target: Position): Position[] | null {
        const MAX_PATH_STEPS = 500;
        if (posEqual(start, target)) {
            return this.isTileWalkableForPlayer(target) ? [] : null;
        }
        const path = findPath(
            start,
            target,
            (pos) => this.isTileWalkableForPlayer(pos),
            MAX_PATH_STEPS,
            true,
        );
        if (!path) return null;
        if (!this.isTileWalkableForPlayer(target)) return null;
        return path;
    }

    /** Возвращает первую сущность на тайле, удовлетворяющую фильтру. */
    findEntityAt(pos: Position, filter?: (entity: Entity) => boolean): Entity | null {
        const entities = findAllEntitiesAt(this.state, pos.x, pos.y);
        return filter ? entities.find(filter) ?? null : entities[0] ?? null;
    }

    /** Возвращает все сущности на тайле, удовлетворяющие фильтру. */
    findEntitiesAt(pos: Position, filter?: (entity: Entity) => boolean): Entity[] {
        const entities = findAllEntitiesAt(this.state, pos.x, pos.y);
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
    initSkillRegistry();
    const registry = new ActionHandlerRegistry();

    registry.register('MOVE', moveEntity);
    registry.register('ATTACK', attackEntity);
    registry.register('END_TURN', endTurnEntity);
    registry.register('USE_ABILITY', useAbilityAction);
    registry.register('EQUIP', equipEntity);
    registry.register('UNEQUIP', unequipEntity);
    registry.register('USE_ITEM', useItemAction);
    registry.register('INTERACT', interactAction);
    registry.register('DEBUG_ADD_ITEM', createDebugAddItemActionHandler(debugContext));
    registry.register('DEBUG_SPAWN_ENTITY', createDebugSpawnEntityActionHandler(debugContext));
    return registry;
}

