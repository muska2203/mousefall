# Content Pipeline

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Content is **data-driven**: game entities, items, abilities, and map parameters are defined as TypeScript modules in `src/content/templates/`. The simulation layer reads these definitions at startup and uses them to create game objects.

This means:
- Content is **compile-time type-checked** — mistakes are caught by TypeScript before the game even runs
- Adding a new enemy type requires **no code changes** beyond the template file itself if it reuses an existing AI strategy; new behavior requires an AI strategy in `src/simulation/ai/`
- Runtime safety is preserved: all templates are validated with Zod at startup

---

## Decision: TypeScript vs JSON Content

### Why TypeScript (Chosen)

| Aspect | TypeScript | JSON |
|--------|-----------|------|
| Type safety | Compile-time (`satisfies`) | Runtime only (Zod) |
| Edit without rebuild | ❌ | ✅ |
| Moddable | ❌ (part of the bundle) | ✅ (edit and reload) |
| Designer-friendly | ❌ | ✅ |
| IDE support | Excellent | Good (with JSON schema) |
| Refactoring | ✅ (IDE rename/find-usages) | ❌ (strings, no tooling) |
| Validation | Compile-time + Runtime (Zod) | Runtime (Zod) |

**Verdict:** TypeScript is the right choice for this project's content. The project is developed solo with AI agents — there is no non-programmer designer who would benefit from JSON. The previous JSON decision was reconsidered because:

- JSON stripped type safety at authoring time: mistakes were caught only by runtime validation, after the game started.
- JSON hindered refactoring: renaming a field or a rule id required fragile text searches instead of IDE tooling.
- Modding "replace files without a build" was rejected as an unneeded feature.

Zod is deliberately kept: it remains the engine for defaults and numeric invariants (`int`/`positive`, `weight > 0`, duplicate `ruleIds` checks) and the single source of types. Templates are typed via `satisfies XTemplateInput`, where Input-types are `z.input<>` of the schemas — fields with Zod defaults stay optional at authoring time.

---

## Content Directory Structure

```
src/content/templates/
├── entities/             # Сущности (враги и др.)
│   ├── cat-small.ts
│   ├── cat-mid.ts
│   └── cat-big.ts
├── players/              # Шаблоны игроков
├── items/
│   ├── weapons/
│   ├── armor/
│   ├── amulet/
│   └── consumables/
├── abilities/
├── statuses/
├── tile-effects/
├── tile-effect-statuses/
├── terrains/
├── maps/
├── stairs/
├── doors/
├── props/
├── pois/
├── traps/
└── index.ts              # buildContent(): сборка и Zod-валидация всех шаблонов
```

**Конвенция файла шаблона:** имя файла = `id` в kebab-case, имя константы = camelCase, объект типизируется через `satisfies`:

```ts
import type {EntityTemplateInput} from '../../schemas';

export const catBig = {
  id: 'cat_big',
  // ...
} satisfies EntityTemplateInput;
```

**Why `src/content/` (not `public/`):**
- Templates are compiled and bundled with the code — full compile-time type checking
- Input-types in `src/content/schemas.ts` give autocompletion and instant feedback in the IDE
- No fetch, no manifest: the content list is the static import graph of each category's `index.ts`

---

## Content Schemas (Zod)

Схемы валидации определены в `src/content/schemas.ts`:

- **Entity Template** — поля: id, symbol, health, combat, ai, lootTable, xpReward, interactionKind и др.
- **Item Template** — поля: id, type, stackable, weapon/armor/consumable/amulet stats.
- **Ability Template** — поля: id, targetMode, apCost, cooldown, skillExecutor и др.
- **Map Parameters** — поля: id, width, height, min/max rooms, enemy/item density, pools.

Все схемы используют Zod для runtime-валидации при сборке контента. Input-типы (`EntityTemplateInput`, `ItemTemplateInput` и т.д.) объявлены в конце `src/content/schemas.ts` через `z.input<>` — поля с Zod-дефолтами в них опциональны.

**Примеры контента:** см. `src/content/templates/entities/`, `src/content/templates/items/consumables/`, `src/content/templates/maps/`.

---

## Content Rules

Контентные правила (content rules) — это data-driven способ описывать **реакции** на игровые события и **модификаторы** интентов (например, модификаторы урона). Они хранятся отдельно от шаблонов, но шаблоны предметов, способностей и статусов ссылаются на них по `ruleIds`.

### Почему правила — статические TypeScript-объекты

- Правила — это **код**, а не данные: они описывают семантику игровой механики (триггеры, условия, эффекты, селекторы целей).
- Шаблоны должны оставаться простыми декларативными данными; правила же меняются реже и требуют полной выразительности TypeScript.
- TypeScript даёт compile-time проверку типов `RuleTrigger`, `RuleCondition`, `RuleEffect` и `TargetSelector`.

### Где хранятся правила

