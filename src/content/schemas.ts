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
  damageType: z.enum(['piercing', 'slashing', 'blunt', 'fire', 'electric', 'poison', 'frost']).optional().describe('Тип урона врага'),
}).describe('Боевые характеристики');

const BaseStatsSchema = z.object({
  str: z.number().int().default(0).describe('Сила'),
  dex: z.number().int().default(0).describe('Ловкость'),
  int: z.number().int().default(0).describe('Интеллект'),
  vit: z.number().int().default(0).describe('Живучесть'),
}).describe('Базовые характеристики');

const EquipmentSchema = z.object({
  weapon: z.string().min(1).optional().describe('ID шаблона экипированного оружия'),
  armor: z.string().min(1).optional().describe('ID шаблона экипированной брони'),
  amulet: z.string().min(1).optional().describe('ID шаблона экипированного амулета'),
}).default({}).describe('Снаряжение врага');

const LootEntrySchema = z.object({
  templateId: z.string().min(1).describe('ID шаблона предмета'),
  weight: z.number().int().nonnegative().describe('Вес выпадения'),
});

const LootDropTableEntrySchema = z.object({
  count: z.number().int().nonnegative().describe('Количество выпадаемых предметов'),
  weight: z.number().int().nonnegative().describe('Вес вероятности'),
});

// ─────────────────────────────────────────────
// Шаблон сущности
// ─────────────────────────────────────────────

export const EntityTemplateSchema = z.object({
  id:       z.string().min(1).describe('Уникальный идентификатор сущности (совпадает с именем файла)'),
  aiStrategyId: z.string().min(1).optional().describe('ID runtime-стратегии ИИ (регистрируется в strategy-registry). Обязателен для врагов, не нужен для игрока.'),
  aiSightRadius: z.number().int().positive().default(6).describe('Радиус обзора врага в клетках (Манхэттен + LOS). По умолчанию 6.'),
  name:     z.string().min(1).describe('Отображаемое имя'),
  health:   HealthSchema,
  combat:   CombatSchema.optional(),
  baseStats: BaseStatsSchema.default({ str: 0, dex: 0, int: 0, vit: 0 }).describe('Базовые характеристики врага'),
  equipment: EquipmentSchema,
  abilities: z.array(z.string().min(1)).default([]).describe('Innate-способности врага (ID шаблонов)'),
  lootTable:  z.array(LootEntrySchema).default([]).describe('Таблица выпадения предметов при смерти'),
  lootDropTable: z.array(LootDropTableEntrySchema).default([]).describe('Взвешенная таблица количества выпадаемых предметов'),
  xpReward:   z.number().int().nonnegative().default(0).describe('Опыт, выдаваемый игроку за убийство'),
  renderScale: z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  flavorText: z.string().optional().describe('Краткое шуточное описание для popover на игровом поле'),
}).describe('Шаблон врага или NPC');

export type EntityTemplate = z.output<typeof EntityTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон предмета
// ─────────────────────────────────────────────

const WeaponDamageEntrySchema = z.object({
  damageType: z.enum(['piercing', 'slashing', 'blunt', 'fire', 'electric', 'poison', 'frost']).describe('Тип урона'),
  baseDamage: z.number().int().nonnegative().describe('Базовый урон данного типа'),
  damageFormulaId: z.string().min(1).optional().describe('ID формулы урона для данного типа (если отличается от общей)'),
}).describe('Запись урона оружия');

const WeaponStatsSchema = z.object({
  baseDamage: z.number().int().nonnegative().optional().describe('Базовый урон оружия (устаревшее, используйте damageEntries)'),
  damageFormulaId: z.string().min(1).optional().describe('ID формулы урона в коде (устаревшее, используйте damageEntries)'),
  range: z.number().int().positive().default(1).describe('Дальность атаки в клетках'),
  damageType: z.enum(['piercing', 'slashing', 'blunt', 'fire', 'electric', 'poison', 'frost']).default('blunt').describe('Тип урона (fallback при отсутствии damageEntries)'),
  damageEntries: z.array(WeaponDamageEntrySchema).optional().describe('Несколько видов урона за атаку'),
}).refine((data) => {
  if (data.damageEntries && data.damageEntries.length > 0) return true;
  return data.baseDamage !== undefined && data.damageFormulaId !== undefined;
}, {
  message: 'Необходимо указать либо baseDamage + damageFormulaId, либо damageEntries',
}).describe('Характеристики оружия');

const ArmorStatsSchema = z.object({
  baseArmor: z.number().int().nonnegative().describe('Плоское снижение урона при экипировке'),
}).describe('Характеристики брони');

const ConsumableEffectSchema = z.object({
  effect: z.enum(['heal', 'damage', 'teleport', 'identify', 'buff']).describe('Тип эффекта'),
  value:  z.number().optional().describe('Величина эффекта (восстановлено HP, нанесён урон и т.д.)'),
  duration: z.number().int().positive().optional().describe('Длительность эффекта в ходах (для buff и статусов)'),
}).describe('Определение эффекта расходуемого предмета');

export const ItemTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор предмета (совпадает с именем файла)'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание, показываемое в инвентаре'),
  spriteId:    z.string().optional().describe('Ключ спрайта PixiJS'),
  icon:        z.string().optional().describe('Путь к иконке предмета для UI'),
  fallback:    z.string().optional().describe('Emoji-запасной вариант для отображения в UI'),
  type:        z.enum(['weapon', 'armor', 'amulet', 'consumable', 'key', 'gold']).describe('Категория предмета'),
  rarity:      z.enum(['common', 'rare', 'unique']).default('common').describe('Редкость предмета'),
  stackable:   z.boolean().default(false).describe('Можно ли складывать несколько в одну ячейку инвентаря'),
  maxStack:    z.number().int().positive().default(1).describe('Максимальный размер стопки'),
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
  grantedAbilities: z.array(
    z.string().min(1).describe('ID способности, которая гарантированно выдаётся при экипировке')
  ).default([]).describe('Обязательные способности предмета, выдаются всегда (в отличие от abilityPool)'),
}).describe('Шаблон предмета');

export type ItemTemplate = z.output<typeof ItemTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон способности
// ─────────────────────────────────────────────

export const AbilityTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор способности'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание способности, показываемое в UI'),
  spriteId:    z.string().optional(),
  cooldown:    z.number().int().nonnegative().default(0).describe('Ходов до повторного использования'),
  castTime:    z.number().int().nonnegative().default(0).describe('Ходов подготовки (0 = мгновенно)'),
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
  renderScale: z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  flavorText:  z.string().optional().describe('Краткое шуточное описание для popover на игровом поле'),
}).describe('Шаблон лестницы');

export type StairsTemplate = z.output<typeof StairsTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон игрока
// ─────────────────────────────────────────────

export const PlayerTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор шаблона игрока (совпадает с именем файла)'),
  name:        z.string().min(1).describe('Отображаемое имя'),
  description: z.string().describe('Описание, показываемое в UI'),
  portraitImg: z.string().describe('Путь к изображению портрета'),
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
