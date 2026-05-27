# Задача 4: Новый Intent/Event `SPAWN_ITEM` и его Executor

> **Статус:** готова к реализации  
> **Зависимости:**
> - Задача 2 (`findFreeTileNear` из `src/utils/loot-spawn.ts`)
> - Задача 3 (deferred deletion — желательно, но unit-тест executor'а может работать и без неё)
> **Сложность:** средняя

---

## Цель

Добавить новый тип Intent `SPAWN_ITEM`, обновить `ItemDroppedEvent`, создать `executeSpawnItemIntent` и зарегистрировать его.

---

## Архитектурный контекст

Согласно `AGENTS.md`:
- Intent → `execute()` → Event. `ExecutionBuilder` создаёт дерево событий.
- `IntentExecutor<T>` мутирует состояние и создаёт узлы событий.
- `runWorldReactions` вызывается после каждого Intent, порождая дополнительные Intents.
- Все типы в `src/simulation/core-types.ts` должны быть JSON-сериализуемы.

Согласно `LOOT_SYSTEM_PLAN.md`:
- `SpawnItemIntent` содержит `templateId`, `position`, `sourceEntityId`.
- `ItemDroppedEvent` обновляется: `entityId` → `dropperEntityId`, добавляется `templateId`.

---

## Что нужно сделать

### 1. Обновить `src/simulation/core-types.ts`

**1a. Добавить `SpawnItemIntent`:**

```typescript
export type SpawnItemIntent = {
  type: 'SPAWN_ITEM';
  templateId: string;
  position: Position;
  sourceEntityId: EntityId;
};
```

**1b. Добавить в union `Intent`:**

```typescript
export type Intent =
  | MoveIntent
  | DamageIntent
  | DieIntent
  | ApplyStatusIntent
  | ChangeFloorIntent
  | ConsumeMpIntent
  | SetCooldownIntent
  | ConsumeApIntent
  | TickStatusEffectsIntent
  | SpawnItemIntent; // ← новый
```

**1c. Обновить `ItemDroppedEvent`:**

```typescript
export type ItemDroppedEvent = {
  type: 'ITEM_DROPPED';
  dropperEntityId: EntityId;
  itemInstanceId: ItemInstanceId;
  templateId: string;
  position: Position;
};
```

### 2. Создать `src/simulation/systems/intents/spawn-item-intent-executor.ts`

```typescript
import { SpawnItemIntent, IntentExecutor } from "./types";
import { GameState } from "@simulation/types";
import { ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types";
import { nextEntityId } from "@simulation/state";
import { findFreeTileNear } from "@utils/loot-spawn";
import { tryGetItem } from "@simulation/content/registry"; // или какой там реестр

export const executeSpawnItemIntent: IntentExecutor<SpawnItemIntent> = (
    state: GameState,
    intent: SpawnItemIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const template = tryGetItem(intent.templateId);
    if (!template) return null; // graceful skip

    const spawnPos = findFreeTileNear(state, intent.position);

    const item = {
        id: nextEntityId(state, 'item'),
        type: 'item' as const,
        templateId: intent.templateId,
        x: spawnPos.x,
        y: spawnPos.y,
        blocksMovement: false,
        displayName: template.name,
        quantity: 1,
        // ... остальные поля ItemEntity по необходимости
    };

    state.entities.set(item.id, item);

    const event = {
        type: 'ITEM_DROPPED' as const,
        dropperEntityId: intent.sourceEntityId,
        itemInstanceId: item.id,
        templateId: intent.templateId,
        position: { x: item.x, y: item.y },
    };

    return builder.addChild(parent, event);
};
```

> Важно: `tryGetItem` должен быть импортирован из реестра контента. Если такой функции нет — используй существующий `LoadedContent` или Content Registry.

### 3. Зарегистрировать в `src/simulation/systems/intents/execute-intent.ts`

```typescript
import { executeSpawnItemIntent } from "@simulation/systems/intents/spawn-item-intent-executor";

const intentExecutors = {
  // ...
  SPAWN_ITEM: executeSpawnItemIntent,
};
```

---

## Тесты

### `tests/unit/simulation/spawn-item-intent-executor.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { executeSpawnItemIntent } from '../../../src/simulation/systems/intents/spawn-item-intent-executor';
import { createNewGameState } from '../../../src/simulation/state';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import { createRNG } from '../../../src/utils/rng';

describe('executeSpawnItemIntent', () => {
  it('создаёт ItemEntity и добавляет в state.entities', () => {
    // ...
  });

  it('использует findFreeTileNear для занятой клетки', () => {
    // ...
  });

  it('порождает ITEM_DROPPED с правильными полями', () => {
    // Проверить dropperEntityId, templateId, position
  });

  it('возвращает null и не меняет state при невалидном templateId', () => {
    // ...
  });
});
```

> Для тестов нужен минимальный `GameState` с загруженным контентом. Если контент не загружен в тестах, замокай `tryGetItem` или используй фикстуру состояния с предзагруженным реестром.

---

## Критерии приёмки

- [ ] `SpawnItemIntent` добавлен в `core-types.ts` и в union `Intent`.
- [ ] `ItemDroppedEvent` обновлён (`dropperEntityId`, `templateId`).
- [ ] `executeSpawnItemIntent` создан, зарегистрирован в `execute-intent.ts`.
- [ ] Предмет спавнится через `findFreeTileNear`.
- [ ] При невалидном `templateId` возвращается `null`, state не меняется.
- [ ] Все новые тесты проходят.
- [ ] `npm run typecheck` проходит.
