import type { ComponentsGameFieldTranslations } from '@i18n/schema';

export const ruGameField = {
  floorTitle: 'Уровень {{floor}}',
  skipTurnAriaLabel: 'Пропустить ход',
  playerPhaseLabel: 'Ход игрока',
  enemiesPhaseLabel: 'Ход врагов',
  alliesPhaseLabel: 'Ход союзников',
  neutralsPhaseLabel: 'Ход нейтралов',
  statusTickPhaseLabel: 'Тик статусов',
  roundRecoveryPhaseLabel: 'Восстановление раунда',
  skipTurnHoverLabel: 'Пропустить ход',
  gameFieldAriaLabel: 'Игровое поле',
} as const satisfies ComponentsGameFieldTranslations;
