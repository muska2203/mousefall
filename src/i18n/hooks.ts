import { useTranslation as useI18nTranslation } from 'react-i18next';
import type { Resources } from './schema';

export function useTranslation<N extends keyof Resources>(ns: N) {
  const result = useI18nTranslation(ns);
  return {
    ...result,
    t: result.t as (key: string, options?: Record<string, unknown>) => string,
  };
}
