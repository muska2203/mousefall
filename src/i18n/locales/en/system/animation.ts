import type {SystemAnimationTranslations} from '@i18n/schema';

export const enAnimation = {
  castInterrupted: 'Cast interrupted',
  doorOpened: 'Door opened',
  doorClosed: 'Door closed',
  abilityPrepared: 'Preparing',
  abilityPreparedCancelled: 'Preparation interrupted',
  crit: 'Crit!',
} as const satisfies SystemAnimationTranslations;
