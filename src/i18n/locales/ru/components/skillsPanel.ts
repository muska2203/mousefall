import type { ComponentsSkillsPanelTranslations } from '@i18n/schema';

export const ruSkillsPanel = {
  title: 'Скиллы',
  noSkills: 'Нет скиллов',
  equipmentSkillTooltip: 'Скилл от экипировки',
  levelupSkillTooltip: 'Скилл от прокачки',
  castPrefix: 'Каст ',
} as const satisfies ComponentsSkillsPanelTranslations;
