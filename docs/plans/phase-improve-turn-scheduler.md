# План: пошаговый планировщик ходов с фракциями и явным END_TURN

> Ветка: `phase-improve`
> Статус: черновик дизайна

---

## 1. Проблема

В текущей реализации `GameSimulation.dispatch(action)` (`src/simulation/simulation.ts:165`) выполняет за один синхронный вызов слишком много работы:

1. Действие игрока.
2. Если `player.ap <= 0` — автоматически внутри того же вызова запускается `endPlayerTurn()` (`simulation.ts:403`), который:
   - тикает статусы игрока;
   - запускает ход окружения для **всех** живых AI-акторов (`runEnvironmentTurn`, `simulation.ts:441`);
   - готовит следующий ход игрока (`beginNextPlayerTurn`, `simulation.ts:532`);
   - тикает статусы окружения.

Симуляция мутирует `GameState` in-place и возвращает только финальное состояние. Presentation вынуждена:

- вычислять предыдущие значения из событий (`entityDamagedBuilder` вычисляет `fromHp = toHp + event.damage`);
- извлекать "промежуточное" AP игрока из дерева событий (`extractPlayerApAfterAction`, `src/presentation/gameSession.ts:605`);
- хранить `lastResult` и блокировать обновление preview автопути во время анимации.

Главная цель рефакторинга — упростить логику отображения, сделав состояние мира консистентным после каждой фазы, без необходимости кэшировать промежуточные значения.

---

## 2. Цель

1. Ввести систему фракций: игрок, союзники, враги, нейтралы.
2. Сделать ход фракции явной фазой: `FACTION_SETUP` → `ACTOR_TURN`* → `ROUND_RECOVERY`.
3. Заменить `WAIT` на явное действие `END_TURN`.
4. Разбить ход каждого актора на отдельные действия, каждое из которых — отдельный `step()`.
5. Дать Presentation контроль над темпом: запускать анимацию фазы, дождаться её окончания и только потом запросить следующую фазу.

---

## 3. Общий подход

Simulation остаётся **синхронной и детерминированной**. Внутри неё появляется конечный автомат хода (`TurnState`).

- `dispatch(action)` выполняет одно действие текущего актора (игрок вручную, AI внутри `step()`).
- `END_TURN` — обычное действие, которое завершает ход текущего актора.
- `step()` выполняет следующую системную фазу или одно действие AI.
- Presentation после завершения анимации вызывает `step()`, пока ход не вернётся к игроку.

```
Начало раунда
    ↓
FACTION_SETUP 'player'        ← тикают статусы игрока, восстанавливается AP
    ↓
ACTOR_TURN 'player'
    ↓
Игрок: MOVE → ATTACK → END_TURN
    ↓
FACTION_SETUP 'allies'
    ↓
ACTOR_TURN 'ally_1' → END_TURN
ACTOR_TURN 'ally_2' → END_TURN
    ↓
FACTION_SETUP 'enemies'
    ↓
ACTOR_TURN 'enemy_A' → MOVE → ATTACK → END_TURN
ACTOR_TURN 'enemy_B' → USE_ABILITY (0 AP) → END_TURN
    ↓
FACTION_SETUP 'neutrals'
    ↓
ACTOR_TURN 'neutral_1' → END_TURN
    ↓
ROUND_RECOVERY                ← cleanup dead entities, round++
    ↓
Снова FACTION_SETUP 'player'
```

---

## 4. Фракции и порядок хода

### 4.1. Тип фракции

```ts
// src/simulation/types.ts
export type FactionId = 'player' | 'allies' | 'enemies' | 'neutrals';
```

Каждый актор имеет `factionId: FactionId`. Игрок — единственный актор фракции `player`.

### 4.2. Порядок фракций

Фиксированный список на раунд:

```ts
const FACTION_ORDER: FactionId[] = ['player', 'allies', 'enemies', 'neutrals'];
```

### 4.3. Порядок акторов внутри фракции

По `id`, как сейчас для врагов (`findAllAliveAiActors`).

### 4.4. TurnSide

```ts
export type TurnSide = FactionId | 'status_tick' | 'round_recovery';
```

---

## 5. Новый интерфейс Simulation

### 5.1. Публичные изменения

