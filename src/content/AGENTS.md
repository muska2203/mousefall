# Правила слоя Content

> Работая в `src/content/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Чистые данные и типы** — никакой игровой логики.
- **Read-only после инициализации**.
- **Не импортировать** `simulation/`, `presentation/`, `ui/`.
- **Fail fast** — невалидный контент должен падать с понятной ошибкой при загрузке.

---

## Структура

```
src/content/
  ids.ts             # Замкнутые наборы ID (EQUIPMENT_SUBTYPE_IDS, AI_STRATEGY_IDS, MAP_STRATEGY_IDS) — источник истины для z.enum и реестров simulation
  schemas.ts         # Zod-схемы и типы шаблонов; в конце — Input-типы для авторства
  validate-references.ts  # Валидация перекрёстных ссылок между шаблонами (modifiers и lootTable сущностей, пулы карт и т.д.)
  registry.ts        # In-memory реестр загруженного контента
  templates/         # Шаблоны контента как TypeScript-модули
    index.ts         # buildContent(): парс через Zod (дефолты, инварианты, дубли id) → LoadedContent
    entities/        # Шаблоны врагов
    players/         # Шаблоны игрока
    items/           # Оружие, броня, амулеты, расходники (weapons/, armor/, amulet/, consumables/)
    abilities/       # Шаблоны способностей
    statuses/        # Шаблоны статусов
    tile-effects/    # Тайловые эффекты
    tile-effect-statuses/  # Статусы от тайловых эффектов
    terrains/        # Шаблоны террейнов (основа пола клетки)
    maps/            # Параметры генерации карт
    room-types/      # Типы комнат этажа (размеры, пулы и плотности наполнения)
    stairs/          # Лестницы
    doors/           # Двери
    props/           # Пропсы
    pois/            # POI
    traps/           # Ловушки
    relics/          # Реликвии (постоянные пассивные бонусы забега)
    modifiers/       # Модификаторы экипировки: stat/rule, аффиксы ролла и фирменные свойства (fixedModifiers)
  texts/             # Локализованные тексты врагов, предметов, способностей
    types.ts         # Типы игровых текстов
    ru/              # Русские тексты по категориям (items.ts, modifiers.ts, ...)
    en/              # Английские тексты по категориям
    ru.ts            # Реэкспорт русских текстов
    en.ts            # Реэкспорт английских текстов
    lookup.ts        # getContentText(category, id, locale)
