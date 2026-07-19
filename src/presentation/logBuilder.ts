/**
 * Построитель combat log из дерева ExecutionNode.
 *
 * Ответственность:
 * - Извлечение значимых для игрока событий из SimulationResult
 * - Преобразование GameEvent → строки лога
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Только фильтрация и форматирование событий.
 */

import {t} from '@i18n/t';
import type {
    ExecutionNode,
    GameEvent,
    GameState,
    SimulationResult,
    StatusEffectType,
    TurnSide
} from '@simulation/types';
import {
    getLocalizedEntity,
    getLocalizedItem,
    getLocalizedPlayerTemplate,
    tryGetLocalizedAbility
} from '@content/registry';
import type {Locale} from '@content/texts/lookup';


export function extractEvents(result: SimulationResult): GameEvent[] {
  const events: GameEvent[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      walkExecutionTree(action, events, phase.side);
    }
  }
  return events;
}

export function extractEventsFromPlan(
  plan: Array<{ event: GameEvent; side: TurnSide }>,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (const node of plan) {
    if (
      node.side === 'player' ||
      node.side === 'status_tick' ||
      node.side === 'environment' ||
      isEventRelevantToPlayer(node.event)
    ) {
      events.push(node.event);
    }
  }
  return events;
}

function walkExecutionTree(node: ExecutionNode, out: GameEvent[], side: TurnSide): void {
  if (
    side === 'player' ||
    side === 'status_tick' ||
    side === 'environment' ||
    isEventRelevantToPlayer(node.event)
  ) {
    out.push(node.event);
  }
  for (const child of node.children) {
    walkExecutionTree(child, out, side);
  }
}

function isEventRelevantToPlayer(event: GameEvent): boolean {
  switch (event.type) {
    case 'ENTITY_DAMAGED':
      return event.targetId === 'player';
    case 'PLAYER_DIED':
      return true;
    default:
      return false;
  }
}

export function gameEventToLog(
  state: GameState,
  event: GameEvent,
  locale: Locale,
): { text: string; variant?: 'loot' | 'good' | 'bad' | 'info' } | null {
  switch (event.type) {
    case 'ENTITY_MOVED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      return { text: t('system.logBuilder.heroMoved', { name }), variant: 'info' };
    }
    case 'ACTION_APPLIED': {
      const action = event.action;
      if (action.type === 'ATTACK') {
        const name = getEntityDisplayName(state, action.entityId, locale);
        return { text: t('system.logBuilder.heroAttacked', { name }), variant: 'info' };
      }
      return null;
    }
    case 'ENTITY_DAMAGED': {
      const name = getEntityDisplayName(state, event.targetId, locale);
      return {
        text: t('system.logBuilder.damageTaken', { name, damage: event.damage }),
        variant: event.targetId === 'player' ? 'bad' : 'good',
      };
    }
    case 'ENTITY_DIED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      return { text: t('system.logBuilder.heroDied', { name }), variant: 'bad' };
    }
    case 'PLAYER_DIED':
      return { text: t('system.logBuilder.playerDied'), variant: 'bad' };
    case 'ENTITY_HEALED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      return { text: t('system.logBuilder.healReceived', { name, amount: event.amount }), variant: 'good' };
    }
    case 'ITEM_USED': {
      const template = getLocalizedItem(event.templateId, locale);
      const itemName = template?.name ?? t('system.logBuilder.itemUsedLabel');
      return { text: t('system.logBuilder.heroUsedItem', { itemName }), variant: 'info' };
    }
    case 'DOOR_OPENED':
      return { text: t('system.logBuilder.doorOpened'), variant: 'info' };
    case 'DOOR_CLOSED':
      return { text: t('system.logBuilder.doorClosed'), variant: 'info' };
    case 'COUNTER_ATTACK_APPLIED': {
      const name = getEntityDisplayName(state, event.attackerId, locale);
      return { text: t('system.logBuilder.counterattackTriggered', { name }), variant: 'info' };
    }
    case 'ABILITY_PREPARED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      const ability = tryGetLocalizedAbility(event.abilityId, locale);
      const abilityName = ability?.name ?? event.abilityId;
      return { text: t('system.logBuilder.abilityPrepared', { name, ability: abilityName }), variant: 'info' };
    }
    case 'ABILITY_PREPARED_CANCELLED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      const ability = tryGetLocalizedAbility(event.abilityId, locale);
      const abilityName = ability?.name ?? event.abilityId;
      return { text: t('system.logBuilder.abilityPreparedCancelled', { name, ability: abilityName }), variant: 'info' };
    }
    case 'STATUS_BLOCKED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      const status = getStatusDisplayName(event.statusType, locale);
      const blockedBy = getStatusDisplayName(event.blockedBy, locale);
      return {
        text: t('system.logBuilder.statusBlocked', { name, status, blockedBy }),
        variant: 'info',
      };
    }
    case 'STATUS_REMOVED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      const status = getStatusDisplayName(event.effectType, locale);
      return {
        text: t('system.logBuilder.statusRemoved', { name, status }),
        variant: 'info',
      };
    }
    case 'ENTITY_COLLIDED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      return {
        text: t('system.logBuilder.entityCollided', { name }),
        variant: 'info',
      };
    }
    case 'ENTITY_DISPLACED': {
      const name = getEntityDisplayName(state, event.entityId, locale);
      return {
        text: t('system.logBuilder.entityDisplaced', { name }),
        variant: 'info',
      };
    }
    case 'ENTITY_MISSED': {
      const attacker = getEntityDisplayName(state, event.attackerId, locale);
      const target = getEntityDisplayName(state, event.targetId, locale);
      return {
        text: t('system.logBuilder.entityMissed', { attacker, target }),
        variant: 'info',
      };
    }
    case 'RULE_TRIGGERED': {
      // RULE_TRIGGERED — observability-событие для консольного дебага, не для игрового лога.
      return null;
    }
    default:
      return null;
  }
}

function getStatusDisplayName(statusType: StatusEffectType, locale: Locale): string {
  const keyMap: Partial<Record<StatusEffectType, string>> = {
    poisoned: 'system.gameSession.effectPoisoned',
    burning: 'system.gameSession.effectBurning',
    frozen: 'system.gameSession.effectFrozen',
    stunned: 'system.gameSession.effectStunned',
    regenerating: 'system.gameSession.effectRegenerating',
    counterattack: 'system.gameSession.effectCounterattack',
    silenced: 'system.gameSession.effectSilenced',
  };

  const key = keyMap[statusType];
  if (key) {
    const actualKey = key.slice(key.indexOf('.') + 1);
    const translated = t(key);
    if (translated !== actualKey) {
      return translated;
    }
  }

  return statusType;
}

function getEntityDisplayName(state: GameState, entityId: string, locale: Locale): string {
  const entity = state.entities.get(entityId);
  if (entity?.type === 'player') {
    try {
      const localized = getLocalizedPlayerTemplate(entity.templateId, locale);
      return localized.name;
    } catch {
      return t('system.logBuilder.heroNameFallback');
    }
  }
  if (entity?.displayName && entity.displayName !== entity.templateId) {
    return entity.displayName;
  }
  if (entity?.templateId) {
    try {
      const localized = getLocalizedEntity(entity.templateId, locale);
      return localized.name;
    } catch {
      // fallback
    }
  }
  return entityId === 'player' ? t('system.logBuilder.heroNameFallback') : t('system.logBuilder.enemyNameFallback');
}
