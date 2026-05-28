import {
    ActionPreview,
    Actor,
    DefaultActionPointCostResolver,
    GameState,
    Position,
    Simulation,
    SimulationResult,
    TurnPhase,
    ValidationError,
    ValidationResult
} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import { getSkillExecutor } from "@simulation/skills/skillExecutor";
import {runActionHandler} from "@simulation/systems/actions/action-utils.ts";
import {generateMap, createStairs} from "@simulation/systems/mapgen.ts";
import {MAX_FLOOR} from "@utils/constants.ts";
import {findAllAliveAiActors, isActor, cleanupDeadEntities} from "@simulation/state.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";
import {attackEntity} from "@simulation/systems/actions/attack-action.ts";
import {descendAction, ascendAction} from "@simulation/systems/actions/floor-transition-action.ts";
import {waitEntity} from "@simulation/systems/actions/wait-action.ts";
import {useAbilityAction} from "@simulation/systems/actions/use-ability-action.ts";
import {pickupEntity} from "@simulation/systems/actions/pickup-action.ts";
import {equipEntity} from "@simulation/systems/actions/equip-action.ts";
import {unequipEntity} from "@simulation/systems/actions/unequip-action.ts";
import {getStrategy} from "@simulation/ai/strategy-registry.ts";
import type {MapParams} from "@content/schemas";
import {createNewGameState, findFirstAttackableEntityAt, createInitialPlayer} from "@simulation/state.ts";
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
import { recalculatePlayerBaseStats } from "@simulation/systems/stats/recalculate.ts";
import { initSkillRegistry } from "@simulation/skills/index.ts";
import { tryGetAbility } from "@content/registry";
import { tickAllStatusEffects } from "@simulation/systems/status-effect-ticker.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";

export {findFirstAttackableEntityAt};

export class GameSimulation implements Simulation {

    private readonly apCostResolver =
        new DefaultActionPointCostResolver();

    constructor(
        private state: GameState,
        private readonly actionHandlerRegistry: ActionHandlerRegistry,
    ) {
    }

    /**
     * Фабрика новой игры.
     * Создаёт состояние, применяет конфиг персонажа, генерирует этаж и возвращает готовую симуляцию.
     */
    static createNewGame(
        seed: number,
        config: CharacterConfig,
        mapParams: MapParams,
    ): GameSimulation {
        const state = createNewGameState(seed, mapParams, config.templateId);
        applyCharacterConfig(state.player, config);
        createStartingEquipment(state, state.player, config.startingEquipment);
        const simulation = new GameSimulation(state, defaultActionHandlerRegistry());
        simulation.generateMap(mapParams);
        return simulation;
    }

