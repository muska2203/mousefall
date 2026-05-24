/**
 * Оркестратор игровой сессии (Presentation Layer).
 *
 * Ответственность:
 * - Управление жизненным циклом симуляции: создание, загрузка, сброс.
 * - Перевод фазы игры (playing → gameOver / victory) в UI-режимы.
 * - Единственная точка входа для UI во взаимодействие с Simulation.
 *
 * Правила:
 * - Не содержит игровой логики (урон, движение, генерация — это Simulation).
 * - Не использует browser API (DOM, localStorage, fetch).
 * - Не импортирует UI.
 * - Все мутации GameState только через simulation.dispatch() или фабрики Simulation.
 */

import type {GameState, Simulation, SimulationResult, ActionPreview, GameEvent, PlayerStatsSnapshot} from '@simulation/types';
import type {ExecutionNode} from '@simulation/systems/actions/types';
import type {GameAction} from '@simulation/systems/actions/types';
import {GameSimulation, findFirstAttackableEntityAt} from '@simulation/simulation';
import type {CharacterConfig} from '@simulation/characterCreation';
import type {MapParams} from '@simulation/schemas/contentSchemas';
import type {AnimationNode, RenderInput} from './types';
import {buildAnimationTree} from './animationPlanner';
import {extractEvents, gameEventToLog} from './logBuilder';

// Реэкспорт типов для UI-слоя, чтобы UI не импортировал из simulation/ напрямую
export type {CharacterConfig} from '@simulation/characterCreation';
export type {MapParams} from '@simulation/schemas/contentSchemas';
export type {AnimationNode, RenderInput} from './types';
export type {RenderState} from './types';
export type {PlayerStatsSnapshot} from '@simulation/types';

export type SessionMode =
  | 'mainMenu'
  | 'characterCreation'
  | 'playing'
  | 'gameOver'
  | 'victory';

export type LogItem = {
  id: number;
  text: string;
  variant?: 'loot' | 'good' | 'bad' | 'info';
};

export type GameViewModel = {
  /** Текущий режим экрана */
  mode: SessionMode;
  /** Входные данные для renderer и HUD (null, если игра не начата) */
  renderInput: RenderInput | null;
  /** Журнал событий текущей сессии */
  logs: LogItem[];
};

export class GameSession {
  private simulation: Simulation | null = null;
  private mode: SessionMode = 'mainMenu';
  private lastResult: SimulationResult | null = null;
  private portraitId: string | null = null;
  private logs: LogItem[] = [];
  private nextLogId = {value: 1};
  private listeners = new Set<() => void>();
  private viewModelCache: GameViewModel | null = null;
  /** Фаза отрисовки: idle — можно вводить, animating — идут анимации. */
  private renderPhase: 'idle' | 'animating' | 'gameOver' = 'idle';
  private cameraZoom = 1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 3;
  /** Удерживаемое направление движения (для автохода при зажатой клавише). */
  private heldDirection: {dx: number; dy: number} | null = null;
  /** Ожидающий автоматический переход по лестнице (после завершения анимаций). */
  private pendingAutoTransition: {direction: 'down' | 'up'} | null = null;

