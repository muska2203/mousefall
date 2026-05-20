# Content Pipeline

## Game: Cats and Mouse — 2D Turn-Based Roguelike

---

## Overview

Content is **data-driven**: game entities, items, abilities, and map parameters are defined in JSON files. The simulation layer reads these definitions at startup and uses them to create game objects.

This means:
- Adding a new enemy type requires **no code changes**
- Balance tweaks require **no rebuild**
- Content can be modded by editing JSON files

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
│   │   ├── goblin.json
│   │   ├── orc.json
│   │   └── skeleton.json
│   └── player/
│       └── player.json
├── items/
│   ├── weapons/
│   │   ├── sword.json
│   │   └── dagger.json
│   ├── armor/
│   │   └── leather_armor.json
│   └── consumables/
│       ├── health_potion.json
│       └── scroll_of_fireball.json
├── abilities/
│   ├── slash.json
│   ├── fireball.json
│   └── heal.json
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

Схемы валидации определены в `src/simulation/schemas/`:

- **Entity Template** — `contentSchemas.ts`
  - Поля: id, name, symbol, health, combat, ai, lootTable, xpReward
- **Item Template** — `contentSchemas.ts`
  - Поля: id, name, type, stackable, weapon/armor/consumable stats
- **Map Parameters** — `contentSchemas.ts`
  - Поля: id, width, height, min/max rooms, enemy/item density, pools

Все схемы используют Zod для runtime-валидации.

**Примеры JSON-контента:** см. `public/content/entities/enemies/goblin.json`, `public/content/items/consumables/health_potion.json`, `public/content/maps/dungeon_params.json`.

---

## Content Registry

Реестр контента загружает все JSON-файлы при старте и предоставляет интерфейс lookup:

- `loadContent()` — асинхронная загрузка всех JSON-файлов
- `getEntityTemplate(id)` — получить шаблон сущности
- `getItemTemplate(id)` — получить шаблон предмета

Реализация: `src/simulation/content/registry.ts`.

---

## Content Loading Flow

```
Игровой клиент инициализируется
    │
    ▼
Presentation Layer вызывает loadContent()
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
Simulation uses getEntityTemplate('goblin') etc.
```

**Fail fast:** If any content file is invalid, the game refuses to start and shows a clear error. This prevents silent content bugs.

---

## Modding Support

To mod the game, replace or add files in `public/content/`:

```
public/content/entities/enemies/my_custom_enemy.json
```

The content registry automatically discovers all JSON files in the content directories. No code changes required.

**Mod constraints:**
- Must pass Zod schema validation
- IDs must be unique across all content
- Cannot override core game logic (only data)

---

## Content Validation Errors

При невалидном контенте игра отказывается стартовать. Ошибки содержат:
- Имя файла
- Путь к полю
- Сообщение об ошибке Zod

Реализация валидации: `src/simulation/content/loader.ts`.

---

## What Content Does NOT Control

- ❌ **Game logic** — how combat works, how AI behaves
- ❌ **Rendering logic** — how sprites are drawn
- ❌ **UI layout** — how the HUD is arranged
- ❌ **Save format** — how state is serialized

Content only controls **data values** that the simulation reads.
