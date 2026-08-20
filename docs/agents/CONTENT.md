# CONTENT — Контент-пайплайн

> **Статус:** `[STABLE]` — контент-пайплайн (TypeScript-шаблоны + Zod + `ruleIds`) устаканился.
> **Источник правды:** этот файл.

> Контент — это данные, описанные в TypeScript-модулях. Шаблоны собираются при старте через `buildContent()` и валидируются через Zod.

---

## Где лежит контент

```
src/content/templates/    # TypeScript-шаблоны: только механика (статы, пулы, ID)
├── entities/             # Сущности (враги и др.)
├── players/              # Шаблоны игроков
├── items/
│   ├── weapons/
│   ├── armor/
│   ├── amulet/
│   └── consumables/
├── modifiers/            # Модификаторы (аффиксы) экипировки: stat/rule, пулы по подтипам
├── abilities/
├── statuses/             # Шаблоны статусов (длительность, категория, ruleIds)
├── tile-effects/         # Шаблоны тайловых эффектов (лужи, ловушки)
├── tile-effect-statuses/ # Шаблоны статусов, висящих на тайловых эффектах
├── terrains/             # Шаблоны террейнов
├── maps/                 # Параметры карт
├── room-types/           # Типы комнат этажа (размеры, пулы и плотности наполнения)
├── stairs/
├── doors/
├── props/
├── pois/
├── traps/
└── index.ts              # buildContent(): LoadedContent — сборка и валидация всех шаблонов

src/content/ids.ts        # Замкнутые наборы ID: EQUIPMENT_SUBTYPE_IDS, AI_STRATEGY_IDS, MAP_STRATEGY_IDS.
                          # Схемы подключают их через z.enum, реестры simulation типизируются от них.

src/content/texts/        # Пользовательские тексты: name, description, flavorText
├── ru.ts                 # Реэкспорт русских текстов из ru/
├── en.ts                 # Реэкспорт английских текстов из en/
├── ru/                   # Русские тексты по категориям
│   ├── statuses.ts       # Локализованные описания эффектов статусов
│   └── ...
├── en/                   # Английские тексты по категориям
│   ├── statuses.ts
│   └── ...
└── lookup.ts             # getContentText(category, id, locale)
```

> **Важно:** шаблоны НЕ содержат `name`, `description`, `flavorText`. Все тексты живут в `src/content/texts/{ru,en}/` и мержатся с шаблоном через `getLocalizedItem()` / `getLocalizedEntity()`.

### Конвенция файла шаблона

Каждый шаблон — отдельный `.ts`-файл в каталоге своей категории. Имя файла — `id` в kebab-case, имя константы — camelCase. Объект типизируется через `satisfies` соответствующим Input-типом:

```ts
import type {EntityTemplateInput} from '../../schemas';

export const catBig = {
  id: 'cat_big',
  // ...
} satisfies EntityTemplateInput;
```

Input-типы (`EntityTemplateInput`, `PlayerTemplateInput`, `ItemTemplateInput`, `AbilityTemplateInput`, `StatusTemplateInput`, `TerrainTemplateInput`, `TileEffectTemplateInput`, `TileEffectStatusTemplateInput`, `MapParamsInput`, `StairsTemplateInput`, `DoorTemplateInput`, `PropTemplateInput`, `PoiTemplateInput`, `TrapTemplateInput`) объявлены в конце `src/content/schemas.ts` через `z.input<>` — поля с Zod-дефолтами в них опциональны.

В каждой категории есть `index.ts`, который импортирует все шаблоны и экспортирует массив (`entityTemplates`, `playerTemplates`, `itemTemplates`, `abilityTemplates`, `statusTemplates`, `tileEffectTemplates`, `tileEffectStatusTemplates`, `terrainTemplates`, `mapParams`, `stairsTemplates`, `doorTemplates`, `propTemplates`, `poiTemplates`, `trapTemplates`).

### Варианты спрайтов объектов (`spriteVariants`)

Объектные шаблоны (`stairs`, `doors`, `props`, `pois`, `traps`) поддерживают опциональное поле `spriteVariants: Record<стейт, spriteId>` — переопределение спрайта по визуальному стейту объекта. Стейт вычисляет Presentation из полей сущности (`src/presentation/objectSpriteResolver.ts`); если стейт не переопределён в шаблоне, действует конвенция `{id}.png` для `default` и `{id}_{state}.png` для остальных (например, `altar_depleted.png` при `charges: 0`). Подробнее — `docs/recipes/add-poi.md`, раздел «Варианты спрайтов по состоянию».

