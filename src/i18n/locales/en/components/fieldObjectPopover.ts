import type {ComponentsFieldObjectPopoverTranslations} from '@i18n/schema';

export const enFieldObjectPopover = {
  damageLabel: 'Damage: ',
  hpLabel: 'HP: ',
  armorLabel: 'Armor: ',
  chargesLabel: 'Charges: ',
  skillsTitle: 'Skills',
  cooldownSuffix: ' turns',
  cooldownReady: 'Ready',
  possibleLootTitle: 'Possible Loot',
  preparingTitle: 'Preparing',
} as const satisfies ComponentsFieldObjectPopoverTranslations;
