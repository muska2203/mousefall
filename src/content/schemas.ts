/**
 * Zod-схемы для JSON-файлов контента (сущности, предметы, способности, карты).
 *
 * Эти схемы:
 * - Валидируют контент при загрузке (fail fast на невалидном контенте)
 * - Выводят TypeScript-типы (единственный источник истины)
 * - Дают понятные сообщения об ошибках авторам контента
 *
 * Правила:
 * - Схемы точно отражают формат JSON-файла
 * - Используйте .default() для опциональных полей с разумными значениями по умолчанию
 * - Используйте .describe() для документации
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// Общие подсхемы
// ─────────────────────────────────────────────

const HealthSchema = z.object({
  max: z.number().int().positive().describe('Максимум HP'),
}).describe('Конфигурация здоровья');

const CombatSchema = z.object({
  damage: z.number().int().nonnegative().describe('Базовый урон за атаку'),
  armor:  z.number().int().nonnegative().default(0).describe('Плоское снижение урона'),
  attackRange: z.number().int().positive().default(1).describe('Дальность атаки в клетках (1 = ближний бой)'),
}).describe('Боевые характеристики');

const AISchema = z.object({
  type: z.enum(['aggressive', 'passive', 'patrol', 'boss']).describe('Тип поведения ИИ'),
  sightRange:  z.number().int().positive().default(6).describe('Клеток, которые враг видит'),
  chaseRange:  z.number().int().positive().default(10).describe('Макс. клеток, на которые враг преследует игрока'),
}).describe('Конфигурация ИИ');

const LootEntrySchema = z.object({
  templateId: z.string().min(1).describe('ID шаблона предмета'),
  weight: z.number().int().nonnegative().describe('Вес выпадения'),
});

const LootDropCountSchema = z.object({
  min: z.number().int().nonnegative().describe('Минимум предметов за раз'),
  max: z.number().int().nonnegative().describe('Максимум предметов за раз'),
});

// ─────────────────────────────────────────────
// Шаблон сущности
// ─────────────────────────────────────────────

export const EntityTemplateSchema = z.object({
  id:       z.string().min(1).describe('Уникальный идентификатор сущности (совпадает с именем файла)'),
  aiStrategyId: z.string().min(1).optional().describe('ID runtime-стратегии ИИ (регистрируется в strategy-registry). Обязателен для врагов, не нужен для игрока.'),
  name:     z.string().min(1).describe('Отображаемое имя'),
  symbol:   z.string().length(1).describe('Символ ASCII для текстового рендера'),
  spriteId: z.string().optional().describe('Ключ спрайта PixiJS'),
  health:   HealthSchema,
  combat:   CombatSchema.optional(),
  ai:       AISchema.optional(),
  lootTable:  z.array(LootEntrySchema).default([]).describe('Таблица выпадения предметов при смерти'),
  lootDropCount: LootDropCountSchema.default({ min: 1, max: 1 }).describe('Количество предметов, выпадающих за раз'),
  xpReward:   z.number().int().nonnegative().default(0).describe('Опыт, выдаваемый игроку за убийство'),
  renderScale: z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
}).describe('Шаблон врага или NPC');

export type EntityTemplate = z.output<typeof EntityTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон предмета
// ─────────────────────────────────────────────

const WeaponStatsSchema = z.object({
  baseDamage: z.number().int().nonnegative().describe('Базовый урон оружия'),
  damageFormulaId: z.string().min(1).describe('ID формулы урона в коде (например, club, staff)'),
  range:  z.number().int().positive().default(1).describe('Дальность атаки в клетках'),
}).describe('Характеристики оружия');

const ArmorStatsSchema = z.object({
  baseArmor: z.number().int().nonnegative().describe('Плоское снижение урона при экипировке'),
}).describe('Характеристики брони');

const ConsumableEffectSchema = z.object({
  effect: z.enum(['heal', 'damage', 'teleport', 'identify', 'buff']).describe('Тип эффекта'),
  value:  z.number().optional().describe('Величина эффекта (восстановлено HP, нанесён урон и т.д.)'),
  duration: z.number().int().positive().optional().describe('Длительность эффекта в ходах (для баффов)'),
}).describe('Определение эффекта расходуемого предмета');

export const ItemTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор предмета (совпадает с именем файла)'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание, показываемое в инвентаре'),
  symbol:      z.string().length(1).describe('Символ ASCII для текстового рендера'),
  spriteId:    z.string().optional().describe('Ключ спрайта PixiJS'),
  icon:        z.string().optional().describe('Путь к иконке предмета для UI'),
  fallback:    z.string().optional().describe('Emoji-запасной вариант для отображения в UI'),
  type:        z.enum(['weapon', 'armor', 'amulet', 'consumable', 'key', 'gold']).describe('Категория предмета'),
  rarity:      z.enum(['common', 'rare', 'unique']).default('common').describe('Редкость предмета'),
  stackable:   z.boolean().default(false).describe('Можно ли складывать несколько в одну ячейку инвентаря'),
  maxStack:    z.number().int().positive().default(1).describe('Максимальный размер стопки'),
  weight:      z.number().nonnegative().default(1).describe('Вес предмета (для будущей системы перегруза)'),
  value:       z.number().int().nonnegative().default(0).describe('Цена в золоте для продажи'),
  weapon:      WeaponStatsSchema.optional(),
  armor:       ArmorStatsSchema.optional(),
  consumable:  ConsumableEffectSchema.optional(),
  equipModifiers: z.array(z.object({
    stat: z.enum(['damage', 'armor', 'maxHp', 'dodgeChance', 'accuracy', 'critChance', 'critMultiplier', 'str', 'dex', 'int', 'vit']),
    value: z.number(),
    op: z.enum(['add', 'multiply']),
  })).default([]).describe('Модификаторы, применяемые при экипировке'),
  abilityPool: z.array(
    z.object({
      abilityId: z.string().min(1).describe('ID способности из пула'),
      weight: z.number().positive().default(1).describe('Вес для вероятности выпадения'),
    })
  ).default([]).describe('Пул скиллов, из которого роллится одна способность при создании экземпляра'),
}).describe('Шаблон предмета');

export type ItemTemplate = z.output<typeof ItemTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон способности
// ─────────────────────────────────────────────

export const AbilityTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор способности'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание способности, показываемое в UI'),
  symbol:      z.string().length(1).describe('Символ ASCII'),
  spriteId:    z.string().optional(),
  targetType:  z.enum(['self', 'adjacent', 'ranged', 'area']).describe('Как нацеливается способность'),
  range:       z.number().int().nonnegative().default(1).describe('Дальность в клетках (0 = только на себя)'),
  aoeRadius:   z.number().int().nonnegative().default(0).describe('Радиус области действия (0 = одиночная цель)'),
  cooldown:    z.number().int().nonnegative().default(0).describe('Ходов до повторного использования'),
  apCost:      z.number().int().nonnegative().default(1).describe('Стоимость AP (0 = бесплатное действие)'),
  castTime:    z.number().int().nonnegative().default(0).describe('Ходов подготовки (0 = мгновенно)'),
  effect: z.object({
    type:     z.enum(['damage', 'heal', 'status', 'teleport', 'summon']),
    value:    z.number().optional(),
    statusType: z.string().optional().describe('Тип накладываемого эффекта статуса'),
    duration:   z.number().int().positive().optional(),
  }).describe('Что делает способность'),
}).describe('Шаблон активной способности');

export type AbilityTemplate = z.infer<typeof AbilityTemplateSchema>;

// ─────────────────────────────────────────────
// Параметры карты
// ─────────────────────────────────────────────

export const MapParamsSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор параметров карты'),
  width:       z.number().int().min(20).max(100).describe('Ширина карты в клетках'),
  height:      z.number().int().min(20).max(100).describe('Высота карты в клетках'),
  minRooms:    z.number().int().positive().describe('Минимальное количество комнат'),
  maxRooms:    z.number().int().positive().describe('Максимальное количество комнат'),
  minRoomSize: z.number().int().min(2).describe('Минимальный размер комнаты'),
  maxRoomSize: z.number().int().max(20).describe('Максимальный размер комнаты'),
  enemyDensity: z.number().min(0).max(1).describe('Плотность спавна врагов (0.0–1.0)'),
  itemDensity:  z.number().min(0).max(1).describe('Плотность спавна предметов (0.0–1.0)'),
  enemyPool:   z.array(z.string()).describe('ID шаблонов сущностей, допустимых к спавну'),
  itemPool:    z.array(z.string()).describe('ID шаблонов предметов, допустимых к спавну'),
}).describe('Параметры процедурной генерации карты');

export type MapParams = z.infer<typeof MapParamsSchema>;

// ─────────────────────────────────────────────
// Шаблон лестницы
// ─────────────────────────────────────────────

export const StairsTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор лестницы'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  symbol:      z.string().length(1).describe('Символ ASCII для текстового рендера'),
  spriteId:    z.string().optional().describe('Ключ спрайта PixiJS'),
  renderScale: z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
}).describe('Шаблон лестницы');

export type StairsTemplate = z.output<typeof StairsTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон игрока
// ─────────────────────────────────────────────

export const PlayerTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор шаблона игрока (совпадает с именем файла)'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание, показываемое в UI'),
  symbol:      z.string().length(1).describe('Символ ASCII для текстового рендера'),
  portraitImg: z.string().describe('Путь к изображению портрета'),
  spriteId:    z.string().describe('Ключ спрайта PixiJS'),
  renderScale: z.number().min(0).optional().default(1.5).describe('Масштаб спрайта относительно размера тайла'),
}).describe('Шаблон класса/внешности игрока');

export type PlayerTemplate = z.output<typeof PlayerTemplateSchema>;

// ─────────────────────────────────────────────
// Форма реестра контента
// ─────────────────────────────────────────────

/** Полностью загруженный и валидированный контент, готовый к использованию симуляцией. */
export type LoadedContent = {
  entities:  Map<string, EntityTemplate>;
  players:   Map<string, PlayerTemplate>;
  items:     Map<string, ItemTemplate>;
  abilities: Map<string, AbilityTemplate>;
  maps:      Map<string, MapParams>;
  stairs:    Map<string, StairsTemplate>;
};
