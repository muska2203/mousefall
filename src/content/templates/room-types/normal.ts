import type {RoomTypeTemplateInput} from '../../schemas';

/**
 * Обычная комната первого этажа (концепт floor-1-content-concept.md):
 * коты small/mid, редкое зелье, бочки с маслом, скрытые колючки, лужи масла/воды.
 * Числа черновые — баланс отдельным проходом (roadMap 1.4).
 */
export const normalRoom = {
  id: 'normal',
  kind: 'generated',
  minSize: 7,
  maxSize: 12,
  fill: {
    enemyPool: ['cat_small', 'cat_mid'],
    enemyDensity: 1,
    itemPool: ['health_potion'],
    itemDensity: 0.1,
    propPool: ['oil_barel'],
    propDensity: 0.15,
    trapPool: ['spikes'],
    trapDensity: 0.1,
    tileEffectPool: ['oil', 'water'],
    tileEffectDensity: 0.15,
  },
} satisfies RoomTypeTemplateInput;
