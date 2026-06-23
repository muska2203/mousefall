import { GameState } from '@simulation/types';
import { BumpIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';

/**
 * Исполняет интент столкновения BUMP.
 *
 * Это декларативный «визуальный» intent: он не мутирует состояние мира,
 * а только порождает событие ENTITY_BUMPED, которое Presentation превращает
 * в анимацию отскока. Такой intent допустим, когда нужно явно выразить
 * визуальный эффект в дереве ExecutionNode, не добавляя логики в Simulation.
 */
export const executeBumpIntent: IntentExecutor<BumpIntent> = (
  state: GameState,
  intent: BumpIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  return builder.addChild(parent, {
    type: 'ENTITY_BUMPED',
    entityId: intent.entityId,
    position: intent.position,
    dx: intent.dx,
    dy: intent.dy,
  });
};