```ts
// src/simulation/types.ts
export type SimulationResult = {
  success: boolean;
  stateChanged: boolean;
  phases: TurnPhase[];
  /** true, если ход ещё не вернулся к игроку */
  hasMoreSteps: boolean;
};
```

```ts
// src/simulation/simulation.ts
export interface Simulation {
  /** Выполнить действие текущего актора. Presentation использует только для игрока. */
  dispatch(action: GameAction): SimulationResult;
  /** Выполнить следующую системную фазу или AI-действие. */
  step(): SimulationResult;
  preview(action: GameAction): ActionPreview;
  getState(): Readonly<GameState>;
  /** true, если сейчас ход игрока (ожидается ввод). */
  isPlayerTurn(): boolean;
  // ... остальные методы без изменений
}
```

### 5.2. Конечный автомат TurnState

```ts
// src/simulation/simulation.ts

type TurnState =
  | { phase: 'idle' }
  | { phase: 'faction-setup'; factionId: FactionId }
  | { phase: 'actor-turn'; factionId: FactionId; actorId: EntityId }
  | { phase: 'round-recovery' };

private turnState: TurnState = { phase: 'idle' };

/** Акторы, закончившие ход в текущем раунде. Сбрасывается в ROUND_RECOVERY. */
private actorsDoneThisRound: Set<EntityId> = new Set();
```

### 5.3. Инициализация хода

При старте игры (`generateMap`) и при переходе между этажами `turnState` должен быть установлен в начало хода игрока:

```ts
this.turnState = {
  phase: 'actor-turn',
  factionId: 'player',
  actorId: this.state.player.id,
};
this.state.player.ap = this.state.player.maxAp;
// Кулдауны и статусы игрока тикают в первом FACTION_SETUP первого раунда.
```

Первый раунд начинается не с `FACTION_SETUP`, а сразу с хода игрока. `FACTION_SETUP` для игрока выполняется в конце предыдущего раунда (`ROUND_RECOVERY` переходит в `FACTION_SETUP` игрока, но для первого раунда это делается вручную).

---

## 6. Алгоритм dispatch, END_TURN и step

### 6.1. dispatch(action)

1. Проверить, что `turnState.phase === 'actor-turn'`.
2. Проверить, что `action.entityId === turnState.actorId`.
3. Проверить, что актор жив (`isAlive !== false`).
4. Если `action.type === 'END_TURN'`:
   - пометить актора как закончившего ход (`actorsDoneThisRound.add(actor.id)`);
   - создать фазу с событием `TURN_ENDED`;
   - вернуть `hasMoreSteps: true`.
5. Иначе выполнить действие (`executeAction`).
6. Если после действия `actor.ap <= 0` — пометить актора как закончившего ход.
7. Вернуть результат.

```ts
dispatch(action: GameAction): SimulationResult {
  if (this.turnState.phase !== 'actor-turn') {
    return reject('not_actor_turn');
  }
  if (this.turnState.actorId !== action.entityId) {
    return reject('wrong_actor');
  }

  const actor = this.getActor(action.entityId);
  if (!actor || actor.isAlive === false) {
    return reject('actor_dead');
  }

  if (action.type === 'END_TURN') {
    this.actorsDoneThisRound.add(actor.id);
    return {
      success: true,
      stateChanged: true,
      phases: [this.buildEndTurnPhase(actor)],
      hasMoreSteps: true,
    };
  }

  const result = this.executeActorAction(actor, action);

  if (actor.ap <= 0) {
    this.actorsDoneThisRound.add(actor.id);
  }

  // Если ходит игрок — ждём следующего ввода, не продолжаем автоматически.
  // Если ходит AI — продолжаем через step().
  const isPlayer = actor.id === this.state.player.id;
  return { ...result, hasMoreSteps: !isPlayer };
}
```

### 6.2. step()

