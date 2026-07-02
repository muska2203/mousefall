/**
 * Контроллер автопути игрока (Presentation Layer).
 *
 * Ответственность:
 * - Построение preview-пути при наведении на тайл.
 * - Фиксация автопути по клику.
 * - Пошаговое выполнение и актуализация пути после каждого хода.
 * - Отслеживание перемещения целевой сущности (враг, дверь, предмет, лестница).
 * - Замена последнего шага на атаку / открытие двери / поднятие предмета.
 *
 * Правила:
 * - Не мутирует GameState.
 * - Все решения о проходимости делегируются внешним query-функциям (публичный API Simulation).
 */

import type { Entity, GameAction, GameState, Position } from '@simulation/types';
import { chebyshevDistance } from '@utils/math';
import { findPathTowards, isTileExplored } from './pathfinding';
import type { AutoPathTarget, AutoPathTargetKind } from './pathfinding';

/** Query-зависимости, которые предоставляет Simulation через публичный API. */
export type AutoPathQueries = {
  /** Проверяет проходимость тайла для игрока (с учётом видимости). */
  isTileWalkable: (pos: Position) => boolean;
  /** Ищет путь к целевой сущности. */
  findPathTowards: (start: Position, target: AutoPathTarget) => Position[] | null;
  /** Возвращает первую сущность на тайле, удовлетворяющую фильтру. */
  findEntityAt: (pos: Position, filter?: (entity: Entity) => boolean) => Entity | null;
  /** Возвращает все сущности на тайле, удовлетворяющие фильтру. */
  findEntitiesAt: (pos: Position, filter?: (entity: Entity) => boolean) => Entity[];
};

/** Причина отмены автопути, которую должен обработать Presentation. */
export type AutoPathCancelReason = 'new_enemy';

/** Результат одного шага автопути: действие или отмена пути. */
export type AutoPathStepResult =
  | { kind: 'action'; action: GameAction }
  | { kind: 'cancelled'; reason?: AutoPathCancelReason };

export class AutoPathController {
  /** Целевой объект зафиксированного или preview-автопути. */
  private target: AutoPathTarget | null = null;

  /** Текущий путь от позиции игрока до цели (не включает стартовую клетку). */
  private path: Position[] | null = null;

  /** Зафиксирован ли путь (клик мыши). */
  private committed = false;

  /** ID видимых врагов на момент предыдущего шага. null — шагов ещё не было. */
  private lastVisibleEnemyIds: Set<string> | null = null;

  /**
   * Обновить preview-путь при наведении на тайл.
   * Если путь уже зафиксирован, hover его не меняет.
   */
  hover(target: AutoPathTarget | null, state: GameState, queries: AutoPathQueries): void {
    if (this.committed) return;

    if (!target || !isTileExplored(state, target.position)) {
      this.target = null;
      this.path = null;
      return;
    }

    this.target = target;
    const start = { x: state.player.x, y: state.player.y };
    this.path = queries.findPathTowards(start, target);
  }

  /**
   * Зафиксировать текущий preview-путь как автопуть.
   * Возвращает true, если цель задана и путь валиден.
   * Пустой путь допускается, если игрок уже стоит у целевой сущности
   * (например, на клетке с предметом или лестницей).
   */
  commit(): boolean {
    if (!this.target || this.path === null) {
      this.cancel();
      return false;
    }
    if (this.path.length === 0 && this.target.kind === 'move') {
      this.cancel();
      return false;
    }
    this.committed = true;
    return true;
  }

  /** Отменить автопуть (hover и committed). */
  cancel(): void {
    this.target = null;
    this.path = null;
    this.committed = false;
    this.lastVisibleEnemyIds = null;
  }

  /** Возвращает true, если есть активный preview или зафиксированный путь. */
  isActive(): boolean {
    return this.path !== null && this.path.length > 0;
  }

  /** Возвращает true, если путь зафиксирован. */
  isCommitted(): boolean {
    return this.committed;
  }

  /** Текущий путь (null, если пути нет). */
  getPath(): Position[] | null {
    return this.path;
  }

  /** Целевой объект (null, если путь не задан). */
  getTarget(): AutoPathTarget | null {
    return this.target;
  }

  /** Вид текущей цели или 'move', если цели нет. */
  getTargetKind(): AutoPathTargetKind {
    return this.target?.kind ?? 'move';
  }

