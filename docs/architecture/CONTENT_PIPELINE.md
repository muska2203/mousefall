# Content Pipeline

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Content is **data-driven**: game entities, items, abilities, and map parameters are defined in JSON files. The simulation layer reads these definitions at startup and uses them to create game objects.

This means:
- Balance tweaks require **no rebuild**
- Content can be modded by editing JSON files
- Adding a new enemy type requires **no code changes** if it reuses an existing AI strategy; new behavior requires an AI strategy in `src/simulation/ai/`

---

## Decision: TypeScript vs JSON Content

### Why JSON (Chosen)

| Aspect | TypeScript | JSON |
|--------|-----------|------|
| Type safety | Compile-time | Runtime (Zod) |
| Edit without rebuild | ❌ | ✅ |
| Moddable | ❌ (requires build tools) | ✅ (edit and reload) |
| Designer-friendly | ❌ | ✅ |
| IDE support | Excellent | Good (with JSON schema) |
| Validation | Compile-time | Runtime (Zod) |

**Verdict:** JSON is the right choice for game content. Runtime validation with Zod provides sufficient safety. TypeScript is used for the schema definitions, not the content itself.

---

## Content Directory Structure

```
public/content/
├── entities/
│   ├── enemies/
│   │   ├── cat_small.json
│   │   ├── cat_mid.json
│   │   └── cat_big.json
│   ├── player/
│   │   └── witcher.json
│   ├── doors/
│   │   └── wooden_door.json
│   └── stairs/
│       └── stone_stairs.json
├── items/
│   ├── weapons/
│   │   ├── sword.json
│   │   └── dagger.json
│   ├── armor/
│   ├── amulet/
│   └── consumables/
│       ├── health_potion.json
│       └── scroll_of_fireball.json
├── abilities/
│   ├── counterattack.json
│   ├── dash.json
│   ├── fireball.json
│   ├── magic_slap.json
│   └── swoop.json
└── maps/
    ├── dungeon_params.json
    └── boss_room.json
```

**Why `public/content/`:**
- Served as static files (no bundling required)
- Can be replaced/extended without rebuilding
- Supports hot-reload in development
- Supports modding (replace files in `public/content/`)

---

## Content Schemas (Zod)

Схемы валидации определены в `src/content/schemas.ts`:

- **Entity Template** — поля: id, symbol, health, combat, ai, lootTable, xpReward, interactionKind и др.
- **Item Template** — поля: id, type, stackable, weapon/armor/consumable/amulet stats.
- **Ability Template** — поля: id, targetMode, apCost, cooldown, skillExecutor и др.
- **Map Parameters** — поля: id, width, height, min/max rooms, enemy/item density, pools.

Все схемы используют Zod для runtime-валидации.

**Примеры JSON-контента:** см. `public/content/entities/enemies/cat_small.json`, `public/content/items/consumables/health_potion.json`, `public/content/maps/default.json`.

---

## Content Rules

Контентные правила (content rules) — это data-driven способ описывать **реакции** на игровые события и **модификаторы** интентов (например, модификаторы урона). Они хранятся отдельно от JSON-шаблонов, но шаблоны предметов, способностей и статусов ссылаются на них по `ruleIds`.

### Почему правила — статические TypeScript-объекты

- Правила — это **код**, а не данные: они описывают семантику игровой механики (триггеры, условия, эффекты, селекторы целей).
- JSON-шаблоны должны оставаться простыми и редактироваться без пересборки; правила же меняются реже и требуют компиляции.
- TypeScript даёт compile-time проверку типов `RuleTrigger`, `RuleCondition`, `RuleEffect` и `TargetSelector`.

### Где хранятся правила

- **Source-bound правила** — привязаны к источнику эффекта (предмет, способность, талант, статус). Реестр: `src/simulation/content-rules/rules.ts`.
- **World-rules** — глобальные правила, не привязанные к конкретной сущности. Реестр: `src/simulation/content-rules/world-rules/global-rules.ts`.

Все правила регистрируются статически при импорте модуля реестра (`src/simulation/content-rules/registry.ts`) и доступны по id через `getContentRule(id)` / `tryGetContentRule(id)`.

### Как шаблоны ссылаются на правила

Шаблоны предметов, способностей и статусов содержат поле `ruleIds` — массив строковых идентификаторов правил. При создании экземпляра актора кэшируются активные правила (`activeRules`) из экипировки, статусов и т.д. Этот кэш используется системами реакций и модификаторов.

Пример JSON-шаблона статуса:

```json
{
  "id": "burning",
  "ruleIds": ["status_burning_vulnerability"],
  "statusCategory": "elemental",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": ["frozen"],
  "blockedBy": []
}
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

Реестр контента загружает все JSON-файлы при старте и предоставляет интерфейс lookup:

- `loadAllContent(fetchJson)` — асинхронная загрузка всех JSON-файлов
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
UI entry (`src/main.tsx`) вызывает loadAllContent(browserFetchJson)
    │
    ├── fetch all JSON files
    ├── validate each with Zod schema
    ├── throw on validation error (fail fast)
    └── populate ContentRegistry
    │
    ▼
Game initializes (content is available)
    │
    ▼
Simulation uses getEntityTemplate('cat_small') etc.
```

**Fail fast:** If any content file is invalid, the game refuses to start and shows a clear error. This prevents silent content bugs.

---

## Modding Support

To mod the game, replace or add files in `public/content/`:

```
public/content/entities/enemies/my_custom_enemy.json
```

Then add the new file path to `public/content/manifest.json`. The content loader reads files strictly from the manifest (`src/content/loader.ts`). To regenerate the manifest from the current file tree, run:

```bash
npm run generate-manifest
```

**Mod constraints:**
- Must pass Zod schema validation
- IDs must be unique across all content
- File must be listed in `public/content/manifest.json`
- Cannot override core game logic (only data)

---

## Content Validation Errors

При невалидном контенте игра отказывается стартовать. Ошибки содержат:
- Имя файла
- Путь к полю
- Сообщение об ошибке Zod

Реализация валидации: `src/content/loader.ts`.

---

## What Content Does NOT Control

- ❌ **Game logic** — how combat works, how AI behaves
- ❌ **Rendering logic** — how sprites are drawn
- ❌ **UI layout** — how the HUD is arranged
- ❌ **Save format** — how state is serialized

Content only controls **data values** that the simulation reads.
