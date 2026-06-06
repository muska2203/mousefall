import type { SystemActionValidationsTranslations } from '@i18n/schema';

export const ruActionValidations = {
  itemNotFound: 'Предмет не найден в инвентаре',
  itemCannotEquip: 'Предмет нельзя экипировать',
  onlyPlayerCanDescend: 'Только игрок может спускаться',
  noDescentHere: 'Здесь нет спуска вниз',
  bottomFloorReached: 'Достигнут нижний этаж подземелья',
  onlyPlayerCanAscend: 'Только игрок может подниматься',
  noAscentHere: 'Здесь нет подъёма вверх',
  alreadyOnSurface: 'Вы уже на поверхности',
  slotEmpty: 'Слот пуст',
  itemCannotUse: 'Предмет нельзя использовать',
  itemEffectNotSupported: 'Эффект предмета "{{effect}}" не поддерживается',
} as const satisfies SystemActionValidationsTranslations;
