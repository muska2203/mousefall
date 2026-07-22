/**
 * Жизненный цикл кэша `activeRules` актора.
 *
 * Ответственность:
 * - добавление и удаление активных правил при изменении источников
 *   (экипировка, статусы, способности);
 * - пересборка `activeRules` по текущему состоянию актора.
 *
 * Правила:
 * - `activeRules` не содержит дубликатов одного и того же `ruleId`
 *   от одного `ownerContext`;
 * - `ownerContext` заполняется в зависимости от источника правила;
 * - при обновлении длительности статуса его правила не пересоздаются.
 */

import type {Actor, StatusEffectHolder} from '@simulation/types.ts';
import type {OwnerContext} from '@simulation/content-rules/types.ts';
import {tryGetContentRule} from '@simulation/content-rules/registry.ts';
import {getRegistry} from '@content/registry.ts';
import type {LoadedContent} from '@content/schemas';
import type {RuntimeAbility} from '@simulation/core-types.ts';

/**
 * Возвращает реестр контента, если он инициализирован.
 * Нужен для безопасной пересборки `activeRules` в тестах и на ранних этапах инициализации.
 */
function getContentRegistrySafe(): LoadedContent | null {
  try {
    return getRegistry();
  } catch {
    return null;
  }
}

/**
 * Сравнивает два `OwnerContext` по значимым полям.
 */
function ownerContextEquals(a: OwnerContext, b: OwnerContext): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'entity': {
      const other = b as Extract<OwnerContext, { type: 'entity' }>;
      return a.entityId === other.entityId;
    }
    case 'tileEffect': {
      const other = b as Extract<OwnerContext, { type: 'tileEffect' }>;
      return (
        a.position.x === other.position.x &&
        a.position.y === other.position.y &&
        a.tileEffectType === other.tileEffectType
      );
    }
    case 'tileEffectStatus': {
      const other = b as Extract<OwnerContext, { type: 'tileEffectStatus' }>;
      return (
        a.position.x === other.position.x &&
        a.position.y === other.position.y &&
        a.tileEffectType === other.tileEffectType &&
        a.statusType === other.statusType
      );
    }
    case 'world':
      return true;
  }
}

/**
 * Проверяет, что правило с таким `ruleId` и `ownerContext` уже есть в кэше.
 */
function hasActiveRule(actor: Actor, ownerContext: OwnerContext, ruleId: string): boolean {
  return actor.activeRules.some(
    (rule) => rule.id === ruleId && ownerContextEquals(rule.ownerContext, ownerContext),
  );
}

/**
 * Резолвит контентные правила по `ruleIds` и добавляет их в `actor.activeRules`.
 */
export function addActiveRules(
  actor: Actor,
  ownerContext: OwnerContext,
  ruleIds: readonly string[],
): void {
  for (const ruleId of ruleIds) {
    if (hasActiveRule(actor, ownerContext, ruleId)) continue;

    const rule = tryGetContentRule(ruleId);
    if (!rule) {
      // eslint-disable-next-line no-console
      console.warn(`Пропущено неизвестное контентное правило: "${ruleId}"`);
      continue;
    }

    actor.activeRules.push({ ...rule, ownerContext });
  }
}

/**
 * Удаляет из `actor.activeRules` все правила, для которых предикат возвращает true.
 */
export function removeActiveRulesByOwnerContext(
  actor: Actor,
  predicate: (context: OwnerContext) => boolean,
): void {
  actor.activeRules = actor.activeRules.filter((rule) => !predicate(rule.ownerContext));
}

/**
 * Добавляет правила предмета, используя ID его экземпляра как `ownerContext`.
 */
export function addActiveRulesForItem(
  actor: Actor,
  itemInstanceId: string,
  ruleIds: readonly string[],
): void {
  addActiveRules(actor, { type: 'entity', entityId: itemInstanceId }, ruleIds);
}

/**
 * Удаляет все правила, принадлежащие экземпляру предмета.
 */
export function removeActiveRulesForItem(actor: Actor, itemInstanceId: string): void {
  removeActiveRulesByOwnerContext(
    actor,
    (context) => context.type === 'entity' && context.entityId === itemInstanceId,
  );
}

/**
 * Добавляет правила статуса по его шаблону.
 * `statusInstanceId` — стабильный ID экземпляра статуса.
 */
