# Задача 5: Реакция на смерть `postDeathLootReaction`

> **Статус:** готова к реализации  
> **Зависимости:**
> - Задача 1 (контент и схемы — нужен формат `lootTable` и `lootDropCount`)
> - Задача 2 (`calculateLootDrops` и `rngInt`)
> - Задача 3 (deferred deletion — сущность должна оставаться в `state.entities`)
> - Задача 4 (`SpawnItemIntent` и `executeSpawnItemIntent`)
> **Сложность:** средняя

---

## Цель

Создать WorldReaction, которая при `ENTITY_DIED` рассчитывает лут из `lootTable` врага и порождает `SpawnItemIntent[]`.

---

## Архитектурный контекст

Согласно `AGENTS.md`:
- `WorldReaction` подписывается на событие, получает `state`, `event`, `builder`, `parentNode`, возвращает `Intent[]`.
- Реакции регистрируются в `reactions.ts` через `registerReaction(eventType, handler, priority)`.
- Реакции с меньшим priority выполняются раньше.
- `runWorldReactions` вызывается после каждого Intent-executor'а.

Согласно `LOOT_SYSTEM_PLAN.md`:
- Реакция подписана на `ENTITY_DIED`.
- Получает сущность через `state.entities.get(event.entityId)`.
- Проверяет `entity.type === 'enemy'`.
- Рандомит `count` через `rngInt(state.rng, min, max)`.
- Вызывает `calculateLootDrops`.
- Возвращает `SpawnItemIntent[]`.

---

## Что нужно сделать

### 1. Создать `src/simulation/systems/world-reactions/post-death-loot-reaction.ts`

```typescript
import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { tryGetEntity } from '@simulation/content/registry'; // или loader
import { calculateLootDrops } from '@utils/loot';
import { rngInt } from '@utils/rng';

export const postDeathLootReaction: WorldReaction = (
    state,
    event,
    _builder,
    _parent,
) => {
    if (event.type !== 'ENTITY_DIED') return [];

    const entity = findEntity(state, event.entityId);
    if (!entity || entity.type !== 'enemy') return [];

    const template = tryGetEntity(entity.templateId);
    if (!template) return [];

    const lootTable = template.lootTable;
    if (!lootTable || lootTable.length === 0) return [];

    const dropCount = template.lootDropCount ?? { min: 1, max: 1 };
    const count = rngInt(state.rng, dropCount.min, dropCount.max);

    const drops = calculateLootDrops(lootTable, count, state.rng);

    return drops.map(templateId => ({
        type: 'SPAWN_ITEM' as const,
        templateId,
        position: event.position,
        sourceEntityId: event.entityId,
    }));
};
```

### 2. Зарегистрировать в `src/simulation/systems/world-reactions/reactions.ts`

```typescript
import { postDeathLootReaction } from './post-death-loot-reaction';

// ... после существующих регистраций:
registerReaction('ENTITY_DIED', postDeathLootReaction, 0);
```

---

## Тесты

### `tests/unit/simulation/post-death-loot-reaction.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { postDeathLootReaction } from '../../../src/simulation/systems/world-reactions/post-death-loot-reaction';
import { createRNG } from '../../../src/utils/rng';

describe('postDeathLootReaction', () => {
  it('возвращает [] для врага без lootTable', () => {
    // ...
  });

  it('возвращает SpawnItemIntent для врага с lootTable', () => {
    // Создать state с врагом, у которого lootTable = [{templateId: 'potion', weight: 1}]
    // Создать ENTITY_DIED event
    // Вызвать реакцию
    // Ожидать массив из SpawnItemIntent с templateId === 'potion'
  });

  it('возвращает [] если entity.type !== enemy', () => {
    // Например, entity.type === 'item' или 'stairs'
  });

  it('рендомит count в диапазоне lootDropCount', () => {
    // lootDropCount = { min: 2, max: 3 }
    // Проверить, что количество SpawnItemIntent лежит в [2, 3]
  });
});
```

> Для тестов нужен `GameState` с:
> - загруженным контентом (или замоканным `tryGetEntity`)
> - врагом в `state.entities` (с `type: 'enemy'`, `templateId`, `isAlive: false` после deferred deletion)
> - `state.rng` (seeded)

---

## Критерии приёмки

- [ ] `postDeathLootReaction` создан и зарегистрирован с `priority = 0`.
- [ ] Для врага без `lootTable` возвращает `[]`.
- [ ] Для врага с `lootTable` возвращает `SpawnItemIntent[]` с корректными `templateId`.
- [ ] Проверяет `entity.type === 'enemy'` (не реагирует на смерть игрока, предметов и т.д.).
- [ ] Учитывает `lootDropCount.min / max` при определении количества предметов.
- [ ] Все новые тесты проходят.
- [ ] `npm run typecheck` проходит.
