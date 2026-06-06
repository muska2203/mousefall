import type { ComponentsGameFieldTranslations } from '@i18n/schema';

export const ruGameField = {
  floorTitle: 'Уровень {{floor}}',
  skipTurnAriaLabel: 'Пропустить ход',
  playerPhaseLabel: 'Ход игрока',
  skipTurnHoverLabel: 'Пропустить ход',
  gameFieldAriaLabel: 'Игровое поле',
} as const satisfies ComponentsGameFieldTranslations;
