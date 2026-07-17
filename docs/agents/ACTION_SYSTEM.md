# ACTION_SYSTEM — Action / Intent / Event

> Симуляция использует трёхфазную систему. Не путай Action (намерение) с Event (запись о произошедшем).

---

## Три фазы

```
Action → validate() → resolve() → Intent[]
  → applyIntentModifiers() → execute() → Events
  → runContentRuleReactions() → runWorldReactions()
  → дополнительные Intents / Events
```

1. **Action (`GameAction`)** — высокоуровневое намерение игрока/врага (MOVE, ATTACK, END_TURN).
2. **Intent (`Intent`)** — низкоуровневые операции после разрешения (MOVE, DAMAGE, DIE).
3. **Модификаторы на интенте** — перед `execute()` контентные правила могут изменить интент (сейчас только `modifyDamage` для `DAMAGE`).
4. **Execution** — `IntentExecutor` мутирует состояние и порождает событие.
5. **ContentRuleReaction** — контентные правила реагируют на событие и порождают дополнительные интенты.
6. **WorldReaction** — системные мировые реакции на то же событие.
7. **Event (`GameEvent`)** — неизменяемая запись о произошедшем, возвращается через дерево `ExecutionNode`.

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

## Модификаторы на интенте

Перед вызовом `IntentExecutor` `executeIntent` строит `RuleContext` и применяет к интенту модифицирующие контентные правила (`applyIntentModifiersIfEnabled` → `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`).

- **Поддерживаемый тип интента:** только `DAMAGE`. Остальные интенты проходят без изменений.
- **Эффект:** `modifyDamage` (`op: 'multiply' | 'add'`, `value`, опционально `addTags`).
- **Слои происхождения:** `source` → `target` → `world` → `radius`.
  - `source` — `activeRules` сущности-источника интента.
  - `target` — `activeRules` сущности-цели (не дублируется, если совпадает с `source`).
  - `world` — глобальные мировые правила (`worldLayer: 'global'`).
  - `radius` — `activeRules` живых акторов в радиусе 1 от позиции события (исключая `source` и `target`).
- **Порядок внутри слоя:** сначала `multiply`, затем `add`; затем `priority` (меньше — раньше); затем `ruleId` для детерминированного порядка.
- **Результат:** новый интент с изменённым `damage` и/или `tags`; исходный объект не мутируется.
- **Feature flag:** поведение активно, только если `contentRulesEnabled` включён (`src/simulation/content-rules/feature-flags.ts`). Флаг включён по умолчанию.

---

## ⚠️ ВАЖНОЕ ПРАВИЛО: IntentExecutor не исполняет другие интенты

> **IntentExecutor должен выполнять ровно одно семантическое действие и порождать ровно одно семантическое событие. Он НЕ ДОЛЖЕН напрямую создавать или исполнять другие интенты.**

Если результат действия логически должен привести к другим эффектам (урону, наложению статуса, смерти и т.д.), исполнитель должен:

1. Выполнить своё прямое действие (например, переместить сущность или зафиксировать столкновение).
2. Породить **семантическое событие** (`ExecutionNode`), описывающее произошедшее.
3. Позволить **реакциям** (`ContentRuleReaction` и `WorldReaction`) на это событие породить следующие интенты.

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

## Контентные реакции (`ContentRuleReaction`)

После выполнения интента и до вызова `runWorldReactions` `executeIntent` запускает реакции контентных правил (`runContentRuleReactionsIfEnabled` → `src/simulation/content-rules/reaction/content-rule-reaction.ts`).

- **Контекст:** `RuleContext` строится по событию (`src/simulation/content-rules/rule-context.ts`) и содержит `sourceEntityId`, `targetEntityId`, `eventPosition`, `eventTags`, а также специфичные поля (урон, длительность, стаки и т.д.).
- **Слои правил:** `source` → `target` → `world` → `radius`.
  - `source` — `activeRules` сущности-источника события.
  - `target` — `activeRules` сущности-цели (не дублируется, если совпадает с `source`).
  - `world` — глобальные правила и тайловые эффекты.
  - `radius` — `activeRules` живых акторов в радиусе 1 от позиции события (исключая `source` и `target`).
