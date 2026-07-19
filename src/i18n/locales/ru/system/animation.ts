import type {SystemAnimationTranslations} from '@i18n/schema';

export const ruAnimation = {
  castInterrupted: 'Каст прерван',
  doorOpened: 'Дверь открыта',
  doorClosed: 'Дверь закрыта',
  abilityPrepared: 'Готовит',
  abilityPreparedCancelled: 'Подготовка прервана',
} as const satisfies SystemAnimationTranslations;
