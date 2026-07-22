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
 * - Системы симуляции, презентации и UI читают из реестра через getEntity(), getItem() и т.д.
 * - Тесты инжектируют мок-контент через initRegistry()
 *
 * Компромисс: синглтон модуля vs. внедрение зависимостей
 * - Синглтон: проще, без prop-drilling, подходит для одиночной игры
 * - DI: более тестируемо, но добавляет шаблонный код повсюду
 * - Решение: синглтон с initRegistry() для инжекции в тестах — золотая середина
 */

import type {
    AbilityTemplate,
    DoorTemplate,
    EntityTemplate,
    ItemTemplate,
    LoadedContent,
    MapParams,
    PlayerTemplate,
    StairsTemplate,
    StatusTemplate,
    TileEffectTemplate,
    TileEffectStatusTemplate,
} from './schemas';
import {getContentText, type Locale} from './texts/lookup';

// ─────────────────────────────────────────────
// Localized типы
// ─────────────────────────────────────────────

export type LocalizedEntityTemplate = EntityTemplate & {
  name: string;
  flavorText?: string;
};

export type LocalizedItemTemplate = ItemTemplate & {
  name: string;
  description: string;
};

export type LocalizedAbilityTemplate = AbilityTemplate & {
  name: string;
  description: string;
};

export type LocalizedPlayerTemplate = PlayerTemplate & {
  name: string;
  description: string;
};

export type LocalizedStairsTemplate = StairsTemplate & {
  name: string;
  flavorText?: string;
};

export type LocalizedDoorTemplate = DoorTemplate & {
  name: string;
  flavorText?: string;
};

export type LocalizedTileEffectTemplate = TileEffectTemplate & {
  name: string;
};

export type LocalizedTileEffectStatusTemplate = TileEffectStatusTemplate & {
  name: string;
};

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

