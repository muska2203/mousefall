import {
    ActionPreview,
    Actor,
    EnemyEntity,
    Entity,
    GameState,
    Intent,
    PlayerEntity,
    Position,
    Simulation,
    SimulationResult,
    TurnPhase,
    ValidationError,
    ValidationResult
} from "@simulation/types.ts";
import {DefaultActionPointCostResolver, type ActionPointCostResolver} from "@simulation/systems/action-cost-resolver.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import { getSkillExecutor } from "@simulation/skills/skillExecutor";
import {runActionHandler} from "@simulation/systems/actions/action-utils.ts";
import {generateMap, createStairs} from "@simulation/systems/mapgen.ts";
import {MAX_FLOOR} from "@utils/constants.ts";
import {findAllAliveAiActors, isActor, createBoolGrid, findInteractableEntitiesAround} from "@simulation/state.ts";
import {isStunned} from "@simulation/systems/stun-helper.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";
import {attackEntity} from "@simulation/systems/actions/attack-action.ts";
import {waitEntity} from "@simulation/systems/actions/wait-action.ts";
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
import {createNewGameState, findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt, createInitialPlayer} from "@simulation/state.ts";
import {applyCharacterConfig, type CharacterConfig} from "@simulation/characterCreation.ts";
import {createStartingEquipment} from "@simulation/systems/starting-equipment.ts";
import {updateFOV} from "@simulation/systems/fov.ts";
import {
  getEffectiveDodgeChance,
  getEffectiveAccuracy,
  getEffectiveCritChance,
  getEffectiveCritMultiplier,
} from "@simulation/systems/stats/effective-stats.ts";
import { getEffectiveBaseStats } from "@simulation/systems/stats/base-resolver.ts";
import { recalculateActorStats } from "@simulation/systems/stats/recalculate.ts";
import { getWeaponDamage as calcWeaponDamage, getWeaponDamageEntries as calcWeaponDamageEntries } from "@simulation/systems/stats/weapon-formulas.ts";
import { initSkillRegistry } from "@simulation/skills/index.ts";
import { tryGetAbility, getItem } from "@content/registry";
import { addModifier } from "@simulation/systems/stats/modifier-engine.ts";
import { tickAllStatusEffects } from "@simulation/systems/status-effect-ticker.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";
import { resolveInteraction } from "@simulation/systems/interactions/resolve-interaction.ts";
import { findPath, posEqual } from "@utils/math.ts";

export {findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt};

export class GameSimulation implements Simulation {

    constructor(
        private state: GameState,
        private readonly actionHandlerRegistry: ActionHandlerRegistry,
        private readonly apCostResolver: ActionPointCostResolver = new DefaultActionPointCostResolver(),
        private readonly debugContext: DebugContext = { enabled: false },
    ) {}

    /**
     * Включить или выключить debug-режим для текущей симуляции.
     * Изменение применяется к уже зарегистрированным обработчикам.
     */
    setDebugEnabled(enabled: boolean): void {
        this.debugContext.enabled = enabled;
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
        const debugContext: DebugContext = { enabled: debugEnabled };
        return new GameSimulation(state, defaultActionHandlerRegistry(debugContext), new DefaultActionPointCostResolver(), debugContext);
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

        const phases: TurnPhase[] = [];

        const executionBuilder = new ExecutionBuilder({
            type: 'ACTION_APPLIED',
            action,
        });

        const root = executionBuilder.root;

        const actor = this.resolveActionActor(action);

        if (!actor) {
            return {
                success: false,
                stateChanged: false,
                phases: [{ side: 'PLAYER', actions: [root] }],
            };
        }

        const success = this.executeAction(
            actor,
            action,
            executionBuilder,
            root,
        );

        if (!success) {
            return {
                success: false,
                stateChanged: false,
                phases: [{ side: 'PLAYER', actions: [root] }],
            };
        }

        if (actor.id === this.state.player.id) {
            const fovEvents = updateFOV(this.state);
            for (const event of fovEvents) {
                executionBuilder.addChild(root, event);
            }
        }

        phases.push({ side: 'PLAYER', actions: [root] });

        if (this.isPlayerExhausted()) {
            this.endPlayerTurn(phases);
        }

        return {
            success: true,
            stateChanged: true,
            phases,
        };
    }

