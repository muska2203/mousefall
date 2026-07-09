/**
 * Хелперы для проверки требований способностей.
 */

import type { Entity } from '@simulation/types.ts';
import type { RuntimeAbility } from '@simulation/core-types.ts';
import { tryGetAbility } from '@content/registry';
import { getWeaponTags } from '@simulation/systems/tags/weapon-tags';
import { hasAllTags } from '@simulation/systems/tags/tag-helpers';

/**
 * Проверяет, соответствует ли экипированное оружие кастующего требованиям
 * способности (requiredWeaponTags).
 * Если требований нет — возвращает true.
 */
export function meetsWeaponRequirements(caster: Entity, ability: RuntimeAbility): boolean {
  const template = tryGetAbility(ability.templateId);
  const required = template?.requiredWeaponTags ?? [];
  if (required.length === 0) return true;
  return hasAllTags(getWeaponTags(caster), required);
}
