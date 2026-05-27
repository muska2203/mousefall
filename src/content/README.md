# Content Layer

## Responsibility

Loads JSON content files from `public/content/`, validates them with Zod schemas, and exposes a typed lookup interface to all layers.

This module is the **only** place that touches async I/O (at startup). After loading, all access is synchronous and read-only.

---

## Module Structure

```
src/content/
├── README.md      # This file
├── schemas.ts     # Zod schemas + TypeScript types for all content
├── registry.ts    # In-memory content store + typed getters
└── loader.ts      # Async fetch + Zod validation for each content type
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

// Called once at app startup by loader.ts
export function initRegistry(data: LoadedContent): void

// For testing: inject mock content without fetching files
export function resetRegistry(): void
```

---

## `loader.ts`

Fetches all JSON files and validates them. Called once at app startup.

```typescript
// Main entry point — called from App.tsx before game starts
export async function loadAllContent(fetchJson: FetchJson): Promise<void>
```

Load sequence:
1. Fetch all JSON files from `public/content/` subdirectories
2. Parse JSON
3. Validate each file against its Zod schema (fail fast on error)
4. Call `initRegistry()` with validated data

---

## Error Handling

Content errors are **fatal** — the game will not start with invalid content:

```
ContentLoadError: Invalid entity in public/content/entities/enemies/cat_small.json
  health.max: Expected number, received string
```

This is intentional. Silent content bugs are worse than startup failures.

---

## Testing

For unit tests, use `initRegistry()` to inject mock content without fetching files:

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
content/schemas.ts  → (nothing — pure types + Zod)
content/registry.ts → content/schemas.ts
content/loader.ts   → content/registry.ts, content/schemas.ts
```

```
content/ ✗→ simulation/systems/  (no game logic)
content/ ✗→ ui/
content/ ✗→ store/
```
