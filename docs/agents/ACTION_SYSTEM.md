# ACTION_SYSTEM — Action / Intent / Event

> Симуляция использует трёхфазную систему. Не путай Action (намерение) с Event (запись о произошедшем).

---

## Три фазы

```
Action → validate() → resolve() → Intent[]
  → execute() → Events → World Reactions → дополнительные Intents / Events
```

1. **Action (`GameAction`)** — высокоуровневое намерение игрока/врага (MOVE, ATTACK, END_TURN).
2. **Intent (`Intent`)** — низкоуровневые операции после разрешения (MOVE, DAMAGE, DIE).
3. **Event (`GameEvent`)** — неизменяемая запись о произошедшем, возвращается через дерево `ExecutionNode`.

---

## ExecutionBuilder и ExecutionNode

События организованы в дерево `ExecutionNode` (каноническое определение — `src/simulation/core-types.ts`, реэкспорт в `src/simulation/types.ts` и `src/simulation/systems/actions/types.ts`).

`ExecutionBuilder` создаёт корневое событие (`ACTION_APPLIED`) и позволяет присоединять дочерние узлы при порождении интентов и реакций.

---

## ActionHandler<T>

Каждый обработчик действия реализует:
- `validate(state, action): ValidationResult`
- `resolve(state, action): Intent[]`
- `execute(state, action, intents, builder, parentNode): void`

Оркестратор `runActionHandler` (`systems/actions/action-utils.ts`) вызывает их последовательно.

---

## IntentExecutor<T>

Исполнители интентов (`systems/intents/`) мутируют состояние и создают узлы событий. Примеры:
- **MOVE** — обновляет `entity.x / entity.y`, порождает `ENTITY_MOVED`
- **JUMP** / **PUSH** / **TELEPORT_ENTITY** — альтернативные перемещения
- **DAMAGE** — обменный урон, порождает `ENTITY_DAMAGED` / `ENTITY_MISSED`
- **HEAL** — восстановление HP, порождает `ENTITY_HEALED`
- **DIE** — удаляет врага или переводит игрока в `phase: 'dead'`, порождает `ENTITY_DIED` / `PLAYER_DIED`
- **APPLY_STATUS** / **ADJUST_STATUS_STACKS** — наложение и стаки статусов
- **EQUIP_ITEM** / **UNEQUIP_ITEM** — экипировка предметов
- **PICK_UP** / **SPAWN_ITEM** / **REMOVE_ITEM** — предметы
- **OPEN_DOOR** / **CLOSE_DOOR** — двери
- **FLOOR_TRANSITION** — переход между этажами
- **USE_ABILITY** / **COUNTER_ATTACK** / **NOTIFY_AI** — способности, встречные удары, AI-уведомления
- Системные: **CONSUME_AP**, **RESTORE_AP**, **SET_COOLDOWN**, **TICK_COOLDOWN**, **TICK_STATUS_EFFECTS**, **BEGIN_TURN**, **CLEANUP_DEAD_ENTITIES** и др.

Полный список — `src/simulation/core-types.ts` (union `Intent`).

---

## ⚠️ ВАЖНОЕ ПРАВИЛО: IntentExecutor не исполняет другие интенты

> **IntentExecutor должен выполнять ровно одно семантическое действие и порождать ровно одно семантическое событие. Он НЕ ДОЛЖЕН напрямую создавать или исполнять другие интенты.**

Если результат действия логически должен привести к другим эффектам (урону, наложению статуса, смерти и т.д.), исполнитель должен:

1. Выполнить своё прямое действие (например, переместить сущность или зафиксировать столкновение).
2. Породить **семантическое событие** (`ExecutionNode`), описывающее произошедшее.
3. Позволить **мировой реакции** (`WorldReaction`) на это событие породить следующие интенты.

### Пример: отталкивание актора в стену

**Неправильно:** `PUSH`-исполнитель сам вызывает `executeDamage()` и `executeApplyStatusIntent()`.

**Правильно:**

```
PUSH-исполнитель
  → фиксирует столкновение
  → порождает ENTITY_COLLIDED

WorldReaction на ENTITY_COLLIDED
  → порождает DAMAGE
  → порождает APPLY_STATUS (stunned)
```

Это правило гарантирует, что:
- мировые реакции запускаются последовательно и предсказуемо;
- каждый эффект проходит через `executeIntent` и получает свой `ExecutionNode`;
- логика не дублируется между исполнителями и реакциями;
- цепочки событий (смерть от урона, лут от смерти, горение от огненного урона) работают единообразно.

---

## Мировые реакции (`WorldReaction`)

После выполнения интента `runWorldReactions` проверяет зарегистрированные реакции.

Реестр реакций (`src/simulation/systems/world-reactions/reactions.ts`) содержит:
- `deathReaction` — при `ENTITY_DAMAGED`, если `hp <= 0`, порождает `DIE`;
- `postDeathLootReaction` — при `ENTITY_DIED` дропает лут;
- `fireDamageReaction` — дополнительный урон от огня;
- `collisionDamageReaction` / `collisionStunReaction` — урон и стан от столкновений;
- `displacementMoveReaction` — добивание отталкиванием;
- `burningTickReaction` — урон от горения при тике статуса;
- `floorTransitionReaction` — обработка смены этажа;
- `aiPerceptionReaction` — уведомляет AI о `ENTITY_MOVED`, `DOOR_OPENED`, `DOOR_CLOSED`;
- `counterAttackReaction` — встречный удар после `COUNTER_ATTACK_APPLIED`.

---

## Пример: ATTACK с убийством

1. **Action:** `ATTACK` (entityId, dx, dy)
2. **Validation:** проверка, что цель в зоне поражения
3. **Resolution:** порождает Intent `DAMAGE`
4. **Execution:** `executeDamageIntent` уменьшает HP и создаёт `ENTITY_DAMAGED`
5. **World Reactions:** `deathReaction` видит `hp <= 0`, порождает Intent `DIE`
6. **Execution DIE:** `executeDieIntent` удаляет сущность, создаёт `ENTITY_DIED`

Итоговое дерево:
```
ACTION_APPLIED (ATTACK)
└── ENTITY_DAMAGED (target, damage)
    └── ENTITY_DIED (target)
```

---

## Чеклист: добавление нового Action

- [ ] Тип добавлен в `GameAction` (`src/simulation/core-types.ts`)
- [ ] Handler создан в `src/simulation/systems/actions/`
- [ ] Handler зарегистрирован в `src/simulation/simulation.ts`
- [ ] Тесты добавлены в `tests/unit/simulation/actions/`

> **Примечание:** для объектных взаимодействий (двери, предметы на полу, лестницы, рычаги и т.п.) не добавляется отдельный action type. Вместо этого целевой объект получает `interactionKind`, а единый action `INTERACT` через `resolveInteraction` выбирает конкретный intent (`OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP`, `FLOOR_TRANSITION`).

## Чеклист: добавление нового Event

- [ ] Тип добавлен в union `GameEvent` (`src/simulation/core-types.ts`, реэкспорт в `src/simulation/types.ts`)
- [ ] Эмиссия добавлена в соответствующий `IntentExecutor` (`src/simulation/systems/intents/`)
- [ ] Обработка добавлена в Presentation (перевод в анимацию / combat log)
- [ ] Визуализация добавлена в UI (если требуется новый тип анимации)
