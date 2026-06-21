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
 * Тикает статусы у всех живых сущностей, способных их хранить (игрок, враги, двери и т.д.).
 */
export function tickAllStatusEffects(state: GameState): { entity: Entity; intents: Intent[] }[] {
  const results: { entity: Entity; intents: Intent[] }[] = [];

  for (const entity of state.entities.values()) {
    if (!('statusEffects' in entity)) continue;
    if ('isAlive' in entity && !entity.isAlive) continue;
    const intents = tickEntityStatusEffects(entity);
    if (intents.length > 0) {
      results.push({ entity, intents });
    }
  }

  return results;
}
