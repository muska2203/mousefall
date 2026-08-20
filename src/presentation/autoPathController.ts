/**
 * Контроллер автопути игрока (Presentation Layer).
 *
 * Ответственность:
 * - Построение preview-пути при наведении на тайл.
 * - Фиксация автопути по клику.
 * - Пошаговое выполнение и актуализация пути после каждого хода.
 * - Отслеживание перемещения целевой сущности (враг, дверь, предмет, лестница).
 * - Путь к врагу строится до ближайшей атакующей клетки, финал — позиционная
 *   атака по текущей позиции врага; замена последнего шага на открытие двери /
 *   поднятие предмета.
 *
 * Правила:
 * - Не мутирует GameState.
 * - Все решения о проходимости делегируются внешним query-функциям (публичный API Simulation).
 */

import type {DoorEntity, Entity, GameAction, GameState, Position} from '@simulation/types';
import {chebyshevDistance, posEqual} from '@utils/math';
import type {AutoPathTarget, AutoPathTargetKind} from './pathfinding';
import {isTileExplored} from './pathfinding';
import {buildPositionalAttackAction} from './actionBuilders';

/** Query-зависимости, которые предоставляет Simulation через публичный API. */
export type AutoPathQueries = {
  /** Проверяет проходимость тайла для игрока (с учётом видимости). */
  isTileWalkable: (pos: Position) => boolean;
  /**
   * Проверяет проходимость тайла для построения автопути.
   * Может разрешать проход через объекты, которые игрок откроет по пути
   * (например, закрытые двери).
   */
  isTilePassable: (pos: Position) => boolean;
  /** Ищет путь к целевой сущности. */
  findPathTowards: (start: Position, target: AutoPathTarget) => Position[] | null;
  /**
   * Ищет ближайшую к игроку атакующую клетку по цели-врагу и путь до неё
   * (см. Simulation.findNearestAttackPosition). Пустой путь означает, что
   * игрок уже может атаковать цель из текущей позиции; null — что атакующей
   * клетки нет (цель недосягаема текущим оружием).
   */
  findAttackPath: (target: Position) => { position: Position; path: Position[] } | null;
  /**
   * Проверяет, валидна ли сейчас направленная bump-атака по целевой клетке
   * (через `simulation.preview`): false, например, для дальнобойного оружия
   * (minRange > 1) в упор — такой bump Simulation гарантированно отклонит.
   */
  canBumpAttack: (target: Position) => boolean;
  /** Возвращает первую сущность на тайле, удовлетворяющую фильтру. */
  findEntityAt: (pos: Position, filter?: (entity: Entity) => boolean) => Entity | null;
  /** Возвращает все сущности на тайле, удовлетворяющие фильтру. */
  findEntitiesAt: (pos: Position, filter?: (entity: Entity) => boolean) => Entity[];
};