- **Source-bound правила** — привязаны к источнику эффекта (предмет, способность, талант, статус). Реестр: `src/simulation/content-rules/rules.ts`.
- **World-rules** — глобальные правила, не привязанные к конкретной сущности. Реестр: `src/simulation/content-rules/world-rules/global-rules.ts`.

Все правила регистрируются статически при импорте модуля реестра (`src/simulation/content-rules/registry.ts`) и доступны по id через `getContentRule(id)` / `tryGetContentRule(id)`.

### Как шаблоны ссылаются на правила

Шаблоны предметов, способностей и статусов содержат поле `ruleIds` — массив строковых идентификаторов правил. При создании экземпляра актора кэшируются активные правила (`activeRules`) из экипировки, статусов и т.д. Этот кэш используется системами реакций и модификаторов.

Пример шаблона статуса:

```ts
import type {StatusTemplateInput} from '../../schemas';

export const burning = {
  id: 'burning',
  ruleIds: ['status_burning_vulnerability'],
  statusCategory: 'elemental',
  categoryPriority: 1,
  mutuallyExclusiveWith: ['frozen'],
  blockedBy: [],
} satisfies StatusTemplateInput;
```

Пример контентного правила (TypeScript-объект):

```ts
{
  id: 'status_burning_vulnerability',
  trigger: {
    event: 'DAMAGE',
    tags: ['damage.magical.fire'],
  },
  conditions: [{ type: 'hasStatus', statusType: 'burning', subject: 'self' }],
  effect: {
    type: 'modifyDamage',
    op: 'multiply',
    value: 1.2,
  },
  target: { type: 'eventTarget' },
  priority: 0,
}
```

### Валидация ссылок при загрузке

При загрузке контента выполняется двухуровневая проверка:

1. **Ссылки шаблонов на правила** (`validateContentRuleReferences` в `src/simulation/content-rules/validation.ts`):
   - Каждый `ruleId` из шаблонов items, abilities и statuses должен существовать в реестре правил.
   - Внутри одного шаблона не должно быть дублирующихся `ruleIds`.
   - При ошибке игра падает fail-fast с понятным сообщением.

2. **Семантика правил** (`validateContentRuleSemantics` в `src/simulation/content-rules/validation.ts`):
   - Проверяет, что правила ссылаются на реально существующие статусы, способности и формулы урона.
   - Проверяет корректность тегов триггера и условий.
   - Возвращает массив ошибок без выброса исключений, чтобы скрипты валидации могли собрать полный отчёт.

### Что не контролируют правила

- ❌ **Порядок исполнения** — он определяется в `src/simulation/content-rules/event-reactions.ts` и `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`.
- ❌ **Визуализацию** — за анимации отвечает Presentation Layer.
- ❌ **Добавление совершенно новых типов интентов** — это изменение модели игры, а не контентное правило.

---

## Content Registry

Реестр контента собирает все шаблоны при старте и предоставляет интерфейс lookup:

- `buildContent()` — синхронная сборка всех шаблонов с Zod-валидацией (`src/content/templates/index.ts`)
- `getEntityTemplate(id)` — получить шаблон сущности
- `getItemTemplate(id)` — получить шаблон предмета
- `getAbilityTemplate(id)` — получить шаблон способности

Реализация: `src/content/registry.ts`.

---

## Content Loading Flow

```
Игровой клиент инициализируется
    │
    ▼
Bootstrap (`src/bootstrap.ts`) вызывает initRegistry(buildContent())
    │
    ├── buildContent() собирает шаблоны из src/content/templates/
    ├── validate each with Zod schema (дефолты и refine-проверки)
    ├── throw on validation error or duplicate id (fail fast)
    ├── populate ContentRegistry
    └── validateContentRuleReferences / validateContentRuleSemantics
    │
    ▼
Game initializes (content is available)
    │
    ▼
Simulation uses getEntityTemplate('cat_small') etc.
```

**Fail fast:** If any template is invalid or an `id` is duplicated, the game refuses to start and shows a clear error. This prevents silent content bugs.

---

## Modding Support

Modding by replacing files is **not supported**. Content is part of the code and the bundle: templates are TypeScript modules compiled together with the game. To change content, edit the templates and rebuild the project. This is a deliberate trade-off — see the decision section above.

---

## Content Validation Errors

При невалидном контенте игра отказывается стартовать. Ошибки содержат:
- Идентификатор шаблона
- Путь к полю
- Сообщение об ошибке Zod

Сборка и валидация: `src/content/templates/index.ts` (`buildContent()`). Отдельная проверка контента без запуска игры: `npm run validate:content` (`scripts/validate-content.ts`) — проверяет `ruleIds`, семантику правил и покрытие переводами ru/en.

---

## What Content Does NOT Control

- ❌ **Game logic** — how combat works, how AI behaves
- ❌ **Rendering logic** — how sprites are drawn
- ❌ **UI layout** — how the HUD is arranged
- ❌ **Save format** — how state is serialized

Content only controls **data values** that the simulation reads.
