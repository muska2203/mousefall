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
├── abilities/
├── statuses/             # Шаблоны статусов (длительность, категория, ruleIds)
├── tile-effects/         # Шаблоны тайловых эффектов (лужи, ловушки)
├── tile-effect-statuses/ # Шаблоны статусов, висящих на тайловых эффектах
├── terrains/             # Шаблоны террейнов
├── maps/                 # Параметры карт
├── stairs/
├── doors/
├── props/
├── pois/
├── traps/
└── index.ts              # buildContent(): LoadedContent — сборка и валидация всех шаблонов

src/content/ids.ts        # Замкнутые наборы ID: WEAPON_FORMULA_IDS, AI_STRATEGY_IDS, MAP_STRATEGY_IDS.
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

Реализация: `src/content/templates/index.ts`, `src/content/registry.ts`.

## Замкнутые наборы ID (`src/content/ids.ts`)

Часть строковых идентификаторов, на которые ссылаются шаблоны, типизирована через `z.enum` от констант в `src/content/ids.ts` — опечатка ловится typecheck'ом, а не в рантайме:

- `WEAPON_FORMULA_IDS` → `weapon.damageFormulaId` (реализации — `src/simulation/systems/stats/weapon-formulas.ts`);
- `AI_STRATEGY_IDS` → `entities[].aiStrategyId` (реализации — `src/simulation/ai/*-strategy.ts`);
- `MAP_STRATEGY_IDS` → `maps[].strategy` (реализации — `src/simulation/systems/map-generation/`).

Добавление новой формулы/стратегии: расширить массив в `ids.ts`, реализовать код в simulation — компилятор подскажет места регистрации.

## Валидация перекрёстных ссылок (`src/content/validate-references.ts`)

`validateContentReferences(content)` проверяет, что id, на которые шаблоны ссылаются друг на друга, существуют: `equipment.*`, `abilities`, `lootTable[].templateId` у сущностей; `starterEquipment` у игроков; `enemyPool`/`itemPool` у карт; `mutuallyExclusiveWith`/`blockedBy` у статусов; `canHaveStatus`/`durationDecreasesWhenHasStatus` у тайловых эффектов; `canHaveStatus` у дверей и пропов; `consumable.tileEffectType`, `grantedAbilities`, `abilityPool[].abilityId` у предметов. Вызывается в `scripts/validate-content.ts` и `src/bootstrap.ts` (fail-fast при старте).

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

Шаблоны предметов, способностей, статусов, тайловых эффектов и статусов тайловых эффектов содержат поле `ruleIds` — массив строк с идентификаторами правил. При загрузке контента `src/simulation/content-rules/validation.ts` проверяет, что каждый `ruleId` существует в реестре, а внутри одного шаблона нет повторов.

### Жизненный цикл: `activeRules`

У каждого актора есть кэш `activeRules` — **производный** набор правил, собранный из экипированных предметов, активных статусов и других источников. Когда предмет снимается или статус заканчивается, правило автоматически пропадает из кэша. Подробнее о жизненном цикле, mid-chain статусах и self-эффектах см. `docs/agents/CONTENT_RULES_EDGE_CASES.md`.

### Пример шаблона с `ruleIds`

```ts
import type {ItemTemplateInput} from '../../schemas';

export const commonFlamingSword = {
  id: 'common_flaming_sword',
  type: 'weapon',
  ruleIds: ['item_fire_damage_multiplier'],
  weapon: {
    baseDamage: 5,
    damageFormulaId: 'sword',
    range: 1,
    damageDistribution: [
      { damageTag: 'damage.magical.fire', weight: 1.0 },
    ],
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
} satisfies ItemTemplateInput;
```

Здесь оружие ссылается на правило `item_fire_damage_multiplier`, которое умножает огненный урон на 1.5. Такой же подход работает для статусов и способностей: шаблон указывает `ruleIds`, а реестр разрешает их в объекты правил.

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
