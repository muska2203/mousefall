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

import type { ItemTemplate } from '@content/schemas';
import { tryGetAbility } from '@content/registry';
import { resolveItemIcon } from '@utils/assetResolver';

const TYPE_LABELS: Record<string, string> = {
  weapon: 'Оружие',
  armor: 'Броня',
  amulet: 'Амулет',
  consumable: 'Расходуемое',
  key: 'Ключ',
  gold: 'Золото',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  unique: 'Уникальный',
};

export type ItemDetailSection =
  | { kind: 'stat-list'; title: string; stats: Array<{ label: string; value: string | number }> }
  | { kind: 'description'; text: string }
  | { kind: 'custom'; title: string; content: unknown };

export interface ItemDetailViewModel {
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'unique';
  rarityLabel: string;
  typeLabel: string;
  /** Тип предмета: weapon, armor, amulet, consumable, key, gold */
  type: string;
  icon: string;
  fallbackIcon?: string;
  stackCount?: number;
  sections: ItemDetailSection[];
  /** Ролленный скилл экземпляра предмета (если есть) */
  grantedAbility?: {
    templateId: string;
    name: string;
    level: number;
    icon: string | null;
  } | null;
  /** Пул скиллов, из которого роллится способность при создании экземпляра */
  abilityPool?: Array<{
    abilityId: string;
    name: string;
    description: string;
    icon: string | null;
    weight: number;
  }> | null;
}

export interface MapItemDetailOptions {
  stackCount?: number;
  rarity?: ItemDetailViewModel['rarity'];
  fallbackIcon?: string;
}

/**
 * Превращает ItemTemplate в ViewModel для ItemDetailPopover.
 *
 * Редкость пока не хранится в ItemTemplate, поэтому передаётся через opts.
 * Когда rarity появится в схеме контента — убрать из opts и читать из template.
 */
export function mapItemTemplateToDetail(
  template: ItemTemplate,
  opts?: MapItemDetailOptions,
): ItemDetailViewModel {
  const rarity = opts?.rarity ?? 'common';

  const sections: ItemDetailSection[] = [];

  if (template.weapon) {
    sections.push({
      kind: 'stat-list',
      title: 'Боевые параметры',
      stats: [
        { label: 'Базовый урон', value: template.weapon.baseDamage },
        { label: 'Формула', value: template.weapon.damageFormulaId },
        { label: 'Дальность', value: template.weapon.range },
      ],
    });
  }

  if (template.armor) {
    sections.push({
      kind: 'stat-list',
      title: 'Защита',
      stats: [
        { label: 'Показатель брони', value: template.armor.baseArmor },
      ],
    });
  }

  if (template.consumable) {
    sections.push({
      kind: 'stat-list',
      title: 'Эффект',
      stats: [
        { label: 'Тип', value: template.consumable.effect },
        ...(template.consumable.value !== undefined
          ? [{ label: 'Значение', value: template.consumable.value }]
          : []),
      ],
    });
  }

  sections.push({ kind: 'description', text: template.description });

  const abilityPool =
    template.abilityPool && template.abilityPool.length > 0
      ? template.abilityPool.map((entry) => {
          const ability = tryGetAbility(entry.abilityId);
          return {
            abilityId: entry.abilityId,
            name: ability?.name ?? entry.abilityId,
            description: ability?.description ?? '',
            icon: ability?.spriteId ? `/assets/skills/${ability.spriteId}.png` : null,
            weight: entry.weight,
          };
        })
      : null;

  return {
    name: template.name,
    description: template.description,
    rarity,
    rarityLabel: RARITY_LABELS[rarity] ?? rarity,
    typeLabel: TYPE_LABELS[template.type] ?? template.type,
    type: template.type,
    icon: resolveItemIcon(template.spriteId ?? template.id),
    fallbackIcon: opts?.fallbackIcon,
    stackCount: opts?.stackCount,
    sections,
    abilityPool,
  };
}