export function getRegistry(): LoadedContent {
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
 * Попытаться получить локализованный шаблон сущности. Возвращает undefined, если не найден.
 */
export function tryGetLocalizedEntity(id: string, locale: Locale): LocalizedEntityTemplate | undefined {
  const template = tryGetEntity(id);
  if (!template) return undefined;
  const text = getContentText('entities', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Получить локализованный шаблон сущности по ID.
 */
export function getLocalizedEntity(id: string, locale: Locale): LocalizedEntityTemplate {
  const template = getEntity(id);
  const text = getContentText('entities', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Получить шаблон игрока по ID.
 * Выбрасывает исключение, если не найден.
 */
export function getPlayerTemplate(id: string): PlayerTemplate {
  const template = getRegistry().players.get(id);
  if (!template) throw new Error(`Player template not found: "${id}"`);
  return template;
}

/**
 * Получить локализованный шаблон игрока по ID.
 */
export function getLocalizedPlayerTemplate(id: string, locale: Locale): LocalizedPlayerTemplate {
  const template = getPlayerTemplate(id);
  const text = getContentText('players', id, locale);
  return { ...template, name: text.name, description: text.description ?? '' };
}

/**
 * Попытаться получить шаблон игрока. Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetPlayerTemplate(id: string): PlayerTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.players.get(id);
}

/**
 * Получить все шаблоны игрока.
 */
export function getAllPlayerTemplates(): PlayerTemplate[] {
  return Array.from(getRegistry().players.values());
}

/**
 * Получить все локализованные шаблоны игрока.
 */
export function getAllLocalizedPlayerTemplates(locale: Locale): LocalizedPlayerTemplate[] {
  return Array.from(getRegistry().players.values()).map((template) => {
    const text = getContentText('players', template.id, locale);
    return { ...template, name: text.name, description: text.description ?? '' };
  });
}

/**
 * Получить все шаблоны предметов.
 */
export function getAllItems(): ItemTemplate[] {
  return Array.from(getRegistry().items.values());
}

/**
 * Получить все локализованные шаблоны предметов.
 */
export function getAllLocalizedItems(locale: Locale): LocalizedItemTemplate[] {
  return Array.from(getRegistry().items.values()).map((template) => {
    const text = getContentText('items', template.id, locale);
    return { ...template, name: text.name, description: text.description ?? '' };
  });
}

/**
 * Получить все шаблоны сущностей (врагов / NPC).
 */
export function getAllEntities(): EntityTemplate[] {
  return Array.from(getRegistry().entities.values());
}

/**
 * Получить все шаблоны статусов.
 */
export function getAllStatuses(): StatusTemplate[] {
  return Array.from(getRegistry().statuses.values());
}

/**
 * Получить шаблон тайлового эффекта по ID.
 */
export function getTileEffect(id: string): TileEffectTemplate {
  const template = getRegistry().tileEffects.get(id);
  if (!template) throw new Error(`Tile effect template not found: "${id}"`);
  return template;
}

/**
 * Попытаться получить шаблон тайлового эффекта.
 */
export function tryGetTileEffect(id: string): TileEffectTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.tileEffects.get(id);
}

/**
 * Получить локализованный шаблон тайлового эффекта по ID.
 */
export function getLocalizedTileEffect(id: string, locale: Locale): LocalizedTileEffectTemplate {
  const template = getTileEffect(id);
  const text = getContentText('tileEffects', id, locale);
  return {...template, name: text.name};
}

/**
 * Попытаться получить локализованный шаблон тайлового эффекта.
 */
export function tryGetLocalizedTileEffect(id: string, locale: Locale): LocalizedTileEffectTemplate | undefined {
  const template = tryGetTileEffect(id);
  if (!template) return undefined;
  const text = getContentText('tileEffects', id, locale);
  return {...template, name: text.name};
}

/**
 * Получить все шаблоны тайловых эффектов.
 */
export function getAllTileEffects(): TileEffectTemplate[] {
  return Array.from(getRegistry().tileEffects.values());
}

/**
 * Получить все локализованные шаблоны тайловых эффектов.
 */
export function getAllLocalizedTileEffects(locale: Locale): LocalizedTileEffectTemplate[] {
  return Array.from(getRegistry().tileEffects.values()).map((template) => {
    const text = getContentText('tileEffects', template.id, locale);
    return {...template, name: text.name};
  });
}

/**
 * Получить шаблон статуса тайлового эффекта по ID.
 */
export function getTileEffectStatus(id: string): TileEffectStatusTemplate {
  const template = getRegistry().tileEffectStatuses.get(id);
  if (!template) throw new Error(`Tile effect status template not found: "${id}"`);
  return template;
}

/**
 * Попытаться получить шаблон статуса тайлового эффекта.
 */
export function tryGetTileEffectStatus(id: string): TileEffectStatusTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.tileEffectStatuses.get(id);
}

/**
 * Получить локализованный шаблон статуса тайлового эффекта по ID.
 */
export function getLocalizedTileEffectStatus(id: string, locale: Locale): LocalizedTileEffectStatusTemplate {
  const template = getTileEffectStatus(id);
  const text = getContentText('tileEffectStatuses', id, locale);
  return {...template, name: text.name};
}

/**
 * Попытаться получить локализованный шаблон статуса тайлового эффекта.
 */
export function tryGetLocalizedTileEffectStatus(id: string, locale: Locale): LocalizedTileEffectStatusTemplate | undefined {
  const template = tryGetTileEffectStatus(id);
  if (!template) return undefined;
  const text = getContentText('tileEffectStatuses', id, locale);
  return {...template, name: text.name};
}

/**
 * Получить все шаблоны статусов тайловых эффектов.
 */
export function getAllTileEffectStatuses(): TileEffectStatusTemplate[] {
  return Array.from(getRegistry().tileEffectStatuses.values());
}

/**
 * Получить все локализованные шаблоны статусов тайловых эффектов.
 */
export function getAllLocalizedTileEffectStatuses(locale: Locale): LocalizedTileEffectStatusTemplate[] {
  return Array.from(getRegistry().tileEffectStatuses.values()).map((template) => {
    const text = getContentText('tileEffectStatuses', template.id, locale);
    return {...template, name: text.name};
  });
}

/**
 * Получить все локализованные шаблоны сущностей.
 */
export function getAllLocalizedEntities(locale: Locale): LocalizedEntityTemplate[] {
  return Array.from(getRegistry().entities.values()).map((template) => {
    const text = getContentText('entities', template.id, locale);
    return { ...template, name: text.name, flavorText: text.flavorText };
  });
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
 * Попытаться получить локализованный шаблон предмета. Возвращает undefined, если не найден.
 */
export function tryGetLocalizedItem(id: string, locale: Locale): LocalizedItemTemplate | undefined {
  const template = tryGetItem(id);
  if (!template) return undefined;
  const text = getContentText('items', id, locale);
  return { ...template, name: text.name, description: text.description ?? '' };
}

/**
 * Получить локализованный шаблон предмета по ID.
 */
export function getLocalizedItem(id: string, locale: Locale): LocalizedItemTemplate {
  const template = getItem(id);
  const text = getContentText('items', id, locale);
  return { ...template, name: text.name, description: text.description ?? '' };
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
 * Попытаться получить локализованный шаблон способности. Возвращает undefined, если не найден.
 */
export function tryGetLocalizedAbility(id: string, locale: Locale): LocalizedAbilityTemplate | undefined {
  const template = tryGetAbility(id);
  if (!template) return undefined;
  const text = getContentText('abilities', id, locale);
  return { ...template, name: text.name, description: text.description ?? '' };
}

/**
 * Получить локализованный шаблон способности по ID.
 */
export function getLocalizedAbility(id: string, locale: Locale): LocalizedAbilityTemplate {
  const template = getAbility(id);
  const text = getContentText('abilities', id, locale);
  return { ...template, name: text.name, description: text.description ?? '' };
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
 * Попытаться получить шаблон сущности.
 * Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetEntity(id: string): EntityTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.entities.get(id);
}

/**
 * Попытаться получить шаблон предмета.
 * Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetItem(id: string): ItemTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.items.get(id);
}

/**
 * Попытаться получить шаблон способности.
 * Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetAbility(id: string): AbilityTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.abilities.get(id);
}

/**
 * Получить шаблон двери по ID.
 * Выбрасывает исключение, если не найден.
 */
export function getDoor(id: string): DoorTemplate {
  const template = getRegistry().doors.get(id);
  if (!template) throw new Error(`Door template not found: "${id}"`);
  return template;
}

/**
 * Попытаться получить локализованный шаблон двери. Возвращает undefined, если не найден.
 */
export function tryGetLocalizedDoor(id: string, locale: Locale): LocalizedDoorTemplate | undefined {
  const template = tryGetDoor(id);
  if (!template) return undefined;
  const text = getContentText('doors', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Получить локализованный шаблон двери по ID.
 */
export function getLocalizedDoor(id: string, locale: Locale): LocalizedDoorTemplate {
  const template = getDoor(id);
  const text = getContentText('doors', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Попытаться получить шаблон двери.
 * Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetDoor(id: string): DoorTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.doors.get(id);
}

/**
 * Получить все шаблоны дверей.
 */
export function getAllDoors(): DoorTemplate[] {
  return Array.from(getRegistry().doors.values());
}

/**
 * Получить все локализованные шаблоны дверей.
 */
export function getAllLocalizedDoors(locale: Locale): LocalizedDoorTemplate[] {
  return Array.from(getRegistry().doors.values()).map((template) => {
    const text = getContentText('doors', template.id, locale);
    return { ...template, name: text.name, flavorText: text.flavorText };
  });
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
 * Попытаться получить локализованный шаблон лестницы. Возвращает undefined, если не найден.
 */
export function tryGetLocalizedStairs(id: string, locale: Locale): LocalizedStairsTemplate | undefined {
  const template = tryGetStairs(id);
  if (!template) return undefined;
  const text = getContentText('stairs', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Получить локализованный шаблон лестницы по ID.
 */
export function getLocalizedStairs(id: string, locale: Locale): LocalizedStairsTemplate {
  const template = getStairs(id);
  const text = getContentText('stairs', id, locale);
  return { ...template, name: text.name, flavorText: text.flavorText };
}

/**
 * Попытаться получить шаблон лестницы.
 * Возвращает undefined, если реестр не инициализирован или шаблон не найден.
 */
export function tryGetStairs(id: string): StairsTemplate | undefined {
  if (_registry === null) return undefined;
  return _registry.stairs.get(id);
}

/**
 * Получить все шаблоны лестниц.
 */
export function getAllStairs(): StairsTemplate[] {
  return Array.from(getRegistry().stairs.values());
}

/**
 * Получить все локализованные шаблоны лестниц.
 */
export function getAllLocalizedStairs(locale: Locale): LocalizedStairsTemplate[] {
  return Array.from(getRegistry().stairs.values()).map((template) => {
    const text = getContentText('stairs', template.id, locale);
    return { ...template, name: text.name, flavorText: text.flavorText };
  });
}
