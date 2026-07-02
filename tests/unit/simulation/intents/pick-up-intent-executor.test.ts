/**
 * Тесты исполнителя интента PICK_UP.
 */

import { describe, it, expect } from 'vitest';
import { ExecutionBuilder } from '@simulation/systems/actions/types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { makeGameState, makePlayer, makeEnemy, makeFloorItemContainer } from '../../../fixtures/gameState';
import type { Entity, EntityId } from '@simulation/types';

describe('executePickUpIntent', () => {
  it('поднимает FloorItemContainerEntity: добавляет предмет в инвентарь игрока и удаляет контейнер с пола', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const container = makeFloorItemContainer({ x: 5, y: 5, id: 'potion_container' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [container.id, container],
      ]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: container.id },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: 'player', itemId: container.id, templateId: container.item.templateId },
      builder,
      builder.root,
    );

    expect(node).not.toBeNull();
    expect(state.entities.has(container.id)).toBe(false);
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0]).toBe(container.item);

    expect(node!.event).toEqual({
      type: 'ITEM_PICKED_UP',
      entityId: 'player',
      itemInstanceId: container.item.instanceId,
      templateId: container.item.templateId,
    });
  });

  it('возвращает null, если предмет отсутствует на полу', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: 'player', targetId: 'missing_item' },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: 'player', itemId: 'missing_item', templateId: 'health_potion' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('возвращает null, если актор не является игроком', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const container = makeFloorItemContainer({ x: 5, y: 5, id: 'potion_container' });
    const state = makeGameState({
      entities: new Map<EntityId, Entity>([
        [enemy.id, enemy],
        [container.id, container],
      ]),
    });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'INTERACT', entityId: enemy.id, targetId: container.id },
    });

    const node = executeIntent(
      state,
      { type: 'PICK_UP', entityId: enemy.id, itemId: container.id, templateId: container.item.templateId },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
