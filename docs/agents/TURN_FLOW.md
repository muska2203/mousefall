# TURN_FLOW — Ход игры

> Реализован в `GameSimulation` (`src/simulation/simulation.ts`).

---

## Обзор

Ход игры разбит на раунды. Каждый раунд состоит из фаз фракций в фиксированном порядке и завершается фазой восстановления.

Публичный API для управления ходом:

- `dispatch(action)` — выполняет **одно действие текущего актора**. Presentation использует его для игрока.
- `step()` — выполняет **следующую системную фазу или одно действие AI**. Presentation вызывает его после завершения анимации предыдущей фазы, пока `hasMoreSteps === true`.
- `isPlayerTurn()` — возвращает `true`, если сейчас ожидается ввод игрока.

```
Начало игры / загрузка
    │
    ▼
actor-turn 'player'           ← первый ход игрока без предварительного сетапа
    │
    ▼
Игрок: MOVE → ATTACK → END_TURN
    │
    ▼
faction-setup 'allies'
    │
    ▼
actor-turn 'ally_1' → END_TURN
actor-turn 'ally_2' → END_TURN
    │
    ▼
faction-setup 'enemies'
    │
    ▼
actor-turn 'enemy_A' → MOVE → ATTACK → END_TURN
actor-turn 'enemy_B' → USE_ABILITY → END_TURN
    │
    ▼
faction-setup 'neutrals'
    │
    ▼
actor-turn 'neutral_1' → END_TURN
    │
    ▼
round-recovery                ← cleanup dead entities, сброс actorsDoneThisRound
    │
    ▼
faction-setup 'player'        ← со второго раунда: сетап игрока, round += 1
    │
    ▼
actor-turn 'player'
    │
    ▼
...
```

> **Примечание о первом раунде.** `generateMap` и `loadSavedGame` устанавливают `turnState` сразу в `actor-turn 'player'`, поэтому первый ход игрока выполняется без предварительного `faction-setup`. Статусы, AP и кулдауны игрока впервые тикают в `faction-setup 'player'` после первого `round-recovery`.

---

## Фракции и порядок хода

Фиксированный порядок фракций в раунде:

```ts
private readonly FACTION_ORDER: FactionId[] = ['player', 'allies', 'enemies', 'neutrals'];
```

Каждый актор имеет `factionId: FactionId`. Игрок — единственный актор фракции `player`.

Акторы внутри одной фракции ходят в порядке сортировки по `id` (см. `findAllAliveActorsOfFaction` в `src/simulation/state.ts`).

---

## TurnState и actorsDoneThisRound

### TurnState

Конечный автомат хода хранится в приватном поле `turnState`:

```ts
type TurnState =
  | { phase: 'idle' }
  | { phase: 'faction-setup'; factionId: FactionId }
  | { phase: 'actor-turn'; factionId: FactionId; actorId: EntityId }
  | { phase: 'round-recovery' };
```

- `idle` — начальное состояние до первого вызова `step()`.
- `faction-setup` — в начале хода фракции: тикают статусы, восстанавливается AP, тикают кулдауны.
- `actor-turn` — текущий актор может совершать действия.
- `round-recovery` — конец раунда: удаление мёртвых сущностей и сброс флагов.

### actorsDoneThisRound

```ts
private actorsDoneThisRound: Set<EntityId> = new Set();
```

Множество акторов, которые уже завершили ход в текущем раунде. Сбрасывается в `round-recovery`.

Актор помечается закончившим ход в следующих случаях:

- явно вызван `dispatch({ type: 'END_TURN', entityId })`;
- после выполнения действия у актора осталось `ap <= 0`;
- AI-актор вернул `END_TURN` из `decideAction`;
- актор оглушён и автоматически завершает ход.

---

## dispatch(action)

`dispatch` выполняет одно действие текущего актора. Работает только в фазе `actor-turn` и только для актора, указанного в `action.entityId`.

1. Проверяется, что `turnState.phase === 'actor-turn'`.
2. Проверяется, что `turnState.actorId === action.entityId`.
3. Проверяется, что актор жив (`isAlive !== false`).
4. Если `action.type === 'END_TURN'`:
   - актор добавляется в `actorsDoneThisRound`;
   - возвращается фаза с событием `TURN_ENDED`;
   - `hasMoreSteps: true`.
