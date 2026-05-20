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

import type {GameState, Simulation, SimulationResult, ActionPreview} from '@simulation/types';
import type {GameAction} from '@simulation/systems/actions/types';
import {GameSimulation, findFirstAttackableEntityAt} from '@simulation/simulation';
import type {CharacterConfig} from '@simulation/characterCreation';
import type {MapParams} from '@simulation/schemas/contentSchemas';

// Реэкспорт типов для UI-слоя, чтобы UI не импортировал из simulation/ напрямую
export type {CharacterConfig} from '@simulation/characterCreation';
export type {MapParams} from '@simulation/schemas/contentSchemas';

export type SessionMode =
  | 'mainMenu'
  | 'characterCreation'
  | 'playing'
  | 'gameOver'
  | 'victory';

export type GameViewModel = {
  /** Текущий режим экрана */
  mode: SessionMode;
  /** Состояние симуляции (null, если игра не начата) */
  state: Readonly<GameState> | null;
  /** Результат последнего dispatch (null, если ход ещё не совершён) */
  lastResult: SimulationResult | null;
  /** ID портрета выбранного героя (null, если не выбран) */
  portraitId: string | null;
};

export class GameSession {
  private simulation: Simulation | null = null;
  private mode: SessionMode = 'mainMenu';
  private lastResult: SimulationResult | null = null;
  private portraitId: string | null = null;
  private listeners = new Set<() => void>();
  private viewModelCache: GameViewModel | null = null;

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
      this.viewModelCache = {
        mode: this.mode,
        state: this.simulation?.getState() ?? null,
        lastResult: this.lastResult,
        portraitId: this.portraitId,
      };
    }
    return this.viewModelCache;
  }

  /** Текущий режим экрана */
  getMode(): SessionMode {
    return this.mode;
  }

  /** Переход в экран создания персонажа */
  enterCharacterCreation(): void {
    this.mode = 'characterCreation';
    this.simulation = null;
    this.lastResult = null;
    this.portraitId = null;
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
  startNewGame(config: CharacterConfig, seed: number, mapParams: MapParams): void {
    this.simulation = GameSimulation.createNewGame(seed, config, mapParams);
    this.mode = 'playing';
    this.lastResult = null;
    this.portraitId = config.portraitId ?? null;
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

    const result = this.simulation.dispatch(action);
    this.lastResult = result;

    // После каждого хода проверяем, не закончилась ли игра
    const state = this.simulation.getState();
    if (state.phase === 'dead') {
      this.mode = 'gameOver';
    } else if (state.phase === 'victory') {
      this.mode = 'victory';
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

  /** Возврат в главное меню. Уничтожает текущую симуляцию. */
  returnToMenu(): void {
    this.simulation = null;
    this.mode = 'mainMenu';
    this.lastResult = null;
    this.portraitId = null;
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
}
