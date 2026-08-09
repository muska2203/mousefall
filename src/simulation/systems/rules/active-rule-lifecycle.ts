/**
 * Жизненный цикл кэша `activeRules` актора.
 *
 * Ответственность:
 * - добавление и удаление активных правил при изменении источников
 *   (экипировка, статусы, способности, реликвии);
 * - пересборка `activeRules` по текущему состоянию актора.
 *
 * Правила:
 * - `activeRules` не содержит дубликатов одного и того же `ruleId`
 *   от одного `ownerContext`;
 * - `ownerContext` заполняется в зависимости от источника правила;
 * - при обновлении длительности статуса его правила не пересоздаются.
 */

import type {Actor, StatusEffectHolder} from '@simulation/types.ts';
import type {ItemAffix, RuntimeAbility} from '@simulation/core-types.ts';
import type {OwnerContext} from '@simulation/content-rules/types.ts';
import {tryGetContentRule} from '@simulation/content-rules/registry.ts';
import {getRegistry} from '@content/registry.ts';
import {collectFixedRuleIds} from '@simulation/systems/item-affix-roll.ts';
import type {LoadedContent} from '@content/schemas';

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
    case 'object': {
      const other = b as Extract<OwnerContext, { type: 'object' }>;
      return a.entityId === other.entityId;
    }
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
 * `paramValues` — ролленные значения rule-аффиксов по ruleId (для ParametrizedValue ownerParam).
 */
export function addActiveRules(
  actor: Actor,
  ownerContext: OwnerContext,
  ruleIds: readonly string[],
  paramValues?: ReadonlyMap<string, number>,
): void {
  for (const ruleId of ruleIds) {
    if (hasActiveRule(actor, ownerContext, ruleId)) continue;

    const rule = tryGetContentRule(ruleId);
    if (!rule) {
      // eslint-disable-next-line no-console
      console.warn(`Пропущено неизвестное контентное правило: "${ruleId}"`);
      continue;
    }

    const paramValue = paramValues?.get(ruleId);
    actor.activeRules.push({ ...rule, ownerContext, ...(paramValue !== undefined ? { paramValue } : {}) });
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
  paramValues?: ReadonlyMap<string, number>,
): void {
  addActiveRules(actor, { type: 'entity', entityId: itemInstanceId }, ruleIds, paramValues);
}

/**
 * Извлекает rule-аффиксы экземпляра предмета: ruleIds и ролленные значения по ruleId.
 * Аффиксы со scaling 'none' (value = null) добавляют правило без paramValue.
 */
export function collectAffixRules(
  affixes: readonly ItemAffix[],
): { ruleIds: string[]; paramValues: Map<string, number> } {
  const registry = getContentRegistrySafe();
  const ruleIds: string[] = [];
  const paramValues = new Map<string, number>();

  for (const affix of affixes) {
    const modifier = registry?.modifiers?.get(affix.modifierId);
    if (!modifier || modifier.effect.kind !== 'rule') continue;

    ruleIds.push(modifier.effect.ruleId);
    if (affix.value !== null) {
      paramValues.set(modifier.effect.ruleId, affix.value);
    }
  }

  return { ruleIds, paramValues };
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
 * Добавляет правила реликвии, используя ID её экземпляра как `ownerContext`.
 * Уникальный `ownerContext` на стак — стаки одной реликвии регистрируются независимо.
 */
export function addActiveRulesForRelic(
  actor: Actor,
  relicInstanceId: string,
  ruleIds: readonly string[],
): void {
  addActiveRules(actor, { type: 'entity', entityId: relicInstanceId }, ruleIds);
}

/**
 * Удаляет все правила, принадлежащие экземпляру реликвии.
 */
export function removeActiveRulesForRelic(actor: Actor, relicInstanceId: string): void {
  removeActiveRulesByOwnerContext(
    actor,
    (context) => context.type === 'entity' && context.entityId === relicInstanceId,
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
 * - innate: `entityId` = `abilityId`;
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
 * экипировка, статусы, способности, реликвии.
 */
export function rebuildActiveRules(actor: Actor): void {
  actor.activeRules = [];

  // ── Экипировка ────────────────────────────────────────────────────────────
  if ('inventory' in actor && Array.isArray(actor.inventory)) {
    // Игрок: экипировка хранится как экземпляры в инвентаре.
    const player = actor as Actor & { inventory: Array<{ instanceId: string; templateId: string; affixes?: ItemAffix[] }> };

    const equippedInstances = [
      (actor as Actor & { equippedWeaponInstanceId?: string | null }).equippedWeaponInstanceId,
      (actor as Actor & { equippedArmorInstanceId?: string | null }).equippedArmorInstanceId,
      (actor as Actor & { equippedAmuletInstanceId?: string | null }).equippedAmuletInstanceId,
    ].filter((id): id is string => id !== null && id !== undefined);

    for (const instanceId of equippedInstances) {
      const item = player.inventory.find((i) => i.instanceId === instanceId);
      if (!item) continue;

      // Правила rule-аффиксов экземпляра: фирменные и случайные уже входят в affixes.
      const affixRules = collectAffixRules(item.affixes ?? []);
      addActiveRulesForItem(actor, instanceId, affixRules.ruleIds, affixRules.paramValues);
    }
  } else {
    // Враг: экипировка задана только шаблоном, экземпляра предмета нет.
    // Фирменные правила предмета собираются из fixedModifiers шаблона.
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

      addActiveRules(actor, { type: 'entity', entityId: `equipment:${slot}:${templateId}` }, collectFixedRuleIds(template));
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

  // ── Реликвии ──────────────────────────────────────────────────────────────
  if ('relics' in actor && Array.isArray(actor.relics)) {
    const registry = getContentRegistrySafe();
    for (const relic of actor.relics as Array<{ instanceId: string; templateId: string }>) {
      const template = registry?.relics?.get(relic.templateId);
      if (template) {
        addActiveRulesForRelic(actor, relic.instanceId, template.ruleIds ?? []);
      }
    }
  }

  // ── Способности ───────────────────────────────────────────────────────────
  if ('abilities' in actor && Array.isArray(actor.abilities)) {
    for (const ability of actor.abilities) {
      addActiveRulesForAbility(actor, ability);
    }
  }
}