export function addActiveRulesForStatus(
  actor: Actor,
  statusInstanceId: string,
  statusType: string,
): void {
  const registry = getContentRegistrySafe();
  const template = registry?.statuses.get(statusType);
  if (!template) return;

  addActiveRules(
    actor,
    { type: 'entity', entityId: statusInstanceId, statusInstanceId: statusInstanceId },
    template.ruleIds ?? [],
  );
}

/**
 * Удаляет все правила, принадлежащие экземпляру статуса.
 */
export function removeActiveRulesForStatus(actor: Actor, statusInstanceId: string): void {
  removeActiveRulesByOwnerContext(
    actor,
    (context) =>
      context.type === 'entity' && context.statusInstanceId === statusInstanceId,
  );
}

/**
 * Возвращает `ownerContext` для способности.
 * - innate / levelup: `entityId` = `abilityId`;
 * - equipment: `entityId` = `abilityId:sourceItemInstanceId`.
 */
function abilityOwnerContext(ability: RuntimeAbility): Extract<OwnerContext, { type: 'entity' }> {
  const entityId =
    ability.source === 'equipment' && ability.sourceItemInstanceId
      ? `${ability.templateId}:${ability.sourceItemInstanceId}`
      : ability.templateId;

  return { type: 'entity', entityId };
}

/**
 * Добавляет правила способности по её шаблону.
 */
export function addActiveRulesForAbility(actor: Actor, ability: RuntimeAbility): void {
  const registry = getContentRegistrySafe();
  const template = registry?.abilities.get(ability.templateId);
  if (!template) return;

  addActiveRules(actor, abilityOwnerContext(ability), template.ruleIds ?? []);
}

/**
 * Удаляет все правила, принадлежащие конкретной способности (с учётом источника).
 */
export function removeActiveRulesForAbility(actor: Actor, ability: RuntimeAbility): void {
  const contextToRemove = abilityOwnerContext(ability);
  removeActiveRulesByOwnerContext(
    actor,
    (context) => context.type === 'entity' && context.entityId === contextToRemove.entityId,
  );
}

/**
 * Полностью пересобирает `activeRules` актора по текущему состоянию:
 * экипировка, статусы, способности.
 */
export function rebuildActiveRules(actor: Actor): void {
  actor.activeRules = [];

  // ── Экипировка ────────────────────────────────────────────────────────────
  if ('inventory' in actor && Array.isArray(actor.inventory)) {
    // Игрок: экипировка хранится как экземпляры в инвентаре.
    const player = actor as Actor & { inventory: Array<{ instanceId: string; templateId: string }> };

    const equippedInstances = [
      (actor as Actor & { equippedWeaponInstanceId?: string | null }).equippedWeaponInstanceId,
      (actor as Actor & { equippedArmorInstanceId?: string | null }).equippedArmorInstanceId,
      (actor as Actor & { equippedAmuletInstanceId?: string | null }).equippedAmuletInstanceId,
    ].filter((id): id is string => id !== null && id !== undefined);

    for (const instanceId of equippedInstances) {
      const item = player.inventory.find((i) => i.instanceId === instanceId);
      if (!item) continue;

      const registry = getContentRegistrySafe();
      const template = registry?.items.get(item.templateId);
      if (template) {
        addActiveRulesForItem(actor, instanceId, template.ruleIds ?? []);
      }
    }
  } else {
    // Враг: экипировка задана только шаблоном, экземпляра предмета нет.
    const enemyEquipmentIds = {
      weapon: (actor as Actor & { equippedWeaponId?: string | null }).equippedWeaponId,
      armor: (actor as Actor & { equippedArmorId?: string | null }).equippedArmorId,
      amulet: (actor as Actor & { equippedAmuletId?: string | null }).equippedAmuletId,
    };

    for (const [slot, templateId] of Object.entries(enemyEquipmentIds)) {
      if (!templateId) continue;
      const registry = getContentRegistrySafe();
      const template = registry?.items.get(templateId);
      if (!template) continue;

      addActiveRules(actor, { type: 'entity', entityId: `equipment:${slot}:${templateId}` }, template.ruleIds ?? []);
    }
  }

  // ── Статусы ───────────────────────────────────────────────────────────────
  if ('statusEffects' in actor) {
    const holder = actor as unknown as StatusEffectHolder;
    for (const status of holder.statusEffects) {
      const instanceId = status.instanceId ?? status.type;
      addActiveRulesForStatus(actor, instanceId, status.type);
    }
  }

  // ── Способности ───────────────────────────────────────────────────────────
  if ('abilities' in actor && Array.isArray(actor.abilities)) {
    for (const ability of actor.abilities) {
      addActiveRulesForAbility(actor, ability);
    }
  }
}
