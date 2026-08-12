/**
 * Zod-схемы игрового контента (сущности, предметы, способности, карты и т.д.).
 *
 * Эти схемы:
 * - Валидируют контент при сборке (fail fast на невалидном контенте)
 * - Выводят TypeScript-типы (единственный источник истины)
 * - Заполняют дефолты и проверяют инварианты при Schema.parse()
 *
 * Шаблоны контента — TypeScript-модули в src/content/templates/,
 * пишутся через `satisfies XTemplateInput` (input-типы в конце файла)
 * и собираются в LoadedContent через buildContent() (templates/index.ts).
 *
 * Правила:
 * - Схемы точно отражают структуру шаблона
 * - Используйте .default() для опциональных полей с разумными значениями по умолчанию
 * - Используйте .describe() для документации
 */

import {z} from 'zod';

import {AI_STRATEGY_IDS, MAP_STRATEGY_IDS} from './ids';
import {
  AMULET_SUBTYPE_IDS,
  ARMOR_SUBTYPE_IDS,
  EQUIPMENT_SUBTYPE_IDS,
  WEAPON_SUBTYPE_IDS,
} from './ids';

// ─────────────────────────────────────────────
// Общие подсхемы
// ─────────────────────────────────────────────

const HealthSchema = z.object({
  max: z.number().int().positive().describe('Максимум HP'),
}).describe('Конфигурация здоровья');

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

/**
 * Варианты спрайтов объекта по визуальным стейтам: ключ состояния → spriteId.
 * Стейт вычисляется Presentation из полей сущности (например, door: 'open', poi: 'depleted');
 * базовый стейт — 'default'. Если стейт не переопределён здесь, действует конвенция
 * имён файлов: '<id>.png' для 'default' и '<id>_<state>.png' для остальных.
 */
const SpriteVariantsSchema = z.record(z.string().min(1), z.string().min(1))
  .optional()
  .describe('Варианты спрайтов по визуальным стейтам объекта (например, open, depleted)');

/**
 * Размещение спрайта в клетке. Все поля опциональны: неуказанные значения
 * берутся из дефолта категории (см. spritePlacementResolver в presentation).
 * Единый механизм позиционирования спрайтов вместо разрозненных констант.
 */
const SpritePlacementFieldsSchema = z.object({
  scale:    z.number().min(0).optional()
    .describe('Масштаб спрайта относительно размера тайла'),
  anchorX:  z.number().optional()
    .describe('Опора спрайта по X внутри клетки: 0 — левый край, 0.5 — центр'),
  anchorY:  z.number().optional()
    .describe('Доля высоты сжатой клетки, к которой привязан низ спрайта: 1 — низ клетки, меньше — выше над полом'),
  flattenY: z.boolean().optional()
    .describe('Сплющить спрайт по вертикали — он ложится в плоскость пола (сжатая сетка)'),
});

export const SpritePlacementSchema = SpritePlacementFieldsSchema
  .optional()
  .describe('Переопределение размещения спрайта в клетке; дефолты — по категории сущности');

/** Переопределение размещения спрайта из шаблона (все поля опциональны). */
export type SpritePlacement = z.output<typeof SpritePlacementFieldsSchema>;

// ─────────────────────────────────────────────
// Шаблон сущности
// ─────────────────────────────────────────────

export const EntityTemplateSchema = z.object({
  id:       z.string().min(1).describe('Уникальный идентификатор сущности (совпадает с именем файла)'),
  aiStrategyId: z.enum(AI_STRATEGY_IDS).optional().describe('ID runtime-стратегии ИИ (регистрируется в strategy-registry). Обязателен для врагов, не нужен для игрока.'),
  aiSightRadius: z.number().int().positive().default(6).describe('Радиус обзора врага в клетках (Манхэттен + LOS). По умолчанию 6.'),
  health:   HealthSchema,
  baseStats: BaseStatsSchema.default({ str: 0, dex: 0, int: 0, vit: 0 }).describe('Базовые характеристики врага'),
  equipment: EquipmentSchema,
  abilities: z.array(z.string().min(1)).default([]).describe('Innate-способности врага (ID шаблонов)'),
  lootTable:  z.array(LootEntrySchema).default([]).describe('Таблица выпадения предметов при смерти'),
  lootDropTable: z.array(LootDropTableEntrySchema).default([]).describe('Взвешенная таблица количества выпадаемых предметов'),
  placement: SpritePlacementSchema,
  maxAp: z.number().int().positive().default(1)
    .describe('Максимальное количество очков действий (AP)'),
}).describe('Шаблон врага или NPC');