  /** Подписаться на изменения сессии. Вызывается после любого mutate-метода. */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    this.viewModelCache = null;
    for (const cb of this.listeners) {
      cb();
    }
  }

  /** Текущий ViewModel для отрисовки UI. Кешируется между нотификациями для useSyncExternalStore. */
  getViewModel(): GameViewModel {
    if (!this.viewModelCache) {
      const state = this.simulation?.getState() ?? null;
      this.viewModelCache = {
        mode: this.mode,
        renderInput: state ? this.buildRenderInput(state) : null,
        logs: this.logs,
      };
    }
    return this.viewModelCache;
  }

  private buildRenderInput(state: Readonly<GameState>): RenderInput {
    return {
      state,
      portraitId: this.portraitId,
      highlightedPath: null,
      animations: this.lastResult ? buildAnimationTree(this.lastResult) : null,
      phase: this.renderPhase,
      zoom: this.cameraZoom,
      playerStats: this.simulation!.getPlayerStats(),
    };
  }

  /** Изменить масштаб камеры на дельту. */
  setZoom(delta: number): void {
    const factor = 1 + delta;
    this.cameraZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraZoom * factor));
    this.notify();
  }

  /** Сбросить масштаб к 1. */
  resetZoom(): void {
    this.cameraZoom = 1;
    this.notify();
  }

  /** Текущий режим экрана */
  getMode(): SessionMode {
    return this.mode;
  }

  /**
   * Предпросмотр характеристик персонажа при создании.
   * Не требует активной симуляции.
   */
  static previewCharacterStats(
    config: Omit<CharacterConfig, 'portraitId'>,
  ): PlayerStatsSnapshot {
    return GameSimulation.previewCharacterStats(config);
  }

  /** Переход в экран создания персонажа */
  enterCharacterCreation(): void {
    this.mode = 'characterCreation';
    this.simulation = null;
    this.lastResult = null;
    this.portraitId = null;
    this.renderPhase = 'idle';
    this.clearLogs();
    this.notify();
  }

  /**
   * Начало новой игры.
   *
   * Фабрика GameSimulation.createNewGame инкапсулирует:
   * - создание начального GameState
   * - применение конфига персонажа
   * - генерацию этажа
   *
   * Presentation не мутирует GameState напрямую.
   */
  startNewGame(config: CharacterConfig, seed: number): void {
    const defaultMapParams: MapParams = {
      id: 'floor_1',
      height: 20,
      width: 20,
      minRooms: 5,
      maxRooms: 20,
      minRoomSize: 3,
      maxRoomSize: 4,
      enemyDensity: 1.0,
      itemDensity: 0.1,
      enemyPool: ['cat_small', 'cat_mid', 'cat_big'],
      itemPool: ['health_potion'],
    };
    this.simulation = GameSimulation.createNewGame(seed, config, defaultMapParams);
    this.mode = 'playing';
    this.lastResult = null;
    this.portraitId = config.portraitId ?? null;
    this.renderPhase = 'idle';
    this.clearLogs();
    this.notify();
  }

  /**
   * Загрузка существующего сохранения.
   *
   * Ожидает уже десериализованный GameState.
   * Десериализация (JSON → GameState) — ответственность вызывающего (Presentation-level helper или UI).
   */
  loadGame(state: GameState): void {
    this.simulation = GameSimulation.loadSavedGame(state);
    this.mode = this.resolveModeFromPhase(state.phase);
    this.lastResult = null;
    this.renderPhase = this.mode === 'playing' ? 'idle' : 'gameOver';
    this.clearLogs();
    this.notify();
  }

  /** Выполнить игровое действие */
  dispatch(action: GameAction): void {
    if (!this.simulation) {
      throw new Error('Cannot dispatch: simulation not initialized');
    }
    if (this.mode !== 'playing') {
      throw new Error(`Cannot dispatch in mode: ${this.mode}`);
    }
    if (this.renderPhase === 'animating') {
      // Игнорируем ввод, пока идут анимации
      return;
    }

    const result = this.simulation.dispatch(action);
    this.lastResult = result;

    if (result.success && result.stateChanged) {
      const state = this.simulation.getState();
      const events = extractEvents(result);
      const newLogs: LogItem[] = [];
      for (const event of events) {
        const log = gameEventToLog(state, event, this.nextLogId);
        if (log) {
          newLogs.push(log);
        }
      }
      if (newLogs.length > 0) {
        this.logs = [...this.logs, ...newLogs].slice(-30);
      }

      // Проверяем, не обнаружена ли лестница — нужен ли авто-переход
      const stairTrigger = this.findStairExitTriggered(result);
      if (stairTrigger) {
        this.pendingAutoTransition = stairTrigger;
      }

      // Строим дерево анимаций из дерева событий
      const animations = buildAnimationTree(result);
      if (animations.length > 0) {
        this.renderPhase = 'animating';
      } else if (this.pendingAutoTransition) {
        // Анимаций нет — можно сразу выполнить transition
        const pending = this.pendingAutoTransition;
        this.pendingAutoTransition = null;
        const transitionAction: GameAction =
          pending.direction === 'down'
            ? {type: 'DESCEND', entityId: 'player'}
            : {type: 'ASCEND', entityId: 'player'};
        this.dispatch(transitionAction);
        return;
      }
    } else {
      // При неудачном ходе сбрасываем анимации
      this.lastResult = null;
    }

    // После каждого хода проверяем, не закончилась ли игра
    const state = this.simulation.getState();
    if (state.phase === 'dead') {
      this.mode = 'gameOver';
      this.renderPhase = 'gameOver';
    } else if (state.phase === 'victory') {
      this.mode = 'victory';
      this.renderPhase = 'gameOver';
    }
    this.notify();
  }

  /** Превью действия (для подсветки пути, подсказок урона и т.д.) */
  preview(action: GameAction): ActionPreview {
    if (!this.simulation) {
      return {
        valid: false,
        intents: [],
        errors: [{code: 'no_simulation', description: 'Simulation not initialized'}],
      };
    }
    return this.simulation.preview(action);
  }

  /**
   * Перемещение или атака в направлении (dx, dy).
   *
   * Логика:
   * - Смотрит на соседнюю клетку от игрока.
   * - Если там есть атакуемая сущность — вызывает ATTACK.
   * - Иначе — вызывает MOVE.
   *
   * Это Presentation-level routing: UI передаёт только направление,
   * Presentation решает, какое действие выполнить, основываясь на состоянии.
   */
  moveOrAttack(dx: number, dy: number): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }

    const state = this.simulation.getState();
    const targetX = state.player.x + dx;
    const targetY = state.player.y + dy;

    const target = findFirstAttackableEntityAt(state, targetX, targetY);

    const action: GameAction =
      target && target.id !== state.player.id
        ? {type: 'ATTACK', entityId: state.player.id, dx, dy}
        : {type: 'MOVE', entityId: state.player.id, dx, dy};

    this.dispatch(action);
  }

  /** Задать удерживаемое направление движения. */
  setHeldDirection(dx: number, dy: number): void {
    this.heldDirection = {dx, dy};
    if (this.renderPhase === 'idle' && this.mode === 'playing') {
      this.moveOrAttack(dx, dy);
    }
  }

  /** Сбросить удерживаемое направление. */
  clearHeldDirection(): void {
    this.heldDirection = null;
  }

  /** Сигнал от UI: все анимации завершены. Разрешаем следующий ввод. */
  onAnimationsComplete(): void {
    const hadAnimations = this.renderPhase === 'animating';
    if (hadAnimations) {
      this.renderPhase = 'idle';
      this.lastResult = null; // сбрасываем анимации, чтобы не воспроизводить повторно
    }

    // Автоматический переход по лестнице после завершения анимаций
    if (this.pendingAutoTransition && this.renderPhase === 'idle' && this.mode === 'playing') {
      const pending = this.pendingAutoTransition;
      this.pendingAutoTransition = null;
      const transitionAction: GameAction =
        pending.direction === 'down'
          ? {type: 'DESCEND', entityId: 'player'}
          : {type: 'ASCEND', entityId: 'player'};
      this.dispatch(transitionAction);
      return;
    }

    if (this.heldDirection && this.renderPhase === 'idle' && this.mode === 'playing') {
      this.moveOrAttack(this.heldDirection.dx, this.heldDirection.dy);
    } else if (hadAnimations) {
      this.notify();
    }
  }

  /** Возврат в главное меню. Уничтожает текущую симуляцию. */
  returnToMenu(): void {
    this.simulation = null;
    this.mode = 'mainMenu';
    this.lastResult = null;
    this.portraitId = null;
    this.renderPhase = 'idle';
    this.clearLogs();
    this.notify();
  }

  private resolveModeFromPhase(phase: GameState['phase']): SessionMode {
    switch (phase) {
      case 'playing':
        return 'playing';
      case 'dead':
        return 'gameOver';
      case 'victory':
        return 'victory';
    }
  }

  private clearLogs(): void {
    this.logs = [];
    this.nextLogId.value = 1;
  }

  /**
   * Ищет событие STAIR_EXIT_TRIGGERED в дереве ExecutionNode.
   * Если найдено — возвращает направление для авто-перехода.
   */
  private findStairExitTriggered(result: SimulationResult): {direction: 'down' | 'up'} | null {
    for (const phase of result.phases) {
      for (const action of phase.actions) {
        const found = this.findStairExitInNode(action);
        if (found) return found;
      }
    }
    return null;
  }

  private findStairExitInNode(node: ExecutionNode): {direction: 'down' | 'up'} | null {
    const event = node.event as GameEvent;
    if (event.type === 'STAIR_EXIT_TRIGGERED') {
      return { direction: event.direction };
    }
    for (const child of node.children) {
      const found = this.findStairExitInNode(child);
      if (found) return found;
    }
    return null;
  }

}
