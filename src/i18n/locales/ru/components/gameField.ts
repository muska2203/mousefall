import type { ComponentsGameFieldTranslations } from '@i18n/schema';

export const ruGameField = {
  floorTitle: 'Уровень {{floor}}',
  skipTurnAriaLabel: 'Пропустить ход',
  playerPhaseLabel: 'Ход игрока',
  environmentPhaseLabel: 'Ход окружения',
  statusTickPhaseLabel: 'Тик статусов',
  skipTurnHoverLabel: 'Пропустить ход',
  gameFieldAriaLabel: 'Игровое поле',
} as const satisfies ComponentsGameFieldTranslations;
