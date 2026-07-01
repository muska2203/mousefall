# TURN_FLOW — Ход игры

> Реализован в `GameSimulation.dispatch()` (`src/simulation/simulation.ts`).

---

## Общая последовательность

Ход игрока и ход окружения чередуются. Одно действие игрока — это один вызов `dispatch()`. Когда у игрока заканчиваются AP, в том же `dispatch()` автоматически запускается ход окружения и подготовка следующего хода игрока.

```
dispatch(action)
  │
  ▼
PLAYER: ACTION_APPLIED (действие игрока) + FOV-обновление
  │
  ▼ (если игрок exhausted)
STATUS_TICK (player)      ← тикают статусы игрока
  │
  ▼
ENVIRONMENT: BEGIN_TURN + TURN_BEGAN + ходы всех AI-актёров
  │
  ▼
PLAYER: beginNextPlayerTurn (CLEANUP_DEAD_ENTITIES, BEGIN_TURN, RESTORE_AP, TICK_COOLDOWN)
  │
  ▼
STATUS_TICK (environment) ← тикают статусы врагов
  │
  ▼
SimulationResult
```

---

## Ход игрока

1. Создаётся `ExecutionBuilder` с событием `ACTION_APPLIED { action }`.
2. Определяется актёр (`resolveActionActor`) — для хода игрока это всегда игрок.
3. Действие валидируется и исполняется через `executeAction`:
   - списываются AP (`CONSUME_AP` → `RESOURCE_CONSUMED { resource: 'ap' }`);
   - handler порождает дочерние интенты (например, `MOVE`, `DAMAGE`);
   - после каждого интента запускаются мировые реакции.
4. Если действие отклонено — возвращается `success: false`.
5. Если актёр — игрок, обновляется поле зрения (`updateFOV`), события добавляются как дети `ACTION_APPLIED`.
6. Корневой узел игрока добавляется в фазу `PLAYER`.
7. Если у игрока закончились AP (`isPlayerExhausted`), запускается `endPlayerTurn()`.

---

## endPlayerTurn — завершение хода игрока

Вызывается внутри `dispatch()`, когда у игрока AP ≤ 0.

1. **STATUS_TICK (player)** — тикают статусы, привязанные к фазе игрока (`burning`, `regeneration` и т.п.).
2. **ENVIRONMENT**:
   - `TURN_BEGAN { side: 'ENVIRONMENT' }` + `BEGIN_TURN` — фиксация начала хода окружения.
   - `runEnvironmentTurn` — все живые AI-актёры делают ходы.
3. **PLAYER (beginNextPlayerTurn)**:
   - `CLEANUP_DEAD_ENTITIES` — физически удаляются мёртвые не-игроковые сущности.
   - `BEGIN_TURN { side: 'PLAYER' }` — `turn.activeSide = 'PLAYER'`, `turn.round += 1`.
   - `RESTORE_AP` — восстанавливаются AP игрока.
   - `TICK_COOLDOWN` — уменьшаются кулдауны способностей игрока.
4. **STATUS_TICK (environment)** — тикают статусы, привязанные к фазе окружения.

---

## Ход окружения (Environment Turn)

Для каждого живого AI-актёра (в порядке сортировки по ID):

1. Создаётся корневой узел `TURN_BEGAN { side: 'ENVIRONMENT', actorId }`.
2. Восстанавливаются AP через `RESTORE_AP` → `AP_RESTORED`.
3. Тикают кулдауны способностей через `TICK_COOLDOWN` → `COOLDOWN_TICKED`.
4. Если актор оглушён — подготовленная способность сбрасывается, эмитится `ABILITY_PREPARED_CANCELLED`, и ход пропускается (`SKIP_STUNNED_TURN`).
5. Основной цикл `while (ap > 0)`:
   - Создаётся `ExecutionBuilder` с placeholder-событием `ACTION_APPLIED (WAIT)`.
   - Вызывается `aiStrategy.decideAction(actor, state, builder, root)`.
   - AI-стратегия может эмитить события как side-effect (например, `ABILITY_PREPARED`) до возврата действия.
   - Корневое событие заменяется на реальное действие, возвращённое стратегией.
   - Результат исполняется через `executeAction`.
   - Если действие невозможно — ход прерывается, `ap` обнуляется.