### Размещение спрайта в клетке (`placement`)

Шаблоны сущностей, игрока, объектов (`stairs`, `doors`, `props`, `pois`, `traps`), тайловых эффектов и их статусов поддерживают опциональное поле `placement` (`SpritePlacementSchema`) — переопределение размещения спрайта в клетке: `scale` (масштаб относительно тайла, дефолт 1.0), `anchorX` (опора по X: 0 — левый край, 0.5 — центр), `anchorY` (доля высоты сжатой клетки, где низ спрайта: 1 — низ клетки), `flattenY` (сплющить в плоскость пола). Неуказанные поля берутся из дефолта категории спрайта (`src/presentation/spritePlacementResolver.ts`); дефолты воспроизводят стандартный вид (акторы/объекты «стоят» на 0.8 высоты клетки, ловушки и cover-эффекты лежат в плоскости пола и т.д.).

---

## Добавление контента

1. Создайте `.ts`-файл шаблона по конвенции (имя файла = `id` в kebab-case, константа в camelCase, `satisfies XTemplateInput`).
2. Добавьте импорт и строку в массиве `index.ts` соответствующей категории.
3. Добавьте тексты (`name`, `description`, `flavorText`) в `src/content/texts/ru/` и `src/content/texts/en/`.
4. Запустите `npm run validate:content` — скрипт собирает контент через `buildContent()` и проверяет `ruleIds`, семантику правил, перекрёстные ссылки между шаблонами и покрытие переводами ru/en.

Пересборка манифеста не требуется — манифеста контента больше нет. Шаблоны компилируются вместе с кодом, поэтому ошибки типов ловятся TypeScript ещё до запуска.

Контент дополнительно валидируется при загрузке через Zod (дефолты и `refine`-проверки работают как раньше). Невалидный контент приводит к fail-fast с понятным сообщением об ошибке; дубль `id` — тоже ошибка.

---

## Реестр контента

- `buildContent()` — синхронная сборка всех шаблонов с Zod-валидацией (`src/content/templates/index.ts`). Вызывается в `src/bootstrap.ts` (`initRegistry(buildContent())`), после чего работают `validateContentRuleReferences` / `validateContentRuleSemantics` как раньше.
- `getEntity(id)` / `getLocalizedEntity(id, locale)` — получить шаблон сущности / локализованный шаблон сущности.
- `getItem(id)` / `getLocalizedItem(id, locale)` — получить шаблон предмета / локализованный шаблон предмета.
- `getAbility(id)` / `getLocalizedAbility(id, locale)` — получить шаблон способности / локализованный шаблон способности.
- `getTileEffect(id)` / `getLocalizedTileEffect(id, locale)` — получить шаблон тайлового эффекта / локализованный шаблон.
- `tryGetModifier(id)` — шаблон модификатора (аффикса) экипировки (тексты — через `getContentText('modifiers', id, locale)`).

Реализация: `src/content/templates/index.ts`, `src/content/registry.ts`.

## Замкнутые наборы ID (`src/content/ids.ts`)

Часть строковых идентификаторов, на которые ссылаются шаблоны, типизирована через `z.enum` от констант в `src/content/ids.ts` — опечатка ловится typecheck'ом, а не в рантайме:

- `EQUIPMENT_SUBTYPE_IDS` → `subtype` экипировки (оружие: `sword/dagger/club/staff/sling/unarmed`, броня: `light/heavy/magic`, амулеты: `bead/charm/talisman`) и `applicableSubtypes` модификаторов;
- `AI_STRATEGY_IDS` → `entities[].aiStrategyId` (реализации — `src/simulation/ai/*-strategy.ts`);
- `MAP_STRATEGY_IDS` → `maps[].strategy` (реализации — `src/simulation/systems/map-generation/`).

Добавление нового подтипа/стратегии: расширить массив в `ids.ts`, реализовать код в simulation — компилятор подскажет места регистрации.

## Валидация перекрёстных ссылок (`src/content/validate-references.ts`)