```ts
step(): SimulationResult {
  // Пропускаем мёртвых или закончивших ход акторов
  while (this.turnState.phase === 'actor-turn' && this.isActorDone(this.turnState.actorId)) {
    this.advanceActor();
  }

  switch (this.turnState.phase) {
    case 'idle': {
      this.turnState = { phase: 'faction-setup', factionId: FACTION_ORDER[0] };
      return this.step();
    }

    case 'faction-setup': {
      const phase = this.runFactionSetup(this.turnState.factionId);
      const actors = this.getAliveActorsOfFactionSorted(this.turnState.factionId);

      if (actors.length > 0) {
        this.turnState = {
          phase: 'actor-turn',
          factionId: this.turnState.factionId,
          actorId: actors[0]!.id,
        };
      } else {
        this.advanceFaction();
      }

      const nextActorIsPlayer = actors.length > 0 && actors[0]!.id === this.state.player.id;
      return {
        success: true,
        stateChanged: phase.actions.length > 0,
        phases: [phase],
        hasMoreSteps: !nextActorIsPlayer && !this.isRoundOver(),
      };
    }

    case 'actor-turn': {
      const actor = this.getActor(this.turnState.actorId);

      if (!actor || actor.isAlive === false) {
        this.advanceActor();
        return this.step();
      }

      if (actor.id === this.state.player.id) {
        // Ход игрока — ждём ввода через dispatch.
        return {
          success: true,
          stateChanged: false,
          phases: [],
          hasMoreSteps: false,
        };
      }

      return this.runAiAction(actor); // hasMoreSteps: true
    }

    case 'round-recovery': {
      const phase = this.runRoundRecovery();
      this.turnState = { phase: 'faction-setup', factionId: FACTION_ORDER[0] };
      this.actorsDoneThisRound.clear();
      return {
        success: true,
        stateChanged: true,
        phases: [phase],
        hasMoreSteps: false, // после recovery ход игрока
      };
    }
  }
}
```

### 6.3. runAiAction(actor)

```ts
private runAiAction(actor: Actor): SimulationResult {
  if (isStunned(actor)) {
    const action: GameAction = { type: 'END_TURN', entityId: actor.id };
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action,
    });
    executeIntent(this.state, { type: 'SKIP_STUNNED_TURN', entityId: actor.id }, builder, builder.root);
    this.actorsDoneThisRound.add(actor.id);

    return {
      success: true,
      stateChanged: true,
      phases: [{ side: actor.factionId, actions: [builder.root] }],
      hasMoreSteps: true,
    };
  }

  const strategy = getStrategy(actor.aiStrategyId);
  strategy.updateState?.(actor, this.state);

  // Builder и root передаются для side-effect событий (например, ABILITY_PREPARED).
  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'END_TURN', entityId: actor.id },
  });
  const root = builder.root;

  const action = strategy.decideAction(actor, this.state, builder, root);

  if (action.type === 'END_TURN') {
    this.actorsDoneThisRound.add(actor.id);
  }

  const result = this.dispatch(action);

  // Fallback: если AI выбрала невыполнимое действие, завершаем ход.
  if (!result.success) {
    this.actorsDoneThisRound.add(actor.id);
    return this.dispatch({ type: 'END_TURN', entityId: actor.id });
  }

  return result;
}
```

### 6.4. advanceActor и advanceFaction

```ts
private advanceActor(): void {
  if (this.turnState.phase !== 'actor-turn') return;

  const currentFactionId = this.turnState.factionId;
  const actors = this.getAliveActorsOfFactionSorted(currentFactionId);
  const currentIndex = actors.findIndex(a => a.id === this.turnState.actorId);
  const nextActor = actors.slice(currentIndex + 1).find(a => !this.actorsDoneThisRound.has(a.id));

  if (nextActor) {
    this.turnState = { phase: 'actor-turn', factionId: currentFactionId, actorId: nextActor.id };
  } else {
    this.advanceFaction();
  }
}

private advanceFaction(): void {
  if (this.turnState.phase !== 'actor-turn' && this.turnState.phase !== 'faction-setup') return;

  const currentFactionId = this.turnState.factionId;
  const currentIndex = FACTION_ORDER.indexOf(currentFactionId);
  const nextFactionId = FACTION_ORDER[currentIndex + 1];

  if (nextFactionId) {
    this.turnState = { phase: 'faction-setup', factionId: nextFactionId };
  } else {
    this.turnState = { phase: 'round-recovery' };
  }
}

private isRoundOver(): boolean {
  return this.turnState.phase === 'round-recovery';
}
```

---

## 7. Фазы

### 7.1. FACTION_SETUP

Выполняется в начале хода каждой фракции:

1. Тикают статусы всех живых акторов фракции.
2. Уменьшаются счётчики эффектов.
3. Восстанавливается AP акторов фракции (`RESTORE_AP`).
4. Тикают кулдауны способностей акторов фракции (`TICK_COOLDOWN`).
5. Сбрасывается флаг "ход закончен" для акторов фракции (неявно через `actorsDoneThisRound`, который не включает их после setup).

### 7.2. ACTOR_TURN

Ход одного актора. Состоит из одного или нескольких вызовов `dispatch(action)`:

- Игрок: через UI.
- AI: через `runAiAction` внутри `step()`.

Каждое действие — отдельная фаза. Каждая атака, каждое движение, каждая 0-AP способность — отдельный `step()` и отдельная анимация.

### 7.3. ROUND_RECOVERY

Выполняется в конце раунда:

1. `CLEANUP_DEAD_ENTITIES` — удаление мёртвых сущностей.
2. Очистка `actorsDoneThisRound`.
3. Счётчик раунда (`state.turn.round`) увеличивается в начале следующего хода игрока — в `FACTION_SETUP 'player'` через `BEGIN_TURN`.

---

## 8. Изменения в Presentation

### 8.1. GameSession.dispatch

```ts
dispatch(action: GameAction): void {
  if (!this.simulation) {
    throw new Error('Cannot dispatch: simulation not initialized');
  }
  if (this.mode !== 'playing') {
    throw new Error(`Cannot dispatch in mode: ${this.mode}`);
  }
  if (this.animation.phase === 'animating') {
    return;
  }

  if (this.targeting.phase === 'targeting') {
    this.cancelTargeting();
  }

  const result = this.simulation.dispatch(action);
  this.lastResult = result;

  if (result.success && result.stateChanged) {
    const state = this.simulation.getState();
    const events = extractEvents(result);
    this.logs.append(state, events, this.locale);
    this.logs.logs = this.logs.logs.slice(-30);

    const animations = buildAnimationTree(result, state);
    if (animations.length > 0) {
      this.animation.phase = 'animating';
      this.animationBatchId++;
    }

    // Если AP игрока закончилось, автоматически завершаем ход.
    // Не делаем этого, если игрок уже явно завершил ход (action.type === 'END_TURN').
    const player = state.player;
    if (action.type !== 'END_TURN' && player.ap <= 0 && player.isAlive !== false) {
      this.dispatch({ type: 'END_TURN', entityId: player.id });
    }

    // Явный END_TURN отменяет автопуть.
    if (action.type === 'END_TURN') {
      this.autoPath.cancel();
    }
  } else {
    const rejectedToasts = extractToasts(result);
    for (const toast of rejectedToasts) {
      this.toasts.push(toast.kind, toast.title, toast.message, toast.duration);
    }
    this.lastResult = null;
    this.autoPath.cancel();
  }

  const state = this.simulation.getState();
  if (state.phase === 'dead') {
    this.mode = 'gameOver';
    this.animation.phase = 'gameOver';
  } else if (state.phase === 'victory') {
    this.mode = 'victory';
    this.animation.phase = 'gameOver';
  }

  this.notify();
}
```

### 8.2. GameSession.step

```ts
private step(): void {
  if (!this.simulation || this.mode !== 'playing') {
    return;
  }

  const result = this.simulation.step();
  this.lastResult = result;

  const state = this.simulation.getState();
  const events = extractEvents(result);
  this.logs.append(state, events, this.locale);
  this.logs.logs = this.logs.logs.slice(-30);

  const animations = buildAnimationTree(result, state);
  if (animations.length > 0) {
    this.animation.phase = 'animating';
    this.animationBatchId++;
    this.emptyStepCounter = 0;
  } else if (!result.hasMoreSteps) {
    this.animation.phase = 'idle';
    this.emptyStepCounter = 0;
  } else {
    // Пустая фаза, но ход не закончен — сразу идём дальше.
    // Защита от бесконечного цикла.
    this.emptyStepCounter = (this.emptyStepCounter ?? 0) + 1;
    if (this.emptyStepCounter > 10) {
      console.error('[GameSession] Слишком много пустых фаз подряд');
      this.animation.phase = 'idle';
      this.emptyStepCounter = 0;
      return;
    }
    this.step();
    return;
  }

  this.notify();
}
```

