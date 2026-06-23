import { GameState, Entity, StatusEffectHolder } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';

/**
 * Возвращает интент на тик статус-эффектов для сущности в заданной фазе.
 * Не мутирует состояние — мутация происходит в IntentExecutor.
 * Если у сущности нет эффектов, подходящих под фазу, интент не возвращается.
 */
export function tickEntityStatusEffects(entity: Entity, phase: 'player' | 'environment' = 'environment'): Intent[] {
  if (!('statusEffects' in entity)) return [];
  const holder = entity as unknown as StatusEffectHolder;
  if (holder.statusEffects.length === 0) return [];

  // Оглушение тикает отдельно в skipStunnedActorTurn, здесь его пропускаем.
  const hasTickableEffect = holder.statusEffects.some(
    effect => effect.type !== 'stunned' && (effect.tickAfter ?? 'environment') === phase,
  );
  if (!hasTickableEffect) return [];

  return [{ type: 'TICK_STATUS_EFFECTS', entityId: entity.id, phase }];
}

/**
 * Возвращает массив кортежей [entity, intents] для последующего исполнения.
 * Тикает статусы у всех живых сущностей, способных их хранить (игрок, враги, двери и т.д.).
 * Для каждой сущности возвращает интент только если у неё есть хотя бы один эффект,
 * соответствующий указанной фазе.
 */
export function tickAllStatusEffects(
  state: GameState,
  phase: 'player' | 'environment' = 'environment',
): { entity: Entity; intents: Intent[] }[] {
  const results: { entity: Entity; intents: Intent[] }[] = [];

  for (const entity of state.entities.values()) {
    if (!('statusEffects' in entity)) continue;
    if ('isAlive' in entity && !entity.isAlive) continue;
    const intents = tickEntityStatusEffects(entity, phase);
    if (intents.length > 0) {
      results.push({ entity, intents });
    }
  }

  return results;
}
