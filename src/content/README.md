# Content Layer

## Responsibility

Defines Zod schemas and types for all game content, builds it from TypeScript template modules at startup, and exposes a typed read-only lookup interface to all layers.

Content is authored as TypeScript modules under `templates/`. At startup `buildContent()` parses every template through its Zod schema (defaults applied, invariants checked, duplicate ids rejected) and the result is loaded into the registry. After that, all access is synchronous and read-only — no I/O, no fetch, no manifest.

---

## Module Structure

```
src/content/
├── README.md         # This file
├── schemas.ts        # Zod schemas + TypeScript types for all content (input types at the bottom)
├── registry.ts       # In-memory content store + typed getters
├── templates/        # Content templates as TS modules, grouped by category
│   ├── index.ts      # buildContent(): Zod parsing → LoadedContent
│   ├── entities/     # Enemy templates
│   ├── players/      # Player templates
│   ├── items/        # weapons/, armor/, amulet/, consumables/
│   ├── abilities/    # Active skills
│   ├── statuses/     # Status effects
│   ├── tile-effects/         # Tile effects
│   ├── tile-effect-statuses/ # Statuses from tile effects
│   ├── terrains/     # Terrain templates
│   ├── maps/         # Procedural generation parameters
│   ├── stairs/       # Stairway transitions
│   ├── doors/        # Doors
│   ├── props/        # Props
│   ├── pois/         # Points of interest
│   └── traps/        # Traps
└── texts/            # Localized texts (name/description/flavorText) per locale
```

---

## `schemas.ts`

Zod schemas and inferred TypeScript types for:
- `EntityTemplate` — enemy/NPC definitions
- `PlayerTemplate` — player class/appearance definitions
- `ItemTemplate` — weapon, armor, consumable, etc.
- `AbilityTemplate` — active skills
- `MapParams` — procedural generation parameters
- `StairsTemplate` — stairway transitions
- Plus statuses, terrains, tile effects, doors, props, pois, traps

At the bottom of the file are the `*Input` types (`z.input<typeof ...Schema>`) used for authoring templates — fields with defaults are optional in input.

---

## `templates/`

Each template is a TS module named after its id in kebab-case, exporting a camelCase constant:

```typescript
// templates/entities/cat-big.ts
import type {EntityTemplateInput} from '../../schemas';

export const catBig = {
  id: 'cat_big',
  // ...
} satisfies EntityTemplateInput;
```

Every category folder has an `index.ts` with an array of all its templates (`entityTemplates`, `itemTemplates`, ...). Adding a template = new file + import + one line in that array.

`templates/index.ts` exports the build entry point:

```typescript
// Parses all template arrays through their Zod schemas
// (fail fast on error, fills defaults, rejects duplicate ids)
export function buildContent(): LoadedContent
```

Called once at app startup: `initRegistry(buildContent())` in `src/bootstrap.ts` (synchronous).

---

## `registry.ts`

Holds all loaded content in memory. Provides typed getters used by simulation systems and presentation layer.

```typescript
// The registry is module-level state — initialized once at startup
// This is intentional: content is immutable after load

export function getEntityTemplate(id: string): EntityTemplate
export function getItemTemplate(id: string): ItemTemplate
export function getAbilityTemplate(id: string): AbilityTemplate
export function getMapParams(id: string): MapParams

// Called once at app startup with the buildContent() result
export function initRegistry(data: LoadedContent): void

// For testing: inject mock content
export function resetRegistry(): void
```

---

## Error Handling

Content errors are **fatal** — the game will not start with invalid content:

```
ContentLoadError: Invalid entity template 'cat_big'
  health.max: Expected number, received string
```

This is intentional. Silent content bugs are worse than startup failures.

---

## Testing

For unit tests, use `initRegistry()` to inject mock content directly, without calling `buildContent()`:

```typescript
// In test setup
initRegistry({
  entities: new Map([['cat_small', mockCatSmallTemplate]]),
  items: new Map([['health_potion', mockPotionTemplate]]),
  abilities: new Map(),
  maps: new Map([['dungeon_floor', mockMapParams]]),
  stairs: new Map(),
  players: new Map(),
});
```

---

## Dependency Rules

```
content/schemas.ts          → (nothing — pure types + Zod)
content/templates/**        → content/schemas.ts
content/templates/index.ts  → content/templates/**, content/schemas.ts
content/registry.ts         → content/schemas.ts
```

```
content/ ✗→ simulation/systems/  (no game logic)
content/ ✗→ ui/
content/ ✗→ store/
```