### 8.3. GameSession.onAnimationsComplete

```ts
onAnimationsComplete(): void {
  // Если в очереди остались фазы — продолжаем выполнение.
  if (this.lastResult?.hasMoreSteps) {
    this.step();
    return;
  }

  const hadAnimations = this.animation.phase === 'animating';
  if (hadAnimations) {
    this.animation.phase = 'idle';
    this.lastResult = null;
  }

  // Автопродолжение зафиксированного автопути.
  if (this.autoPath.isCommitted() && this.mode === 'playing') {
    const state = this.simulation!.getState();
    const isPlayerTurn = this.simulation!.isPlayerTurn();
    if (!isPlayerTurn || state.player.ap <= 0) {
      this.autoPath.cancel();
      this.notify();
      return;
    }
    const stepResult = this.autoPath.step(state, this.getAutoPathQueries());
    if (stepResult.kind === 'action') {
      this.dispatch(stepResult.action);
      return;
    }
    this.handleAutoPathCancel(stepResult);
    this.notify();
    return;
  }

  if (this.heldDirection && this.mode === 'playing') {
    this.moveOrAttack(this.heldDirection.dx, this.heldDirection.dy);
  } else {
    if (hadAnimations && this.mode === 'playing') {
      this.refreshAutoPathPreview();
    }
    if (hadAnimations) {
      this.notify();
    }
  }
}
```

### 8.4. Удаление extractPlayerApAfterAction

Когда восстановление AP игрока происходит в `FACTION_SETUP` в начале его хода, состояние `player.ap` между действиями игрока остаётся актуальным. HUD показывает реальное AP. `pendingAp` и `extractPlayerApAfterAction` больше не нужны.

---

## 9. Удаление действия WAIT

### 9.1. Из типов

```ts
// src/simulation/core-types.ts
export type GameAction =
  | MoveAction
  | AttackAction
  | EndTurnAction   // заменяет WAIT
  | UseAbilityAction
  | EquipAction
  | UnequipAction
  | UseItemAction
  | InteractAction
  | DebugAddItemAction
  | DebugSpawnEntityAction
;

export type EndTurnAction = {
  type: 'END_TURN';
  entityId: EntityId;
};
```

### 9.2. Из обработчиков

- `src/simulation/systems/actions/wait-action.ts` — удалить файл.
- `src/simulation/systems/action-cost-resolver.ts` — убрать специальную логику WAIT, `END_TURN` стоит 0 AP.
- `src/simulation/simulation.ts` — убрать обработку `action.type === 'WAIT'` в `canActorAct`, разрешить `END_TURN` при оглушении.

### 9.3. Из UI

- `src/ui/screens/GameScreen.tsx`: клавиша Space вызывает `dispatch({ type: 'END_TURN', entityId: 'player' })`.
- Все остальные кнопки, которые использовали WAIT, заменяются на END_TURN.

---

## 10. Оглушение и смерть

### 10.1. Оглушение

- Оглушение — активный эффект (`stunned`).
- В `FACTION_SETUP` эффект тикает, счётчик уменьшается.
- Если эффект активен, актор не может выполнять действия, включая 0-AP.
- AP не отнимается. Восстановление AP происходит в `FACTION_SETUP` независимо от оглушения.
- Для AI: `runAiAction` проверяет `isStunned(actor)` и возвращает `END_TURN` с `SKIP_STUNNED_TURN`.
- Для игрока: `dispatch` отклоняет любое действие, кроме `END_TURN`, пока игрок оглушён.
- Оглушение не отнимает AP. AP восстанавливается в `FACTION_SETUP` как обычно.

### 10.2. Смерть актора

Если актор умирает во время хода:

- `isAlive = false`.
- Текущее действие завершается.
- `step()` при следующем вызове проверяет `isAlive` и пропускает мёртвого актора через `advanceActor`.
- В `ROUND_RECOVERY` мёртвые сущности удаляются через `CLEANUP_DEAD_ENTITIES`.

---

## 11. Узкие места

### 11.1. Ввод во время хода других фракций