    getState(): Readonly<GameState> {
        return this.state;
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
            activeSide: 'PLAYER',
            round: 1,
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
        // Разрешено только действие WAIT (см. canActorAct), остальные отклонены выше.
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
    // ЗАВЕРШЕНИЕ ХОДА ИГРОКА
    // =========================================================

    private endPlayerTurn(
        phases: TurnPhase[],
    ): void {
        const playerTickNodes = this.runStatusTicks('player');
        if (playerTickNodes.length > 0) {
            phases.push({ side: 'STATUS_TICK', actions: playerTickNodes });
        }

        const envActions: ExecutionNode[] = [];

        // Фиксируем начало хода окружения.
        const envBeginBuilder = new ExecutionBuilder({
            type: 'TURN_BEGAN',
            side: 'ENVIRONMENT',
            round: this.state.turn.round,
            actorId: null,
        });
        executeIntent(this.state, { type: 'BEGIN_TURN', side: 'ENVIRONMENT' }, envBeginBuilder, envBeginBuilder.root);
        envActions.push(envBeginBuilder.root);

        this.runEnvironmentTurn(envActions);
        phases.push({ side: 'ENVIRONMENT', actions: envActions });

        const playerCastNode = this.beginNextPlayerTurn();
        if (playerCastNode) {
            phases.push({ side: 'PLAYER', actions: [playerCastNode] });
        }

        const tickNodes = this.runStatusTicks('environment');
        if (tickNodes.length > 0) {
            phases.push({ side: 'STATUS_TICK', actions: tickNodes });
        }
    }

    // =========================================================
    // ХОД ОКРУЖЕНИЯ
    // =========================================================

    private runEnvironmentTurn(
        actions: ExecutionNode[],
    ): void {

        const enemies = findAllAliveAiActors(this.state)

        for (const enemy of enemies) {

            const enemyEntity = enemy as EnemyEntity;

            // Подготовка хода врага: восстановление AP, тики кулдаунов и каста.
            const setupBuilder = new ExecutionBuilder({
                type: 'TURN_BEGAN',
                side: 'ENVIRONMENT',
                round: this.state.turn.round,
                actorId: enemy.id,
            });
            const setupRoot = setupBuilder.root;

            executeIntent(this.state, { type: 'RESTORE_AP', entityId: enemy.id }, setupBuilder, setupRoot);

            for (const ability of enemyEntity.abilities) {
                if (ability.currentCooldown > 0) {
                    executeIntent(
                        this.state,
                        { type: 'TICK_COOLDOWN', entityId: enemy.id, abilityId: ability.templateId },
                        setupBuilder,
                        setupRoot,
                    );
                }
            }

            actions.push(setupRoot);

            // Оглушённый враг пропускает ход и сбрасывает подготовку.
            if (isStunned(enemy)) {
                const prepared = cancelPreparedAbility(enemyEntity);
                const stunBuilder = new ExecutionBuilder({
                    type: 'ACTION_APPLIED',
                    action: { type: 'WAIT', entityId: enemy.id },
                });
                const stunNode = executeIntent(this.state, { type: 'SKIP_STUNNED_TURN', entityId: enemy.id }, stunBuilder, stunBuilder.root);
                if (prepared && stunNode) {
                    stunBuilder.addChild(stunNode, {
                        type: 'ABILITY_PREPARED_CANCELLED',
                        entityId: enemy.id,
                        abilityId: prepared.abilityId,
                        targets: prepared.targets,
                        from: { x: enemy.x, y: enemy.y },
                    });
                }
                actions.push(stunBuilder.root);
                continue;
            }

            const strategy = getStrategy(enemy.aiStrategyId);
            strategy.updateState?.(enemy, this.state);

            while (enemy.ap > 0) {
                // Builder создаётся до decideAction, потому что стратегия может
                // эмитить события (например, ABILITY_PREPARED) как side-effect.
                // Корневое событие заменяется на реальное действие после решения стратегии.
                const placeholderAction: GameAction = { type: 'WAIT', entityId: enemy.id };
                const builder = new ExecutionBuilder({
                    type: 'ACTION_APPLIED',
                    action: placeholderAction,
                });
                const root = builder.root;

                const action = strategy.decideAction(enemy, this.state, builder, root);

                // Подменяем placeholder на реальное действие перед исполнением.
                builder.root.event = { type: 'ACTION_APPLIED', action };

                const success = this.executeAction(
                    enemy,
                    action,
                    builder,
                    root,
                );

                if (success) {
                    actions.push(root);
                } else {
                    enemy.ap = 0;
                    break;
                }
            }
        }
    }

    private beginNextPlayerTurn(): ExecutionNode | null {

        // Подготовка хода игрока: смена стороны/раунда, тик каста, восстановление AP, тики кулдаунов.
        // Очистка мёртвых сущностей происходит через канонический интент.
        const setupBuilder = new ExecutionBuilder({
            type: 'TURN_BEGAN',
            side: 'PLAYER',
            round: this.state.turn.round + 1,
            actorId: this.state.player.id,
        });
        const setupRoot = setupBuilder.root;

        executeIntent(this.state, { type: 'CLEANUP_DEAD_ENTITIES' }, setupBuilder, setupRoot);

        executeIntent(this.state, { type: 'BEGIN_TURN', side: 'PLAYER' }, setupBuilder, setupRoot);

        executeIntent(this.state, { type: 'RESTORE_AP', entityId: this.state.player.id }, setupBuilder, setupRoot);

        // Уменьшение cooldown скиллов игрока
        for (const ability of this.state.player.abilities) {
            if (ability.currentCooldown > 0) {
                executeIntent(
                    this.state,
                    { type: 'TICK_COOLDOWN', entityId: this.state.player.id, abilityId: ability.templateId },
                    setupBuilder,
                    setupRoot,
                );
            }
        }

        return setupRoot.children.length > 0 ? setupRoot : null;
    }

    private runStatusTicks(phase: 'player' | 'environment'): ExecutionNode[] {
        const nodes: ExecutionNode[] = [];
        const tickResults = tickAllStatusEffects(this.state, phase);
        for (const { entity, intents } of tickResults) {
            for (const intent of intents) {
                const builder = new ExecutionBuilder({
                    type: 'STATUS_TICKED',
                    entityId: entity.id,
                    effectTypes: [],
                });
                executeIntent(this.state, intent, builder, builder.root);
                nodes.push(builder.root);
            }
        }
        return nodes;
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
            // Оглушённый актор может только завершить ход (WAIT).
            return action.type === 'WAIT';
        }

        if (this.state.turn.activeSide === 'PLAYER') {
            return actor.id === this.state.player.id;
        }

        return actor.id !== this.state.player.id;
    }

