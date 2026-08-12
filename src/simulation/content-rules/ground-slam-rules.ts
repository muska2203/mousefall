import type {ContentRule} from './types';

/**
 * Контентные правила способности «Удар по земле» (первый босс, Кот-Страж).
 */

/**
 * Оглушение выживших после Удара по земле.
 * Срабатывает на каждую цель, получившую урон с тегом идентичности способности
 * (`skill.ground_slam` добавляет исполнитель groundSlamSkill в DAMAGE-интенты).
 * Урон 0 (например, под «Глухой обороной») не мешает наложению — событие эмитится.
 */
export const groundSlamDazeRule: ContentRule = {
  id: 'ground_slam_daze',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['skill.ground_slam'],
  },
  // eventRole: 'source' обязателен: иначе владелец способности оглушал бы
  // сам себя при получении урона с этим тегом (прецедент — weapon_blunt_daze).
  conditions: [{ type: 'eventRole', role: 'source' }],
  effect: {
    type: 'applyStatus',
    statusType: 'dazed',
    duration: 2,
  },
  target: { type: 'eventTarget' },
  priority: 0,
};
