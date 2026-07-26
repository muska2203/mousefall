/**
 * Конфигурация клавиатурного управления в игровом экране.
 *
 * Правила:
 * - UI не решает, что делать с нажатием — только переводит клавишу в направление или действие.
 * - Решение о действии (MOVE vs ATTACK) принимает Presentation.
 */

/** Карта клавиш движения по сетке: код клавиши → [dx, dy]. */
export const KEY_MAP: Record<string, [number, number]> = {
  // Основные 4 направления
  ArrowUp: [0, -1],
  w: [0, -1],
  W: [0, -1],
  ц: [0, -1],
  Ц: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  S: [0, 1],
  ы: [0, 1],
  Ы: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  A: [-1, 0],
  ф: [-1, 0],
  Ф: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
  D: [1, 0],
  в: [1, 0],
  В: [1, 0],

  // Диагонали (QWE / ZXC раскладка)
  q: [-1, -1],
  Q: [-1, -1],
  й: [-1, -1],
  Й: [-1, -1],
  e: [1, -1],
  E: [1, -1],
  у: [1, -1],
  У: [1, -1],
  z: [-1, 1],
  Z: [-1, 1],
  я: [-1, 1],
  Я: [-1, 1],
  c: [1, 1],
  C: [1, 1],
  с: [1, 1],
  С: [1, 1],
};

/** HTML-теги, при фокусе на которых клавиатурный ввод игнорируется. */
export const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Описание привязки одного действия к клавишам. */
export interface KeyBinding {
  /** Значения KeyboardEvent.key, активирующие действие. */
  keys?: readonly string[];
  /** Значение KeyboardEvent.code, активирующее действие (независимо от языка). */
  code?: string;
}

/** Действия игрового экрана и их клавиатурные привязки. */
export const ACTION_KEY_BINDINGS: Record<string, KeyBinding> = {
  interact: { keys: ['f', 'F', 'а', 'А'] },
  cycleInteraction: { keys: ['Tab'] },
  endTurn: { keys: [' ', 'Spacebar'] },
  cancelTargeting: { keys: ['Escape'] },
  toggleDebug: { keys: ['`', '~'], code: 'Backquote' },
};

/** Проверяет, соответствует ли событие клавиши заданному действию. */
export function matchesActionBinding(action: string, e: Pick<KeyboardEvent, 'key' | 'code'>): boolean {
  const binding = ACTION_KEY_BINDINGS[action];
  if (!binding) return false;
  if (binding.keys && binding.keys.includes(e.key)) return true;
  if (binding.code && e.code === binding.code) return true;
  return false;
}

/** Клавиши активации слотов хотбара по порядку (1 → 0). */
export const HOTBAR_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Отображаемые метки слотов хотбара (1–9, 0). */
export const HOTBAR_LABELS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Количество слотов хотбара по умолчанию. Должно совпадать с длиной HOTBAR_KEYS. */
export const DEFAULT_HOTBAR_SIZE = HOTBAR_KEYS.length;

/** Обратная карта: клавиша → индекс слота хотбара. */
export const HOTBAR_INDEX_BY_KEY: Record<string, number> = Object.fromEntries(
  HOTBAR_KEYS.map((key, index) => [key, index]),
);

/** Возвращает индекс слота хотбара для нажатой клавиши или -1. */
export function getHotbarIndexByKey(key: string): number {
  return HOTBAR_INDEX_BY_KEY[key] ?? -1;
}
