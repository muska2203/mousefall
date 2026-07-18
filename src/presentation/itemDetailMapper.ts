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
import type { ItemDetailSection, ItemDetailViewModel } from './types';
import { tryGetLocalizedAbility } from '@content/registry';
import { resolveItemIcon, resolveItemFrame, resolveAbilityIcon } from '@utils/assetResolver';
import type { Locale } from '@content/texts/lookup';
import { getContentText, getTagText } from '@content/texts/lookup';
import type { GameplayTag } from '@simulation/core-types';
import { t } from '@i18n/t';

export interface MapItemDetailOptions {
  stackCount?: number;
  rarity?: ItemDetailViewModel['rarity'];
  fallbackIcon?: string;
  /** Effective урон по каждому типу урона (для оружия). Если не передан — показывается базовый урон. */
  effectiveDamageByTag?: Record<GameplayTag, number>;
  /** true, если карточка показывает шаблон предмета, а не конкретный инстанс. */
  isTemplate?: boolean;
}

function formatDamage(value: number): number {
  return Math.round(value);
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
  const isTemplate = opts?.isTemplate ?? false;

  const sections: ItemDetailSection[] = [];

  if (template.weapon) {
    const stats: Array<{ label: string; value: string | number }> = [];
    const effectiveByTag = opts?.effectiveDamageByTag;
    for (const entry of template.weapon.damageDistribution) {
      // Локализованное название типа урона из контентных текстов.
      const tagText = getTagText(entry.damageTag, locale);
      if (effectiveByTag && entry.damageTag in effectiveByTag) {
        stats.push({
          label: tagText.name,
          value: formatDamage(effectiveByTag[entry.damageTag]!),
        });
      } else {
        const baseDamage = template.weapon.baseDamage ?? 0;
        stats.push({
          label: `${tagText.name} (${t('system.itemMapper.baseDamageLabel')})`,
          value: formatDamage(baseDamage * entry.weight),
        });
      }
    }
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

  const properties =
    template.ruleIds && template.ruleIds.length > 0
      ? template.ruleIds.map((ruleId) => {
          const text = getContentText('rules', ruleId, currentLocale);
          return {
            ruleId,
            name: text.name,
            description: text.description ?? '',
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
    isTemplate,
    sections,
    abilityPool: isTemplate ? abilityPool : null,
    properties,
    tags: template.weapon?.tags ?? [],
  };
}
