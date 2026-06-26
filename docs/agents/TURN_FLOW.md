# TURN_FLOW — Ход игры

> Реализован в `GameSimulation.dispatch()` (`src/simulation/simulation.ts`).

---

## Поток хода игрока

1. Создаётся `ExecutionBuilder` с событием `ACTION_APPLIED`.
2. Определяется актёр (`resolveActionActor`) — для хода игрока это всегда игрок.
3. Действие исполняется через `executeAction` (списываются AP).
4. Корневой узел игрока добавляется в фазу `PLAYER` результата.
5. Если у игрока закончились AP (`isPlayerExhausted`):
   - Запускается `runEnvironmentTurn` — все живые AI-актёры делают ходы.
   - Фаза `ENVIRONMENT` начинается с `BEGIN_TURN { side: 'ENVIRONMENT' }`.
   - Для каждого врага порождается узел `TURN_BEGAN` с подготовкой хода: `RESTORE_AP`, `TICK_COOLDOWN`, `TICK_CAST`.
   - Каждое действие врага получает собственный `ExecutionBuilder` и корневой узел `ACTION_APPLIED`; все они собираются в фазу `ENVIRONMENT`.
   - Запускается `beginNextPlayerTurn` — фиксируется `BEGIN_TURN { side: 'PLAYER' }`, увеличивается раунд, тикает каст, восстанавливаются AP игрока, тикают кулдауны.
6. Выполняется ASCII-рендер карты в консоль.
7. Возвращается `{ success, stateChanged, phases }`, где `phases` — массив фаз хода в порядке выполнения.

---

## Ход окружения (Environment Turn)

Для каждого живого AI-актёра:
- Создаётся корневой узел `TURN_BEGAN` для актора.
- Восстанавливаются AP через интент `RESTORE_AP` → событие `AP_RESTORED`.
- Тикают кулдауны способностей через `TICK_COOLDOWN` → `COOLDOWN_TICKED`.
- Тикает подготовленный каст через `TICK_CAST` → `CAST_TICKED` (или сразу резолвится, если `remainingTurns === 0`).
- Пока `ap > 0`: вызывается `enemy.aiStrategy.decideAction(enemy, state)`, результат исполняется.
- Каждое успешное действие врага порождает отдельное дерево `ExecutionNode` (корень `ACTION_APPLIED`).
- Если действие невозможно — ход прерывается.

---

## Начало хода игрока

- Создаётся корневой узел `TURN_BEGAN { side: 'PLAYER' }`.
- Выполняется `CLEANUP_DEAD_ENTITIES` → физически удаляются мёртвые не-игроковые сущности, порождается `DEAD_ENTITIES_CLEANED`.
- Выполняется `BEGIN_TURN` → устанавливается `turn.activeSide = 'PLAYER'`, увеличивается `turn.round`.
- Тикает каст игрока (`TICK_CAST` / резолв).
- Восстанавливаются AP игрока (`RESTORE_AP`).
- Тикают кулдауны способностей игрока (`TICK_COOLDOWN`).

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
Simulation → runEnvironmentTurn
  ┌─ TURN_BEGAN (ENVIRONMENT)
  ├─ TURN_BEGAN (enemy_1)
  │  ├─ AP_RESTORED
  │  ├─ COOLDOWN_TICKED
  │  └─ CAST_TICKED
  └─ AI решает действие (например, MOVE)
     └─ ENTITY_MOVED (cat_mid_1, (3,3) → (4,4))
    │
    ▼
Simulation → beginNextPlayerTurn
  └─ TURN_BEGAN (PLAYER)
     ├─ AP_RESTORED
     └─ COOLDOWN_TICKED
    │
    ▼
SimulationResult возвращается в Presentation:
  rootEvent: ExecutionNode (всё дерево: ход игрока + ход AI)
    │
    ▼
Presentation:
  - Обходит дерево
  - Формирует AnimationPlan:
      [ATTACK_ANIMATION, DAMAGE_NUMBER, DEATH_ANIMATION, MOVE_SPRITE]
  - Формирует combatLog:
      ["Вы ударили гоблина на 8 урона.", "Гоблин погиб.", "Орк двигается."]
  - Обновляет ViewModel
    │
    ▼
UI:
  - PixiJS исполняет анимации
  - React отображает обновлённый HUD и combat log
```
