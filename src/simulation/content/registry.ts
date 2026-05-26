/**
 * Реестр контента.
 *
 * Хранит весь загруженный и валидированный игровой контент (сущности, предметы, способности, карты).
 * Заполняется при старте загрузчиком контента.
 * Только для чтения во время игры — никогда не мутируется после инициализации.
 *
 * Правила:
 * - Реестр — синглтон на уровне модуля (просто, практично для соло-разработки)
 * - Весь контент валидируется через Zod-схемы перед регистрацией
 * - Системы симуляции читают из реестра через getEntity(), getItem() и т.д.
 * - Тесты инжектируют мок-контент через initRegistry()
 *
 * Компромисс: синглтон модуля vs. внедрение зависимостей
 * - Синглтон: проще, без prop-drilling, подходит для одиночной игры
 * - DI: более тестируемо, но добавляет шаблонный код повсюду
 * - Решение: синглтон с initRegistry() для инжекции в тестах — золотая середина
 */

import type { LoadedContent, EntityTemplate, ItemTemplate, AbilityTemplate, MapParams, StairsTemplate } from '../schemas/contentSchemas';

// ─────────────────────────────────────────────
// Состояние реестра
// ─────────────────────────────────────────────

let _registry: LoadedContent | null = null;

// ─────────────────────────────────────────────
// Инициализация
// ─────────────────────────────────────────────

/**
 * Инициализирует реестр загруженным контентом.
 * Вызывать один раз при старте (или в тестах с мок-контентом).
 * Выбрасывает исключение, если вызван повторно без сброса.
 */
export function initRegistry(content: LoadedContent): void {
  if (_registry !== null) {
    throw new Error('Content registry already initialized. Call resetRegistry() first.');
  }
  _registry = content;
}

/**
 * Сбрасывает реестр (только для тестирования).
 */
export function resetRegistry(): void {
  _registry = null;
}

// ─────────────────────────────────────────────
// Методы доступа
// ─────────────────────────────────────────────

function getRegistry(): LoadedContent {
  if (_registry === null) {
    throw new Error('Content registry not initialized. Call initRegistry() first.');
  }
  return _registry;
}

/**
 * Получить шаблон сущности по ID.
 * Выбрасывает исключение, если не найден — ошибки контента должны отлавливаться при загрузке.
 */
export function getEntity(id: string): EntityTemplate {
  const template = getRegistry().entities.get(id);
  if (!template) throw new Error(`Entity template not found: "${id}"`);
  return template;
}

/**
 * Получить шаблон предмета по ID.
 * Выбрасывает исключение, если не найден.
 */
export function getItem(id: string): ItemTemplate {
  const template = getRegistry().items.get(id);
  if (!template) throw new Error(`Item template not found: "${id}"`);
  return template;
}

/**
 * Получить шаблон способности по ID.
 * Выбрасывает исключение, если не найден.
 */
export function getAbility(id: string): AbilityTemplate {
  const template = getRegistry().abilities.get(id);
  if (!template) throw new Error(`Ability template not found: "${id}"`);
  return template;
}

/**
 * Получить параметры генерации карты по ID.
 * Выбрасывает исключение, если не найдены.
 */
export function getMapParams(id: string): MapParams {
  const params = getRegistry().maps.get(id);
  if (!params) throw new Error(`Map params not found: "${id}"`);
  return params;
}

/**
 * Попытаться получить шаблон сущности. Возвращает undefined, если не найден.
 */
export function tryGetEntity(id: string): EntityTemplate | undefined {
  return getRegistry().entities.get(id);
}

/**
 * Попытаться получить шаблон предмета. Возвращает undefined, если не найден.
 */
export function tryGetItem(id: string): ItemTemplate | undefined {
  return getRegistry().items.get(id);
}

/**
 * Попытаться получить шаблон способности. Возвращает undefined, если не найден.
 */
export function tryGetAbility(id: string): AbilityTemplate | undefined {
  return getRegistry().abilities.get(id);
}

/**
 * Получить шаблон лестницы по ID.
 * Выбрасывает исключение, если не найден.
 */
export function getStairs(id: string): StairsTemplate {
  const template = getRegistry().stairs.get(id);
  if (!template) throw new Error(`Stairs template not found: "${id}"`);
  return template;
}

/**
 * Попытаться получить шаблон лестницы. Возвращает undefined, если не найден.
 */
export function tryGetStairs(id: string): StairsTemplate | undefined {
  return getRegistry().stairs.get(id);
}