    private isPlayerExhausted(): boolean {
        return this.state.player.ap <= 0;
    }

    private resolveActionActor(
        action: GameAction,
    ): Actor | null {
        const entityId = (action as { entityId?: string }).entityId;
        if (!entityId) {
            return null;
        }

        const entity = this.state.entities.get(entityId);
        if (!entity || !isActor(entity)) {
            return null;
        }

        return entity;
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
            };
        } catch {
            return null;
        }
    }

    getWeaponDamage(player: PlayerEntity, weapon: ItemTemplate | null): number {
        return calcWeaponDamage(player, weapon);
    }

    getWeaponDamageEntries(player: PlayerEntity, weapon: ItemTemplate | null): ReturnType<typeof calcWeaponDamageEntries> {
        return calcWeaponDamageEntries(player, weapon);
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
    registry.register('WAIT', waitEntity);
    registry.register('USE_ABILITY', useAbilityAction);
    registry.register('EQUIP', equipEntity);
    registry.register('UNEQUIP', unequipEntity);
    registry.register('USE_ITEM', useItemAction);
    registry.register('INTERACT', interactAction);
    registry.register('DEBUG_ADD_ITEM', createDebugAddItemActionHandler(debugContext));
    registry.register('DEBUG_SPAWN_ENTITY', createDebugSpawnEntityActionHandler(debugContext));
    return registry;
}

