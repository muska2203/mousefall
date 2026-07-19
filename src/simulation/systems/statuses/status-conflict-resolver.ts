import type {GameState} from '@simulation/types';
import type {Intent} from '@simulation/core-types';
import {getStatusTemplate} from './status-template';

/**
 * Разрешает конфликты одновременно накладываемых статусов одной категории.
 *
 * Правила:
 * - Не мутирует state.
 * - Сохраняет относительный порядок не-APPLY_STATUS интентов.
 * - Для APPLY_STATUS группирует по паре (entityId, statusCategory) и оставляет
 *   только один интент с наивысшим categoryPriority; при равенстве — первый по порядку.
 * - mutuallyExclusiveWith и blockedBy обрабатываются позже, в исполнителе APPLY_STATUS.
 */
export function resolveStatusBatch(
  _state: GameState,
  intents: Intent[],
): Intent[] {
  const result: Intent[] = [];
  const bestByGroup = new Map<string, { priority: number; index: number }>();

  for (const intent of intents) {
    if (intent.type !== 'APPLY_STATUS') {
      result.push(intent);
      continue;
    }

    const template = getStatusTemplate(intent.status.type);
    const category = template?.statusCategory ?? 'generic';
    const priority = template?.categoryPriority ?? 0;
    const key = `${intent.entityId}|${category}`;

    const current = bestByGroup.get(key);
    if (current === undefined) {
      bestByGroup.set(key, { priority, index: result.length });
      result.push(intent);
    } else if (priority > current.priority) {
      bestByGroup.set(key, { priority, index: current.index });
      result[current.index] = intent;
    }
    // При равном приоритете оставляем первый по порядку интент.
  }

  return result;
}
