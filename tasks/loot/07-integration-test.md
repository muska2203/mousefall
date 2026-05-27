# Задача 7: Интеграционный тест цикла выпадения лута

> **Статус:** готова к реализации  
> **Зависимости:** все предыдущие задачи (1–6)  
> **Сложность:** средняя

---

## Цель

Проверить полный цикл: атака → смерть врага → выпадение лута → `ITEM_DROPPED` в дереве событий.

---

## Архитектурный контекст

Согласно `AGENTS.md`:
- Интеграционные тесты проверяют взаимодействие нескольких систем.
- Детерминированность: фиксированный seed (`createRNG(12345)`).
- Используем фикстуры из `tests/fixtures/`.

Согласно `LOOT_SYSTEM_PLAN.md`:
- Дерево событий должно содержать: `ACTION_APPLIED` → `DAMAGE` → `ENTITY_DAMAGED` → `DIE` → `ENTITY_DIED` → `SPAWN_ITEM` → `ITEM_DROPPED`.

---

## Что нужно сделать

### Создать `tests/integration/loot-drop-cycle.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createNewGameState } from '../../src/simulation/state';
import { createRNG } from '../../src/utils/rng';
import { DefaultTestSimulation } from '../../src/simulation/simulation'; // или нужный класс
import type { ExecutionNode } from '../../src/simulation/core-types';

describe('Интеграция: цикл выпадения лута', () => {
  it('атака убивает врага и порождает ITEM_DROPPED в дереве событий', () => {
    // 1. Создать state с врагом, у которого hp = 1, lootTable = [{templateId: 'potion', weight: 1}]
    // 2. Игрок атакует врага
    // 3. Вызвать simulation.dispatch({ type: 'ATTACK', entityId: 'player', dx, dy })
    // 4. Проверить дерево ExecutionNode
  });

  it('дерево событий содержит правильную цепочку', () => {
    // ACTION_APPLIED (ATTACK)
    // └── DAMAGE
    //     └── ENTITY_DAMAGED
    //         └── DIE
    //             └── ENTITY_DIED
    //                 └── SPAWN_ITEM
    //                     └── ITEM_DROPPED
  });

  it('ItemEntity появляется в state.entities после хода', () => {
    // После dispatch проверить, что в state.entities есть entity type === 'item'
    // с templateId из lootTable
  });

  it('враг помечен isAlive=false, но ещё в entities до конца хода', () => {
    // Сразу после dispatch враг должен быть в state.entities с isAlive === false
  });

  it('после beginNextPlayerTurn мёртвый враг удалён, а предмет остаётся', () => {
    // ...
  });
});
```

**Требования к фикстуре:**
- `GameState` с картой минимум 3x3 (все клетки — пол).
- Игрок на (1,1), враг на (1,2).
- Враг: `hp: 1`, `maxHp: 1`, `isAlive: true`, `templateId: 'test_enemy'`.
- В шаблоне врага: `lootTable: [{templateId: 'test_potion', weight: 1}]`, `lootDropCount: {min: 1, max: 1}`.
- Игрок: `damage: 999` (чтобы гарантированно убить за один удар).

> Можно создать отдельную фикстуру `tests/fixtures/loot-integration-state.ts`, если не подходит существующая.

---

## Критерии приёмки

- [ ] Интеграционный тест проходит от начала до конца.
- [ ] Дерево `ExecutionNode` содержит `ITEM_DROPPED` как потомок `ENTITY_DIED`.
- [ ] После хода в `state.entities` появляется `ItemEntity`.
- [ ] Мёртвый враг остаётся в `state.entities` до `cleanupDeadEntities`, а после — удаляется.
- [ ] Все остальные тесты продолжают проходить (`npm test`).