> **Примечание по prepared-скиллам.** Исполнение подготовленного скилла теперь является решением AI-стратегии внутри основного цикла `while (ap > 0)`.
> `GameSimulation` не содержит специальной фазы для prepared-скиллов; он только предоставляет стратегии доступное AP и вызывает `decideAction`.
> Подготовка скилла — внутренний side-effect AI, а не отдельное действие игрового мира.
> Если `maxAp > apCost` способности, у врага останется AP, и он сможет сделать дополнительные действия в том же ходу.

---

## Prepared-скиллы

### Подготовка

- AI-стратегия принимает решение подготовить скилл как side-effect внутри `decideAction`.
- Хелпер `tryPrepareAbility` (`src/simulation/ai/ai-helpers.ts`) выбирает первую доступную preparable-способность и валидные цели.
- Хелпер `prepareAbility` сохраняет в `enemy.aiState.preparedAbility`:
  - `abilityId`;
  - `targets` — зафиксированные позиции целей.
- Событие `ABILITY_PREPARED { entityId, abilityId, targets, from }` эмитится как child текущего `ACTION_APPLIED`.
- После подготовки стратегия возвращает `WAIT`, чтобы потратить оставшиеся AP и не использовать скилл в том же ходу.

### Исполнение

- Происходит, когда AI-стратегия решает вернуть `USE_ABILITY` для `preparedAbility` внутри основного цикла действий.
- `USE_ABILITY` формируется из `preparedAbility` и исполняется через тот же `executeAction`.
- `use-ability-action.ts` валидирует совпадение `abilityId` и `targets` с `preparedAbility`, а после успешного применения сбрасывает его.
- Сами цели валидировались при подготовке; при исполнении они могли устареть (например, fireball промахнётся по старым координатам).

### Отмена

- При оглушении подготовленная способность сбрасывается и эмитится `ABILITY_PREPARED_CANCELLED`.
- Сброс централизован в helper'е `cancelPreparedAbility` (`src/simulation/ai/ai-helpers.ts`) и вызывается из:
  - `apply-status-intent-executer.ts` — если стан наложили во время хода игрока;
  - `simulation.ts:runEnvironmentTurn` — если враг начинает ход в стане.

---

## Последовательность событий в ходе

```
UI → Presentation: "атака в направлении (dx, dy)"
    │
    ▼
Presentation → simulation.dispatch(ATTACK)
    │
    ▼
Simulation:
  ┌─ ACTION_APPLIED (ATTACK)
  │  └─ ENTITY_DAMAGED (cat_small, damage: 8)
  │     └─ ENTITY_DIED (cat_small)  ← deathReaction
    │
    ▼
Simulation обнаруживает: player.ap <= 0
    │
    ▼
Simulation → endPlayerTurn
  ┌─ STATUS_TICK (player)
  │
  ├─ ENVIRONMENT
  │  ├─ TURN_BEGAN (ENVIRONMENT)
  │  ├─ BEGIN_TURN (ENVIRONMENT)
  │  ├─ TURN_BEGAN (enemy_1)
  │  │  ├─ AP_RESTORED
  │  │  ├─ COOLDOWN_TICKED
  │  │  └─ ACTION_APPLIED (USE_ABILITY)  ← prepared-скилл, если стратегия решила выполнить
  │  │     └─ ABILITY_USED / ENTITY_DAMAGED / ...
  │  └─ ACTION_APPLIED (WAIT)             ← подготовка скилла
  │     └─ ABILITY_PREPARED
  │
  ├─ PLAYER (beginNextPlayerTurn)
  │  ├─ CLEANUP_DEAD_ENTITIES
  │  ├─ BEGIN_TURN (PLAYER)
  │  ├─ AP_RESTORED
  │  └─ COOLDOWN_TICKED
  │
  └─ STATUS_TICK (environment)
    │
    ▼
SimulationResult возвращается в Presentation:
  phases: [PLAYER, STATUS_TICK, ENVIRONMENT, PLAYER, STATUS_TICK]
    │
    ▼
Presentation:
  - Обходит дерево ExecutionNode
  - Формирует AnimationPlan:
      [ATTACK_ANIMATION, DAMAGE_NUMBER, DEATH_ANIMATION, MOVE_SPRITE]
  - Формирует combatLog
  - Обновляет ViewModel
    │
    ▼
UI:
  - PixiJS исполняет анимации
  - React отображает обновлённый HUD и combat log
```
