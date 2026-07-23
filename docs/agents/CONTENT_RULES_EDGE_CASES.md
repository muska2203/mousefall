# Крайние случаи контентных правил (content-rules)

> **Статус:** `[STABLE]` — документ отражает текущую реализацию контентных правил.
> **Источник правды:** этот файл для edge cases; `src/simulation/content-rules/` для кода.

> Этот документ собирает пограничные ситуации, тонкости порядка исполнения и рекомендации по отладке декларативных контентных правил. Он дополняет [`Концепт боевой системы.md`](../plans/Концепт%20боевой%20системы.md) и [`docs/design/starting-rules-catalog.md`](../design/starting-rules-catalog.md) и ориентирован на разработчиков/агентов, которые будут добавлять новые правила.

---

## Содержание

1. [Self-эффекты](#self-эффекты)
2. [Циклы и лимит реакций](#циклы-и-лимит-реакций)
3. [Mid-chain статусы](#mid-chain-статусы)
4. [Конфликты статусов](#конфликты-статусов)
5. [Пустые селекторы](#пустые-селекторы)
6. [Порядок слоёв](#порядок-слоёв)
7. [Параметризованные значения](#параметризованные-значения)
8. [Модификаторы на интенте](#модификаторы-на-интенте)
9. [Отладка](#отладка)
10. [Чек-лист добавления нового правила](#чек-лист-добавления-нового-правила)

---

## Self-эффекты

### Что происходит

Когда в событии `sourceEntityId === targetEntityId` (например, самолечение или самонанесение урона), правила этой сущности **не срабатывают дважды**. Слои `source` и `target` объединяются: сущность включается только в слой `source`, а слой `target` для неё пропускается.

### Где это в коде

`src/simulation/content-rules/reaction/content-rule-reaction.ts`, функция `collectRules`:

```ts
// Если source и target совпадают, target-слой не дублируется.
if (ctx.targetEntityId !== null && ctx.targetEntityId !== ctx.sourceEntityId) { ... }
```

Аналогичное поведение в `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts` для модификаторов урона.

### Self-селектор

`target: { type: 'self' }` всегда разрешается в **владельца правила** (`selfId` текущего слоя), а не в `eventSource`/`eventTarget`. Это позволяет правилу целить самого себя независимо от того, кто инициировал событие.

### Пример из каталога

`amulet_restore_ap_on_hit` — амулет при ударе игрока с шансом 15% восстанавливает AP **владельцу амулета**:

```ts
{
  id: 'amulet_restore_ap_on_hit',
  trigger: { event: 'ENTITY_DAMAGED', tags: ['attack.melee', 'delivery.weapon'] },
  conditions: [{ type: 'chance', probability: 15 }],
  effect: { type: 'restoreAp' },
  target: { type: 'self' },
}
```

Если игрок атакует себя (редкий edge case), правило сработает один раз через слой `source` и не повторится в слое `target`.

### Типичная ошибка

Правило с `target: { type: 'self' }`, в котором владелец совпадает с `eventTarget`, не дублируется — это ожидаемо. Если нужно гарантированно применить эффект к цели события, используйте `eventTarget`.

---

## Циклы и лимит реакций

### Лимит

Глубина цепочки реакций ограничена константой `MAX_REACTION_DEPTH = 1000` (`src/simulation/systems/intents/execute-intent.ts`). Лимит считается по рекурсивным вызовам `executeIntent`.

### Что происходит при превышении

Если `reactionDepth > 1000`, `executeIntent` возвращает `null` **до выполнения интента**, печатает ошибку в консоль и прерывает дальнейшее распространение этой ветви цепочки. Остальные ветви, уже находящиеся в очереди, продолжают выполняться.

```ts
if (reactionDepth > MAX_REACTION_DEPTH) {
  console.error('[executeIntent] превышен лимит глубины реакций (%d)', MAX_REACTION_DEPTH);
  return null;
}
```

### Как отлаживать с помощью RULE_TRIGGERED

Событие `RULE_TRIGGERED` (`src/simulation/core-types.ts`) записывается в дерево `ExecutionNode` как child узла, вызвавшего реакцию. Оно содержит:

- `ruleId` — какое правило сработало;
- `layer` — `source` | `target` | `world` | `radius`;
- `ownerEntityId` — владелец правила;
- `triggerEventType` — событие, на которое отреагировали;
- `triggerTags` — теги того события;
- `intents` — порождённые интенты;
- `conditionMatched: true`.

В debug-режиме combat log и `DebugPanel` показывают `RULE_TRIGGERED`. Если бой «завис» или выд странный результат, ищите повторяющиеся `ruleId` в дереве — это признак цикла.

### Примеры циклов

Классический цикл: правило A наносит урон → `ENTITY_DAMAGED` → правило B наносит урон → `ENTITY_DAMAGED` → правило A снова. Без лимита такая цепь ушла бы в бесконечность. Лимит 1000 — аварийный стоп-кран, а не решение проблемы: при обнаружении цикла правила нужно пересматривать.

---

## Mid-chain статусы

### Правило

Статус, наложенный реакцией в процессе текущей цепочки, **немедленно добавляется** в `actor.activeRules` (кэш активных правил), но **не участвует в текущей фазе `ContentRuleReaction`**. Его правила активируются **сразу после завершения текущей цепочки** и учитываются во всех последующих действиях в рамках того же `dispatch(action)`.

### Почему так

Текущая фаза `ContentRuleReaction` работает со **снимком** правил, собранным в её начале. Это сохраняет предсказуемость: статус влияет на будущие события, а не на событие, которое его вызвало.

### Пример

```text
Игрок бьёт мечом
  → DAMAGE intent
    → executeIntent → ENTITY_DAMAGED
      → ContentRuleReaction: кольцо «при рубящем уроне → наложить ярость»
        → APPLY_STATUS rage
          → правила rage активируются ПОСЛЕ завершения цепочки
```

Если `rage` даёт бонус к урону, он **не** усилит исходный удар мечом, но усилит следующий удар в том же ходу/боевом цикле.

### Альтернативный вариант (post-MVP)

Немедленная активация mid-chain статусов в текущей цепочке отложена на пост-MVP. Если дизайн потребует такого поведения, потребуется изменить `ContentRuleReaction` и/или жизненный цикл `activeRules`.

---

## Конфликты статусов

### Поля шаблона статуса

```ts
{
  statusCategory: StatusCategory,
  categoryPriority: number,
  mutuallyExclusiveWith: StatusEffectType[], // снимаются при наложении этого статуса
  blockedBy: StatusEffectType[],             // этот статус не накладывается, если есть блокирующий
}
```

### Правила наложения

1. Если на акторе есть статус из `blockedBy`, `APPLY_STATUS` не применяется и порождает событие `STATUS_BLOCKED`.
2. Иначе сначала снимаются статусы из `mutuallyExclusiveWith` (`STATUS_REMOVED`), затем накладывается новый.

### Замена vs стаки

- **Замена**: один статус категории заменяет другой. Решается `statusCategory` + `categoryPriority` в `resolveStatusBatch` (`src/simulation/systems/statuses/status-conflict-resolver.ts`). Для одной пары `(entityId, statusCategory)` остаётся только один `APPLY_STATUS` с наивысшим `categoryPriority`.
- **Стаки**: статусы разных категорий / без категории сосуществуют. Например, `burning` и `poisoned` могут висеть одновременно.

### Примеры из контента

| Статус | `mutuallyExclusiveWith` | `blockedBy` |
|---|---|---|
| `wet` | `burning` | `oiled` |
| `oiled` | `wet` | `[]` |
| `burning` | `wet` | `[]` |
| `stunned` | `dazed` | `[]` |
| `dazed` | `[]` | `stunned` |

- `wet` тушит `burning`, но не накладывается, если актор в масле.
- `oiled` смывает `wet`, но не тушит `burning`.
- `stunned` заменяет `dazed`.

### Разрешение в одной фазе реакций

Если несколько правил одновременно пытаются наложить взаимоисключающие статусы:

1. Выполняются все `REMOVE_STATUS` и снятия через `mutuallyExclusiveWith`.
2. Проверяются `blockedBy` против состояния после шага 1.
3. Оставшиеся `APPLY_STATUS` сортируются по `categoryPriority` (выше — раньше).
4. При равных приоритетах используется порядок правил: `source` → `target` → `world` → `radius`, затем `priority`, затем `ruleId`.

---

## Пустые селекторы

### Поведение

Если `targetSelector` не находит ни одной цели, правило **пропускается** без ошибки:

```ts
const targetIds = resolveTarget(rule.target, ctx, selfId).filter((candidateId) => {
  if (!rule.targetConditions) return true;
  return evaluateConditions(rule.targetConditions, ctx, selfId, candidateId);
});

if (targetIds.length === 0) continue;
```

Это означает, что `RULE_TRIGGERED` **не записывается**, а эффект не применяется.

### allInRadius

`allInRadius` возвращает пустой массив, если:

- центр `eventPosition` / `self` не разрешился (`resolveCenter` вернул `null`);
- в радиусе нет живых акторов;
- все найденные акторы исключены фильтрами `faction` или `excludeSelf`;
- в радиусе есть только мёртвые сущности.

Результат отсортирован по `id` для детерминизма.

### nearestEnemy

`nearestEnemy` возвращает пустой массив, если:

- центр не разрешился;
- в радиусе нет врагов;
- у сущности-владельца не задана фракция.

Если несколько врагов на одинаковом расстоянии, tie-break по `id`.

### Практический совет

Не полагайтесь на то, что правило «обязательно найдёт цель». Для AoE-эффектов с негарантированным числом целей это нормальная ситуация. Если пустой селектор — ошибка контента, добавьте валидацию или `conditions`.

---

## Порядок слоёв

### Общий порядок

Правила обрабатываются строго в порядке:

```text
source → target → world → radius
```

### Сортировка внутри слоя

1. **world** сначала сортируется по подтипу: `global` → `tileEffect` → `tileIntrinsic`.
2. Затем все слои сортируются по `priority` (меньше — раньше).
3. При равных `priority` — по `ruleId` (лексикографически, детерминированный tie-break).

### Пример влияния порядка

```text
source:  item_fire_damage_multiplier (multiply ×1.5)
world:   fire_damage_ignites       (applyStatus burning)
world:   status_burning_vulnerability (multiply ×1.2)
```

- Модификаторы урона: `source` и `world` применяются к `DAMAGE`-интенту до нанесения урона.
- Реакция на событие: `world` срабатывает после `ENTITY_DAMAGED` и может наложить `burning`.
- Если у цели уже есть `burning`, мировое правило `status_burning_vulnerability` усилит входящий огненный урон на 20%.

### Слой radius

`radius` — это сущности в радиусе 1 (Chebyshev distance) от `eventPosition`, исключая `source` и `target`. Используется для аур и наблюдателей.

### Self vs target повторно

Если `sourceEntityId === targetEntityId`, target-слой пропускается, поэтому для self-эффектов `source` всегда идёт раньше любого потенциального `target`.

---

## Параметризованные значения

### Тип `ParametrizedValue`

```ts
export type ParametrizedValue =
  | { type: 'literal'; value: number }
  | {
      type: 'context';
      field: 'eventDamage' | 'eventAmount' | 'eventDuration' | 'eventStacks' | 'eventMaxHp';
      multiply?: number;
      min?: number;
      round?: boolean;
    };
```

### literal

Простая константа. Эквивалентна числу, но явно помечена как параметризованное значение.

```ts
amount: { type: 'literal', value: 5 }
```

### context

Читает поле из `RuleContext` и применяет к нему опциональные операции:

1. `multiply` — умножает извлечённое значение.
2. `min` — нижняя граница после умножения (`Math.max(v, min)`).
3. `round` — округление до ближайшего целого (`Math.round`), если `true`.

### Примеры

**Тик яда:** 8% max HP, минимум 1, округление.

```ts
{
  type: 'context',
  field: 'eventMaxHp',
  multiply: 0.08,
  min: 1,
  round: true,
}
```

**Урон контратаки:** передаёт `eventDamage` без изменений.

```ts
{
  type: 'context',
  field: 'eventDamage',
}
```

**Прямое число:** `amount: 5` — сахар для `{ type: 'literal', value: 5 }` (на самом деле `resolveParametrizedValue` принимает `number | ParametrizedValue` и возвращает число как есть).

### Что не поддерживается

- `divide`, `add`, `subtract`, `max`, `floor`, `ceil` — заложены в концепте, но в текущем `value-resolver.ts` не реализованы.
- Ссылки на характеристики (`source.str`, `target.maxHp` и т.п.) — отложены.
- `round` по умолчанию `false`: если не указать `round: true`, результат остаётся дробным.

### fallback

Если `context`-значение не найдено (`ctx[field]` — `null` или `undefined`), используется 0.

---

## Модификаторы на интенте

### Только DAMAGE

В текущей реализации модификаторы применяются **только к `DAMAGE`-интентам**. Для остальных типов интентов `applyIntentModifiers` возвращает исходный объект без изменений.

### Порядок операций

Внутри одного слоя модификаторы сортируются так:

```text
multiply → add
```

То есть сначала все множители, потом все добавочные значения.

Пример:

```text
source: multiply ×2
source: add +3
world:  multiply ×1.5
target: add -2
```

Порядок: `source ×2` → `source +3` → `world ×1.5` → `target -2`.

### Округление

`applyIntentModifiers` **не округляет** итоговый урон. Округление происходит позже, при исполнении `DAMAGE`-интента (обычно в `executeDamageIntent`).

### Ограничения

- Модификаторы не мутируют `state`, только меняют поле `damage` и `tags` интента.
- `addTags` добавляет теги через `mergeDamageIntentTags`, гарантируя ровно один `damage.*`-тег.

### Пример из каталога

```ts
{
  id: 'item_fire_damage_multiplier',
  trigger: { event: 'DAMAGE', tags: ['damage.magical.fire'] },
  effect: { type: 'modifyDamage', op: 'multiply', value: 1.5 },
  target: { type: 'eventTarget' },
}
```

Если огненный меч наносит 10 урона, после модификатора урон станет 15 (до округления в исполнителе).

---

## Отладка

### RULE_TRIGGERED

Событие `RULE_TRIGGERED` — основной инструмент observability. Оно не влияет на игровую логику, только на дерево `ExecutionNode`.

Что видно:

- какое правило сработало (`ruleId`);
- из какого слоя (`layer`);
- кто владелец (`ownerEntityId`);
- какие интенты породило (`intents`);
- совпали ли условия (`conditionMatched: true`, всегда true при записи).

### Debug-лог

В debug-режиме combat log печатает сообщение вида:

```text
[DEBUG] Сработало правило {ruleId} ({layer}) → {intents}
```

### Как диагностировать проблему

1. **Правило не срабатывает:** проверьте `trigger.event`, `trigger.tags` и `eventTags` в `RULE_TRIGGERED` соседних правил. Частая причина — не совпадают теги (например, `delivery.weapon` отсутствует).
2. **Сработало не то правило:** смотрите порядок слоёв и `priority`.
3. **Бесконечная цепочка:** ищите повторяющиеся `ruleId` в дереве.
4. **Неправильный урон:** проверьте `DAMAGE`-интент до и после модификаторов; убедитесь, что `multiply` и `add` в правильном порядке.
5. **Пустой селектор:** `RULE_TRIGGERED` не будет записан — смотрите, что вернул `resolveTarget`.

### Ручное тестирование

Для изоляции правила используйте тестовые хелперы из `tests/fixtures/content-rules.ts`:

- `withContentRules(extraRules, callback)` — временно добавить source-bound правила.
- `withWorldContentRules(extraRules, callback)` — временно добавить мировые правила.

---

## Чек-лист добавления нового правила

1. **Определить тип правила.**
   - Модификатор на интенте (`modifyDamage`) → триггер `DAMAGE` или другой интент.
   - Реакция на событие (`applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `counterAttack`) → триггер `GameEvent`.

2. **Добавить правило в реестр.**
   - Source-bound правило: `src/simulation/content-rules/rules.ts`, массив `CONTENT_RULES`.
   - Мировое правило: `src/simulation/content-rules/world-rules/global-rules.ts`, массив `GLOBAL_WORLD_CONTENT_RULES` (или создать отдельный модуль и реэкспортировать).
   - Убедиться, что `id` уникален в пределах `CONTENT_RULES + WORLD_CONTENT_RULES`.

3. **Обновить контент, который ссылается на правило.**
   - Предмет: `public/content/items/...json`, поле `ruleIds`.
   - Статус: `public/content/statuses/...json`, поле `ruleIds`.
   - Способность: `public/content/abilities/...json`, поле `ruleIds`.

4. **Проверить валидацию.**
   - `npm run validate:content` должен проходить.
   - Если правило использует `applyStatus`, статус должен существовать в `public/content/statuses/`.
   - Если использует `counterAttack` с `skillId`, способность должна существовать.

5. **Добавить/обновить тексты.**
   - Если правило даёт предмет/статус/способность новый эффект, обновите `name`/`description`/`flavorText` в `src/content/texts/ru.ts` и `src/content/texts/en.ts`.
   - Не храните тексты в JSON-шаблонах.

6. **Написать тесты.**
   - Unit: `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts` или новый файл.
   - Интеграционный сценарий: `tests/integration/combat-scenarios/`.
   - Проверьте edge cases: пустой селектор, self-эффект, mid-chain статус, конфликт статусов.

7. **Обновить документацию.**
   - Если правило входит в стартовый набор — `docs/design/starting-rules-catalog.md`.
   - Если добавляет новый edge case — этот файл (`CONTENT_RULES_EDGE_CASES.md`).
   - Если меняет порядок/жизненный цикл — `src/simulation/content-rules/AGENTS.md` и `docs/plans/Концепт боевой системы.md`.

8. **Запустить проверки.**
   - `npm run typecheck`
   - `npm test`
   - `npm run validate:content`

---

## Связанные документы

- [`docs/plans/Концепт боевой системы.md`](../plans/Концепт%20боевой%20системы.md) — концептуальное описание боевой системы.
- [`docs/design/starting-rules-catalog.md`](../design/starting-rules-catalog.md) — каталог стартовых правил и чисел.
- [`src/simulation/content-rules/AGENTS.md`](../../src/simulation/content-rules/AGENTS.md) — локальные правила слоя content-rules.
- [`src/simulation/AGENTS.md`](../../src/simulation/AGENTS.md) — общие правила слоя simulation.
- [`docs/agents/CONTENT.md`](./CONTENT.md) — контент-пайплайн и добавление JSON-шаблонов.