Пока идёт ход союзников/врагов/нейтралов, ввод игрока должен быть заблокирован. Текущая проверка `this.animation.phase === 'animating'` (`gameSession.ts:1349`) уже это делает. Главное — не сбрасывать `animation.phase` в `'idle'` между фазами.

### 11.2. Пустые фазы

Фаза, не породившая событий, возвращает `phases: []`. В `GameSession.step()` если `animations.length === 0` и `hasMoreSteps === true`, `step()` вызывается рекурсивно. Нужна защита от бесконечного цикла (например, проверка, что `turnState` действительно продвинулся).

### 11.3. Автопуть и heldDirection

`onAnimationsComplete` обрабатывает автопуть/heldDirection только при пустой очереди (`!lastResult?.hasMoreSteps`).

### 11.4. Смерть игрока во время хода другой фракции

Если игрок умирает от статусов/врагов, Simulation переходит в `state.phase = 'dead'`. Presentation должна корректно прервать очередь. `step()` может проверять `state.phase` и очищать/сбрасывать `turnState`.

### 11.5. AI perception

Текущий мир реагирует на движение игрока через `world-reactions/ai-perception-reaction.ts`. Это происходит внутри фазы `ACTOR_TURN` игрока и не затрагивает очередь.

### 11.6. Порядок фракций и акторов

Порядок фракций фиксирован (`FACTION_ORDER`). Порядок акторов внутри фракции — по `id`. Если в будущем появится инициатива, это потребует отдельного рефакторинга.

### 11.7. Spawn акторов во время раунда

Если актор появляется во время раунда (например, призыв), он не попадёт в текущий раунд, если `actorsDoneThisRound` уже сформирован. Нужно решить, может ли новый актор ходить в текущем раунде. Сейчас считаем, что нет — ходит в следующем.

---

## 12. Паттерны и антипаттерны

### 12.1. Паттерны

- **Явный API вместо неявного поведения.** `END_TURN` делает завершение хода контролируемым.
- **Конечный автомат вместо монолитной функции.** `TurnState` явно описывает, кто сейчас ходит.
- **Синхронная Simulation + асинхронная Presentation.** Simulation не знает про анимации. Presentation управляет темпом через `step()`.
- **Один шаг — одна анимационная порция.** Каждое действие актора — отдельная фаза.
- **State как единственный источник истины.** После каждого `step()` `GameState` консистентен.

### 12.2. Антипаттерны

- **Не делать Simulation async.** Async generator усложнит тесты, preview и debug.
- **Не хранить копию state "до" в Presentation.** Если нужно предыдущее значение — уменьшаем фазу или добавляем pre/post в событие.
- **Не смешивать логику очереди с AI-стратегиями.** Стратегия решает, какое действие сделать. Планировщик решает, чей ход сейчас.
- **Не возвращать из step() несколько фаз сразу.** Нарушает единообразие и усложняет анимации.

---

## 13. Влияние на текущую архитектуру

### 13.1. Simulation

- `dispatch` станет универсальным для текущего актора.
- Появятся новые методы: `step()`, `runFactionSetup()`, `runAiAction()`, `advanceActor()`, `advanceFaction()`, `runRoundRecovery()`.
- `endPlayerTurn`, `runEnvironmentTurn`, `beginNextPlayerTurn` будут удалены.
- Появится `TurnState` и `actorsDoneThisRound`.
- `TurnSide` расширится до `FactionId | 'status_tick' | 'round_recovery'`.

### 13.2. Presentation

- `GameSession.dispatch`: автоматический `END_TURN` при AP = 0.
- `GameSession.step`: новый приватный метод.
- `GameSession.onAnimationsComplete`: ветка с `step()`.
- `buildRenderInput`: убрать `pendingAp` и `extractPlayerApAfterAction`.
- `AnimationState` может получить флаг, указывающий, что идёт ход не игрока.

### 13.3. UI

- `GameField.tsx` не меняется.
- `GameScreen.tsx`: Space → `dispatch({ type: 'END_TURN' })`.

### 13.4. Тесты

- Тесты Simulation должны учитывать `hasMoreSteps` и вызывать `step()`.
- Тесты хода окружения заменяются на тесты фракций.
- Тесты `WAIT` заменяются на тесты `END_TURN`.

---

## 14. Этапы внедрения

### Этап 1. Подготовка типов

