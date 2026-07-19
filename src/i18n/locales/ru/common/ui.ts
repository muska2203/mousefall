import type {CommonUiTranslations} from '@i18n/schema';

export const ruCommonUi = {
  yes: 'Да',
  no: 'Нет',
  close: 'Закрыть',
  cancel: 'Отмена',
  unknownMode: 'Неизвестный режим: {{mode}}',
} as const satisfies CommonUiTranslations;