`validateContentReferences(content)` проверяет, что id, на которые шаблоны ссылаются друг на друга, существуют: `equipment.*`, `abilities`, `lootTable[].templateId` у сущностей; `starterEquipment` у игроков; `roomTypePool`/`startRoomTypeId`/`relicPool` у карт; `bossPool` у карт (шаблоны пула обязаны существовать и иметь `isBoss: true`) и `bossRoomTypeId`/`rewardRoomTypeId` → roomTypes (только при заданном `bossPool`); все пулы `fill` (враги/предметы/пропы/ловушки/тайловые эффекты/poi) у типов комнат; `mutuallyExclusiveWith`/`blockedBy` у статусов; `canHaveStatus`/`durationDecreasesWhenHasStatus` у тайловых эффектов; `canHaveStatus` у дверей и пропов; `consumable.tileEffectType`, `grantedAbilities`, `abilityPool[].abilityId`, `fixedModifiers` у предметов (плюс `subtype` предмета ∈ `applicableSubtypes` модификатора и запрет `perLevel` у фирменного модификатора); `statusType` у способностей вида `selfBuff` (существование статуса). Вызывается в `scripts/validate-content.ts` и `src/bootstrap.ts` (fail-fast при старте).

`validateModifierTextPlaceholders(content, textsByLocale)` проверяет, что плейсхолдер `{value}` в описании модификатора встречается только у модификаторов со `scaling: perLevel` или `fixed` (иначе в UI отрисовалась бы заглушка «—»). Вызывается только в `scripts/validate-content.ts` (тексты передаются параметром).

## Модификаторы экипировки (аффиксы и фирменные свойства)

Контентная категория `modifiers` (`src/content/templates/modifiers/`, тексты — `src/content/texts/{ru,en}/modifiers.ts`) — единый источник свойств экипировки: и случайных аффиксов экземпляров, и фирменных свойств шаблонов. Шаблон (`ModifierTemplateSchema`):

- `polarity` — `positive` (default)/`negative` (на экземпляре: 1 положительный + до 1 отрицательного с шансом `NEGATIVE_AFFIX_CHANCE`; для `poolEligible: false` не используется);
- `effect` — `stat` (модификатор характеристики со значением) или `rule` (ID контентного правила из `CONTENT_RULES`);
- `scaling` — `perLevel` (рейнжи ролла значения по уровням `ranges[level-1]`, уровень выше длины — clamp к последнему), `fixed` (детерминированное `value`, для фирменных stat-модификаторов) или `none` (значение не роллится, `value = null`);
- `applicableSubtypes` — непустой список подтипов экипировки, к которым модификатор применим;
- `poolEligible` — участвует ли в случайном ролле (default `true`; `false` — только фирменное свойство конкретных предметов);
- `weight` — вес в пуле ролла (default 1, игнорируется при `poolEligible: false`).

Фирменные свойства предмета задаются полем `fixedModifiers: string[]` шаблона экипировки (ID модификаторов; заменяет удалённые 2026-08-09 `equipModifiers` и `ruleIds` предметов). Экземпляр несёт единый список `InventoryItem.affixes` — фирменные аффиксы (`origin: 'fixed'`, детерминированы) + до 2 случайных (`origin: 'rolled'`, ролл один раз при создании через `state.rng` в `src/simulation/systems/item-affix-roll.ts`; пул фильтруется по `poolEligible`/`applicableSubtypes` и исключает фирменные модификаторы и конфликтующие с ними ruleId). Инварианты (проверяются в `validateContentRuleSemantics` и `scripts/validate-content.ts`): stat-модификатор обязан иметь `scaling: perLevel` или `fixed` (иначе модификатор применился бы со значением 0); rule-модификатор со `scaling: perLevel` — эффект правила обязан содержать `{type: 'ownerParam'}`; плейсхолдер `{value}` в описании — только при `scaling: perLevel` или `fixed`. Ссылки `fixedModifiers` (существование модификатора, `subtype` предмета ∈ `applicableSubtypes`, запрет `perLevel` у фирменного) проверяются в `validateContentReferences`, сами `ruleId` модификаторов — в `validateContentRuleReferences`. Рецепт: `docs/recipes/add-modifier.md`; дизайн — `docs/game-design/equipment-modifiers-concept.md`.

## Шаблоны способностей (union `kind`)

`AbilityTemplateSchema` — discriminated union по полю `kind` (дискриминатор вида механики, camelCase — не контентный id). Общая база всех членов: `id`, `spriteId`, `cooldown`, `apCost` (число или `"all"`), `aiPreparable`, `damageTag?` (тип урона ability-based скиллов), `requiredWeaponTags` (требования к оружию для weapon-based), `tags`, `ruleIds`.

Все виды несут параметры механики прямо в шаблоне (баланс настраивается контентом); исполнитель собирается фабрикой в `getSkillExecutor` (`KIND_FACTORIES` покрывает все виды — забытый ловится компилятором), регистрация исполнителей отсутствует (legacy-реестр удалён 2026-08-12):