export type EntityTemplate = z.output<typeof EntityTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон предмета
// ─────────────────────────────────────────────

/** Рейнж урона оружия: целые границы, max ≥ min. */
const DamageRangeSchema = z.object({
  min: z.number().int().nonnegative().describe('Нижняя граница урона'),
  max: z.number().int().nonnegative().describe('Верхняя граница урона'),
}).refine(range => range.max >= range.min, {
  message: 'damage.max не может быть меньше damage.min',
}).describe('Рейнж урона {min, max}');

const WeaponStatsSchema = z.object({
  damage: DamageRangeSchema.describe('Рейнж урона оружия (роллится при каждом ударе)'),
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

/** Имена характеристик, доступных модификаторам (экипировка, реликвии, аффиксы). */
const StatNameSchema = z.enum(['damage', 'armor', 'maxHp', 'critMultiplier', 'str', 'dex', 'int', 'vit']);

/** Модификатор характеристики: применяется экипировкой и реликвиями. */
const StatModifierEntrySchema = z.object({
  stat: StatNameSchema,
  value: z.number(),
  op: z.enum(['add', 'multiply']),
});

/** Наборы допустимых подтипов по типу экипировки. */
const EQUIPMENT_SUBTYPES_BY_TYPE = {
  weapon: WEAPON_SUBTYPE_IDS,
  armor: ARMOR_SUBTYPE_IDS,
  amulet: AMULET_SUBTYPE_IDS,
} as const;

export const ItemTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор предмета (совпадает с именем файла)'),
  spriteId:    z.string().optional().describe('Ключ спрайта PixiJS'),
  icon:        z.string().optional().describe('Путь к иконке предмета для UI'),
  fallback:    z.string().optional().describe('Emoji-запасной вариант для отображения в UI'),
  type:        z.enum(['weapon', 'armor', 'amulet', 'consumable', 'key', 'gold']).describe('Категория предмета'),
  level:       z.number().int().min(1).optional()
    .describe('Уровень шаблона экипировки (≥1). Обязателен для weapon/armor/amulet; определяет рейнж аффиксов и (в будущем) этажи дропа'),
  subtype:     z.enum(EQUIPMENT_SUBTYPE_IDS).optional()
    .describe('Подтип экипировки из замкнутого набора своего типа. Обязателен для weapon/armor/amulet'),
  rarity:      z.enum(['common', 'rare', 'unique']).default('common').describe('Редкость предмета'),
  stackable:   z.boolean().default(false).describe('Можно ли складывать несколько в одну ячейку инвентаря'),
  maxStack:    z.number().int().positive().default(1).describe('Максимальный размер стопки'),
  value:       z.number().int().nonnegative().default(0).describe('Цена в золоте для продажи'),
  weapon:      WeaponStatsSchema.optional(),
  armor:       ArmorStatsSchema.optional(),
  consumable:  ConsumableEffectSchema.optional(),
  abilityPool: z.array(
    z.object({
      abilityId: z.string().min(1).describe('ID способности из пула'),
      weight: z.number().positive().default(1).describe('Вес для вероятности выпадения'),
    })
  ).default([]).describe('Пул скиллов, из которого роллится одна способность при создании экземпляра'),
  grantedAbilities: z.array(
    z.string().min(1).describe('ID способности, которая гарантированно выдаётся при экипировке')
  ).default([]).describe('Обязательные способности предмета, выдаются всегда (в отличие от abilityPool)'),
  fixedModifiers: z.array(z.string().min(1))
    .default([])
    .refine(ids => new Set(ids).size === ids.length, {
      message: 'fixedModifiers не должны содержать дубликатов',
    })
    .describe('Фирменные модификаторы предмета (ID из категории modifiers): добавляются каждому экземпляру как аффиксы с origin "fixed" и не участвуют в случайном ролле'),
  apCost: z.number().int().nonnegative().default(1)
    .describe('Стоимость использования предмета в очках действий (AP) через действие USE_ITEM'),
}).superRefine((template, ctx) => {
  const subtypes = EQUIPMENT_SUBTYPES_BY_TYPE[template.type as keyof typeof EQUIPMENT_SUBTYPES_BY_TYPE];
  if (subtypes) {
    // Экипировка (weapon/armor/amulet): level и subtype обязательны,
    // subtype должен принадлежать набору своего типа.
    if (template.level === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['level'], message: `level обязателен для предметов типа "${template.type}"` });
    }
    if (template.subtype === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subtype'], message: `subtype обязателен для предметов типа "${template.type}"` });
    } else if (!(subtypes as readonly string[]).includes(template.subtype)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subtype'], message: `subtype "${template.subtype}" не принадлежит набору подтипов типа "${template.type}"` });
    }
  } else {
    // Прочие типы (расходники, ключи, золото) не имеют level/subtype.
    if (template.level !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['level'], message: `level недопустим для предметов типа "${template.type}"` });
    }
    if (template.subtype !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subtype'], message: `subtype недопустим для предметов типа "${template.type}"` });
    }
  }
}).describe('Шаблон предмета');

