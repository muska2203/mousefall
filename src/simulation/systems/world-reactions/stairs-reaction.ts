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
import {findStairsAt} from '@simulation/state';
import {MAX_FLOOR} from '@utils/constants';

export const stairsTransitionReaction: WorldReaction = (
    state,
    event,
    builder,
    parent,
) => {
    if (event.type !== 'ENTITY_MOVED') return [];

    // Реагируем только на обычное перемещение игрока (не на телепорт при смене этажа).
    if (event.movementType !== 'walk') return [];

    // Реагируем только на перемещение игрока
    if (event.entityId !== 'player') return [];

    const stairs = findStairsAt(state, event.to.x, event.to.y);
    if (!stairs) return [];

    const direction = stairs.templateId === 'stairs_down' ? 'down'
                    : stairs.templateId === 'stairs_up' ? 'up'
                    : null;
    if (!direction) return [];

    // Проверяем границы подземелья
    if (direction === 'down' && state.floor >= MAX_FLOOR) return [];
    if (direction === 'up' && state.floor <= 1) return [];

    // Порождаем интент, который исполнителем создаст событие STAIR_EXIT_TRIGGERED.
    // Сам переход между этажами выполняет Action handler DESCEND / ASCEND.
    return [{
        type: 'TRIGGER_STAIR_EXIT',
        direction,
    }];
};