/** Причина отмены автопути, которую должен обработать Presentation. */
export type AutoPathCancelReason = 'new_enemy' | 'target_unreachable';

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
    this.path = this.findPathToTarget(start, target, queries);
  }

  /**
   * Построить путь к цели. Для врага — путь до ближайшей атакующей клетки
   * (findAttackPath), а не в клетку врага: финальный удар выполняется
   * позиционной атакой из атакующей клетки. Если атакующей клетки нет —
   * fallback на старое поведение (путь в клетку врага).
   */
  private findPathToTarget(
    start: Position,
    target: AutoPathTarget,
    queries: AutoPathQueries,
  ): Position[] | null {
    if (target.kind === 'enemy') {
      const attack = queries.findAttackPath(target.position);
      if (attack) return attack.path;
    }
    return queries.findPathTowards(start, target);
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
      const isDead = 'isAlive' in entity && !entity.isAlive;
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

    // Цель-враг: финал автопути — позиционная атака из текущей позиции игрока,
    // если она позволяет атаковать (оружие достаёт цель и есть LOS).
    // Проверка идёт на каждом шаге: враг отслеживается по entityId, его клетка
    // уже актуализирована выше.
    let attackPathUsed = false;
    let enemyAttackPath: Position[] | null = null;
    if (this.target.kind === 'enemy') {
      const attack = queries.findAttackPath(this.target.position);
      if (attack && attack.path.length === 0) {
        const action = buildPositionalAttackAction(state.player.id, start, this.target.position);
        this.cancel();
        return { kind: 'action', action };
      }
      attackPathUsed = attack !== null;
      enemyAttackPath = attack?.path ?? null;
    }

    // Для врага с найденной атакующей клеткой путь уже построен до неё;
    // иначе — старое поведение (путь в клетку цели, допускает непроходимую).
    const newPath = attackPathUsed
      ? enemyAttackPath
      : this.findPathToTarget(start, this.target, queries);
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

    // Если следующий тайл — закрытая дверь на пути (не сама цель-дверь),
    // открываем её, не отменяя автопуть. После открытия путь перестроится
    // и движение продолжится.
    const isTargetDoorItself = this.target.kind === 'door' && posEqual(next, this.target.position);
    if (!isTargetDoorItself) {
      const door = this.findClosedDoorOnPath(next, queries);
      if (door) {
        return {
          kind: 'action',
          action: {
            type: 'INTERACT',
            entityId: state.player.id,
            targetId: door.id,
          },
        };
      }
    }

    // Если следующий шаг впритык к цели — заменяем ходьбу на взаимодействие.
    // Автопуть к активируемому/атакуемому объекту завершается после одного действия.
    // Исключение — враг с найденной атакующей клеткой: bump-форма не подставляется
    // (для оружия с minRange > 1 она невалидна), финал — позиционная атака выше.
    if (!attackPathUsed && chebyshevDistance(playerPos, this.target.position) === 1) {
      // Враг впритык, атакующей клетки нет и bump-атака невалидна
      // (дальнобойное оружие в упор не бьёт) — не испускаем обречённый
      // ATTACK, а отменяем путь: Presentation покажет тост с причиной.
      if (this.target.kind === 'enemy' && !queries.canBumpAttack(this.target.position)) {
        this.cancel();
        return { kind: 'cancelled', reason: 'target_unreachable' };
      }
      const action = this.buildAdjacentAction(state, queries);
      if (action) {
        this.cancel();
        return { kind: 'action', action };
      }
    }

    const dx = next.x - state.player.x;
    const dy = next.y - state.player.y;

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
        entity.isAlive &&
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

  /**
   * Возвращает закрытую незапертую дверь на указанном тайле, если она является
   * единственным блокиратором. Если на клетке есть враг или другой объект,
   * блокирующий движение, дверь не считается проходом на пути.
   * Запертая дверь не открывается взаимодействием и не считается проходом.
   */
  private findClosedDoorOnPath(pos: Position, queries: AutoPathQueries): DoorEntity | null {
    const blockers = queries.findEntitiesAt(pos).filter((e) => e.blocksMovement);
    if (blockers.length !== 1) return null;

    const door = blockers[0];
    if (!door || door.type !== 'door' || !door.isAlive || door.isOpen || door.isLocked) return null;
    return door;
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
          (e) => e.type === 'door' && e.isAlive,
        );
        if (!door || door.type !== 'door') {
          // Дверь исчезла — отменяем путь.
          return null;
        }
        if (door.isOpen) {
          // Дверь уже открыта: заходим на её клетку.
          return { type: 'MOVE', entityId: state.player.id, dx, dy };
        }
        if (door.isLocked) {
          // Запертая дверь не открывается взаимодействием — INTERACT не подставляем.
          // Вернём null: основная логика step сделает MOVE, который Simulation
          // отклонит как tile_blocked, и автопуть будет отменён.
          return null;
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
        if (!entity.blocksMovement) {
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
