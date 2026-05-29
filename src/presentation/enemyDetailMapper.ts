/**
 * Маппер: EnemyEntity (Simulation) → EnemyPopoverViewModel (UI).
 *
 * Presentation читает шаблон врага из Content Registry,
 * разрешает пути к ассетам и формирует готовый ViewModel для popover'а.
 */

import type { EnemyEntity } from '@simulation/types';
import { tryGetEntity, tryGetItem, tryGetAbility } from '@content/registry';
import { resolveEnemySprite, resolveItemIcon, resolveAbilityIcon } from '@utils/assetResolver';
import type { EnemyPopoverViewModel } from './types';

export function mapEnemyToPopover(enemy: EnemyEntity): EnemyPopoverViewModel {
  const template = tryGetEntity(enemy.templateId);

  const skills = enemy.abilities.map((ability) => {
    const abilityTemplate = tryGetAbility(ability.templateId);
    return {
      name: abilityTemplate?.name ?? ability.templateId,
      icon: abilityTemplate?.spriteId ? resolveAbilityIcon(abilityTemplate.spriteId) : null,
      cooldown: ability.currentCooldown,
      maxCooldown: abilityTemplate?.cooldown ?? 0,
    };
  });

  const loot = (template?.lootTable ?? []).map((entry) => {
    const itemTemplate = tryGetItem(entry.templateId);
    return {
      name: itemTemplate?.name ?? entry.templateId,
      icon: itemTemplate ? resolveItemIcon(itemTemplate.spriteId ?? itemTemplate.id) : '',
    };
  });

  return {
    name: enemy.displayName,
    sprite: resolveEnemySprite(enemy.templateId),
    flavorText: template?.flavorText ?? '',
    damage: enemy.damage,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    skills,
    loot,
  };
}
