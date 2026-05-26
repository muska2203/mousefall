import { GameState, Entity, StatusEffectHolder } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';

/**
 * Возвращает интент на тик статус-эффектов для сущности.
 * Не мутирует состояние — мутация происходит в IntentExecutor.
 */
export function tickEntityStatusEffects(entity: Entity): Intent[] {
  if (!('statusEffects' in entity)) return [];
  const holder = entity as unknown as StatusEffectHolder;
  if (holder.statusEffects.length === 0) return [];

  return [{ type: 'TICK_STATUS_EFFECTS', entityId: entity.id }];
}

/**
 * Возвращает массив кортежей [entity, intents] для последующего исполнения.
 */
export function tickAllStatusEffects(state: GameState): { entity: Entity; intents: Intent[] }[] {
  const results: { entity: Entity; intents: Intent[] }[] = [];

  // Игрок
  if (state.player.hp > 0) {
    const playerIntents = tickEntityStatusEffects(state.player);
    if (playerIntents.length > 0) {
      results.push({ entity: state.player, intents: playerIntents });
    }
  }

  // Враги
  for (const entity of state.entities.values()) {
    if (entity.type !== 'enemy') continue;
    if (!('isAlive' in entity) || !entity.isAlive) continue;
    const enemyIntents = tickEntityStatusEffects(entity);
    if (enemyIntents.length > 0) {
      results.push({ entity, intents: enemyIntents });
    }
  }

  return results;
}
