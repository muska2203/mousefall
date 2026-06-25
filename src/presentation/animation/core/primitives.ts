/**
 * Базовые анимационные примитивы.
 *
 * Ответственность:
 * - Создание AnimationNode для универсальных AnimationStep.
 * - Переиспользование базовых анимаций в builders и skill composers.
 */

import type { Entity, GameEvent } from '@simulation/types';
import type { AnimationNode, Position } from '@presentation/types';

// Конкретные типы событий выводим из union GameEvent, чтобы не зависеть от внутренних реэкспортов.
type EntityMovedEvent = Extract<GameEvent, { type: 'ENTITY_MOVED' }>;
type EntityDamagedEvent = Extract<GameEvent, { type: 'ENTITY_DAMAGED' }>;
type EntityDiedEvent = Extract<GameEvent, { type: 'ENTITY_DIED' }>;
type EntityBumpedEvent = Extract<GameEvent, { type: 'ENTITY_BUMPED' }>;
type ItemDroppedEvent = Extract<GameEvent, { type: 'ITEM_DROPPED' }>;
type FogUpdatedEvent = Extract<GameEvent, { type: 'FOG_UPDATED' }>;
type EntityHealedEvent = Extract<GameEvent, { type: 'ENTITY_HEALED' }>;
type CastCancelledEvent = Extract<GameEvent, { type: 'CAST_CANCELLED' }>;
type StatusAppliedEvent = Extract<GameEvent, { type: 'STATUS_APPLIED' }>;
type DoorOpenedEvent = Extract<GameEvent, { type: 'DOOR_OPENED' }>;
type DoorClosedEvent = Extract<GameEvent, { type: 'DOOR_CLOSED' }>;
type ActionAppliedEvent = Extract<GameEvent, { type: 'ACTION_APPLIED' }>;
export type AbilityEvent = Extract<GameEvent, { type: 'ABILITY_USED' | 'CAST_RESOLVED' }>;

/** Type guard: сущность имеет HP-бар (не предмет/лестница). */
export function isAttackableEntity(entity: Entity): entity is Extract<Entity, { hp: number }> {
  return 'hp' in entity && 'maxHp' in entity;
}

/** Создать узел перемещения. */
export function moveNode(event: EntityMovedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'MOVE',
      entityId: event.entityId,
      from: event.from,
      to: event.to,
    },
    children,
  };
}

/** Создать узел прыжка. */
export function jumpNode(event: EntityMovedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'JUMP',
      entityId: event.entityId,
      from: event.from,
      to: event.to,
    },
    children,
  };
}

/** Создать узел ближней атаки. */
export function attackNode(event: ActionAppliedEvent, children: AnimationNode[]): AnimationNode | null {
  const action = event.action;
  if (action.type !== 'ATTACK') return null;

  return {
    step: {
      type: 'ATTACK',
      attackerId: action.entityId,
      dx: action.dx,
      dy: action.dy,
    },
    children,
  };
}

/** Создать узел всплывающего урона. */
export function damageNode(event: EntityDamagedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'DAMAGE',
      targetId: event.targetId,
      amount: event.damage,
      damageType: event.damageType,
      position: event.position,
    },
    children,
  };
}

/** Создать узел изменения полоски HP. */
export function hpChangeNode(
  event: EntityDamagedEvent,
  target: Extract<Entity, { hp: number }>,
  children: AnimationNode[],
): AnimationNode {
  const toHp = target.hp;
  const fromHp = toHp + event.damage;

  return {
    step: {
      type: 'HP_CHANGE',
      entityId: event.targetId,
      fromHp,
      toHp,
      maxHp: target.maxHp,
      position: event.position,
    },
    children,
  };
}

/** Создать узел смерти сущности. */
export function deathNode(event: EntityDiedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'DEATH',
      entityId: event.entityId,
    },
    children,
  };
}

