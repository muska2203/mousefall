# Задача 2: Утилиты расчёта лута и поиска свободной клетки

> **Статус:** готова к реализации  
> **Зависимости:** нет (чистые утилиты, не зависят от других задач лута)  
> **Сложность:** низкая

---

## Цель

Создать две чистые утилиты:
1. `calculateLootDrops` — взвешенный рандом предметов из таблицы.
2. `findFreeTileNear` — поиск ближайшей свободной клетки для спавна предмета.

Обе утилиты размещаются в `src/utils/` (чистые функции, без зависимостей от `GameState`).

---

## Архитектурный контекст

Согласно `AGENTS.md`:
- `utils/` — чистые функции, не импортируют ничего из `simulation/`, `presentation/`, `ui/`.
- Вся случайность в Simulation — через seeded RNG (`utils/rng.ts`), никогда `Math.random()`.
- Тестируемость: unit-тесты на чистые функции, фиксированный seed.

Согласно `LOOT_SYSTEM_PLAN.md`:
- `calculateLootDrops` принимает `lootTable`, `count`, `rng`.
- `findFreeTileNear` принимает `state`, `origin`, опциональный `maxRadius`.

---

## Что нужно сделать

### 1. `src/utils/loot.ts`

```typescript
import { RNGState } from '../simulation/types';
import { rngInt, rngFloat } from './rng';

export function calculateLootDrops(
  lootTable: Array<{ templateId: string; weight: number }>,
  count: number,
  rng: RNGState,
): string[] {
  if (lootTable.length === 0 || count <= 0) return [];

  const totalWeight = lootTable.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) return [];

  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    let roll = rngFloat(rng) * totalWeight;
    for (const entry of lootTable) {
      if (entry.weight <= 0) continue;
      roll -= entry.weight;
      if (roll <= 0) {
        results.push(entry.templateId);
        break;
      }
    }
  }

  return results;
}
```

**Правила:**
- Отрицательные веса трактуются как 0.
- Пустая таблица → `[]`.
- `count = 0` → `[]`.
- Детерминированный (один seed + один вызов = один результат).

### 2. `src/utils/loot-spawn.ts`

```typescript
import { GameState } from '../simulation/types';
import { Position } from '../simulation/core-types';
import { isBlocked } from '../simulation/state';

export function findFreeTileNear(
  state: GameState,
  origin: Position,
  maxRadius: number = 3,
): Position {
  if (!isBlocked(state, origin.x, origin.y)) {
    return origin;
  }

  for (let radius = 1; radius <= maxRadius; radius++) {
    const candidates: Position[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (!isBlocked(state, x, y)) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length > 0) {
      // Детерминированно выбираем первую подходящую (можно расширить до rngPick позже)
      return candidates[0];
    }
  }

  return origin; // fallback: спавним прямо в origin, даже если занята
}
```

**Правила:**
- Проверяет кольца вокруг `origin` по манхэттенскому расстоянию.
- Если всё занято — возвращает `origin` (предметы могут стакаться).
- `maxRadius` по умолчанию `3`.

---

## Тесты

### `tests/unit/utils/loot.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateLootDrops } from '../../../src/utils/loot';
import { createRNG } from '../../../src/utils/rng';

describe('calculateLootDrops', () => {
  it('возвращает пустой массив для пустой таблицы', () => {
    const rng = createRNG(12345);
    expect(calculateLootDrops([], 1, rng)).toEqual([]);
  });

  it('возвращает ровно count предметов', () => {
    const rng = createRNG(12345);
    const table = [{ templateId: 'a', weight: 1 }];
    expect(calculateLootDrops(table, 3, rng)).toEqual(['a', 'a', 'a']);
  });

  it('игнорирует нулевые и отрицательные веса', () => {
    const rng = createRNG(12345);
    const table = [
      { templateId: 'a', weight: -1 },
      { templateId: 'b', weight: 0 },
      { templateId: 'c', weight: 1 },
    ];
    expect(calculateLootDrops(table, 1, rng)).toEqual(['c']);
  });

  it('детерминирован при фиксированном seed', () => {
    const table = [
      { templateId: 'a', weight: 1 },
      { templateId: 'b', weight: 1 },
    ];
    const rng1 = createRNG(999);
    const rng2 = createRNG(999);
    expect(calculateLootDrops(table, 5, rng1)).toEqual(
      calculateLootDrops(table, 5, rng2),
    );
  });
});
```

### `tests/unit/utils/loot-spawn.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { findFreeTileNear } from '../../../src/utils/loot-spawn';
import { createNewGameState } from '../../../src/simulation/state';
import { generateMap } from '../../../src/simulation/systems/mapgen';
import type { MapParams } from '../../../src/simulation/schemas/contentSchemas';

describe('findFreeTileNear', () => {
  it('возвращает origin, если клетка свободна', () => {
    const state = createMockState(); // использовать фикстуру
    const pos = { x: 5, y: 5 };
    expect(findFreeTileNear(state, pos)).toEqual(pos);
  });

  it('находит соседнюю свободную клетку, если origin занята', () => {
    // ...
  });

  it('возвращает origin как fallback, если всё занято', () => {
    // ...
  });
});
```

> Для `loot-spawn.test.ts` используй существующие фикстуры из `tests/fixtures/` или создай минимальный `GameState` через `createNewGameState` + сгенерируй карту.

---

## Критерии приёмки

- [ ] `calculateLootDrops` покрыт тестами на граничные случаи (пустая таблица, count=0, отрицательные веса).
- [ ] `findFreeTileNear` покрыт тестами (свободная клетка, занятая клетка, fallback).
- [ ] Все новые тесты проходят (`npm test -- loot`).
- [ ] `npm run typecheck` проходит.
