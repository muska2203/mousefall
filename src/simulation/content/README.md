# Simulation Content Registry

## Responsibility

Loads JSON content files from `public/content/`, validates them with Zod schemas, and exposes a typed lookup interface to the simulation layer.

This module is the **only** place in the simulation that touches async I/O (at startup). After loading, all access is synchronous.

---

## Module Structure

```
simulation/content/
├── README.md
├── registry.ts   # In-memory content store + typed getters
└── loader.ts     # Async fetch + Zod validation for each content type
```

---

## `registry.ts`

Holds all loaded content in memory. Provides typed getters used by simulation systems.

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
export function initRegistryFromData(data: LoadedContent): void
```

---

## `loader.ts`

Fetches all JSON files and validates them. Called once at app startup.

```typescript
// Main entry point — called from App.tsx before game starts
export async function loadAllContent(): Promise<void>
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

For unit tests, use `initRegistryFromData()` to inject mock content without fetching files:

```typescript
// In test setup
initRegistryFromData({
  entities: new Map([['cat_small', mockCatSmallTemplate]]),
  items: new Map([['health_potion', mockPotionTemplate]]),
  abilities: new Map(),
  maps: new Map([['dungeon_floor', mockMapParams]]),
});
```

---

## Dependency Rules

```
content/registry.ts → simulation/schemas/  (Zod schemas)
content/loader.ts   → content/registry.ts
content/loader.ts   → simulation/schemas/  (validation)
```

```
content/ ✗→ simulation/systems/  (no game logic)
content/ ✗→ ui/
content/ ✗→ store/
```