- `kind: 'selfBuff'` — `statusType` (валидируется: статус обязан существовать), `duration` — наложение статуса на кастера (`counterattack`, `bulwark`);
- `kind: 'swoop'` — `jumpRadius` (≥ 1), `aoeRadius` (≥ 0), `baseDamage` (≥ 0) — прыжок + площадной удар (`swoop` 2/1/8, `guardian_swoop` 3/1/10);
- `kind: 'groundSlam'` — `radius` (≥ 1), `baseDamage` (≥ 0) — площадной удар по квадрату вокруг кастера по всем существам кроме кастера; DAMAGE-интенты несут тег `skill.<id>` для контентных правил (`ground_slam` 2/12);
- `kind: 'fireball'` — `range` (≥ 1), `aoeRadius` (≥ 0), `centerDamage`, `aoeDamage` — урон по квадрату вокруг выбранной клетки (`fireball` 5/1/20/10);
- `kind: 'magicSlap'` — `range` (≥ 1), `targetCount` (≥ 1), `baseDamage` — урон по нескольким целям (`magic_slap` 5/3/12);
- `kind: 'dash'` — `distance` (≥ 1), `bumpDamage` — рывок с уроном и отталкиванием акторов на пути (`dash` 2/5);
- `kind: 'suddenStrike'` — `silenceDuration` (≥ 1) — удар оружием, немота цели с подготовленной способностью (`sudden_strike` 2);
- `kind: 'cleave'` — без параметров — удар оружием по дуге из трёх клеток (`cleave`);
- `kind: 'throw'` — `range` (≥ 1), `baseDamage` (≥ 0), `pushDistance` (≥ 0) — бросок по одной цели в прямой видимости с отталкиванием на `pushDistance` клеток (цепочка одноклеточных PUSH; урон и `dazed` при столкновении — глобальные правила `collision_*`). Контентных экземпляров пока нет («Бросок камня» пращи — концепт этажа 1, §4.3).

Урон способностей — фиксированные значения из шаблона, без скейлинга от характеристик и уровня (формулы `damageFormula.ts` удалены 2026-08-12); модификаторы урона — через стандартные модификаторы и контентные правила. Исключение — оружейные виды (`cleave`, `suddenStrike`): урон — ролл экипированного оружия.

Новый экземпляр существующего вида — чистый контент (шаблон + тексты); новая механика — новый член union + фабрика в simulation. Рецепт: `docs/recipes/add-ability.md`; разрешение исполнителей — `src/simulation/AGENTS.md`.

## Босс-инфраструктура (roadMap 1.3, 2026-08-14)

- `EntityTemplateSchema.isBoss` (default `false`) — признак босса; заменил удалённый захардкоженный `BOSS_TEMPLATE_IDS` (проверка — `isBossTemplate` в simulation читает реестр). Имена убитых боссов для экрана концовки берутся локализованными из контента. Пример: `cat_guardian` (`isBoss: true`).
- `MapParamsSchema.bossPool` (опционально, min 1) — пул боссов этажа; при заданном пуле генератор назначает босс-комнату и комнату награды и спавнит одного случайного босса из пула. `bossRoomTypeId` (default `'boss'`) и `rewardRoomTypeId` (default `'reward'`) — id типов комнат, назначаемых генератором напрямую.
- Типы комнат `boss` (weight 0, `maxPerFloor: 1`, пустой `fill` — босс спавнится отдельно) и `reward` (weight 0, `guaranteedPois: ['altar']`) — не участвуют во взвешенном ролле, шаблоны в `templates/room-types/`.
- `DoorTemplateSchema.indestructible` (default `false`) — неразрушаемая дверь: движок обнуляет любой урон по ней. Шаблон `boss_door` (тег `boss_room`, `indestructible: true`, негорючая — без тега `flammable` и с пустым `canHaveStatus`; спрайты деревянной двери — временно) в `templates/doors/`. По тегу `boss_room` runtime-контроллер находит двери босс-комнаты.

## Реестр статусов

- `getStatusTemplate(statusType)` — получить шаблон статуса. Реализация: `src/simulation/systems/statuses/status-template.ts` (обёртка над реестром контента).
- Шаблоны статусов хранятся в `src/content/templates/statuses/` и ссылаются на `ruleIds` в `src/simulation/content-rules/`.
- Локализованные описания эффектов статусов живут в `src/content/texts/ru/statuses.ts` и `src/content/texts/en/statuses.ts`.

---

## Контентные правила (content rules)

