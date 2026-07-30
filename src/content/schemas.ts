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

import {z} from 'zod';

// ─────────────────────────────────────────────
// Общие подсхемы
// ─────────────────────────────────────────────

const HealthSchema = z.object({
  max: z.number().int().positive().describe('Максимум HP'),
}).describe('Конфигурация здоровья');

const CombatSchema = z.object({
  damage: z.number().int().nonnegative().describe('Базовый урон за атаку'),
  armor:  z.number().int().nonnegative().default(0).describe('Плоское снижение урона'),
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

const TagsSchema = z.array(z.string().min(1))
  .default([])
  .describe('Иерархические игровые теги (например, damage.physical.slashing). Родительские теги выводятся через hasTag при проверках');

/** Список ID декларативных контентных правил. Дубликаты внутри одного шаблона запрещены. */
const RuleIdsSchema = z.array(z.string().min(1))
  .default([])
  .refine(ids => new Set(ids).size === ids.length, {
    message: 'ruleIds не должны содержать дубликатов',
  })
  .describe('ID декларативных контентных правил, применяемых шаблоном');

// ─────────────────────────────────────────────
// Шаблон сущности
// ─────────────────────────────────────────────

export const EntityTemplateSchema = z.object({
  id:       z.string().min(1).describe('Уникальный идентификатор сущности (совпадает с именем файла)'),
  aiStrategyId: z.string().min(1).optional().describe('ID runtime-стратегии ИИ (регистрируется в strategy-registry). Обязателен для врагов, не нужен для игрока.'),
  aiSightRadius: z.number().int().positive().default(6).describe('Радиус обзора врага в клетках (Манхэттен + LOS). По умолчанию 6.'),
  health:   HealthSchema,
  combat:   CombatSchema.optional(),
  baseStats: BaseStatsSchema.default({ str: 0, dex: 0, int: 0, vit: 0 }).describe('Базовые характеристики врага'),
  equipment: EquipmentSchema,
  abilities: z.array(z.string().min(1)).default([]).describe('Innate-способности врага (ID шаблонов)'),
  lootTable:  z.array(LootEntrySchema).default([]).describe('Таблица выпадения предметов при смерти'),
  lootDropTable: z.array(LootDropTableEntrySchema).default([]).describe('Взвешенная таблица количества выпадаемых предметов'),
  xpReward:   z.number().int().nonnegative().default(0).describe('Опыт, выдаваемый игроку за убийство'),
  renderScale: z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  maxAp: z.number().int().positive().default(1)
    .describe('Максимальное количество очков действий (AP)'),
}).describe('Шаблон врага или NPC');

export type EntityTemplate = z.output<typeof EntityTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон предмета
// ─────────────────────────────────────────────

const WeaponStatsSchema = z.object({
  baseDamage: z.number().int().nonnegative().describe('Базовый урон оружия'),
  damageFormulaId: z.string().min(1).describe('ID формулы урона в коде'),
  range: z.number().int().positive().default(1).describe('Дальность атаки в клетках'),
  damageDistribution: z.array(
    z.object({
      damageTag: z.string().min(1),
      weight: z.number().min(0),
    })
  )
  .refine(arr => arr.some(e => e.weight > 0), {
    message: 'Как минимум один вес должен быть > 0',
  })
  .default([{ damageTag: 'damage.physical.blunt', weight: 1.0 }])
  .describe('Распределение типов урона оружия по тегам'),
  tags: TagsSchema.describe('Теги классификации оружия (attack.melee, target.aoe и т.д.)'),
}).describe('Характеристики оружия');

const ArmorStatsSchema = z.object({
  baseArmor: z.number().int().nonnegative().describe('Плоское снижение урона при экипировке'),
}).describe('Характеристики брони');

const ConsumableEffectSchema = z.object({
  effect: z.enum(['heal', 'damage', 'teleport', 'identify', 'buff', 'spawn_tile_effect']).describe('Тип эффекта'),
  value:  z.number().optional().describe('Величина эффекта (восстановлено HP, нанесён урон и т.д.)'),
  duration: z.number().int().positive().optional().describe('Длительность эффекта в ходах (для buff и статусов)'),
  /** Тип тайлового эффекта для spawn_tile_effect (например, water или oil). */
  tileEffectType: z.string().min(1).optional().describe('ID тайлового эффекта, который спавнится при spawn_tile_effect'),
  /** Радиус области действия в клетках (только для spawn_tile_effect). */
  radius: z.number().int().nonnegative().optional().describe('Радиус области действия в клетках'),
  /** Дальность броска/применения в клетках (только для spawn_tile_effect). */
  range: z.number().int().positive().optional().describe('Дальность применения в клетках'),
}).describe('Определение эффекта расходуемого предмета');

export const ItemTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор предмета (совпадает с именем файла)'),
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
  ruleIds: RuleIdsSchema,
  apCost: z.number().int().nonnegative().default(1)
    .describe('Стоимость использования предмета в очках действий (AP) через действие USE_ITEM'),
}).describe('Шаблон предмета');

