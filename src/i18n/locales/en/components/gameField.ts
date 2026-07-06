import type { ComponentsGameFieldTranslations } from '@i18n/schema';

export const enGameField = {
  floorTitle: 'Floor {{floor}}',
  skipTurnAriaLabel: 'Skip turn',
  playerPhaseLabel: 'Player turn',
  enemiesPhaseLabel: 'Enemies turn',
  alliesPhaseLabel: 'Allies turn',
  neutralsPhaseLabel: 'Neutrals turn',
  statusTickPhaseLabel: 'Status tick',
  roundRecoveryPhaseLabel: 'Round recovery',
  environmentPhaseLabel: 'Environment turn',
  skipTurnHoverLabel: 'Skip turn',
  gameFieldAriaLabel: 'Game field',
} as const satisfies ComponentsGameFieldTranslations;
