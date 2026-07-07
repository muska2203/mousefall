/**
 * Маппер: ItemTemplate (Content) → ItemDetailViewModel (UI).
 *
 * Ответственность Presentation:
 * - читать шаблон предмета из Content Registry
 * - локализовать типы и редкость
 * - превращать доменные поля (weapon/armor/consumable) в типизированные секции тултипа
 *
 * UI получает готовый ViewModel и не знает о существовании ItemTemplate.
 */

import type { LocalizedItemTemplate } from '@content/registry';
import type { GameplayTag } from './types';
import { tryGetLocalizedAbility } from '@content/registry';
import { resolveItemIcon, resolveItemFrame, resolveAbilityIcon } from '@utils/assetResolver';
import type { Locale } from '@content/texts/lookup';
import { t } from '@i18n/t';
import { damageTypeLabel } from './localizationHelpers';

export type ItemDetailSection =
  | { kind: 'stat-list'; title: string; stats: Array<{ label: string; value: string | number }> }
  | { kind: 'description'; text: string };

export interface ItemDetailViewModel {
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'unique';
  rarityLabel: string;
  typeLabel: string;
  /** Тип предмета: weapon, armor, amulet, consumable, key, gold */
  type: string;
  icon: string;
  frameUrl: string;
  fallbackIcon?: string;
  stackCount?: number;
  sections: ItemDetailSection[];
  /** Все способности экземпляра предмета (фиксированные + ролленные) */
  grantedAbilities?: Array<{
    templateId: string;
    name: string;
    description: string;
    level: number;
    icon: string | null;
  }> | null;
  /** Пул скиллов, из которого роллится способность при создании экземпляра */
  abilityPool?: Array<{
    abilityId: string;
    name: string;
    description: string;
    icon: string | null;
    weight: number;
  }> | null;
  /** Теги классификации предмета (обычно оружия). */
  tags: GameplayTag[];
}

export interface MapItemDetailOptions {
  stackCount?: number;
  rarity?: ItemDetailViewModel['rarity'];
  fallbackIcon?: string;
}

function typeLabel(type: string): string {
  switch (type) {
    case 'weapon': return t('system.itemMapper.typeWeapon');
    case 'armor': return t('system.itemMapper.typeArmor');
    case 'amulet': return t('system.itemMapper.typeAmulet');
    case 'consumable': return t('system.itemMapper.typeConsumable');
    case 'key': return t('system.itemMapper.typeKey');
    case 'gold': return t('system.itemMapper.typeGold');
    default: return type;
  }
}

function rarityLabel(rarity: string): string {
  switch (rarity) {
    case 'common': return t('system.itemMapper.rarityCommon');
    case 'rare': return t('system.itemMapper.rarityRare');
    case 'unique': return t('system.itemMapper.rarityUnique');
    default: return rarity;
  }
}

/**
 * Превращает ItemTemplate в ViewModel для ItemDetailPopover.
 *
 * Редкость пока не хранится в ItemTemplate, поэтому передаётся через opts.
 * Когда rarity появится в схеме контента — убрать из opts и читать из template.
 */
export function mapItemTemplateToDetail(
  template: LocalizedItemTemplate,
  opts: MapItemDetailOptions | undefined,
  locale: Locale,
): ItemDetailViewModel {
  const currentLocale = locale;
  const rarity = opts?.rarity ?? 'common';

  const sections: ItemDetailSection[] = [];

  if (template.weapon) {
    const stats: Array<{ label: string; value: string | number }> = [];
    const entries = template.weapon.damageEntries;
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        stats.push({
          label: t('system.itemMapper.weaponDamageLabel', { damageType: damageTypeLabel(entry.damageType) }),
          value: entry.baseDamage,
        });
      }
    } else {
      stats.push({
        label: t('system.itemMapper.weaponBaseDamageLabel', { damageType: damageTypeLabel(template.weapon.damageType) }),
        value: template.weapon.baseDamage ?? 0,
      });
    }
    stats.push({ label: t('system.itemMapper.weaponFormulaLabel'), value: template.weapon.damageFormulaId ?? t('system.itemMapper.weaponFormulaFallback') });
    sections.push({
      kind: 'stat-list',
      title: t('system.itemMapper.combatParamsTitle'),
      stats,
    });
  }

  if (template.armor) {
    sections.push({
      kind: 'stat-list',
      title: t('system.itemMapper.armorTitle'),
      stats: [
        { label: t('system.itemMapper.armorRatingLabel'), value: template.armor.baseArmor },
      ],
    });
  }

  if (template.consumable) {
    sections.push({
      kind: 'stat-list',
      title: t('system.itemMapper.consumableTitle'),
      stats: [
        { label: t('system.itemMapper.effectTypeLabel'), value: template.consumable.effect },
        ...(template.consumable.value !== undefined
          ? [{ label: t('system.itemMapper.effectValueLabel'), value: template.consumable.value }]
          : []),
      ],
    });
  }

  const abilityPool =
    template.abilityPool && template.abilityPool.length > 0
      ? template.abilityPool.map((entry) => {
          const ability = tryGetLocalizedAbility(entry.abilityId, currentLocale);
          return {
            abilityId: entry.abilityId,
            name: ability?.name ?? entry.abilityId,
            description: ability?.description ?? '',
            icon: ability?.spriteId ? resolveAbilityIcon(ability.spriteId) : null,
            weight: entry.weight,
          };
        })
      : null;

  return {
    name: template.name,
    description: template.description,
    rarity,
    rarityLabel: rarityLabel(rarity),
    typeLabel: typeLabel(template.type),
    type: template.type,
    icon: resolveItemIcon(template.spriteId ?? template.id),
    frameUrl: resolveItemFrame(rarity),
    fallbackIcon: opts?.fallbackIcon,
    stackCount: opts?.stackCount,
    sections,
    abilityPool,
    tags: template.weapon?.tags ?? [],
  };
}
