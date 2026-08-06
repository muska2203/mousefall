import type {ComponentsRelicsPanelTranslations} from '@i18n/schema';

export const enRelicsPanel = {
  title: 'Relics',
  listAriaLabel: 'Relic collection',
  stackCount: 'Stack: {{count}}',
} as const satisfies ComponentsRelicsPanelTranslations;
