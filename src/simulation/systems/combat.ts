/**
 * Система боя.
 *
 * Обрабатывает разрешение атаки, расчёт урона, смерть и выпадение лута.
 *
 * Контракт: (state, attackerId, targetId) → GameEvent[]
 * - Мутирует HP цели
 * - Удаляет мёртвые сущности из состояния
 * - Возвращает события, описывающие произошедшее
 */

import type {EnemyEntity, EntityId, GameEvent, GameState} from '../types';
import {findAttackableEntity, findAttacker} from '../state';
import {rngInt} from '../../utils/rng';
import {PLAYER_ID} from '../../utils/constants';

/**
 * Resolve an attack from attacker → target.
 *
 * Damage formula: max(1, attackerDamage - targetArmor) ± small variance
 * Death: target removed from state, loot dropped
 */
// export function attackEntity(
//   state: GameState,
//   attackerId: EntityId,
//   targetId: EntityId,
// ): GameEvent[] {
//   const events: GameEvent[] = [];
//
//   // Разрешение характеристик атакующего
//   const attackerDamage = attackerId === PLAYER_ID
//     ? getPlayerDamage(state)
//     : (findAttacker(state, attackerId)?.damage ?? 0);
//
//   // Разрешение цели
//   if (targetId === PLAYER_ID) {
//     // Enemy attacks player
//     const rawDamage = Math.max(1, attackerDamage - state.player.armor);
//     const damage = rawDamage + rngInt(state.rng, -1, 1); // ±1 variance
//     const finalDamage = Math.max(1, damage);
//
//     state.player.hp -= finalDamage;
//
//     events.push({
//       type: 'ENTITY_ATTACKED',
//       attackerId,
//       targetId: PLAYER_ID,
//       damage: finalDamage,
//     });
//
//     if (state.player.hp <= 0) {
//       state.player.hp = 0;
//       state.phase = 'dead';
//       events.push({
//         type: 'PLAYER_DIED',
//         cause: `killed by ${attackerId}`,
//       });
//     }
//
//     return events;
//   }
//
//   // Игрок атакует врага
//   const target = findAttackableEntity(state, targetId);
//   if (!target) return [];
//
//   const rawDamage = Math.max(1, attackerDamage - target.armor);
//   const damage = rawDamage + rngInt(state.rng, -1, 1);
//   const finalDamage = Math.max(1, damage);
//
//   target.hp -= finalDamage;
//
//   events.push({
//     type: 'ENTITY_ATTACKED',
//     attackerId,
//     targetId,
//     damage: finalDamage,
//   });
//
//   if (target.hp <= 0) {
//     target.hp = 0;
//     const deathPos = { x: target.x, y: target.y };
//
//     // Выпадение лута перед удалением врага
//     events.push(...dropLoot(state, target));
//
//     // Награждение опытом
//     state.player.xp += target.templateId ? 10 : 0; // TODO: read from template
//
//     // Удаление врага
//     state.enemies = state.enemies.filter(e => e.id !== targetId);
//
//     events.push({
//       type: 'ENTITY_DIED',
//       entityId: targetId,
//       position: deathPos,
//     });
//   }
//
//   return events;
// }
//
// // ─────────────────────────────────────────────
// // Вспомогательные функции
// // ─────────────────────────────────────────────
//
// /**
//  * Вычисляет общий урон игрока (базовый + бонус оружия).
//  */
// function getPlayerDamage(state: GameState): number {
//   // TODO: добавить бонус экипированного оружия из реестра контента
//   return state.player.damage;
// }
//
// /**
//  * Сбрасывает лут с мёртвого врага на пол.
//  * Таблица лута определяется в шаблоне сущности.
//  */
// function dropLoot(state: GameState, enemy: EnemyEntity): GameEvent[] {
//   // TODO: читать таблицу лута из реестра контента и бросать выпадение
//   // For now: no loot drops (skeleton implementation)
//   return [];
// }