export type ItemTemplate = z.output<typeof ItemTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон модификатора (аффикса) экипировки
// ─────────────────────────────────────────────

/** Эффект аффикса: либо модификатор характеристики, либо ссылка на контентное правило. */
const ModifierEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stat'),
    stat: StatNameSchema.describe('Характеристика, к которой применяется аффикс'),
    op: z.enum(['add', 'multiply']).describe('Операция модификатора'),
  }).describe('Stat-аффикс: модификатор характеристики с ролленным значением'),
  z.object({
    kind: z.literal('rule'),
    ruleId: z.string().min(1).describe('ID контентного правила (реестр CONTENT_RULES)'),
  }).describe('Rule-аффикс: активное контентное правило предмета'),
]).describe('Эффект модификатора');

/** Масштабирование значения аффикса от уровня шаблона предмета. */
const ModifierScalingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('perLevel'),
    ranges: z.array(
      z.object({
        min: z.number().describe('Нижняя граница ролла (для отрицательных аффиксов — отрицательная)'),
        max: z.number().describe('Верхняя граница ролла'),
      }).refine(range => range.max >= range.min, {
        message: 'max рейнжа не может быть меньше min',
      })
    ).nonempty()
      .describe('Рейнжи ролла по уровням: ranges[level-1]; уровень выше длины — clamp к последнему'),
  }).describe('Значение роллится из рейнжа, зависящего от уровня предмета'),
  z.object({
    kind: z.literal('none'),
  }).describe('Уровне-независимый аффикс (значение не роллится, value = null)'),
  z.object({
    kind: z.literal('fixed'),
    value: z.number().describe('Фиксированное значение модификатора (для отрицательных — отрицательное)'),
  }).describe('Детерминированное значение: не роллится, используется фирменными модификаторами (fixedModifiers)'),
]).describe('Схема масштабирования значения аффикса');

export const ModifierTemplateSchema = z.object({
  id:       z.string().min(1).describe('Уникальный идентификатор модификатора (совпадает с именем файла)'),
  polarity: z.enum(['positive', 'negative'])
    .default('positive')
    .describe('Полярность аффикса: на предмете 1 положительный + до 1 отрицательного. Для poolEligible: false не используется.'),
  effect:   ModifierEffectSchema,
  scaling:  ModifierScalingSchema,
  applicableSubtypes: z.array(z.enum(EQUIPMENT_SUBTYPE_IDS))
    .nonempty()
    .refine(ids => new Set(ids).size === ids.length, {
      message: 'applicableSubtypes не должны содержать дубликатов',
    })
    .describe('Подтипы экипировки, на которые выпадает аффикс (непустой список)'),
  poolEligible: z.boolean().default(true)
    .describe('Участвует ли модификатор в случайном ролле аффиксов. false — только фирменное свойство конкретных предметов (fixedModifiers).'),
  weight:   z.number().positive().default(1).describe('Вес в пуле ролла (игнорируется при poolEligible: false)'),
}).describe('Шаблон модификатора (аффикса) экипировки');

