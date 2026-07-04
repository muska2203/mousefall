# AI_SYSTEM — Искусственный интеллект врагов

> Как устроены AI-стратегии, реестр тактических утилит и правила внесения изменений.

---

## Быстрый старт

1. **Добавить новую тактическую утилиту** → `src/simulation/ai/tactics/`
2. **Добавить новую стратегию** → `src/simulation/ai/*-strategy.ts`, зарегистрировать через `registerStrategy`
3. **Изменить поведение существующего врага** → править его стратегию, а не утилиты
4. **Изменить способ выполнения действия** (например, как искать путь) → править утилиту

---

## Архитектура: разделение ответственности

AI в Mousefall построен по принципу **«стратегия решает что, утилиты решают как»**.

```
┌─────────────────────────────────────────────┐
│  Стратегия (*-strategy.ts)                  │
│  - Владеет приоритетами и FSM-режимами      │
│  - Выбирает цель                            │
│  - Решает, когда атаковать / отступать      │
│  - Возвращает GameAction                    │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Реестр тактических утилит (tactics/)       │
│  - Превращают решение в конкретный action   │
│  - Содержат pathfinding, выбор позиции      │
│  - Не знают о приоритетах стратегии         │
└─────────────────────────────────────────────┘
```

### Что делает стратегия

- Определяет **порядок приоритетов**: сначала атаковать, потом преследовать, потом отступить.
- Управляет **FSM**: `idle → chase → return`.
- Выбирает **цель**: игрок, слабейший враг, точка патрулирования.
- Решает, **когда** использовать доступные способности (если стратегия работает со скиллами).
- Мутирует `enemy.aiState` (режим, target, home).
- Возвращает `GameAction` или эмитит side-эффекты через `ExecutionBuilder`.

### Что делает тактическая утилита

