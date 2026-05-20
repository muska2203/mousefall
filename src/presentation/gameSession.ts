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

import type {GameEvent, GameState, Simulation, SimulationResult, ActionPreview, TurnSide} from '@simulation/types';
import type {ExecutionNode, GameAction} from '@simulation/systems/actions/types';
import {tryGetEntity} from '@simulation/content/registry';
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

export type LogItem = {
  id: number;
  text: string;
  variant?: 'loot' | 'good' | 'bad' | 'info';
};

export type GameViewModel = {
  /** Текущий режим экрана */
  mode: SessionMode;
  /** Состояние симуляции (null, если игра не начата) */
  state: Readonly<GameState> | null;
  /** Результат последнего dispatch (null, если ход ещё не совершён) */
  lastResult: SimulationResult | null;
  /** ID портрета выбранного героя (null, если не выбран) */
  portraitId: string | null;
  /** Журнал событий текущей сессии */
  logs: LogItem[];
};

export class GameSession {
  private simulation: Simulation | null = null;
  private mode: SessionMode = 'mainMenu';
  private lastResult: SimulationResult | null = null;
  private portraitId: string | null = null;
  private logs: LogItem[] = [];
  private nextLogId = 1;
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
        logs: this.logs,
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
  startNewGame(config: CharacterConfig, seed: number, mapParams: MapParams): void {
    this.simulation = GameSimulation.createNewGame(seed, config, mapParams);
    this.mode = 'playing';
    this.lastResult = null;
    this.portraitId = config.portraitId ?? null;
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

    const result = this.simulation.dispatch(action);
    this.lastResult = result;

    if (result.success && result.stateChanged) {
      const state = this.simulation.getState();
      const events = this.extractEvents(result);
      const newLogs: LogItem[] = [];
      for (const event of events) {
        const log = this.gameEventToLog(state, event);
        if (log) {
          newLogs.push(log);
        }
      }
      if (newLogs.length > 0) {
        this.logs = [...this.logs, ...newLogs].slice(-30);
      }
    }

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
    this.nextLogId = 1;
  }

  private extractEvents(result: SimulationResult): GameEvent[] {
    const events: GameEvent[] = [];
    for (const phase of result.phases) {
      for (const action of phase.actions) {
        this.walkExecutionTree(action, events, phase.side);
      }
    }
    return events;
  }

  private walkExecutionTree(node: ExecutionNode, out: GameEvent[], side: TurnSide): void {
    if (side === 'PLAYER' || this.isEventRelevantToPlayer(node.event)) {
      out.push(node.event);
    }
    for (const child of node.children) {
      this.walkExecutionTree(child, out, side);
    }
  }

  private isEventRelevantToPlayer(event: GameEvent): boolean {
    switch (event.type) {
      case 'ENTITY_DAMAGED':
        return event.targetId === 'player';
      case 'PLAYER_DIED':
        return true;
      default:
        return false;
    }
  }

  private gameEventToLog(state: GameState, event: GameEvent): LogItem | null {
    switch (event.type) {
      case 'ENTITY_MOVED': {
        const name = this.getEntityDisplayName(state, event.entityId);
        return {id: this.nextLogId++, text: `${name} переместился`, variant: 'info'};
      }
      case 'ENTITY_ATTACKED': {
        const name = this.getEntityDisplayName(state, event.attackerId);
        return {id: this.nextLogId++, text: `${name} атаковал`, variant: 'info'};
      }
      case 'ENTITY_DAMAGED': {
        const name = this.getEntityDisplayName(state, event.targetId);
        return {
          id: this.nextLogId++,
          text: `${name} получил ${event.damage} урона`,
          variant: event.targetId === 'player' ? 'bad' : 'good',
        };
      }
      case 'ENTITY_DIED': {
        const name = this.getEntityDisplayName(state, event.entityId);
        return {id: this.nextLogId++, text: `${name} погиб`, variant: 'bad'};
      }
      case 'PLAYER_DIED':
        return {id: this.nextLogId++, text: 'Герой погиб', variant: 'bad'};
      default:
        return null;
    }
  }

  private getEntityDisplayName(state: GameState, entityId: string): string {
    if (entityId === 'player') return 'Герой';
    const entity = state.entities.get(entityId);
    if (entity && 'templateId' in entity) {
      try {
        const template = tryGetEntity(entity.templateId);
        if (template?.name) return template.name;
      } catch {
        // Реестр не инициализирован — используем fallback
      }
    }
    return 'Враг';
  }
}
