/**
 * Построитель всплывающих уведомлений из дерева ExecutionNode.
 *
 * Ответственность:
 * - Извлечение ошибок действий (ACTION_REJECTED) из SimulationResult.
 * - Преобразование кодов ошибок в локализованные заголовки и сообщения.
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Только фильтрация и форматирование ошибок.
 */

import { t } from '@i18n/t';
import type { SimulationResult } from '@simulation/types';
import type { ExecutionNode } from '@simulation/systems/actions/types';
import type { ToastItem, ToastKind } from './types';

type ErrorMapping = {
  kind: ToastKind;
  titleKey: string;
  messageKey: string;
};

/**
 * Маппинг известных кодов ошибок на тип уведомления и i18n-ключи.
 * Ключи ищутся в namespace "components.toast".
 */
const ERROR_MAP: Record<string, ErrorMapping> = {
  ability_on_cooldown: {
    kind: 'warning',
    titleKey: 'skillOnCooldownTitle',
    messageKey: 'skillOnCooldownMessage',
  },
  not_enough_ap: {
    kind: 'warning',
    titleKey: 'notEnoughApTitle',
    messageKey: 'notEnoughApMessage',
  },
  actor_cannot_act: {
    kind: 'error',
    titleKey: 'actorCannotActTitle',
    messageKey: 'actorCannotActMessage',
  },
  invalid_target: {
    kind: 'warning',
    titleKey: 'invalidTargetTitle',
    messageKey: 'invalidTargetMessage',
  },
  wrong_target_count: {
    kind: 'warning',
    titleKey: 'wrongTargetCountTitle',
    messageKey: 'wrongTargetCountMessage',
  },
  already_casting: {
    kind: 'warning',
    titleKey: 'alreadyCastingTitle',
    messageKey: 'alreadyCastingMessage',
  },
  ability_not_found: {
    kind: 'error',
    titleKey: 'abilityNotFoundTitle',
    messageKey: 'abilityNotFoundMessage',
  },
  item_not_found: {
    kind: 'error',
    titleKey: 'itemNotFoundTitle',
    messageKey: 'itemNotFoundMessage',
  },
  not_consumable: {
    kind: 'warning',
    titleKey: 'notConsumableTitle',
    messageKey: 'notConsumableMessage',
  },
  unsupported_effect: {
    kind: 'warning',
    titleKey: 'unsupportedEffectTitle',
    messageKey: 'unsupportedEffectMessage',
  },
  not_equippable: {
    kind: 'warning',
    titleKey: 'notEquippableTitle',
    messageKey: 'notEquippableMessage',
  },
  slot_empty: {
    kind: 'warning',
    titleKey: 'slotEmptyTitle',
    messageKey: 'slotEmptyMessage',
  },
  bottom_floor_reached: {
    kind: 'info',
    titleKey: 'bottomFloorReachedTitle',
    messageKey: 'bottomFloorReachedMessage',
  },
  max_floor_reached: {
    kind: 'info',
    titleKey: 'maxFloorReachedTitle',
    messageKey: 'maxFloorReachedMessage',
  },
  no_stairs_down: {
    kind: 'warning',
    titleKey: 'noStairsDownTitle',
    messageKey: 'noStairsDownMessage',
  },
  no_stairs_up: {
    kind: 'warning',
    titleKey: 'noStairsUpTitle',
    messageKey: 'noStairsUpMessage',
  },
  min_floor_reached: {
    kind: 'info',
    titleKey: 'minFloorReachedTitle',
    messageKey: 'minFloorReachedMessage',
  },
  tile_blocked: {
    kind: 'warning',
    titleKey: 'tileBlockedTitle',
    messageKey: 'tileBlockedMessage',
  },
  no_target_at_tile: {
    kind: 'warning',
    titleKey: 'noTargetAtTileTitle',
    messageKey: 'noTargetAtTileMessage',
  },
};

/** Время отображения по умолчанию для разных типов уведомлений (мс). */
const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  error: 4000,
  warning: 3000,
  info: 2500,
  success: 2500,
};

/** Фallback для неизвестных кодов ошибок. */
const GENERIC_ERROR: ErrorMapping = {
  kind: 'error',
  titleKey: 'genericErrorTitle',
  messageKey: 'genericErrorMessage',
};

/** Вернуть стандартную длительность отображения уведомления для заданного типа. */
export function getDefaultToastDuration(kind: ToastKind): number {
  return DEFAULT_DURATIONS[kind];
}

function walkExecutionTree(node: ExecutionNode, out: ToastItem[]): void {
  if (node.event.type === 'ACTION_REJECTED') {
    for (const error of node.event.errors) {
      const toast = errorToToast(error.code);
      if (toast) {
        out.push(toast);
      }
    }
  }

  for (const child of node.children) {
    walkExecutionTree(child, out);
  }
}

export function errorCodeToToast(code: string): ToastItem {
  const mapping = ERROR_MAP[code] ?? GENERIC_ERROR;

  const title = t(`components.toast.${mapping.titleKey}`);
  const message = t(`components.toast.${mapping.messageKey}`);

  return {
    id: '',
    kind: mapping.kind,
    title,
    message,
    duration: DEFAULT_DURATIONS[mapping.kind],
  };
}

function errorToToast(code: string): ToastItem | null {
  const mapping = ERROR_MAP[code];
  if (!mapping) {
    return null;
  }
  return errorCodeToToast(code);
}

/**
 * Извлечь уведомления из результата симуляции.
 * Возвращает только распознанные ошибки; неизвестные коды игнорируются.
 */
export function extractToasts(result: SimulationResult): ToastItem[] {
  const toasts: ToastItem[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      walkExecutionTree(action, toasts);
    }
  }
  return toasts;
}
