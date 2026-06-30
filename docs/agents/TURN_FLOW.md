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
4. **Выполнение `preparedIntent`**, если оно есть:
   - Актор не оглушён — исполняется `USE_ABILITY` → `ACTION_APPLIED` → `ABILITY_USED` и списываются AP.
   - Актор оглушён — `preparedIntent` сбрасывается, эмитится `ABILITY_PREPARED_CANCELLED`.
5. Основной цикл `while (ap > 0)`:
   - Вызывается `aiStrategy.decideAction(actor, state)`.
   - Результат исполняется через `executeAction`.
   - Если действие невозможно — ход прерывается, `ap` обнуляется.

> **Примечание по prepared-скиллам.** Подготовленный скилл исполняется *до* основного цикла `while (ap > 0)`.
> Если `maxAp > apCost` способности, у врага останется AP, и он сможет сделать ещё одно или несколько действий в том же ходу.
> Это текущее осознанное поведение, но оно требует геймдизайнерского решения.
> Возможно, ответственность за исполнение `preparedIntent` стоит перенести в AI-стратегию,
> чтобы стратегия сама решала, выполнять ли prepared-скилл и как распорядиться оставшимися AP.

---

## Prepared-скиллы

### Подготовка

- AI-стратегия может вернуть действие `PREPARE_ABILITY`.
- `prepare-ability-action.ts` валидирует цели и флаг `aiPreparable` шаблона.
- Интент `PREPARE_ABILITY` сохраняет в `enemy.aiState.preparedIntent`:
  - `abilityId`;
  - `fixedTargets` — зафиксированные позиции целей.
- Событие: `ABILITY_PREPARED { entityId, abilityId, targets, from }`.
- AP в момент подготовки **не тратятся**; стоимость списывается при исполнении.

### Исполнение

- Происходит в начале следующего хода AI, до основного цикла действий.
- `USE_ABILITY` формируется из `preparedIntent` и исполняется через тот же `executeAction`.
- После успешного исполнения `preparedIntent` очищается.
- Если исполнение отклонено (например, не хватает AP или цель ушла), `preparedIntent` очищается без дополнительных событий — см. п. 3.3 ревью.

### Отмена

- При оглушении в момент хода AI `preparedIntent` сбрасывается и эмитится `ABILITY_PREPARED_CANCELLED`.
- Сброс происходит в двух местах:
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
  │  │  └─ ACTION_APPLIED (USE_ABILITY)  ← prepared-скилл, если есть
  │  └─ AI решает действие (например, MOVE)
  │     └─ ENTITY_MOVED (enemy_1, (3,3) → (4,4))
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