1. Добавить `FactionId` и `factionId` в акторов.
2. Добавить `hasMoreSteps` в `SimulationResult`.
3. Заменить `TurnSide` на `FactionId | 'status_tick' | 'round_recovery'`.
4. Добавить `EndTurnAction` в `GameAction`, удалить `WaitAction`.
5. Убедиться, что проект компилируется.

### Этап 2. Реализация TurnState

1. Добавить `TurnState`, `actorsDoneThisRound`, `FACTION_ORDER`.
2. Реализовать `runFactionSetup()`.
3. Реализовать `runRoundRecovery()`.
4. Реализовать `advanceActor()` / `advanceFaction()`.
5. Реализовать `isPlayerTurn()`.
6. Инициализировать `turnState` в `generateMap` и при переходе этажа.

### Этап 3. Реализация dispatch и step

1. Переписать `dispatch(action)` под текущего актора.
2. Реализовать `step()`.
3. Реализовать `runAiAction()`.
4. Переписать AI стратегии для возврата `END_TURN`.

### Этап 4. Удаление WAIT

1. Удалить `wait-action.ts`.
2. Убрать WAIT из `action-cost-resolver.ts`, `END_TURN` стоит 0 AP.
3. Убрать обработку WAIT в `canActorAct`, разрешить `END_TURN` при оглушении.
4. В `GameScreen.tsx` Space → `END_TURN`.
5. Отменять автопуть при явном `END_TURN`.

### Этап 5. Интеграция в Presentation

1. В `GameSession.dispatch` добавить автовызов `END_TURN` при AP = 0.
2. Реализовать `GameSession.step()`.
3. Обновить `GameSession.onAnimationsComplete`.
4. Убрать `extractPlayerApAfterAction` и `pendingAp`.

### Этап 6. Тесты и полировка

1. Обновить unit-тесты Simulation.
2. Добавить тесты на фракции, `END_TURN`, `step()`.
3. Проверить ручные сценарии: несколько фракций, оглушение, смерть, автопуть.

---

## 15. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Зацикливание в `step()` из-за пустых фаз | Средняя | Высокое | Проверка прогресса `turnState`, лимит итераций. |
| Потеря событий в combat log между фазами | Средняя | Среднее | Добавлять события каждого `step()` в лог. |
| Регрессия автопути | Средняя | Среднее | Автопуть срабатывает только при пустой очереди. |
| AI не возвращает END_TURN и зацикливается | Низкая | Высокое | Fallback: если действие невозможно, автоматически END_TURN. |
| Оглушение игрока блокирует ход | Средняя | Среднее | Разрешить END_TURN при оглушении, отклонить остальные действия. |
| Двойной END_TURN при AP = 0 | Средняя | Среднее | В GameSession не вызывать автоматический END_TURN, если action уже END_TURN. |
| Некорректная инициализация turnState | Средняя | Высокое | Устанавливать turnState в generateMap и при переходе этажа. |
| Устаревшая проверка activeSide | Средняя | Среднее | Заменить на simulation.isPlayerTurn(). |
| Смерть актора во время хода ломает очередь | Средняя | Среднее | Проверка `isAlive` в `advanceActor`. |

---

## 16. Принятые решения в ходе обсуждения