  /**
   * Выполнить следующий шаг автопути.
   * Перестраивает путь от текущей позиции игрока и отслеживает целевую сущность.
   *
   * Возвращает действие для выполнения или признак отмены пути, если:
   * - путь не зафиксирован;
   * - целевая сущность мертва / исчезла;
   * - путь больше не может быть проложен;
   * - следующая клетка занята видимым препятствием;
   * - после предыдущего шага появился новый видимый враг.
   */
  step(state: GameState, queries: AutoPathQueries): AutoPathStepResult {
    if (!this.committed || !this.target) {
      this.cancel();
      return { kind: 'cancelled' };
    }

    // Если после предыдущего шага появился новый видимый враг — отменяем путь.
    const currentVisibleEnemyIds = this.getVisibleEnemyIds(state);
    if (this.lastVisibleEnemyIds !== null) {
      for (const id of currentVisibleEnemyIds) {
        if (!this.lastVisibleEnemyIds.has(id)) {
          this.cancel();
          return { kind: 'cancelled', reason: 'new_enemy' };
        }
      }
    }
    this.lastVisibleEnemyIds = currentVisibleEnemyIds;

    // Если цель привязана к сущности — актуализируем её позицию.
    // Цель отменяется, если сущность исчезла или явно мертва (для тех, у кого есть isAlive).
    if (this.target.entityId !== null) {
      const entity = state.entities.get(this.target.entityId);
      if (!entity) {
        this.cancel();
        return { kind: 'cancelled' };
      }
      const isDead = 'isAlive' in entity && entity.isAlive === false;
      if (isDead) {
        this.cancel();
        return { kind: 'cancelled' };
      }
      this.target = {
        ...this.target,
        position: { x: entity.x, y: entity.y },
      };
    }

    const start = { x: state.player.x, y: state.player.y };
    const newPath = queries.findPathTowards(start, this.target);
    if (newPath === null) {
      this.cancel();
      return { kind: 'cancelled' };
    }

    this.path = newPath;

    const playerPos = { x: state.player.x, y: state.player.y };

    // Игрок уже стоит на целевой клетке — для интерактивных объектов
    // выполняем действие, для остальных отменяем путь.
    if (newPath.length === 0) {
      const action = this.buildInteractAction(state, queries);
      this.cancel();
      return action ? { kind: 'action', action } : { kind: 'cancelled' };
    }

    const next = newPath[0]!;
    const dx = next.x - state.player.x;
    const dy = next.y - state.player.y;

    // Если следующий шаг впритык к цели — заменяем ходьбу на взаимодействие.
    // Автопуть к активируемому/атакуемому объекту завершается после одного действия.
    if (chebyshevDistance(playerPos, this.target.position) === 1) {
      const action = this.buildAdjacentAction(state, queries);
      if (action) {
        this.cancel();
        return { kind: 'action', action };
      }
    }

    return {
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx,
        dy,
      },
    };
  }

  /** Возвращает ID видимых живых врагов в текущем состоянии. */
  private getVisibleEnemyIds(state: GameState): Set<string> {
    const ids = new Set<string>();
    for (const entity of state.entities.values()) {
      if (
        entity.type === 'enemy' &&
        entity.isAlive !== false &&
        state.visible[entity.y]?.[entity.x]
      ) {
        ids.add(entity.id);
      }
    }
    return ids;
  }

  /** Формирует действие, когда игрок стоит на клетке с интерактивным объектом. */
  private buildInteractAction(state: GameState, _queries: AutoPathQueries): GameAction | null {
    if (!this.target || this.target.kind !== 'interactable' || !this.target.entityId) {
      return null;
    }

    const entity = state.entities.get(this.target.entityId);
    if (!entity) return null;

    return {
      type: 'INTERACT',
      entityId: state.player.id,
      targetId: entity.id,
    };
  }

  /** Формирует действие, когда игрок впритык к цели. */
  private buildAdjacentAction(state: GameState, queries: AutoPathQueries): GameAction | null {
    if (!this.target) return null;

    const dx = this.target.position.x - state.player.x;
    const dy = this.target.position.y - state.player.y;

    switch (this.target.kind) {
      case 'enemy':
        return { type: 'ATTACK', entityId: state.player.id, dx, dy };
      case 'door': {
        const door = queries.findEntityAt(
          this.target.position,
          (e) => e.type === 'door' && e.isAlive !== false,
        );
        if (!door || door.type !== 'door') {
          // Дверь исчезла — отменяем путь.
          return null;
        }
        if (door.isOpen) {
          // Дверь уже открыта: заходим на её клетку.
          return { type: 'MOVE', entityId: state.player.id, dx, dy };
        }
        return {
          type: 'INTERACT',
          entityId: state.player.id,
          targetId: door.id,
        };
      }
      case 'interactable': {
        const entity = this.target.entityId ? state.entities.get(this.target.entityId) : null;
        if (!entity) return null;
        // Проходимые активируемые объекты (предметы, лестницы) требуют
        // сначала встать на их клетку, а уже потом активировать.
        // Возвращаем null, чтобы основная логика step сделала MOVE без
        // отмены автопути; активация произойдёт на следующем шаге.
        if (entity.blocksMovement === false) {
          return null;
        }
        return {
          type: 'INTERACT',
          entityId: state.player.id,
          targetId: entity.id,
        };
      }
      case 'move':
      default:
        return null;
    }
  }

}