- Превращает высокоуровневое решение в конкретный `GameAction`.
- Считает путь, выбирает направление атаки, проверяет досягаемость.
- Не решает, стоит ли действовать — только **как** выполнить команду.
- Не мутирует `aiState`, не эмитит события (кроме явных helper'ов вроде `prepareAbility`).

---

## Структура файлов

```
src/simulation/ai/
├── strategy-registry.ts      # Реестр стратегий
├── ai-state.ts               # JSON-сериализуемое состояние FSM
├── ai-helpers.ts             # Общие helpers: зрение, prepareAbility, wait
├── cast-helpers.ts           # Helpers для выбора preparable-способностей
├── *-strategy.ts             # Конкретные стратегии (hunter, simple-boss, ...)
└── tactics/                  # Реестр тактических утилит
    ├── index.ts              # Публичный API
    ├── types.ts              # Типы: AttackTarget, CloseCombatResult, ...
    ├── targeting.ts          # Выбор цели
    ├── movement.ts           # Передвижение и ближний бой
    └── ...                   # Будущие модули: positioning, ability, etc.
```

---

## Правила разработки AI

### Обязательно

1. **Любая новая тактика добавляется в `src/simulation/ai/tactics/`**.
   - Если нескольким стратегиям нужна одна и та же логика — она должна жить в утилите, а не дублироваться в стратегиях.

2. **Стратегия не считает путь сама**.
   - Используй `moveToward`, `closeCombat`, `attackTarget` из `tactics/`.

3. **Утилита не решает, атаковать ли**.
   - Утилита отвечает только на вопрос «как технически выполнить выбранное действие».

4. **Утилита не мутирует `aiState` и не эмитит события**.
   - Исключение: явные side-effect helpers в `ai-helpers.ts` (`prepareAbility`, `cancelPreparedAbility`).

5. **Новая стратегия регистрируется через `registerStrategy(id, {...})`**.
   - `id` совпадает с `aiStrategyId` из JSON-шаблона врага.
   - `strategy` в `AIState` — строка, поэтому core-типы править не нужно.

### Запрещено

- Писать pathfinding или выбор цели прямо в стратегии.
- Дублировать логику `closeCombat` / `moveToward` в нескольких стратегиях.
- Мутировать `GameState` вне `aiState` из стратегии.
- Использовать `Math.random()` или browser API.

---

## Как добавить тактическую утилиту

1. **Создать или открыть модуль** в `src/simulation/ai/tactics/` по домену:
   - Движение → `movement.ts`
   - Выбор цели → `targeting.ts`
   - Позиционирование → `positioning.ts`
   - Скиллы → `ability.ts`

2. **Определить тип результата** в `types.ts`, если нужен новый:

   ```ts
   export type SomeTacticResult =
     | { kind: 'action'; action: GameAction }
     | { kind: 'none'; reason?: string };
   ```

3. **Реализовать функцию**:
   - Чистая функция от `(actor, state, ...)`.
   - Детерминирована при одинаковом `state`.
   - Не мутирует состояние.

4. **Экспортировать в `index.ts`**.

5. **Добавить unit-тесты** в `tests/unit/simulation/ai/tactics/`.

---

## Как добавить новую стратегию

1. **Создать файл** `src/simulation/ai/my-strategy.ts`.

2. **Импортировать нужные утилиты**:

   ```ts
   import { findVisibleAttackTarget, closeCombat, moveToward } from './tactics';
   ```

3. **Зарегистрировать стратегию**:

   ```ts
   registerStrategy('my-strategy', {
     updateState(actor, state) { /* FSM-тики */ },
     onWorldChange(actor, state, change) { /* реакция на движение/двери */ },
     decideAction(actor, state, builder, parent) { /* возвращаем GameAction */ },
   });
   ```

   - `updateState` — вызывается в начале хода актора для FSM-тиков.
   - `onWorldChange` — вызывается для каждого заметного события мира (движение, двери), пока ходит игрок.
   - `decideAction` — вызывается в фазе окружения, возвращает `GameAction`.

4. **Указать `aiStrategyId`** в JSON-шаблоне врага в `public/content/entities/enemies/`.

5. **Добавить интеграционные тесты** для нового поведения.

---

## Реакция стратегии на изменения мира

Кроме собственного хода, стратегия может получать уведомления о событиях игрока через `onWorldChange`.

### Контракт

```ts
onWorldChange?(actor: AiActor, state: GameState, change: WorldChange): void;
```

`WorldChange` описывает факт изменения мира, а не решение стратегии:

```ts
type WorldChange =
  | { kind: 'entity_moved'; entityId: EntityId; from: Position; to: Position }
  | { kind: 'door_opened'; position: Position }
  | { kind: 'door_closed'; position: Position };
```

### Правила

1. **Стратегия сама проверяет видимость.** Мир делает только грубый фильтр по расстоянию; FOV и LOS проверяются в `onWorldChange`.
2. **Только мутация `aiState`.** Вне своего хода стратегия не может возвращать `GameAction` или эмитить события.
3. **Не дублируйте логику.** Если несколько стратегий реагируют одинаково (например, "увидел игрока → chase"), вынесите общий helper в `ai-helpers.ts`.

### Пример

```ts
onWorldChange(actor, state, change) {
  if (!isEnemyEntity(actor)) return;

  if (change.kind === 'entity_moved' && change.entityId === state.player.id) {
    if (canSeePosition(actor, state, change.to)) {
      actor.aiState.mode = 'chase';
      actor.aiState.targetX = change.to.x;
      actor.aiState.targetY = change.to.y;
    }
  }
}
```

---

## Пример: стратегия охотника

```ts
import { registerStrategy } from './strategy-registry';
import { wait } from './ai-helpers';
import { findVisibleAttackTarget, closeCombat, moveToward } from './tactics';

registerStrategy('hunter', {
  updateState(actor, state) {
    // FSM: idle → chase → return
  },

  onWorldChange(actor, state, change) {
    // Реакция на движение игрока или изменение двери.
    // Стратегия сама проверяет FOV/LOS и решает, переключаться ли в chase.
  },

  decideAction(actor, state, builder, parent) {
    // Стратегия решает: если видим цель — идём в ближний бой.
    const visibleTarget = findVisibleAttackTarget(actor, state);
    if (visibleTarget) {
      const result = closeCombat(actor, state, visibleTarget);
      if (result.kind !== 'blocked') return result.action;
      return wait(actor);
    }

    // Иначе действуем по FSM...
  },
});
```

Важно: `findVisibleAttackTarget` и `closeCombat` знают **как** найти цель и как к ней подойти. Стратегия решает **что** с ней делать.

---

## Типы целей

`AttackTarget` — абстракция любой атакуемой сущности:

```ts
export type AttackTarget = {
  id: EntityId;
} & Position & Attackable;
```

Сейчас `findVisibleAttackTarget` возвращает только игрока, но тип позволяет в будущем расширить выбор на другие сущности без переписывания утилит.

---

## Тестирование

- **Утилиты** тестируются изолированно: `tests/unit/simulation/ai/tactics/`.
- **Стратегии** тестируются через `GameSimulation.dispatch()` с подготовленным `GameState`.
- **FSM-переходы** проверяются через изменение `enemy.aiState.mode` после хода.
- Каждая новая утилита должна иметь unit-тесты.

---

## См. также

- [`docs/agents/TURN_FLOW.md`](./TURN_FLOW.md) — ход окружения и вызов стратегий
- [`docs/agents/ACTION_SYSTEM.md`](./ACTION_SYSTEM.md) — Action / Intent / Event
- [`src/simulation/AGENTS.md`](../../src/simulation/AGENTS.md) — правила слоя Simulation