```

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить новый шаблон сущности | `src/content/templates/entities/<id>.ts` + строка в `templates/entities/index.ts` |
| Добавить новый террейн | `docs/recipes/add-terrain.md` → `src/content/templates/terrains/`, `texts/{ru,en}/terrain.ts` |
| Добавить новый тип комнаты | `docs/recipes/add-room-type.md` → `src/content/templates/room-types/` + `roomTypePool` карты |
| Добавить новую реликвию | `docs/recipes/add-relic.md` → `src/content/templates/relics/`, `texts/{ru,en}/relics.ts` |
| Добавить новый модификатор (аффикс) | `docs/recipes/add-modifier.md` → `src/content/templates/modifiers/`, `texts/{ru,en}/modifiers.ts` |
| Изменить схему валидации | `src/content/schemas.ts` |
| Добавить поле в реестр | `src/content/registry.ts` + `templates/index.ts` |
| Добавить/изменить текст врага/предмета/способности | `src/content/texts/{ru,en}.ts` |
| Добавить/изменить игровой тег | `src/content/schemas.ts` (`TagsSchema`) + `src/content/texts/{ru,en}.ts` |
| Добавить/изменить тип урона | `src/content/schemas.ts` (`AttackProfileSchema` / `AbilityTemplateSchema`) + `src/simulation/systems/damage/damage-handlers.ts` + `src/simulation/systems/tags/weapon-tags.ts` |

---

## Добавление контента

1. Создать файл `src/content/templates/<категория>/<id>.ts` (имя файла = id в kebab-case, константа — camelCase):

   ```typescript
   import type {EntityTemplateInput} from '../../schemas';

   export const catBig = {
     id: 'cat_big',
     // ...
   } satisfies EntityTemplateInput;
   ```

   Input-типы (`EntityTemplateInput`, `ItemTemplateInput`, ...) определены в конце `src/content/schemas.ts` через `z.input<>` — поля с дефолтами в них опциональны.
2. Импортировать константу и добавить её в массив шаблонов в `index.ts` соответствующей категории (`entityTemplates`, `itemTemplates`, ...).
3. Добавить тексты в `src/content/texts/{ru,en}.ts`.
4. Прогнать `npm run validate:content` — собирает контент через `buildContent()` и проверяет `ruleIds`, семантику правил, перекрёстные ссылки между шаблонами (`validate-references.ts`) и переводы.

> Шаблоны содержат только механику (`tags`, `damageDistribution`, статы, пулы). Все `name` / `description` / `flavorText` живут в `src/content/texts/{ru,en}.ts` и мержатся через `getLocalizedItem()` / `getLocalizedEntity()`.
>
> Предпочтительный способ классифицировать урон и эффекты — иерархические теги (`damage.physical.slashing`, `damage.magical.fire`, `attack.melee` и т.д.).

Боевые статы врага — прямые поля шаблона сущности (экипировки у врагов нет с 2026-08-28): `attack` (профиль базовой атаки, `AttackProfileSchema` — та же структура, что `weapon` у предметов), `armor` (int ≥ 0, default 0), `modifiers` (ID модификаторов, только `scaling: fixed`/`none`; ссылки проверяются в `validate-references.ts`). Рецепт: `docs/recipes/add-enemy.md`.

### Террейны: `src/content/templates/terrains/`

Террейн — структурная основа клетки (стена — тоже террейн с `walkable: false`).
Шаблон (`TerrainTemplateSchema`): `walkable`, `moveCost` (≥ 1, default 1), `blocksLOS` (default false), `tags`, `ruleIds`.
Тег `ground` означает «на клетку можно ставить тайловые эффекты и спавнить объекты» — это не то же самое, что `walkable`.
Тексты террейнов — в `src/content/texts/{ru,en}/terrain.ts`. Рецепт: `docs/recipes/add-terrain.md`.

### Оружие: `damage`, `subtype`, `level` и `damageDistribution`

В `AttackProfileSchema` (`src/content/schemas.ts`) урон оружия задаётся рейнжем `damage: {min, max}` (роллится при каждом ударе, смещение вверх от dex атакующего — `src/simulation/systems/stats/weapon-damage-roll.ts`), а распределение типов урона — массивом `damageDistribution`. У каждого шаблона экипировки обязательны `subtype` (подтип из `EQUIPMENT_SUBTYPE_IDS`, определяет пул аффиксов) и `level` (уровень ≥ 1, выбирает рейнж ролла аффиксов):

```typescript
{
  "type": "weapon",
  "subtype": "sword",
  "level": 1,
  "weapon": {
    "damage": { "min": 4, "max": 6 },
    "range": 1,
    "damageDistribution": [
      { "damageTag": "damage.physical.slashing", "weight": 1.0 }
    ],
    "tags": ["attack.melee", "target.single", "delivery.weapon"]
  }
}
```

- `damageTag` — полный тег типа урона (`damage.physical.slashing`, `damage.magical.fire` и т.д.).
- `weight` — неотрицательный множитель. Минимум одна запись должна иметь `weight > 0`.
- Веса не нормализуются; максимальный вес определяет основной тип оружия.
- Теги урона (`damage.*`) не должны дублироваться в `weapon.tags`; они описываются только через `damageDistribution`.
- `range` (int ≥ 1, default 1) — максимальная дальность базовой атаки в клетках (дистанция Чебышёва, требуется LOS); `minRange` (int ≥ 1, default 1) — минимальная дальность: при `minRange > 1` оружие в упор не бьёт — bump в соседнюю клетку отклоняется с reason-кодом `too_close_for_ranged_weapon`. Семантика — `src/simulation/systems/stats/weapon-range.ts` и `attack-action.ts`.
- Формулы урона оружия (`damageFormulaId`, `weapon-formulas.ts`) удалены 2026-08-08 — урон берётся только из рейнжа шаблона.

### Модификаторы экипировки: `fixedModifiers`, `poolEligible`, `scaling fixed`

Категория `modifiers` — единый источник свойств экипировки. Фирменные свойства предмета задаются полем `fixedModifiers: string[]` шаблона экипировки (ID модификаторов; поля `equipModifiers` и `ruleIds` предметов удалены 2026-08-09). У модификатора:

- `poolEligible` (default `true`) — участвует ли в случайном ролле аффиксов; `false` — только фирменное свойство конкретных предметов;
- `scaling` — `perLevel` (ролл из рейнжей по уровню предмета), `fixed` (детерминированное `value`, для фирменных stat-модификаторов) или `none` (без значения);
- `polarity` — default `positive`; для `poolEligible: false` не используется.

Валидация (`npm run validate:content`): stat-модификатор обязан иметь `scaling: perLevel` или `fixed`; модификатор в `fixedModifiers` не может быть `perLevel` (фирменные детерминированы), обязан существовать и включать `subtype` предмета в `applicableSubtypes`; `{value}` в описании допустим при `perLevel` или `fixed`. Рецепт: `docs/recipes/add-modifier.md`.

### Способности: union `kind`, `damageTag` и `requiredWeaponTags`

`AbilityTemplateSchema` (`src/content/schemas.ts`) — discriminated union по полю `kind` (дискриминатор вида механики, camelCase — это не контентный id). Общая база всех членов: `id`, `spriteId`, `cooldown`, `apCost`, `aiPreparable`, `damageTag?`, `requiredWeaponTags`, `tags`, `ruleIds`.

Члены union (исполнитель каждого вида собирается фабрикой из `KIND_FACTORIES` в `getSkillExecutor`; регистрация исполнителей отсутствует — legacy-реестр удалён 2026-08-12):

- `kind: 'selfBuff'` — `statusType`, `duration`: наложение статуса на кастера (фабрика `createSelfBuffSkill`, примеры — `counterattack`, `bulwark`). `statusType` проверяется валидацией перекрёстных ссылок (существование статуса).
- `kind: 'swoop'` — `jumpRadius` (≥ 1), `aoeRadius` (≥ 0), `baseDamage` (≥ 0): прыжок + площадной удар (фабрика `createSwoopSkill`, примеры — `swoop` 2/1/8, `guardian_swoop` 3/1/10). Удар по земле — плоский урон и радиальное отталкивание по квадрату `aoeRadius` без центральной клетки — проходит при любом приземлении, включая подставку. Семантика столкновения: клетка цели с живым актором — «подставка» (актор получает удвоенный `baseDamage` вместо AoE по своей клетке, без ошеломления, его отпихивает на ближайшую свободную от непроходимых объектов клетку прочь от кастера, кастер приземляется на его место; если актор недвижим — под «Глухой обороной» или отпихнуть некуда — вместо его отталкивания кастер сам отскакивает к ближайшей к началу каста свободной клетке, урон при этом проходит); непроходимая цель (возможна только при устаревшем подготовленном прицеле) — «отскок» (урона нет, dazed кастеру). Удары по клеткам не задевают самого кастера (`excludeEntityId` у DAMAGE_TILE).
- `kind: 'groundSlam'` — `radius` (≥ 1), `baseDamage` (≥ 0): площадной удар по квадрату вокруг кастера по всем существам кроме кастера; DAMAGE-интенты несут тег идентичности `skill.<id>` для контентных правил (фабрика `createGroundSlamSkill`, пример — `ground_slam` 2/12).
- `kind: 'fireball'` — `range` (≥ 1), `aoeRadius` (≥ 0), `centerDamage`, `aoeDamage`: урон по квадрату вокруг выбранной клетки, центр бьёт сильнее (фабрика `createFireballSkill`, пример — `fireball` 5/1/20/10).
- `kind: 'magicSlap'` — `range` (≥ 1), `targetCount` (≥ 1), `baseDamage`: урон по нескольким целям (фабрика `createMagicSlapSkill`, пример — `magic_slap` 5/3/12).
- `kind: 'dash'` — `distance` (≥ 1), `bumpDamage`: рывок с уроном и отталкиванием акторов на пути (фабрика `createDashSkill`, пример — `dash` 2/5).
- `kind: 'suddenStrike'` — `silenceDuration` (≥ 1): удар оружием, немота цели с подготовленной способностью (фабрика `createSuddenStrikeSkill`, пример — `sudden_strike` 2).
- `kind: 'cleave'` — без параметров: удар оружием по дуге из трёх клеток (фабрика `createCleaveSkill`).
- `kind: 'throw'` — `range` (≥ 1), `baseDamage` (≥ 0), `pushDistance` (≥ 0): бросок по одной цели в LOS на одном из 8 лучей-направлений от кастера (как dash) с отталкиванием на `pushDistance` клеток вдоль луча (цепочка одноклеточных PUSH; урон/daze при столкновении — глобальные правила `collision_*`) (фабрика `createThrowSkill`).
- `kind: 'search'` — `radius` (≥ 1): раскрытие скрытых ловушек в квадрате радиуса вокруг кастера, только в прямой видимости (фабрика `createSearchSkill`, пример — `search` 3). Без урона; targetMode `self`. Выдаётся игроку врождённой через `innateAbilities` шаблона игрока (`PlayerTemplateSchema`).

Урон способностей — фиксированные значения из шаблона (без скейлинга от характеристик и уровня; формулы `damageFormula.ts` удалены 2026-08-12). Модификаторы урона вешаются через стандартные модификаторы и контентные правила. Исключение — оружейные виды (`cleave`, `suddenStrike`): их урон — ролл экипированного оружия (`rollWeaponDamage`).

Сквозные поля базы:

- `damageTag?: string` — тег урона способности. Используется для ability-based скиллов, урон которых не зависит от экипированного оружия.
- `requiredWeaponTags?: string[]` — требования к тегам экипированного оружия. Используется для weapon-based скиллов; скилл становится недоступен, если оружие не содержит все указанные теги.

Новый экземпляр существующего параметризованного вида — чистый контент (шаблон + тексты). Новая механика — новый член union + фабрика в движке (см. `docs/recipes/add-ability.md`).

### Босс-инфраструктура (2026-08-14, roadMap 1.3)

- `EntityTemplateSchema.isBoss` (default `false`) — признак босса; шаблоны с `isBoss: true` допустимы в `bossPool` карт (проверяется валидацией). Пример: `cat_guardian`.
- `MapParamsSchema`: `bossPool` (опционально, min 1 — пул боссов этажа), `bossRoomTypeId` (default `'boss'`), `bossDoorId` (default `'boss_door'` — шаблон дверей босс-комнаты), `rewardRoomTypeId` (default `'reward'`). Валидация ссылок на roomTypes и doors — только при заданном `bossPool`. У `floor_1` задан `bossPool: ['cat_guardian']`.
- `DoorTemplateSchema.indestructible` (default `false`) — неразрушаемая дверь (движок обнуляет урон). Шаблон `boss_door` (тег `boss_room`, негорючая — без `flammable` и с `canHaveStatus: []`).
- Типы комнат `boss` и `reward` (`templates/room-types/`) — `weight: 0`, во взвешенный ролл не входят: генератор назначает их напрямую при заданном `bossPool`.

Примеры:

```typescript
// Ability-based: фиксированный урон из шаблона + тег fire
{
  "id": "fireball",
  "kind": "fireball",
  "range": 5,
  "aoeRadius": 1,
  "centerDamage": 20,
  "aoeDamage": 10,
  "damageTag": "damage.magical.fire",
  "tags": ["attack.ranged", "target.aoe", "delivery.projectile", "delivery.spell", "effect.burn"]
}

// Вид swoop: параметры механики в шаблоне
{
  "id": "guardian_swoop",
  "kind": "swoop",
  "jumpRadius": 3,
  "aoeRadius": 1,
  "baseDamage": 10,
  "damageTag": "damage.physical.blunt",
  "tags": ["delivery.ability", "delivery.movement", "attack.melee", "target.aoe", "effect.knockback"]
}

// Weapon-based: требует ближнего оружия, числовых параметров нет (урон — ролл оружия)
{
  "id": "cleave",
  "kind": "cleave",
  "requiredWeaponTags": ["attack.melee"],
  "tags": ["attack.melee", "target.aoe", "delivery.weapon"]
}
```

---

## Полная документация

- [`docs/agents/CONTENT.md`](../../docs/agents/CONTENT.md) — контент-пайплайн
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