5. Обычное действие:
   - валидируется и исполняется через `executeActionInContext`;
   - списываются AP (`CONSUME_AP` → `RESOURCE_CONSUMED { resource: 'ap' }`);
   - handler порождает дочерние интенты (`MOVE`, `DAMAGE` и т.п.);
   - после каждого интента запускаются мировые реакции.
6. Если актор — игрок, обновляется поле зрения (`updateFOV`), события добавляются как дети `ACTION_APPLIED`.
7. Если после действия у актора `ap <= 0`, он автоматически добавляется в `actorsDoneThisRound`.
8. Возвращается `SimulationResult`.

```ts
export type SimulationResult = {
  success: boolean;
  stateChanged: boolean;
  phases: TurnPhase[];
  /** true, если ход ещё не вернулся к игроку */
  hasMoreSteps: boolean;
};
```

`hasMoreSteps`:

- `false` — ход игрока, ожидается следующий ввод;
- `true` — ход AI или переход между фазами.

> **Оглушение.** Оглушённый актор может выполнить только `END_TURN`. Любое другое действие отклоняется с кодом `actor_stunned`.

---

## step()

`step()` продвигает игру на одну фазу вперёд. Presentation вызывает его рекурсивно после анимации, пока `hasMoreSteps === true`.

```
step()
  │
  ▼
Пропуск мёртвых / уже закончивших ход акторов
  │
  ▼
switch (turnState.phase)
```

### idle

Переход в `faction-setup 'player'`, затем рекурсивный вызов `step()`.

### faction-setup

1. Выполняется `runFactionSetup(factionId)`:
   - `BEGIN_TURN { side: factionId }` — устанавливает `state.turn.activeSide`, для `player` увеличивает `state.turn.round`, порождает событие `TURN_BEGAN`;
   - тикают статусы всех живых акторов фракции (`TICK_STATUS_EFFECTS`);
   - восстанавливается AP (`RESTORE_AP`);
   - тикают кулдауны способностей (`TICK_COOLDOWN`).
2. Если в фракции есть живые акторы — переход в `actor-turn` первого актора.
3. Если акторов нет — переход к следующей фракции через `advanceFaction()`.
4. Возвращается фаза с `hasMoreSteps: true`, кроме случая, когда сетап вернул ход к игроку.

### actor-turn

1. Если текущий актор мёртв или уже закончил ход — `advanceActor()` и повторный `step()`.
2. Если текущий актор — игрок — возвращается пустой результат с `hasMoreSteps: false`. Ввод продолжается через `dispatch()`.
3. Иначе выполняется `runAiAction(actor)`.

### round-recovery

1. Выполняется `runRoundRecovery()`:
   - `CLEANUP_DEAD_ENTITIES` — физически удаляются мёртвые не-игроковые сущности;
   - сбрасывается `actorsDoneThisRound`.
2. `turnState` переводится в `faction-setup 'player'`.
3. Возвращается фаза с `hasMoreSteps: true`.

> **Важно:** `ROUND_RECOVERY` сам по себе не увеличивает счётчик раунда. Номер раунда увеличивается при следующем `BEGIN_TURN` фракции `player`.

---

## Фазы в деталях

### faction-setup

| Событие | Описание |
|---------|----------|
| `TURN_BEGAN` | Начало фазы фракции. |
| `BEGIN_TURN` | Установка `activeSide`, для `player` — увеличение `round`. |
| `TICK_STATUS_EFFECTS` | Тикают статусы всех живых акторов фракции. Intent несёт `phase: FactionId` (идентификатор фракции). |
| `RESTORE_AP` | Восстановление AP для каждого актора фракции. |
| `TICK_COOLDOWN` | Уменьшение кулдаунов способностей. |

### actor-turn

Ход одного актора. Состоит из одного или нескольких вызовов `dispatch(action)`:

- **Игрок:** каждое действие — отдельная фаза. Игрок сам решает, когда вызвать `END_TURN` (клавиша Space) или дождаться автоматического `END_TURN` при `ap <= 0`.
- **AI:** `runAiAction` вызывает `strategy.decideAction` **один раз** за `step()`. Стратегия возвращает одно действие (`MOVE`, `ATTACK`, `USE_ABILITY`, `END_TURN` и т.п.). Если решение — `END_TURN`, актор помечается закончившим ход.

### round-recovery

| Событие | Описание |
|---------|----------|
| `CLEANUP_DEAD_ENTITIES` | Удаление мёртвых не-игроковых сущностей. |

После этого очищается `actorsDoneThisRound` и раунд начинается заново с `faction-setup 'player'`.

---

## END_TURN вместо WAIT

Старое действие `WAIT` удалено. Вместо него используется явное `END_TURN`:

```ts
export type EndTurnAction = {
  type: 'END_TURN';
  entityId: EntityId;
};
```

- Стоит `0 AP`.
- Игрок вызывает его вручную (Space) или Presentation автоматически диспатчит при `ap <= 0`.
- AI возвращает его из `decideAction`, когда хочет завершить ход.
- Явный `END_TURN` игрока сбрасывает автопуть.
- Оглушённый актор может выполнить только `END_TURN`.

---

## AI-реакции на события игрока

Во время хода игрока определённые доменные события порождают мировые реакции, которые уведомляют AI-стратегии об изменениях мира. Это позволяет врагам реагировать на движение игрока, открытие/закрытие дверей и другие заметные события до своего хода.

### Какие события вызывают реакцию

- `ENTITY_MOVED` — сущность переместилась.
- `DOOR_OPENED` — дверь открылась.
- `DOOR_CLOSED` — дверь закрылась.

### Поток уведомления

```
ENTITY_MOVED / DOOR_OPENED / DOOR_CLOSED
  │
  ▼
aiPerceptionReaction (world-reactions/)
  │
  ▼
NOTIFY_AI { entityId, change } intent для каждого AI-актора в радиусе
  │
  ▼
executeNotifyAIIntent
  │
  ├─ getStrategy(actor.aiStrategyId)
  ├─ strategy.onWorldChange(actor, state, change)
  └─ AI_NOTIFIED { entityId, change }
```

### Ответственность слоёв

- **Реакция мира** (`ai-perception-reaction.ts`) делает только грубый фильтр по расстоянию (Chebyshev) до источника события. Она не проверяет FOV/LOS и не решает, стоит ли реагировать.
- **Исполнитель интента** (`notify-ai-intent-executor.ts`) находит стратегию актора и вызывает `onWorldChange`. Если стратегия не зарегистрирована — это ошибка конфигурации.
- **Стратегия** (`hunter-strategy.ts`) сама решает, видит ли актор источник изменения, и мутирует только `enemy.aiState` (например, переключается в `chase`).

> Стратегия может менять своё внутреннее состояние вне своего хода, но не может выполнять действия. Действия выполняются только в фазе `actor-turn` через `decideAction`.

---

## Ход AI

Для каждого живого AI-актора в фазе `actor-turn` `step()` вызывает `runAiAction(actor)`:

1. Если актор оглушён:
   - сбрасывается подготовленная способность (`cancelPreparedAbility`), если актор — враг;
   - эмитится `SKIP_STUNNED_TURN`;
   - актор помечается закончившим ход;
   - возвращается фаза с `hasMoreSteps: true`.
2. Вызывается `strategy.updateState?.(actor, state)` для FSM-тиков.
3. Создаётся `ExecutionBuilder` с placeholder-событием `ACTION_APPLIED (END_TURN)`.
4. Вызывается `strategy.decideAction(actor, state, builder, root)` **один раз**.
5. AI-стратегия может эмитить события как side-effect (например, `ABILITY_PREPARED`) до возврата действия.
6. Корневое событие заменяется на реальное действие, возвращённое стратегией.
7. Действие исполняется через `executeActionInContext`.
8. Если действие невозможно — срабатывает fallback: ход принудительно завершается `END_TURN`.

