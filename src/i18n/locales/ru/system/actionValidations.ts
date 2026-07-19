import type {SystemActionValidationsTranslations} from '@i18n/schema';

export const ruActionValidations = {
  itemNotFound: 'Предмет не найден в инвентаре',
  itemCannotEquip: 'Предмет нельзя экипировать',
  onlyPlayerCanTransition: 'Только игрок может переходить между этажами',
  cannotCloseDoorFromInside: 'Нельзя закрыть дверь, стоя на её клетке',
  slotEmpty: 'Слот пуст',
  itemCannotUse: 'Предмет нельзя использовать',
  itemEffectNotSupported: 'Эффект предмета "{{effect}}" не поддерживается',
} as const satisfies SystemActionValidationsTranslations;
