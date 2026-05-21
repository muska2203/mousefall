import {
    ActionPreview,
    Actor,
    DefaultActionPointCostResolver,
    GameState,
    Simulation,
    SimulationResult,
    TurnPhase,
    ValidationError
} from "@simulation/types.ts";
import {ActionHandler, ExecutionBuilder, ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import {runActionHandler} from "@simulation/systems/actions/action-utils.ts";
import {generateMap, createStairs} from "@simulation/systems/mapgen.ts";
import {MAX_FLOOR} from "@utils/constants.ts";
import {findAllAliveAiActors} from "@simulation/state.ts";
import {moveEntity} from "@simulation/systems/actions/movement-action.ts";
import {attackEntity} from "@simulation/systems/actions/attack-action.ts";
import {descendAction, ascendAction} from "@simulation/systems/actions/floor-transition-action.ts";
import {getStrategy} from "@simulation/ai/strategy-registry.ts";
import type {MapParams} from "@simulation/schemas/contentSchemas.ts";
import {createNewGameState, findFirstAttackableEntityAt} from "@simulation/state.ts";
import {applyCharacterConfig, type CharacterConfig} from "@simulation/characterCreation.ts";
import {updateFOV} from "@simulation/systems/fov.ts";

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
        const state = createNewGameState(seed);
        applyCharacterConfig(state.player, config);
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

    generateMap(params?: MapParams): void {
        const mapParams: MapParams = params ?? {
            id: 'default',
            height: 20,
            width: 20,
            itemDensity: 0,
            enemyDensity: 1,
            enemyPool: ['cat_small', 'cat_mid', 'cat_big'],
            itemPool: [],
            maxRooms: 20,
            maxRoomSize: 4,
            minRoomSize: 2,
            minRooms: 5,
        };

        const generatedMap = generateMap(mapParams, this.state, this.state.floor, MAX_FLOOR);

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
                createStairs(this.state, 'down', generatedMap.stairsDown.x, generatedMap.stairsDown.y),
            );
        }
        if (generatedMap.stairsUp && this.state.floor > 1) {
            this.state.entities.set(
                `stairs_up_${this.state.floor}`,
                createStairs(this.state, 'up', generatedMap.stairsUp.x, generatedMap.stairsUp.y),
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
            return false;
        }

        const actionCost =
            this.apCostResolver.getCost(action);

        if (actor.ap < actionCost) {
            return false;
        }

        const handler =
            this.actionHandlerRegistry.get(action.type);

        if (!handler) {
            return false;
        }

        runActionHandler(
            this.state,
            handler as never,
            action as never,
            executionBuilder,
            parentNode,
        );

        actor.ap -= actionCost;

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

        this.state.turn.activeSide =
            'PLAYER';

        this.state.turn.round += 1;

        this.state.player.ap =
            this.state.player.maxAp;
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

        // ВАЖНО:
        // здесь лучше позже перейти
        // на action.actorId

        if (this.state.turn.activeSide === 'PLAYER') {
            return this.state.player;
        }

        return null;
    }
}

export class ActionHandlerRegistry {
    private readonly handlers = new Map<
        GameAction['type'],
        ActionHandler<any>
    >();

    register<T extends GameAction>(
        type: T['type'],
        handler: ActionHandler<T>,
    ): void {
        this.handlers.set(type, handler);
    }

    get<T extends GameAction['type']>(
        type: T,
    ): ActionHandler<Extract<GameAction, { type: T }>> | undefined {
        return this.handlers.get(type);
    }
}

export function defaultActionHandlerRegistry(): ActionHandlerRegistry {
    const registry = new ActionHandlerRegistry();

    registry.register('MOVE', moveEntity);
    registry.register('ATTACK', attackEntity);
    registry.register('DESCEND', descendAction);
    registry.register('ASCEND', ascendAction);
    return registry;
}