    /**
     * Фабрика загруженной игры.
     * Оборачивает десериализованное состояние в симуляцию без повторной генерации карты.
     */
    static loadSavedGame(state: GameState): GameSimulation {
        return new GameSimulation(state, defaultActionHandlerRegistry());
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
        recalculatePlayerBaseStats(player);
        const effective = getEffectiveBaseStats(player);
        return {
            level: player.level,
            xp: player.xp,
            hp: player.hp,
            maxHp: player.maxHp,
            mp: player.mp,
            maxMp: player.maxMp,
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
            const envActions: ExecutionNode[] = [];

            this.runEnvironmentTurn(envActions);
            phases.push({ side: 'ENVIRONMENT', actions: envActions });

            this.beginNextPlayerTurn();

            const tickNodes = this.runStatusTicks();
            if (tickNodes.length > 0) {
                phases.push({ side: 'STATUS_TICK', actions: tickNodes });
            }
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
                        description:
                            `Game action ${action.type} not handled.`,
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
                        description:
                        validationResult.reasonDescription,
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

        // Лестницы
        if (generatedMap.stairsDown && this.state.floor < MAX_FLOOR) {
            this.state.entities.set(
                `stairs_down_${this.state.floor}`,
                createStairs(this.state, 'stairs_down', generatedMap.stairsDown.x, generatedMap.stairsDown.y),
            );
        }
        if (generatedMap.stairsUp && this.state.floor > 1) {
            this.state.entities.set(
                `stairs_up_${this.state.floor}`,
                createStairs(this.state, 'stairs_up', generatedMap.stairsUp.x, generatedMap.stairsUp.y),
            );
        }

        // Начальный расчёт поля зрения
        updateFOV(this.state);
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

        if (!this.canActorAct(actor)) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED',
                errors: [{ code: 'actor_cannot_act', description: 'Actor cannot act now' }],
            });
            return false;
        }

        const actionCost =
            this.apCostResolver.getCost(action);

        if (actor.ap < actionCost) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED',
                errors: [{ code: 'not_enough_ap', description: 'Not enough action points' }],
            });
            return false;
        }

        const handler =
            this.actionHandlerRegistry.get(action.type);

        if (!handler) {
            executionBuilder.addChild(parentNode, {
                type: 'ACTION_REJECTED',
                errors: [{ code: 'handler_not_found', description: `Game action ${action.type} not handled.` }],
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
                errors: [{ code: validation.reasonCode, description: validation.reasonDescription }],
            });
            return false;
        }

        executeIntent(this.state, { type: 'CONSUME_AP', entityId: actor.id, amount: actionCost }, executionBuilder, parentNode);

        return true;
    }

    // =========================================================
    // ХОД ОКРУЖЕНИЯ
    // =========================================================

    private runEnvironmentTurn(
        actions: ExecutionNode[],
    ): void {

        this.state.turn.activeSide =
            'ENVIRONMENT';

        const enemies = findAllAliveAiActors(this.state)

        for (const enemy of enemies) {

            enemy.ap = enemy.maxAp;

            // Уменьшение cooldown скиллов врага
            const enemyWithAbilities = enemy as import('@simulation/types').EnemyEntity;
            for (const ability of enemyWithAbilities.abilities) {
                if (ability.currentCooldown > 0) {
                    ability.currentCooldown -= 1;
                }
            }

            while (enemy.ap > 0) {

                const strategy = getStrategy(enemy.aiStrategyId);
                const action = strategy.decideAction(enemy, this.state);

                if (!action) {
                    enemy.ap = 0;
                    break;
                }

                const builder = new ExecutionBuilder({
                    type: 'ACTION_APPLIED',
                    action,
                });
                const root = builder.root;

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

    private beginNextPlayerTurn(): void {

        cleanupDeadEntities(this.state);

        this.state.turn.activeSide =
            'PLAYER';

        this.state.turn.round += 1;

        this.state.player.ap =
            this.state.player.maxAp;

        // Восстановление маны: 5% от максимума, минимум 1
        const mpRecovery = Math.max(1, Math.floor(this.state.player.maxMp * 0.05));
        this.state.player.mp = Math.min(this.state.player.mp + mpRecovery, this.state.player.maxMp);

        // Уменьшение cooldown скиллов игрока
        for (const ability of this.state.player.abilities) {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown -= 1;
            }
        }
    }

    private runStatusTicks(): ExecutionNode[] {
        const nodes: ExecutionNode[] = [];
        const tickResults = tickAllStatusEffects(this.state);
        for (const { entity, intents } of tickResults) {
            for (const intent of intents) {
                const builder = new ExecutionBuilder({
                    type: 'STATUS_TICKED',
                    entityId: entity.id,
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

    private canActorAct(actor: Actor): boolean {

        if (actor.ap <= 0) {
            return false;
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
            mp: p.mp,
            maxMp: p.maxMp,
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
        selectedTargets: Position[],
        hoveredTarget: Position | null,
    ) {
        const executor = getSkillExecutor(abilityId);
        if (!executor) return [];
        return executor.getAffectedPositions(this.state, this.state.player, selectedTargets, hoveredTarget);
    }

    getAbilityInfo(abilityId: string) {
        try {
            const template = tryGetAbility(abilityId);
            if (!template) return null;
            return {
                name: template.name,
                spriteId: template.spriteId,
                mpCost: template.mpCost,
                cooldown: template.cooldown,
            };
        } catch {
            return null;
        }
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

export function defaultActionHandlerRegistry(): ActionHandlerRegistry {
    initSkillRegistry();
    const registry = new ActionHandlerRegistry();

    registry.register('MOVE', moveEntity);
    registry.register('ATTACK', attackEntity);
    registry.register('WAIT', waitEntity);
    registry.register('DESCEND', descendAction);
    registry.register('ASCEND', ascendAction);
    registry.register('USE_ABILITY', useAbilityAction);
    registry.register('PICKUP', pickupEntity);
    registry.register('EQUIP', equipEntity);
    registry.register('UNEQUIP', unequipEntity);
    return registry;
}