export type ItemTemplate = z.output<typeof ItemTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон способности
// ─────────────────────────────────────────────

export const AbilityTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор способности'),
  spriteId:    z.string().optional(),
  cooldown:    z.number().int().nonnegative().default(0).describe('Ходов до повторного использования'),
  apCost: z.union([z.number().int().nonnegative(), z.literal('all')]).default(1)
    .describe('Стоимость использования в очках действий (AP). Число или "all" — все текущие AP актора.'),
  aiPreparable: z.boolean().default(false).describe('AI может подготавливать этот скилл на следующий ход'),
  damageTag: z.string().min(1).optional()
    .describe('Тег урона способности (для ability-based скиллов)'),
  requiredWeaponTags: z.array(z.string().min(1)).default([])
    .describe('Требования к тегам экипированного оружия'),
  tags: TagsSchema.describe('Теги классификации способности (attack.melee, target.aoe и т.д.)'),
  ruleIds: RuleIdsSchema,
}).describe('Шаблон активной способности');

export type AbilityTemplate = z.infer<typeof AbilityTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон террейна
// ─────────────────────────────────────────────

export const TerrainTemplateSchema = z.object({
  id: z.string().min(1).describe('Уникальный идентификатор террейна (совпадает с именем файла)'),
  walkable: z.boolean().describe('Проходим ли террейн для движения'),
  moveCost: z.number().int().min(1).default(1)
    .describe('Стоимость входа на клетку в очках действий (AP)'),
  blocksLOS: z.boolean().default(false)
    .describe('Блокирует ли террейн линию видимости (отделено от проходимости)'),
  tags: TagsSchema,
  ruleIds: RuleIdsSchema,
}).describe('Шаблон террейна (основа пола клетки)');

export type TerrainTemplate = z.output<typeof TerrainTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон статуса
// ─────────────────────────────────────────────

export const StatusTemplateSchema = z.object({
  id: z.string().min(1).describe('Уникальный идентификатор статуса (совпадает с именем файла)'),
  ruleIds: RuleIdsSchema,
  statusCategory: z.enum(['elemental', 'physical', 'mental', 'poison', 'generic'])
    .default('generic')
    .describe('Категория статуса для разрешения конфликтов'),
  categoryPriority: z.number().int()
    .default(0)
    .describe('Приоритет внутри категории; выше — приоритетнее'),
  mutuallyExclusiveWith: z.array(z.string().min(1))
    .default([])
    .describe('Статусы, снимаемые при наложении этого статуса'),
  blockedBy: z.array(z.string().min(1))
    .default([])
    .describe('Статусы, блокирующие наложение этого статуса'),
}).describe('Шаблон статусного эффекта');

export type StatusTemplate = z.output<typeof StatusTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон тайлового эффекта
// ─────────────────────────────────────────────

export const TileEffectTemplateSchema = z.object({
  id: z.string().min(1).describe('Уникальный идентификатор тайлового эффекта (совпадает с именем файла)'),
  layer: z.enum(['cover', 'aboveGround'])
    .default('cover')
    .describe('Слой эффекта. Уникальность по слою: на клетке максимум один эффект каждого слоя, новый эффект слоя заменяет старый'),
  duration: z.number().int().positive()
    .describe('Базовая длительность эффекта в ходах'),
  renderOrder: z.number().int().default(1)
    .describe('Порядок отрисовки относительно других тайловых эффектов'),
  blocksLOS: z.boolean()
    .default(false)
    .describe('Блокирует ли эффект линию видимости (дым и т.п.). Движение не блокируется никогда'),
  ruleIds: RuleIdsSchema,
  canHaveStatus: z.array(z.string().min(1))
    .default([])
    .describe('Статусы тайловых эффектов, которые могут быть наложены на этот эффект'),
  durationDecreasesWhenHasStatus: z.array(z.string().min(1))
    .default([])
    .describe('Статусы тайловых эффектов, при наличии которых уменьшается длительность эффекта. Если пусто — длительность уменьшается каждый тик.'),
}).describe('Шаблон тайлового эффекта (материала)');