export type ModifierTemplate = z.output<typeof ModifierTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон способности
// ─────────────────────────────────────────────

// Общая база шаблона способности: метаданные, сквозные для всех видов.
const AbilityTemplateBaseSchema = z.object({
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
});

/**
 * Шаблон способности — discriminated union по полю kind.
 * kind — дискриминатор вида механики (camelCase, не контентный id):
 * параметризованные виды (selfBuff, swoop) несут параметры механики в шаблоне,
 * legacy-виды объявлены без параметров (их исполнители регистрируются по id).
 */
export const AbilityTemplateSchema = z.discriminatedUnion('kind', [
  AbilityTemplateBaseSchema.extend({
    kind: z.literal('selfBuff'),
    statusType: z.string().min(1).describe('Тип статуса, накладываемого на кастера'),
    duration: z.number().int().positive().describe('Длительность статуса в ходах'),
  }).describe('Self-buff способность: getSkillExecutor собирает generic-исполнитель наложения статуса на себя фабрикой createSelfBuffSkill'),
  AbilityTemplateBaseSchema.extend({
    kind: z.literal('swoop'),
    jumpRadius: z.number().int().min(1).describe('Радиус выбора точки приземления относительно кастера'),
    aoeRadius: z.number().int().nonnegative().describe('Радиус удара по земле вокруг точки приземления'),
    baseDamage: z.number().nonnegative().describe('Базовый урон от удара по земле'),
  }).describe('Способность вида «налёт»: прыжок в точку + площадной удар с отталкиванием; исполнитель собирается фабрикой createSwoopSkill'),
  AbilityTemplateBaseSchema.extend({
    kind: z.literal('groundSlam'),
    radius: z.number().int().min(1).describe('Радиус удара по земле вокруг кастера (квадрат по Чебышёву)'),
    baseDamage: z.number().nonnegative().describe('Базовый урон от удара по земле'),
  }).describe('Способность вида «удар по земле»: площадной урон по квадрату вокруг кастера по всем существам кроме кастера; исполнитель собирается фабрикой createGroundSlamSkill'),
  // Legacy-виды без параметров: исполнители регистрируются по id в initSkillRegistry.
  AbilityTemplateBaseSchema.extend({ kind: z.literal('fireball') }),
  AbilityTemplateBaseSchema.extend({ kind: z.literal('magicSlap') }),
  AbilityTemplateBaseSchema.extend({ kind: z.literal('dash') }),
  AbilityTemplateBaseSchema.extend({ kind: z.literal('cleave') }),
  AbilityTemplateBaseSchema.extend({ kind: z.literal('suddenStrike') }),
]).describe('Шаблон активной способности');

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
  standing: z.boolean().optional()
    .describe('Террейн рисуется «стоя» в полный размер, без вертикального сжатия плоскости пола'),
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
  placement: SpritePlacementSchema,
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
  placement: SpritePlacementSchema,
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
  strategy:    z.enum(MAP_STRATEGY_IDS).default('tree').describe('Алгоритм генерации карты: tree — дерево комнат от спавна до выхода'),
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
  startPoiId:  z.string().min(1).optional()
    .describe('ID poi, гарантированно размещаемого в стартовой комнате рядом со спавном. Временная мера до типов комнат (этап 1 roadmap, решение 2026-08-04)'),
  relicPool:   z.array(z.string()).optional()
    .describe('ID шаблонов реликвий, доступных в окнах выбора реликвии (relic_choice) на этом этаже'),
}).describe('Параметры процедурной генерации карты');

export type MapParams = z.infer<typeof MapParamsSchema>;

// ─────────────────────────────────────────────
// Шаблон лестницы
// ─────────────────────────────────────────────

