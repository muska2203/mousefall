import type { InteractionId } from '@simulation/types';

/**
 * Утилиты для формирования подсказок взаимодействия (Presentation Layer).
 *
 * Ответственность:
 * - Преобразование идентификатора взаимодействия (`interactionId`) в i18n-ключ.
 * - Определение приоритета автовыбора опции взаимодействия.
 *
 * Правила:
 * - Чистые функции, не зависят от состояния игры.
 * - Не содержат игровой логики — только маппинг для UI.
 */

/** Маппинг идентификаторов взаимодействий в i18n-ключи подсказок. */
const INTERACTION_HINT_KEYS: Record<InteractionId, string> = {
  open_door: 'components.interactionHint.openDoor',
  close_door: 'components.interactionHint.closeDoor',
  pickup: 'components.interactionHint.pickup',
  descend: 'components.interactionHint.descend',
  ascend: 'components.interactionHint.ascend',
};

/**
 * Возвращает i18n-ключ для подсказки взаимодействия.
 * Если идентификатор неизвестен — возвращает ключ по шаблону,
 * чтобы UI мог показать fallback-метку.
 */
export function getInteractionHintKey(interactionId: InteractionId): string {
  return INTERACTION_HINT_KEYS[interactionId] ?? 'components.interactionHint.unknown';
}

/** Приоритеты автовыбора опции взаимодействия: меньше — выше. */
const PRIORITIES: Record<InteractionId, number> = {
  pickup: 0,
  descend: 1,
  ascend: 1,
  open_door: 2,
  close_door: 2,
};

/**
 * Возвращает приоритет автовыбора для `interactionId`.
 * Неизвестные взаимодействия получают низший приоритет.
 */
export function getInteractionPriority(interactionId: InteractionId): number {
  return PRIORITIES[interactionId] ?? 99;
}
