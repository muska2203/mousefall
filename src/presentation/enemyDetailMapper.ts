/**
 * Маппер: EnemyEntity (Simulation) → EnemyPopoverViewModel (UI).
 *
 * Presentation читает шаблон врага из Content Registry,
 * разрешает пути к ассетам и формирует готовый ViewModel для popover'а.
 */

import type { EnemyEntity } from '@simulation/types';
import { tryGetLocalizedEntity, tryGetLocalizedItem, tryGetLocalizedAbility } from '@content/registry';
import { resolveEnemySprite, resolveItemIcon, resolveAbilityIcon } from '@utils/assetResolver';
import type { EnemyPopoverViewModel } from './types';
import type { Locale } from '@content/texts/lookup';
import { damageTypeLabel } from './localizationHelpers';

export function mapEnemyToPopover(enemy: EnemyEntity, locale: Locale): EnemyPopoverViewModel {
  const currentLocale = locale;
  const template = tryGetLocalizedEntity(enemy.templateId, currentLocale);

  const skills = enemy.abilities.map((ability) => {
    const abilityTemplate = tryGetLocalizedAbility(ability.templateId, currentLocale);
    return {
      name: abilityTemplate?.name ?? ability.templateId,
      icon: abilityTemplate?.spriteId ? resolveAbilityIcon(abilityTemplate.spriteId) : null,
      cooldown: ability.currentCooldown,
      maxCooldown: abilityTemplate?.cooldown ?? 0,
    };
  });

  const loot = (template?.lootTable ?? []).map((entry) => {
    const itemTemplate = tryGetLocalizedItem(entry.templateId, currentLocale);
    return {
      name: itemTemplate?.name ?? entry.templateId,
      icon: itemTemplate ? resolveItemIcon(itemTemplate.spriteId ?? itemTemplate.id) : '',
    };
  });

  const preparingAbility = enemy.aiState.preparedIntent
    ? (() => {
        const abilityTemplate = tryGetLocalizedAbility(enemy.aiState.preparedIntent!.abilityId, locale);
        return {
          name: abilityTemplate?.name ?? enemy.aiState.preparedIntent!.abilityId,
          icon: abilityTemplate?.spriteId ? resolveAbilityIcon(abilityTemplate.spriteId) : null,
        };
      })()
    : null;

  return {
    name: template?.name ?? enemy.displayName,
    sprite: resolveEnemySprite(enemy.templateId),
    flavorText: template?.flavorText ?? '',
    damage: enemy.damage,
    damageType: enemy.damageType,
    damageTypeLabel: damageTypeLabel(enemy.damageType),
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    skills,
    loot,
    preparingAbility,
  };
}
