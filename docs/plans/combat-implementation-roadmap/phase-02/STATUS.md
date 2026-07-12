# Фаза 2. Введение абстракций — текущий статус

> Актуальный статус реализации фазы 2. Обновляется по мере прохождения шагов.
> Дата последнего обновления: 2026-07-13.

---

## Общий прогресс

Фаза 2 выполнена на **~33%** (2 из 6 шагов).

- ✅ Шаг 2.1 — Реестр декларативных правил
- ✅ Шаг 2.2 — Построитель `RuleContext`
- ⏳ Шаг 2.3 — Жизненный цикл `activeRules`
- ⏳ Шаг 2.4 — Каркас `ContentRuleReaction`
- ⏳ Шаг 2.5 — Каркас модификаторов на интенте
- ⏳ Шаг 2.6 — Флаги и точки включения

---

## ✅ Выполненные шаги

### Шаг 2.1. Реестр декларативных правил

**Статус:** завершён.

**Что сделано:**

- `ruleIds` добавлены в `ItemTemplateSchema` и `AbilityTemplateSchema` (`src/content/schemas.ts`).
- Создан `StatusTemplateSchema`, расширен `LoadedContent` полем `statuses`.
- `src/content/loader.ts` загружает категорию `statuses`.
- `scripts/generate-manifest.js` сканирует `public/content/statuses/`.
- Созданы JSON-шаблоны статусов в `public/content/statuses/` для всех `StatusEffectType`.
- Созданы:
  - `src/simulation/content-rules/rules.ts` — статические правила;
  - `src/simulation/content-rules/registry.ts` — поиск по `ruleId`;
  - `src/simulation/content-rules/validation.ts` — валидация ссылок из шаблонов.
- Создан `src/bootstrap.ts`, в `src/main.tsx` вызывается `bootstrapContent()`.
- Исправлены все вызовы `initRegistry` и mock-шаблоны в тестах.

**Тесты:**

- `tests/unit/simulation/content-rules/registry.test.ts`
- `tests/unit/simulation/content-rules/validation.test.ts`

### Шаг 2.2. Построитель `RuleContext`

**Статус:** завершён.

**Что сделано:**

- Создан `src/simulation/content-rules/rule-context.ts`.
- Определён тип `RuleContext`.
- Реализована функция `buildRuleContext(state, event)`.
- Поддержаны MVP-события: `ENTITY_DAMAGED`, `ENTITY_HEALED`, `ENTITY_COLLIDED`, `STATUS_APPLIED`, `ABILITY_USED`, `TURN_BEGAN`, `AP_RESTORED`.
- Поддержаны MVP-интенты: `DAMAGE`, `PUSH`, `APPLY_STATUS`, `MOVE`, `HEAL`.
- Реализован fallback `eventPosition`.

**Тесты:**

- `tests/unit/simulation/content-rules/rule-context.test.ts` (18 тестов).

---

## ⏳ Оставшиеся шаги

### Шаг 2.3. Жизненный цикл `activeRules`

**Задачи:**

- Добавить поле `activeRules: ActiveRule[]` в интерфейс `Actor` (`src/simulation/types.ts`).
- Добавить `instanceId` в `StatusEffect` (`src/simulation/core-types.ts`).
- Создать модуль `src/simulation/systems/rules/active-rule-lifecycle.ts` с хелперами добавления/удаления правил.
- Интегрировать в исполнители:
  - `executeEquipItemIntent` / `executeUnequipItemIntent`;
  - `executeApplyStatusIntent` и места удаления статуса (`tick-status-effects`, `adjust-status-stacks`, `skip-stunned-turn`);
  - `executeGrantAbilityIntent` / `executeRevokeAbilityIntent`.
- Инициализировать `activeRules: []` во всех местах создания актора.
- Добавить тесты.

**Блокируется ли чем-то:** нет, может выполняться после шагов 2.1–2.2.

### Шаг 2.4. Каркас `ContentRuleReaction`

**Задачи:**

- Создать `src/simulation/content-rules/reaction/content-rule-reaction.ts`.
- Реализовать сбор правил по слоям `source → target → world → radius`.
- Реализовать фильтрацию по событию/тегам.
- Реализовать базовые условия (`chance`, `hasStatus`, `and`/`or`/`not`).
- Реализовать селекторы целей (`eventTarget`, `eventSource`, `self`, `collisionTarget`, базовый `allInRadius`).
- Реализовать генерацию интентов (`applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`).
- Добавить тесты.

**Блокируется ли чем-то:** зависит от шага 2.3 (`activeRules`).

### Шаг 2.5. Каркас модификаторов на интенте

**Задачи:**

- Создать `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`.
- Реализовать сбор модифицирующих правил по слоям.
- Реализовать порядок применения: `multiply` → `add` внутри каждого слоя.
- Реализовать `MODIFY_DAMAGE` с константами и базовыми параметризованными значениями.
- Добавить тесты.

**Блокируется ли чем-то:** зависит от шага 2.3 (`activeRules`).

### Шаг 2.6. Флаги и точки включения

**Задачи:**

- Добавить `featureFlags.contentRulesEnabled` в `GameState`.
- Создать `src/simulation/content-rules/feature-flags.ts`.
- Создать заглушки:
  - `src/simulation/content-rules/intent-modifiers.ts`;
  - `src/simulation/content-rules/event-reactions.ts`.
- Изменить `src/simulation/systems/intents/execute-intent.ts`:
  - точка врезки модификаторов перед `IntentExecutor`;
  - точка врезки контентных реакций перед `runWorldReactions`.
- Убедиться, что при выключенном флаге новая система не вызывается и все guardian tests проходят.
- Добавить тесты.

**Блокируется ли чем-то:** зависит от шагов 2.4–2.5.

---

## Проверки

| Проверка | Результат | Дата |
|---|---|---|
| `npm test` | ✅ 114 файлов, 909 тестов | 2026-07-13 |
| `npm run build` | ✅ успешно | 2026-07-13 |

---

## Следующее действие

Перейти к **шагу 2.3 — Жизненный цикл `activeRules`**.
