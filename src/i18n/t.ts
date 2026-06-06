/**
 * Type-safe wrapper для i18next.t вне React.
 * Обходит строгую типизацию i18next v23+ для dot-notation ключей.
 * Автоматически разбирает namespace из ключа по первой точке (ns.key.subKey).
 */

import i18next from 'i18next';

export function t(key: string, options?: Record<string, unknown>): string {
  const firstDot = key.indexOf('.');
  if (firstDot === -1) {
    return i18next.t(key, options as any) as string;
  }
  const ns = key.slice(0, firstDot);
  const actualKey = key.slice(firstDot + 1);
  return i18next.t(actualKey, { ns, ...(options as any) }) as string;
}