export const StairsTemplateSchema = z.object({
  id:             z.string().min(1).describe('Уникальный идентификатор лестницы'),
  interactionKind: z.enum(['stairs']).describe('Вид интерактивного объекта'),
  direction:      z.enum(['up', 'down']).describe('Направление лестницы (up — вверх/на поверхность, down — вниз в подземелье)'),
  placement:      SpritePlacementSchema,
  spriteVariants: SpriteVariantsSchema,
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
  placement:       SpritePlacementSchema,
  openSpriteId:    z.string().min(1).optional().describe('ID спрайта открытой двери. Если не указан — используется <id>_open'),
  spriteVariants: SpriteVariantsSchema,
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
  placement:       SpritePlacementSchema,
  propKind:        z.string().min(1).describe('Вид пропа: barrel, crate и т.д.'),
  spriteVariants: SpriteVariantsSchema,
  tags:            TagsSchema,
  canHaveStatus:   z.array(z.string().min(1))
    .default([])
    .describe('Статусы, которые могут быть наложены на проп'),
}).describe('Шаблон разрушаемого объекта окружения');

export type PropTemplate = z.output<typeof PropTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон точки интереса (poi)
// ─────────────────────────────────────────────

/** Вид окна poi «выбор реликвии»: предлагает offerSize реликвий из relicPool карты. */
export const PoiRelicChoiceWindowSchema = z.object({
  kind:      z.literal('relic_choice'),
  offerSize: z.number().int().positive().describe('Количество реликвий в предложении окна'),
}).describe('Окно выбора реликвии (выбор 1 из N)');

/**
 * Дескриптор окна poi (discriminated union по `kind`).
 * Новые виды окон (магазин и пр.) добавляются сюда новым вариантом.
 */
export const PoiWindowSchema = z.discriminatedUnion('kind', [
  PoiRelicChoiceWindowSchema,
]).describe('Окно poi: интерактивный выбор, открываемый активацией');

export type PoiWindow = z.output<typeof PoiWindowSchema>;
/** Вид окна poi (значение дискриминатора `kind`). */
export type PoiWindowKind = PoiWindow['kind'];

export const PoiTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор точки интереса (совпадает с именем файла)'),
  interactionKind: z.literal('poi').describe('Вид интерактивного объекта'),
  ruleIds:         RuleIdsSchema,
  charges:         z.number().int().nonnegative().default(1).describe('Количество использований (зарядов). При 0 взаимодействие недоступно'),
  chargeSpentOn:   z.enum(['activation', 'resolution']).default('activation')
    .describe('Когда тратится заряд: activation — при активации (обычные poi), resolution — при выборе опции в окне (оконные poi)'),
  window:          PoiWindowSchema.optional()
    .describe('Окно, открываемое активацией poi (выбор реликвии и пр.). Без окна poi срабатывает сразу'),
  spriteVariants: SpriteVariantsSchema,
  placement:       SpritePlacementSchema,
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
  spriteVariants: SpriteVariantsSchema,
  placement:       SpritePlacementSchema,
  tags:            TagsSchema,
}).describe('Шаблон ловушки (проходимый объект, срабатывающий на вход на клетку)');

export type TrapTemplate = z.output<typeof TrapTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон реликвии
// ─────────────────────────────────────────────

export const RelicTemplateSchema = z.object({
  id:              z.string().min(1).describe('Уникальный идентификатор реликвии (совпадает с именем файла)'),
  ruleIds:         RuleIdsSchema,
  statModifiers:   z.array(StatModifierEntrySchema).default([]).describe('Постоянные модификаторы характеристик, действующие, пока реликвия в коллекции'),
  stackable:       z.boolean().default(false)
    .describe('Можно ли брать несколько экземпляров одной реликвии (каждый стак — дополнительный экземпляр эффекта)'),
  grantedAbilities: z.array(
    z.string().min(1).describe('ID способности, которая выдаётся вместе с реликвией')
  ).default([]).describe('Способности, выдаваемые реликвией (в MVP не используется)'),
  icon:            z.string().optional().describe('Путь к иконке реликвии для UI'),
  fallback:        z.string().optional().describe('Emoji-запасной вариант для отображения в UI'),
  rarity:          z.enum(['common', 'rare', 'unique']).default('common').describe('Редкость реликвии (для UI)'),
}).describe('Шаблон реликвии (постоянный пассивный бонус забега)');