- **Порядок внутри слоя `world`:** `global` → `tileEffect` → `tileIntrinsic`.
- **Общий порядок сортировки:** слой → подтип слоя `world` → `priority` (меньше — раньше) → `ruleId`.
- **Фильтрация:** правила отбираются по типу события (`trigger.event`) и обязательным тегам (`trigger.tags`).
- **Условия:** поддерживаются `chance`, `hasStatus`, `hasTag`, `and`, `or`, `not`.
- **Поддерживаемые эффекты:** `applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `modifyDamage` (только на интенте, не порождает интентов здесь), `counterAttack`.
- **Execution Node:** каждое сработавшее правило создаёт узел `RULE_TRIGGERED` в дереве `ExecutionNode` как дочерний к событию, вызвавшему реакцию. Порождённые правилом интенты исполняются отдельно и могут породить собственные цепочки реакций.
- **Feature flag:** поведение активно, только если `contentRulesEnabled` включён (`src/simulation/content-rules/feature-flags.ts`). Флаг включён по умолчанию.

---

## Мировые реакции (`WorldReaction`)

После выполнения интента `runWorldReactions` (`src/simulation/systems/world-reactions/reactions.ts`) проверяет зарегистрированные системные реакции.

Сейчас реестр содержит только системные реакции:
- `deathReaction` — при `ENTITY_DAMAGED`, если `hp <= 0`, порождает `DIE`;
- `postDeathLootReaction` — при `ENTITY_DIED` дропает лут;
- `displacementMoveReaction` — добивание отталкиванием;
- `floorTransitionReaction` — обработка смены этажа;
- `aiPerceptionReaction` — уведомляет AI о `ENTITY_MOVED`, `DOOR_OPENED`, `DOOR_CLOSED`.

> Ранее здесь находились игровые механики (урон от огня, урон и стан от столкновений, тик горения). Они перенесены в декларативные контентные правила (`src/simulation/content-rules/world-rules/global-rules.ts`) и теперь обрабатываются фазой `ContentRuleReaction`.

---

## Пример: ATTACK с убийством

1. **Action:** `ATTACK` (entityId, dx, dy)
2. **Validation:** проверка, что цель в зоне поражения
3. **Resolution:** порождает Intent `DAMAGE`
4. **Modifiers:** контентные правила могут изменить урон (например, бонус к урону от предмета источника)
5. **Execution:** `executeDamageIntent` уменьшает HP и создаёт `ENTITY_DAMAGED`
6. **Content Reactions:** сработавшие правила (например, `fire_damage_ignites`, эффекты предметов) создают `RULE_TRIGGERED` и могут породить дополнительные интенты
7. **World Reactions:** `deathReaction` видит `hp <= 0`, порождает Intent `DIE`
8. **Execution DIE:** `executeDieIntent` удаляет сущность, создаёт `ENTITY_DIED`

Итоговое дерево:
```
ACTION_APPLIED (ATTACK)
└── ENTITY_DAMAGED (target, damage)
    ├── RULE_TRIGGERED (fire_damage_ignites, ...)
    └── ENTITY_DIED (target)
```

---

## Чеклист: добавление нового Action

- [ ] Тип добавлен в `GameAction` (`src/simulation/core-types.ts`)
- [ ] Handler создан в `src/simulation/systems/actions/`
- [ ] Handler зарегистрирован в `src/simulation/simulation.ts`
- [ ] Тесты добавлены в `tests/unit/simulation/actions/`
- [ ] Проверено влияние на контентные правила: если action порождает события, на которые могут реагировать правила, добавлены/обновлены соответствующие `RuleContext` и `RULE_TRIGGERED`

> **Примечание:** для объектных взаимодействий (двери, предметы на полу, лестницы, рычаги и т.п.) не добавляется отдельный action type. Вместо этого целевой объект получает `interactionKind`, а единый action `INTERACT` через `resolveInteraction` выбирает конкретный intent (`OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP`, `FLOOR_TRANSITION`).

## Чеклист: добавление нового Event

- [ ] Тип добавлен в union `GameEvent` (`src/simulation/core-types.ts`, реэкспорт в `src/simulation/types.ts`)
- [ ] Эмиссия добавлена в соответствующий `IntentExecutor` (`src/simulation/systems/intents/`)
- [ ] Обработка добавлена в Presentation (перевод в анимацию / combat log)
- [ ] Визуализация добавлена в UI (если требуется новый тип анимации)
- [ ] Для событий, которые могут быть триггером контентных правил, добавлено построение `RuleContext` в `src/simulation/content-rules/rule-context.ts`
- [ ] Если событие генерируется вне стандартного `executeIntent` (ручной вызов `builder.addChild`), учтён узел `RULE_TRIGGERED` в дереве `ExecutionNode` при необходимости