export type TileEffectTemplate = z.output<typeof TileEffectTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон статуса тайлового эффекта
// ─────────────────────────────────────────────

export const TileEffectStatusTemplateSchema = z.object({
  id: z.string().min(1).describe('Уникальный идентификатор статуса тайлового эффекта (совпадает с именем файла)'),
  duration: z.number().int().positive()
    .describe('Базовая длительность статуса тайлового эффекта в ходах'),
  ruleIds: RuleIdsSchema,
  statusCategory: z.enum(['elemental', 'physical', 'mental', 'poison', 'generic'])
    .default('generic')
    .describe('Категория статуса для разрешения конфликтов'),
  categoryPriority: z.number().int()
    .default(0)
    .describe('Приоритет внутри категории; выше — приоритетнее'),
  mutuallyExclusiveWith: z.array(z.string().min(1))
    .default([])
    .describe('Статусы тайловых эффектов, снимаемые при наложении этого статуса'),
  blockedBy: z.array(z.string().min(1))
    .default([])
    .describe('Статусы тайловых эффектов, блокирующие наложение этого статуса'),
  renderOrder: z.number().int().default(1)
    .describe('Порядок отрисовки статуса относительно других статусов тайлового эффекта'),
  neverExpires: z.boolean()
    .default(false)
    .describe('Если true, длительность статуса не уменьшается и он не удаляется при тике. Снимается только вместе с родительским тайловым эффектом.'),
}).describe('Шаблон статуса тайлового эффекта');

export type TileEffectStatusTemplate = z.output<typeof TileEffectStatusTemplateSchema>;

// ─────────────────────────────────────────────
// Параметры карты
// ─────────────────────────────────────────────

export const MapParamsSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор параметров карты'),
  strategy:    z.string().min(1).default('tree').describe('Алгоритм генерации карты: tree — дерево комнат от спавна до выхода'),
  width:       z.number().int().min(20).max(100).describe('Ширина карты в клетках'),
  height:      z.number().int().min(20).max(100).describe('Высота карты в клетках'),
  minRooms:    z.number().int().positive().describe('Минимальное количество комнат'),
  maxRooms:    z.number().int().positive().describe('Максимальное количество комнат'),
  minRoomSize: z.number().int().min(2).describe('Минимальный размер комнаты'),
  maxRoomSize: z.number().int().max(20).describe('Максимальный размер комнаты'),
  enemyDensity: z.number().min(0).max(1).describe('Множитель плотности врагов: 1.0 соответствует одному врагу на каждые 4×4 клеток комнаты'),
  itemDensity:  z.number().min(0).max(1).describe('Плотность спавна предметов (0.0–1.0)'),
  enemyPool:   z.array(z.string()).describe('ID шаблонов сущностей, допустимых к спавну'),
  itemPool:    z.array(z.string()).describe('ID шаблонов предметов, допустимых к спавну'),
}).describe('Параметры процедурной генерации карты');

export type MapParams = z.infer<typeof MapParamsSchema>;

// ─────────────────────────────────────────────
// Шаблон лестницы
// ─────────────────────────────────────────────

export const StairsTemplateSchema = z.object({
  id:             z.string().min(1).describe('Уникальный идентификатор лестницы'),
  interactionKind: z.enum(['stairs']).describe('Вид интерактивного объекта'),
  direction:      z.enum(['up', 'down']).describe('Направление лестницы (up — вверх/на поверхность, down — вниз в подземелье)'),
  renderScale:    z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
}).describe('Шаблон лестницы');

export type StairsTemplate = z.output<typeof StairsTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон двери
// ─────────────────────────────────────────────

export const DoorTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор двери'),
  interactionKind: z.enum(['door']).describe('Вид интерактивного объекта'),
  maxHp:           z.number().int().positive().describe('Максимальное здоровье двери'),
  armor:           z.number().int().nonnegative().default(0).describe('Броня двери'),
  renderScale:     z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  openSpriteId:    z.string().min(1).optional().describe('ID спрайта открытой двери. Если не указан — используется <id>_open'),
  tags:            TagsSchema.describe('Иерархические игровые теги двери (например, flammable).'),
  canHaveStatus:   z.array(z.string().min(1))
    .default([])
    .describe('Статусы, которые могут быть наложены на дверь'),
}).describe('Шаблон двери');