export type RelicTemplate = z.output<typeof RelicTemplateSchema>;

// ─────────────────────────────────────────────
// Шаблон игрока
// ─────────────────────────────────────────────

export const PlayerTemplateSchema = z.object({
  id:          z.string().min(1).describe('Уникальный идентификатор шаблона игрока (совпадает с именем файла)'),
  portraitImg: z.string().describe('Путь к изображению портрета'),
  placement:   SpritePlacementSchema,
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
  /** Реликвии (постоянные пассивные бонусы забега). Опционально для обратной совместимости с тестовыми моками. */
  relics?:   Map<string, RelicTemplate>;
  /** Модификаторы (аффиксы) экипировки. Опционально для обратной совместимости с тестовыми моками. */
  modifiers?: Map<string, ModifierTemplate>;
};

// ─────────────────────────────────────────────
// Input-типы для авторства шаблонов в TypeScript
// ─────────────────────────────────────────────
//
// Шаблоны контента живут в src/content/templates/ как TypeScript-модули
// и пишутся через `satisfies XTemplateInput`. В отличие от output-типов
// (XTemplate), поля с Zod-дефолтами здесь опциональны: их заполняет
// Schema.parse() при сборке контента (см. templates/index.ts).

/** Входная форма шаблона сущности: поля с дефолтами опциональны. */
export type EntityTemplateInput = z.input<typeof EntityTemplateSchema>;
/** Входная форма шаблона игрока: поля с дефолтами опциональны. */
export type PlayerTemplateInput = z.input<typeof PlayerTemplateSchema>;
/** Входная форма шаблона предмета: поля с дефолтами опциональны. */
export type ItemTemplateInput = z.input<typeof ItemTemplateSchema>;
/** Входная форма шаблона способности: поля с дефолтами опциональны. */
export type AbilityTemplateInput = z.input<typeof AbilityTemplateSchema>;
/** Входная форма шаблона статуса: поля с дефолтами опциональны. */
export type StatusTemplateInput = z.input<typeof StatusTemplateSchema>;
/** Входная форма шаблона террейна: поля с дефолтами опциональны. */
export type TerrainTemplateInput = z.input<typeof TerrainTemplateSchema>;
/** Входная форма шаблона тайлового эффекта: поля с дефолтами опциональны. */
export type TileEffectTemplateInput = z.input<typeof TileEffectTemplateSchema>;
/** Входная форма шаблона статуса тайлового эффекта: поля с дефолтами опциональны. */
export type TileEffectStatusTemplateInput = z.input<typeof TileEffectStatusTemplateSchema>;
/** Входная форма параметров карты: поля с дефолтами опциональны. */
export type MapParamsInput = z.input<typeof MapParamsSchema>;
/** Входная форма шаблона лестницы: поля с дефолтами опциональны. */
export type StairsTemplateInput = z.input<typeof StairsTemplateSchema>;
/** Входная форма шаблона двери: поля с дефолтами опциональны. */
export type DoorTemplateInput = z.input<typeof DoorTemplateSchema>;
/** Входная форма шаблона пропа: поля с дефолтами опциональны. */
export type PropTemplateInput = z.input<typeof PropTemplateSchema>;
/** Входная форма шаблона точки интереса: поля с дефолтами опциональны. */
export type PoiTemplateInput = z.input<typeof PoiTemplateSchema>;
/** Входная форма шаблона ловушки: поля с дефолтами опциональны. */
export type TrapTemplateInput = z.input<typeof TrapTemplateSchema>;
/** Входная форма шаблона реликвии: поля с дефолтами опциональны. */
export type RelicTemplateInput = z.input<typeof RelicTemplateSchema>;
/** Входная форма шаблона модификатора (аффикса): поля с дефолтами опциональны. */
export type ModifierTemplateInput = z.input<typeof ModifierTemplateSchema>;