/** Создать узел обновления тумана войны. */
export function fogUpdateNode(event: FogUpdatedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'FOG_UPDATE',
      newlyVisible: event.newlyVisible,
    },
    children,
  };
}

/** Создать узел отскока о препятствие. */
export function bounceNode(event: EntityBumpedEvent): AnimationNode {
  return {
    step: {
      type: 'BOUNCE',
      entityId: event.entityId,
      x: event.position.x,
      y: event.position.y,
      dx: event.dx,
      dy: event.dy,
    },
    children: [],
  };
}

/** Создать узел падения предмета. */
export function itemDropNode(event: ItemDroppedEvent, children: AnimationNode[]): AnimationNode {
  return {
    step: {
      type: 'ITEM_DROP',
      itemId: event.itemInstanceId,
      position: event.position,
      from: event.from,
      templateId: event.templateId,
    },
    children,
  };
}

/** Создать узел всплывающего UI-текста. */
export function floatingTextNode(
  text: string | undefined,
  textKey: string | undefined,
  position: Position,
  styleKey: string,
): AnimationNode {
  return {
    step: {
      type: 'UI_FLOATING_TEXT',
      text,
      textKey,
      x: position.x,
      y: position.y,
      styleKey,
    },
    children: [],
  };
}

/** Создать узел каста способности. */
export function abilityCastNode(
  event: AbilityEvent,
  children: AnimationNode[],
): AnimationNode {
  return {
    step: {
      type: 'ABILITY_CAST',
      entityId: event.entityId,
      abilityId: event.abilityId,
      targets: event.targets,
      from: event.from,
    },
    children,
  };
}

/** Создать узел полёта снаряда. */
export function projectileNode(
  from: Position,
  to: Position,
  children: AnimationNode[],
): AnimationNode {
  return {
    step: { type: 'PROJECTILE', from, to },
    children,
  };
}

/** Создать узел взрыва. */
export function explosionNode(
  center: Position,
  radius: number,
  children: AnimationNode[],
): AnimationNode {
  return {
    step: { type: 'EXPLOSION', center, radius },
    children,
  };
}

/** Создать узел тряски тайлов. */
export function tileShakeNode(
  center: Position,
  radius: number,
  children: AnimationNode[] = [],
): AnimationNode {
  return {
    step: { type: 'TILE_SHAKE', center, radius },
    children,
  };
}

/** Создать узел статус-эффекта. */
export function statusBurstNode(
  entityId: string,
  position: Position,
  statusType: string,
  children: AnimationNode[],
): AnimationNode {
  return {
    step: {
      type: 'STATUS_BURST',
      entityId,
      position,
      statusType,
    },
    children,
  };
}

/** Создать узел лечения. */
export function healNode(event: EntityHealedEvent): AnimationNode {
  return floatingTextNode(
    `+${event.amount}`,
    undefined,
    event.position,
    'heal',
  );
}

/** Создать узел отмены каста. */
export function castCancelledNode(event: CastCancelledEvent): AnimationNode {
  return floatingTextNode(
    undefined,
    'system.animation.castInterrupted',
    event.from,
    'cast_cancel',
  );
}

/** Создать узел открытия двери. */
export function doorOpenedNode(event: DoorOpenedEvent): AnimationNode {
  return floatingTextNode(
    undefined,
    'system.animation.doorOpened',
    event.position,
    'info',
  );
}

/** Создать узел закрытия двери. */
export function doorClosedNode(event: DoorClosedEvent): AnimationNode {
  return floatingTextNode(
    undefined,
    'system.animation.doorClosed',
    event.position,
    'info',
  );
}

/** Общий узел статус-эффекта с позицией из состояния. */
export function statusBurstForEntity(
  entityId: string,
  entity: Entity | undefined,
  statusType: string,
  children: AnimationNode[],
): AnimationNode | null {
  if (!entity) return null;

  return statusBurstNode(
    entityId,
    { x: entity.x, y: entity.y },
    statusType,
    children,
  );
}
