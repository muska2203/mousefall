# TURN_FLOW — Ход игры

> Реализован в `DefaultTestSimulation.dispatch()` (`src/simulation/simulation.ts`).

---

## Поток хода игрока

1. Создаётся `ExecutionBuilder` с событием `ACTION_APPLIED`.
2. Определяется актёр (`resolveActionActor`) — для хода игрока это всегда игрок.
3. Действие исполняется через `executeAction` (списываются AP).
4. Корневой узел игрока добавляется в фазу `PLAYER` результата.
5. Если у игрока закончились AP (`isPlayerExhausted`):
   - Запускается `runEnvironmentTurn` — все живые AI-актёры делают ходы.
   - Каждое действие врага получает собственный `ExecutionBuilder` и корневой узел; все они собираются в фазу `ENVIRONMENT`.
   - Запускается `beginNextPlayerTurn` — увеличивается раунд, AP игрока восстанавливаются.
6. Выполняется ASCII-рендер карты в консоль.
7. Возвращается `{ success, stateChanged, phases }`, где `phases` — массив фаз хода в порядке выполнения.

---

## Ход окружения (Environment Turn)

Для каждого живого AI-актёра:
- Восстанавливаются AP (`ap = maxAp`).
- Пока `ap > 0`: вызывается `enemy.aiStrategy.decideAction(enemy, state)`, результат исполняется.
- Каждое успешное действие врага порождает отдельное дерево `ExecutionNode` (корень `ACTION_APPLIED`).
- Если действие невозможно — ход прерывается.

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
  ┌─ Для каждого живого AI:
  │  └─ AI решает действие (например, MOVE)
  │     └─ ENTITY_MOVED (cat_mid_1, (3,3) → (4,4))
    │
    ▼
Simulation → beginNextPlayerTurn
  └─ turn.round += 1
  └─ player.ap = player.maxAp
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