export type DoorTemplate = z.output<typeof DoorTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон разрушаемого объекта (пропа)
// ─────────────────────────────────────────────

export const PropTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор пропа (совпадает с именем файла)'),
  maxHp:           z.number().int().positive().describe('Максимальное здоровье пропа'),
  armor:           z.number().int().nonnegative().default(0).describe('Броня пропа'),
  blocksMovement:  z.boolean().default(true).describe('Блокирует ли проход через клетку'),
  blocksLOS:       z.boolean().default(false).describe('Блокирует ли линию видимости'),
  renderScale:     z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  propKind:        z.string().min(1).describe('Вид пропа: barrel, crate и т.д.'),
  tags:            TagsSchema,
  canHaveStatus:   z.array(z.string().min(1))
    .default([])
    .describe('Статусы, которые могут быть наложены на проп'),
}).describe('Шаблон разрушаемого объекта окружения');

export type PropTemplate = z.output<typeof PropTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон точки интереса (poi)
// ─────────────────────────────────────────────

export const PoiTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор точки интереса (совпадает с именем файла)'),
  interactionKind: z.literal('poi').describe('Вид интерактивного объекта'),
  ruleIds:         RuleIdsSchema,
  charges:         z.number().int().nonnegative().default(1).describe('Количество использований (зарядов). При 0 взаимодействие недоступно'),
  renderScale:     z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  tags:            TagsSchema,
}).describe('Шаблон точки интереса (непроходимый неразрушаемый интерактивный объект)');

export type PoiTemplate = z.output<typeof PoiTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон ловушки (trap)
// ─────────────────────────────────────────────

export const TrapTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор ловушки (совпадает с именем файла)'),
  ruleIds:         RuleIdsSchema,
  oneShot:         z.boolean().default(true)
    .describe('Одноразовая ловушка уничтожается при срабатывании; постоянная раскрывается и остаётся'),
  initiallyHidden: z.boolean().default(true)
    .describe('Ловушка создаётся скрытой: не рисуется и не попадает в popover до срабатывания'),
  renderScale:     z.number().min(0).optional().default(1.0).describe('Масштаб спрайта относительно размера тайла'),
  tags:            TagsSchema,
}).describe('Шаблон ловушки (проходимый объект, срабатывающий на вход на клетку)');

export type TrapTemplate = z.output<typeof TrapTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон игрока
// ─────────────────────────────────────────────

export const PlayerTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор шаблона игрока (совпадает с именем файла)'),
  portraitImg: z.string().describe('Путь к изображению портрета'),
  renderScale: z.number().min(0).optional().default(1.5).describe('Масштаб спрайта относительно размера тайла'),
  maxAp: z.number().int().positive().default(2)
    .describe('Стартовое максимальное количество очков действий (AP)'),
  baseStats: BaseStatsSchema.default({ str: 0, dex: 0, int: 0, vit: 0 })
    .describe('Стартовые базовые характеристики персонажа. Не могут быть снижены при распределении очков'),
  isDefault: z.boolean().default(false)
    .describe('Является ли шаблон выбранным по умолчанию в экране создания персонажа'),
  starterEquipment: z.array(z.string().min(1)).optional()
    .describe('Список ID стартового снаряжения, доступного при создании персонажа по этому шаблону'),
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
  statuses:  Map<string, StatusTemplate>;
  tileEffects: Map<string, TileEffectTemplate>;
  tileEffectStatuses: Map<string, TileEffectStatusTemplate>;
  maps:      Map<string, MapParams>;
  stairs:    Map<string, StairsTemplate>;
  doors:     Map<string, DoorTemplate>;
  /** Разрушаемые объекты окружения. Опционально для обратной совместимости с тестовыми моками. */
  props?:    Map<string, PropTemplate>;
  /** Террейны (основа пола клетки). Опционально для обратной совместимости с тестовыми моками. */
  terrains?: Map<string, TerrainTemplate>;
  /** Точки интереса (непроходимые неразрушаемые интерактивные объекты). Опционально для обратной совместимости с тестовыми моками. */
  pois?:     Map<string, PoiTemplate>;
  /** Ловушки (проходимые объекты, срабатывающие на вход на клетку). Опционально для обратной совместимости с тестовыми моками. */
  traps?:    Map<string, TrapTemplate>;
};