> **Один step — одно действие AI.** Раньше AI ходил в цикле `while (ap > 0)` за один вызов. Теперь каждое действие — отдельный `step()` и отдельная анимация.

---

## Prepared-скиллы

### Подготовка

- AI-стратегия принимает решение подготовить скилл как side-effect внутри `decideAction`.
- Хелпер `tryPrepareAbility` (`src/simulation/ai/ai-helpers.ts`) выбирает первую доступную preparable-способность и валидные цели.
- Хелпер `prepareAbility` сохраняет в `enemy.aiState.preparedAbility`:
  - `abilityId`;
  - `targets` — зафиксированные позиции целей.
- Событие `ABILITY_PREPARED { entityId, abilityId, targets, from }` эмитится как child текущего `ACTION_APPLIED`.
- После подготовки стратегия возвращает `END_TURN`, чтобы потратить оставшиеся AP и не использовать скилл в том же ходу.

### Исполнение

- Происходит, когда AI-стратегия решает вернуть `USE_ABILITY` для `preparedAbility` в одном из следующих `step()`.
- `USE_ABILITY` формируется из `preparedAbility` и исполняется через тот же `executeAction`.
- `use-ability-action.ts` валидирует совпадение `abilityId` и `targets` с `preparedAbility`, а после успешного применения сбрасывает его.
- Сами цели валидировались при подготовке; при исполнении они могли устареть (например, fireball промахнётся по старым координатам).

### Отмена

- При оглушении подготовленная способность сбрасывается и эмитится `ABILITY_PREPARED_CANCELLED`.
- Сброс централизован в helper'е `cancelPreparedAbility` (`src/simulation/ai/ai-helpers.ts`) и вызывается из:
  - `apply-status-intent-executer.ts` — если стан наложили во время хода игрока;
  - `simulation.ts:runAiAction` — если враг начинает ход в стане.

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
Simulation → result (hasMoreSteps: false)
    │
    ▼
Presentation:
  - Обходит дерево ExecutionNode
  - Формирует AnimationPhase[]:
      [ATTACK_ANIMATION, DAMAGE_NUMBER, DEATH_ANIMATION]
  - Формирует combatLog
  - Обновляет ViewModel
    │
    ▼
UI:
  - PixiJS исполняет анимации
  - React отображает обновлённый HUD и combat log
    │
    ▼
Анимация завершена → onAnimationsComplete
    │
    ▼
Если player.ap <= 0:
  Presentation → simulation.dispatch(END_TURN)
    │
    ▼
Simulation:
  ┌─ ACTION_APPLIED (END_TURN)
  │  └─ TURN_ENDED
    │
    ▼
result.hasMoreSteps === true
    │
    ▼
Presentation → simulation.step()
    │
    ▼
faction-setup 'allies' / 'enemies' / 'neutrals'
  ┌─ TURN_BEGAN
  ├─ BEGIN_TURN
  ├─ TICK_STATUS_EFFECTS
  ├─ RESTORE_AP
  └─ TICK_COOLDOWN
    │
    ▼
actor-turn AI → step() → runAiAction
  ┌─ ACTION_APPLIED (MOVE / ATTACK / USE_ABILITY / END_TURN)
  │  └─ ...
    │
    ▼
...
    │
    ▼
round-recovery
  ┌─ CLEANUP_DEAD_ENTITIES
    │
    ▼
faction-setup 'player' (следующий раунд)
  ┌─ TURN_BEGAN
  ├─ BEGIN_TURN          ← round += 1
  ├─ TICK_STATUS_EFFECTS
  ├─ RESTORE_AP
  └─ TICK_COOLDOWN
    │
    ▼
actor-turn 'player' — ожидание ввода
```

---

## Где что тикает

| Механика | Фаза | Примечание |
|----------|------|------------|
| Статусы | `faction-setup` | Для каждой фракции отдельно. |
| Восстановление AP | `faction-setup` | В начале хода фракции. |
| Тик кулдаунов | `faction-setup` | В начале хода фракции. |
| Удаление мёртвых сущностей | `round-recovery` | В конце раунда. |
| Увеличение номера раунда | `faction-setup 'player'` | В `BEGIN_TURN` фракции `player`. |
