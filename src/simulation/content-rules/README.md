# Content Rules — декларативные контентные правила

> Слой data-driven боевых правил: предметы, статусы и способности ссылаются на статические правила по `ruleIds`, а рантайм собирает и применяет их в ответ на события и интенты.

---

## Архитектура

Система состоит из трёх частей:

1. **Хранилище правил** — статические TypeScript-объекты (`rules.ts`) и реестр (`registry.ts`).
2. **Рантайм-контекст** — `RuleContext`, построенный по событию/интенту (`rule-context.ts`).
3. **Исполнение** — модификаторы интентов (`modifiers/apply-intent-modifiers.ts`) и контентные реакции (`reaction/content-rule-reaction.ts`).

Точки врезки в боевой цикл находятся в `src/simulation/systems/intents/execute-intent.ts`:

- модификаторы применяются перед `IntentExecutor`;
- контентные реакции запускаются после `IntentExecutor`, перед системными `WorldReaction`.

Новая система по умолчанию **выключена** через `GameState.featureFlags.contentRulesEnabled`.

---

## Структура папки

| Файл | Назначение |
|---|---|
| `types.ts` | Типы: `ContentRule`, `ActiveRule`, `WorldContentRule`, `OwnerContext`, `RuleTrigger`, `RuleCondition`, `TargetSelector`, `RuleEffect`, `ParametrizedValue`. |
| `rules.ts` | Статические декларативные правила (`CONTENT_RULES`) и глобальные мировые правила (`WORLD_CONTENT_RULES`). |
| `registry.ts` | Реестр правил по `id`: `getContentRule`, `tryGetContentRule`, `getAllContentRules`. |
| `validation.ts` | Проверка ссылок `ruleIds` в шаблонах предметов, способностей и статусов. |
| `rule-context.ts` | Тип `RuleContext` и функция `buildRuleContext(state, event/intent)`. |
| `reaction/content-rule-reaction.ts` | `runContentRuleReactions` — сбор, фильтрация, условия, селекторы и генерация интентов. |
| `modifiers/apply-intent-modifiers.ts` | `applyIntentModifiers` — изменение `DAMAGE`-интентов (multiply/add, теги). |
| `feature-flags.ts` | Работа с флагом `contentRulesEnabled`. |
| `runtime-rng.ts` | Управление `GameState.runtimeRng` для детерминированных шансов правил. |
| `intent-modifiers.ts` | Точка врезки `applyIntentModifiersIfEnabled`. |
| `event-reactions.ts` | Точка врезки `runContentRuleReactionsIfEnabled`. |
| `README.md` | Этот файл. |

---

## Границы фазы 2

### Поддерживается

**Условия (`RuleCondition`):**

- `chance` — константа или параметризованная вероятность (использует `state.runtimeRng`, см. раздел ниже);
- `hasStatus` — проверка статуса у `self` / `target` / `candidate`;
- `and` / `or` / `not` — логические комбинации;
- `targetConditions` — фильтрация целей после их разрешения.

**Селекторы целей (`TargetSelector`):**

- `eventTarget`, `eventSource`, `self`, `collisionTarget`;
- `allInRadius` — все акторы в радиусе (с опциональной фракцией `enemy`/`ally`);
- `nearestEnemy` — ближайший враг в радиусе.

**Эффекты (`RuleEffect`):**

- `applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`;
- `modifyDamage` — только в слое модификаторов.

**Слои применения:**

- `source` → `target` → `world` → `radius`;
- сортировка: слой → приоритет → `ruleId`;
- в слое модификаторов внутри слоя сначала `multiply`, затем `add`.

### Отложено

- Тайловые эффекты (`worldLayer: 'tileEffect'`) и встроенные свойства тайла (`worldLayer: 'tileIntrinsic'`).
- Условия у модификаторов интентов (на фазе 2 модификаторы фильтруются только по триггеру/тегам).
- Модификаторы для интентов, отличных от `DAMAGE`.
- Параметризованные значения сложнее `literal` / `context`.
- Запись реакций в дерево `ExecutionNode` (`builder` и `parent` зарезервированы).

---

## Примеры правил

### Реакция: огненный урон поджигает цель

```typescript
{
  id: 'fire_damage_ignites',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['damage.magical.fire'],
  },
  conditions: [{ type: 'chance', probability: 30 }],
  effect: {
    type: 'applyStatus',
    statusType: 'burning',
    duration: 3,
  },
  target: { type: 'eventTarget' },
  priority: 0,
  ownerContext: { type: 'world' },
  worldLayer: 'global',
}
```

### Модификатор: огненный урон ×1,5

```typescript
{
  id: 'item_fire_damage_multiplier',
  trigger: {
    event: 'DAMAGE',
    tags: ['damage.magical.fire'],
  },
  effect: {
    type: 'modifyDamage',
    op: 'multiply',
    value: 1.5,
  },
  target: { type: 'eventTarget' },
  priority: 0,
}
```

### Глобальное мировое правило

```typescript
{
  id: 'fire_damage_ignites',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['damage.magical.fire'],
  },
  conditions: [{ type: 'chance', probability: 30 }],
  effect: {
    type: 'applyStatus',
    statusType: 'burning',
    duration: 3,
  },
  target: { type: 'eventTarget' },
  priority: 0,
  ownerContext: { type: 'world' },
  worldLayer: 'global',
}
```

---

## Детерминированные шансы и `runtimeRng`

Условие `chance` использует `GameState.runtimeRng` (Mulberry32) вместо `Math.random()`.
Это гарантирует, что одно и то же начальное состояние + одна последовательность действий
дают один и тот же результат шансовых правил, при этом runtime-шансы не мутируют
`state.rng`, отвечающий за генерацию мира.

`runtimeRng` создаётся в `createNewGameState`, сериализуется в сохранениях,
а при загрузке старых сейвов восстанавливается через `ensureRuntimeRng`.

---

## Включение

По умолчанию система выключена. Чтобы включить в тесте или пилоте:

```typescript
import { setContentRulesEnabled } from '@simulation/content-rules/feature-flags.ts';

setContentRulesEnabled(state, true);
```

При выключенном флаге `executeIntent` работает по старой схеме: модификаторы возвращают исходный интент, а контентные реакции возвращают пустой массив.
