import { getRegistry } from '@content/registry';
import type { StatusTemplate } from '@content/schemas';

/**
 * Возвращает шаблон статуса из реестра контента.
 * Если реестр не инициализирован или шаблон не найден — возвращает null.
 */
export function getStatusTemplate(statusType: string): StatusTemplate | null {
  try {
    return getRegistry().statuses.get(statusType) ?? null;
  } catch {
    return null;
  }
}
