# AI Module

## Responsibility

Enemy AI behaviors. Each file implements one behavior type. AI runs during the AI turn, after the player has acted.

---

## Entry Point

```typescript
// index.ts — called by turn.ts
function processAllEnemies(state: GameState): GameEvent[]
```

Iterates all enemies **sorted by ID** (for determinism), calls the appropriate behavior function for each, collects and returns all events.

---

## Behavior Files

### `aggressive.ts`
Enemy moves toward player and attacks when adjacent.

```typescript
function aggressiveBehavior(state: GameState, enemy: EnemyEntity): GameEvent[]
```

Logic:
1. If player is in sight range → chase
2. If adjacent to player → attack
3. If player not in sight → wander (random adjacent tile)

---

### `passive.ts`
Enemy wanders randomly. Flees when attacked.

```typescript
function passiveBehavior(state: GameState, enemy: EnemyEntity): GameEvent[]
```

Logic:
1. If recently attacked → move away from attacker
2. Otherwise → move to random adjacent walkable tile

---

### `patrol.ts`
Enemy follows a patrol path. Alerts nearby enemies when player spotted.

```typescript
function patrolBehavior(state: GameState, enemy: EnemyEntity): GameEvent[]
```

Logic:
1. If player in sight → switch to aggressive, alert nearby enemies
2. Otherwise → follow patrol waypoints

---

## AI Behavior Selection

Behavior is determined by `enemy.ai.type` from the entity template:

```typescript
// index.ts
function processEnemy(state: GameState, enemy: EnemyEntity): GameEvent[] {
  switch (enemy.ai.type) {
    case 'aggressive': return aggressiveBehavior(state, enemy);
    case 'passive':    return passiveBehavior(state, enemy);
    case 'patrol':     return patrolBehavior(state, enemy);
    default:           return [];
  }
}
```

---

## Determinism Rules

- Enemies processed in sorted ID order (guaranteed by `index.ts`)
- All random decisions use `state.rng`
- No async operations
- No external state

---

## Dependency Rules

```
ai/ → systems/movement.ts  (to move enemies)
ai/ → systems/combat.ts    (to attack player)
ai/ → utils/math.ts        (distance, pathfinding helpers)
```

```
ai/ ✗→ ui/
ai/ ✗→ renderer/
ai/ ✗→ Math.random()
```