| # | Решение | Обоснование |
|---|---|---|
| 1 | **END_TURN как действие вместо WAIT** | WAIT полностью удаляется. END_TURN — явный способ завершить ход актора (игрока или AI). |
| 2 | **Нет отдельного метода `endTurn()`** | Вместо этого `dispatch({ type: 'END_TURN', entityId })`. Единый API для игрока и AI. |
| 3 | **Ход актора разбивается на отдельные действия** | Каждое действие — отдельный `step()`. Решает проблему множественных атак за одну анимацию. |
| 4 | **AI сам решает, когда END_TURN** | Позволяет использовать 0-AP способности и сохранять AP. |
| 5 | **Presentation автоматически END_TURN при AP = 0** | После последнего действия игрока `GameSession` сам диспатчит END_TURN. |
| 6 | **Space = ручной END_TURN игрока** | Через `dispatch({ type: 'END_TURN', entityId: 'player' })`. |
| 7 | **Внутри Simulation — конечный автомат `TurnState`** | Вместо жёсткой очереди, потому что количество действий неизвестно заранее. |
| 8 | **`step()` выполняет фазу или AI-действие** | Универсальный метод продвижения хода. |
| 9 | **Фракции: player, allies, enemies, neutrals** | Фиксированный порядок фракций, акторы внутри фракции по `id`. |
| 10 | **Статусы тикают в `FACTION_SETUP`** | В начале хода каждой фракции, счётчики уменьшаются сразу после тика. |
| 11 | **AP восстанавливается в `FACTION_SETUP`** | В начале хода фракции. |
| 12 | **Cleanup dead entities в `ROUND_RECOVERY`** | В конце раунда. |
| 13 | **Оглушение — флаг, AP не отнимаются** | Оглушённый актор не может действовать, но AP восстанавливается. |
| 14 | **Смерть актора = ход завершён** | `isAlive` проверяется в `advanceActor`, мёртвые удаляются в `ROUND_RECOVERY`. |
| 15 | **UI-кнопка END_TURN пока не нужна** | Space и замена всех WAIT на END_TURN достаточно. |
| 16 | **UI-индикация текущей фракции** | Минимум: подсветка активного врага + текст «Ход врагов» в углу. Остальное позже. |
| 17 | **Пустые фазы** | Мгновенно пропускаются. Пауза добавляется позже, если понадобится. |
| 18 | **Новые акторы (призыв)** | Ходят только в следующем раунде. |
| 19 | **Смерть всех врагов** | Раунд продолжается до конца, пустые фракции пропускаются. `ROUND_RECOVERY` в конце. |
| 20 | **Preview для END_TURN** | Не нужен. `GameSession` не вызывает preview для END_TURN. |
| 21 | **Сохранение во время хода** | Сохранения пока не реализованы. Вопрос отложен. |
| 22 | **Инициализация `turnState`** | Устанавливается в `generateMap` и при переходе этажа: сразу ход игрока, AP = maxAp. |
| 23 | **Метод `isPlayerTurn()`** | Добавлен в API Simulation. Используется в Presentation вместо `state.turn.activeSide`. |
| 24 | **`END_TURN` стоит 0 AP** | `action-cost-resolver` возвращает 0 для `END_TURN`. |
| 25 | **`END_TURN` при оглушении** | Разрешён только `END_TURN`, остальные действия отклоняются. |
| 26 | **AI fallback** | Если AI выбрала невыполнимое действие, автоматически `END_TURN`. |
| 27 | **Автопуть отменяется при `END_TURN`** | Явный `END_TURN` игрока сбрасывает автопуть. |
| 28 | **Переход между этажами** | `turnState` инициализируется так же, как при старте игры. |
| 29 | **Смерть игрока от статуса** | Presentation переходит в `gameOver`, `step()` прекращает выполнение. |
| 30 | **Debug-действия** | Разрешены только во время хода игрока, не тратят AP, не заканчивают ход автоматически. |
| 31 | **Hover/preview во время хода других фракций** | Preview отключён, hover работает только для информации. |

---

## 17. Открытые вопросы

Все открытые вопросы закрыты. План готов к реализации.

---

## 18. Связанные файлы

- `src/simulation/simulation.ts` — основные изменения.
- `src/simulation/types.ts` — `FactionId`, `SimulationResult`, `TurnSide`.
- `src/simulation/core-types.ts` — замена `WaitAction` на `EndTurnAction`.
- `src/simulation/state.ts` — `findAllAliveActorsOfFaction` (порядок акторов).
- `src/simulation/systems/actions/wait-action.ts` — удалить.
- `src/simulation/systems/action-cost-resolver.ts` — убрать логику WAIT.
- `src/simulation/ai/strategy-registry.ts` и стратегии — возврат END_TURN.
- `src/presentation/gameSession.ts` — `dispatch`, `step`, `onAnimationsComplete`, `buildRenderInput`.
- `src/presentation/animation/core/treeBuilder.ts` — обработка новых `TurnSide`.
- `src/ui/components/GameField.tsx` — без изменений.
- `src/ui/animation/sequencer.ts` — проверить обработку пустых фаз.
- `src/ui/screens/GameScreen.tsx` — Space → `dispatch({ type: 'END_TURN', entityId: 'player' })`.
