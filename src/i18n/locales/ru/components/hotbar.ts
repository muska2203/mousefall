import type {ComponentsHotbarTranslations} from '@i18n/schema';

export const ruHotbar = {
  emptySlotAria: 'Слот быстрого доступа {{index}} (пусто)',
  occupiedSlotAria: 'Слот быстрого доступа {{index}}',
  toolbarAria: 'Панель быстрого доступа',
  skillTooltipApCost: 'AP: {{ap}}',
  skillTooltipCooldown: 'Кулдаун: {{current}} / {{max}} ходов',
  skillTooltipCastTime: 'Подготовка: {{turns}} ходов',
} as const satisfies ComponentsHotbarTranslations;
