/**
 * Система передвижения.
 *
 * Обрабатывает перемещение сущностей по сетке.
 * Bump-attack: при движении в клетку врага срабатывает бой вместо перемещения.
 * Автоподбор: при движении на предмет срабатывает подбор.
 *
 * Контракт: (state, entityId, dx, dy) → GameEvent[]
 * - Мутирует позицию state.player или врагов
 * - Возвращает события, описывающие произошедшее
 * - Возвращает [] для невалидных перемещений (без мутаций)
 */

/**
 * Переместить сущность на (dx, dy).
 *
 * Порядок разрешения:
 * 1. Вне границ / стена → нет операции, вернуть []
 * 2. Враг в целевой клетке → bump-атака, вернуть боевые события
 * 3. Предмет в целевой клетке → движение + подбор, вернуть события движения и подбора
 * 4. Пустой пол → движение, обновить FOV если игрок, вернуть события движения
 */

// TODO: Вынесено в movement-action.ts.
// export function moveEntity(
//   state: GameState,
//   entityId: EntityId,
//   dx: number,
//   dy: number,
// ): GameEvent[] {
//   const entity = entityId === PLAYER_ID
//     ? state.player
//     : state.enemies.find(e => e.id === entityId);
//
//   if (!entity) return [];
//
//   const newX = entity.x + dx;
//   const newY = entity.y + dy;
//
//   // Проверка границ + стена
//   if (isBlocked(state, newX, newY)) return [];
//
//   // Bump-атака: движение в клетку врага
//   const target = enemyAt(state, newX, newY);
//   if (target) {
//     // Только игрок может bump-атаковать врагов (враги используют combat.ts напрямую)
//     if (entityId === PLAYER_ID) {
//       // Player turn ends after attack
//       // TODO: Убрать
//       state.turn = 'ai';
//       return attackEntity(state, PLAYER_ID, target.id);
//     }
//     return []; // Enemies don't bump into each other
//   }
//
//   // Перемещение сущности
//   const from = { x: entity.x, y: entity.y };
//   entity.x = newX;
//   entity.y = newY;
//   const to = { x: newX, y: newY };
//
//   const events: GameEvent[] = [
//     { type: 'ENTITY_MOVED', entityId, from, to },
//   ];
//
//   // Специфично для игрока: обновить FOV, проверить подбор предмета, завершить ход
//   if (entityId === PLAYER_ID) {
//     // Обновление тумана войны
//     events.push(...updateFOV(state));
//
//     // Автоподбор предметов
//     const floorItem = itemAt(state, newX, newY);
//     if (floorItem) {
//       events.push(...pickupItem(state, PLAYER_ID, floorItem.id));
//     }
//
//     // Завершение хода игрока
//     state.turn = 'ai';
//   }
//
//   return events;
// }