Контентные правила — это data-driven декларативные реакции на игровые события и интенты. Вместо того чтобы хардкодить эффекты внутри логики оружия или статусов, шаблоны просто ссылаются на `ruleIds`, а сами правила описываются в TypeScript и регистрируются в общем реестре.

### Где живут правила

- **Source-bound правила** (привязанные к предмету, способности или статусу) — массив `CONTENT_RULES` в `src/simulation/content-rules/rules.ts`.
- **Мировые правила** (не привязаны к конкретной сущности, срабатывают от событий в мире) — массив `GLOBAL_WORLD_CONTENT_RULES` в `src/simulation/content-rules/world-rules/global-rules.ts`, реэкспортируемый как `WORLD_CONTENT_RULES` в `src/simulation/content-rules/rules.ts`.

Оба массива попадают в реестр `src/simulation/content-rules/registry.ts`, который проверяет уникальность `id` и выбрасывает ошибку при дублировании.

### Как шаблоны ссылаются на правила

Шаблоны способностей, статусов, тайловых эффектов и статусов тайловых эффектов содержат поле `ruleIds` — массив строк с идентификаторами правил. Шаблоны предметов ссылаются на правила опосредованно — через rule-модификаторы в `fixedModifiers` (`effect: {kind: 'rule', ruleId}`; поле `ruleIds` предметов удалено 2026-08-09). При загрузке контента `src/simulation/content-rules/validation.ts` проверяет, что каждый `ruleId` существует в реестре, а внутри одного шаблона нет повторов.

### Жизненный цикл: `activeRules`

У каждого актора есть кэш `activeRules` — **производный** набор правил, собранный из экипированных предметов, активных статусов и других источников. Когда предмет снимается или статус заканчивается, правило автоматически пропадает из кэша. Подробнее о жизненном цикле, mid-chain статусах и self-эффектах см. `docs/agents/CONTENT_RULES_EDGE_CASES.md`.

### Пример шаблона предмета с фирменным правилом

```ts
import type {ItemTemplateInput} from '../../schemas';

export const commonFlamingSword = {
  id: 'common_flaming_sword',
  type: 'weapon',
  subtype: 'sword',
  level: 1,
  fixedModifiers: ['mod_fire_damage_multiplier'],
  weapon: {
    damage: { min: 4, max: 6 },
    range: 1,
    damageDistribution: [
      { damageTag: 'damage.magical.fire', weight: 1.0 },
    ],
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
} satisfies ItemTemplateInput;
```

Здесь оружие ссылается на правило `item_fire_damage_multiplier` (умножает огненный урон на 1.5) через rule-модификатор `mod_fire_damage_multiplier` в `fixedModifiers`. Для статусов и способностей работает прямой подход: шаблон указывает `ruleIds`, а реестр разрешает их в объекты правил.

Дальность базовой атаки оружия задаётся полями `weapon.range` (максимальная дистанция в клетках, Чебышёв, требуется LOS; int ≥ 1, default 1) и `weapon.minRange` (минимальная дистанция; int ≥ 1, default 1). При `range > 1` базовая атака становится дальней (позиционная форма действия ATTACK с выбором цели); при `minRange > 1` оружие в упор не бьёт — bump в соседнюю клетку отклоняется валидацией (`too_close_for_ranged_weapon`). Подробнее — `src/simulation/AGENTS.md` и рецепт `docs/recipes/add-weapon.md`.

### Связанная документация

- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](./CONTENT_RULES_EDGE_CASES.md) — крайние случаи, порядок слоёв и жизненный цикл `activeRules`.
- [`src/simulation/content-rules/AGENTS.md`](../../src/simulation/content-rules/AGENTS.md) — локальные правила слоя content-rules: как добавить новое правило, шаблоны, чек-лист.

---

## Что контент контролирует (и не контролирует)

**Контролирует:**
- data values (статы, названия, пулы спавна);
- декларативные ссылки на `ruleIds` (правила интерпретирует Simulation, но шаблон выбирает, какие правила активны).

**НЕ контролирует:**
- ❌ Игровую логику (как считается урон, как AI ведёт себя)
- ❌ Рендеринг (как рисуются спрайты)
- ❌ UI layout
- ❌ Формат сохранений

---

## Моддинг

Моддинг через замену файлов больше не поддерживается. Контент — это TypeScript-модули, часть кода и бандла: чтобы добавить или изменить контент, нужно отредактировать шаблоны и пересобрать проект. Это осознанное решение: игра разрабатывается соло с AI-агентами, дизайнера без знания кода нет, а типизация при авторстве важнее возможности править данные без сборки.
