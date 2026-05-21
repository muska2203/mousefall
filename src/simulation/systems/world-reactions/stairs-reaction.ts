/**
 * Реакция мира на перемещение игрока на лестницу.
 *
 * Архитектура:
 * - Срабатывает на событие ENTITY_MOVED.
 * - Если игрок наступил на лестницу — порождает STAIR_EXIT_TRIGGERED.
 * - Сам переход НЕ выполняется здесь; Presentation вызывает DESCEND/ASCEND action
 *   после завершения анимаций (или по нажатию клавиши > / <).
 * - Соблюдает границы подземелья (floor >= 1, floor <= MAX_FLOOR).
 */

import {WorldReaction} from './types';
import {EntityMovedEvent} from '@simulation/types';
import {findStairsAt} from '@simulation/state';
import {MAX_FLOOR} from '@utils/constants';

export const stairsTransitionReaction: WorldReaction<EntityMovedEvent> = (
    state,
    event,
    builder,
    parent,
) => {
    // Реагируем только на перемещение игрока
    if (event.entityId !== 'player') return;

    const stairs = findStairsAt(state, event.to.x, event.to.y);
    if (!stairs) return;

    // Проверяем границы подземелья
    if (stairs.direction === 'down' && state.floor >= MAX_FLOOR) return;
    if (stairs.direction === 'up' && state.floor <= 1) return;

    // Порождаем событие-запрос; сам переход делает Action handler
    builder.addChild(parent, {
        type: 'STAIR_EXIT_TRIGGERED',
        direction: stairs.direction,
    });
};
