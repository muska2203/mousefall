# Задача 3: Логическое удаление сущностей (Deferred Deletion)

> **Статус:** ✅ выполнена  
> **Зависимости:** нет (инфраструктурное изменение, можно делать до лута)  
> **Сложность:** средняя

---

## Цель

Вместо немедленного физического удаления врага при смерти, помечать его `isAlive = false` и удалять из `state.entities` только в конце хода. Это позволяет post-death реакциям обращаться к данным сущности.

---

## Архитектурный контекст

Согласно `AGENTS.md` и `ARCHITECTURE.md`:
- Simulation — headless, детерминированный слой.
- Состояние мутируется напрямую внутри функций симуляции.
- `GameState.entities` — `Map<string, Entity>`.
- Существующий флаг `isAlive?: boolean` уже есть в `Attackable` (`src/simulation/types.ts`).
- `findAllAliveAiActors`, `targeting.ts`, `status-effect-ticker.ts` уже фильтруют по `isAlive`.

Согласно `LOOT_SYSTEM_PLAN.md`:
- `executeDieIntent` больше не удаляет врага, а помечает `isAlive = false` и `blocksMovement = false`.
- `deathReaction` защищён от двойного срабатывания.
- `cleanupDeadEntities` физически удаляет мёртвых в `beginNextPlayerTurn`.
- `findAttackableEntity` проверяет `isAlive !== false`.

---

## Что нужно сделать

### 1. `src/simulation/systems/intents/die-intent-executer.ts`

**Было:**
```typescript
import { removeEnemy } from "@simulation/state.ts";
// ...
if (removeEnemy(state, intent.entityId)) {
  return builder.addChild(parent, {type: 'ENTITY_DIED', ...})
}
```

**Станет:**
```typescript
export const executeDieIntent: IntentExecutor<DieIntent> = (
    state: GameState,
    intent: DieIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const entity = state.entities.get(intent.entityId);
    if (!entity) return null;
    
    if (intent.entityId === PLAYER_ID) {
        state.player.hp = 0;
        state.player.isAlive = false;
        state.phase = 'dead';
        return builder.addChild(parent, {type: 'PLAYER_DIED'});
    } else {
        if ('isAlive' in entity) {
            entity.isAlive = false;
            entity.blocksMovement = false;
            return builder.addChild(parent, {
                type: 'ENTITY_DIED',
                entityId: intent.entityId,
                position: intent.position,
            });
        }
    }
    return null;
}
```

> Убрать импорт `removeEnemy`, если он больше не используется.

### 2. `src/simulation/systems/world-reactions/death-reaction.ts`

Добавить проверку на уже мёртвую сущность:

```typescript
export const deathReaction: WorldReaction = (state, event) => {
    if (event.type !== 'ENTITY_DAMAGED') return [];
    const entity = findAttackableEntity(state, event.targetId);
    if (!entity) return [];
    if (entity.hp > 0) return [];
    if (entity.isAlive === false) return []; // ← новое
    const deathPos = { x: entity.x, y: entity.y };
    return [{ type: 'DIE', entityId: entity.id, position: deathPos }];
};
```

### 3. `src/simulation/state.ts`

**3a. Добавить `cleanupDeadEntities`:**

```typescript
export function cleanupDeadEntities(state: GameState): void {
  for (const [id, entity] of state.entities) {
    if ('isAlive' in entity && entity.isAlive === false) {
      state.entities.delete(id);
    }
  }
}
```

**3b. Обновить `findAttackableEntity`:**

```typescript
export function findAttackableEntity(
  state: GameState,
  id: EntityId,
): (Entity & Attackable) | undefined {
  const foundEntity = state.entities.get(id);
  if (foundEntity && 'hp' in foundEntity && foundEntity.isAlive !== false) {
    return foundEntity as Entity & Attackable;
  }
  return undefined;
}
```

### 4. `src/simulation/simulation.ts`

В `beginNextPlayerTurn()` (перед восстановлением AP/раунда):

```typescript
private beginNextPlayerTurn(): void {
    cleanupDeadEntities(this.state);
    this.state.turn.activeSide = 'PLAYER';
    this.state.turn.round += 1;
    this.state.player.ap = this.state.player.maxAp;
    // ...
}
```

### 5. `src/simulation/types.ts` (опционально, но желательно)

Сделать `isAlive` обязательным у `Attackable`, чтобы TypeScript подсвечивал места, где его нет:

```typescript
export interface Attackable {
  hp: number;
  maxHp: number;
  armor: number;
  isAlive: boolean; // ← убрать ?
}
```

> Если это ломает слишком много мест (например, фикстуры), можно оставить `isAlive?: boolean` и полагаться на runtime-проверки. Но лучше сделать обязательным и поправить все места создания сущностей (player в `state.ts`, enemies в `mapgen.ts`).

---

## Тесты

### `tests/unit/simulation/deferred-deletion.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createRNG } from '../../../src/utils/rng';
import { createNewGameState } from '../../../src/simulation/state';
import { executeDieIntent } from '../../../src/simulation/systems/intents/die-intent-executer';
import { deathReaction } from '../../../src/simulation/systems/world-reactions/death-reaction';
import { cleanupDeadEntities, findAttackableEntity } from '../../../src/simulation/state';
import { ExecutionBuilder } from '../../../src/simulation/core-types';

describe('Deferred Deletion', () => {
  it('executeDieIntent помечает врага isAlive=false, но не удаляет из entities', () => {
    // ...
  });

  it('findAttackableEntity возвращает undefined для мёртвой сущности', () => {
    // ...
  });

  it('cleanupDeadEntities физически удаляет мёртвых', () => {
    // ...
  });

  it('deathReaction не срабатывает дважды на одну сущность', () => {
    // Создать entity с hp=0, isAlive=false
    // Вызвать deathReaction с ENTITY_DAMAGED
    // Ожидать []
  });

  it('мёртвая сущность не блокирует проход (blocksMovement=false)', () => {
    // ...
  });
});
```

> Используй существующие фикстуры или создай минимальный `GameState` через `createNewGameState`. Не забудь задать `isAlive: true` при создании врага.

---

## Критерии приёмки

- [ ] `executeDieIntent` не вызывает `removeEnemy` для врагов, а ставит `isAlive = false` и `blocksMovement = false`.
- [ ] `deathReaction` возвращает `[]` для сущности с `isAlive === false`.
- [ ] `findAttackableEntity` возвращает `undefined` для мёртвой сущности.
- [ ] `cleanupDeadEntities` удаляет всех `isAlive === false` из `state.entities`.
- [ ] `beginNextPlayerTurn` вызывает `cleanupDeadEntities`.
- [ ] Все существующие тесты продолжают проходить (`npm test`).
- [ ] Новые тесты на deferred deletion проходят.
