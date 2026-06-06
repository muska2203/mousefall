import type { ComponentsGameFieldTranslations } from '@i18n/schema';

export const enGameField = {
  floorTitle: 'Floor {{floor}}',
  skipTurnAriaLabel: 'Skip turn',
  playerPhaseLabel: 'Player turn',
  skipTurnHoverLabel: 'Skip turn',
  gameFieldAriaLabel: 'Game field',
} as const satisfies ComponentsGameFieldTranslations;
