# Фаза 2. Введение абстракций — текущий статус

> Актуальный статус реализации фазы 2. Обновляется по мере прохождения шагов.
> Дата последнего обновления: 2026-07-13.

---

## Общий прогресс

Фаза 2 выполнена на **100%** (6 из 6 шагов).

- ✅ Шаг 2.1 — Реестр декларативных правил
- ✅ Шаг 2.2 — Построитель `RuleContext`
- ✅ Шаг 2.3 — Жизненный цикл `activeRules`
- ✅ Шаг 2.4 — Каркас `ContentRuleReaction`
- ✅ Шаг 2.5 — Каркас модификаторов на интенте
- ✅ Шаг 2.6 — Флаги и точки включения

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

### Шаг 2.3. Жизненный цикл `activeRules`

**Статус:** завершён.

**Что сделано:**

- Добавлено поле `activeRules: ActiveRule[]` в интерфейс `Actor` (`src/simulation/types.ts`).
- Добавлено поле `instanceId` в `StatusEffect` (`src/simulation/core-types.ts`).
- Создан `src/simulation/systems/rules/active-rule-lifecycle.ts`:
  - `addActiveRules` / `removeActiveRulesByOwnerContext`;
  - `addActiveRulesForItem` / `removeActiveRulesForItem`;
  - `addActiveRulesForStatus` / `removeActiveRulesForStatus`;
  - `addActiveRulesForAbility` / `removeActiveRulesForAbility`;
  - `rebuildActiveRules` для полной пересборки кэша.
- Интегрировано в исполнители:
  - `executeEquipItemIntent` / `executeUnequipItemIntent`;
  - `executeApplyStatusIntent`, `tick-status-effects`, `adjust-status-stacks`, `skip-stunned-turn`;
  - `executeGrantAbilityIntent` / `executeRevokeAbilityIntent`.
- `activeRules: []` инициализировано во всех местах создания актора.
- Добавлены unit-тесты.

**Тесты:**

- `tests/unit/simulation/rules/active-rule-lifecycle.test.ts`

### Шаг 2.4. Каркас `ContentRuleReaction`

**Статус:** завершён.

**Что сделано:**

- Создан `src/simulation/content-rules/reaction/content-rule-reaction.ts`.
- Реализован сбор правил по слоям `source → target → world → radius`.
- Реализована фильтрация по событию и обязательным тегам.
- Реализованы базовые условия: `chance`, `hasStatus`, `and` / `or` / `not`, а также `targetConditions`.
- Реализованы селекторы целей: `eventTarget`, `eventSource`, `self`, `collisionTarget`, `allInRadius`, `nearestEnemy`.
- Реализована генерация интентов: `applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`.
- Эффект `modifyDamage` в реакции распознаётся, но не порождает отдельных интентов (его обработка — в слое модификаторов).
- Добавлены unit-тесты.

**Тесты:**

- `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts`

### Шаг 2.5. Каркас модификаторов на интенте

**Статус:** завершён.

**Что сделано:**

- Создан `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`.
- Реализован сбор модифицирующих правил по слоям `source → target → world → radius`.
- Реализован порядок применения внутри каждого слоя: сначала `multiply`, затем `add`.
- Реализован `MODIFY_DAMAGE` для `DAMAGE`-интентов с константными и базовыми параметризованными значениями (`eventDamage`, `eventAmount`, `eventDuration`, `eventStacks`).
- Поддержано добавление тегов через `addTags`.
- Модификатор не мутирует входной интент и не обращается к `state` для записи.
- Добавлены unit-тесты.

**Тесты:**

- `tests/unit/simulation/content-rules/modifiers/apply-intent-modifiers.test.ts`

### Шаг 2.6. Флаги и точки включения

**Статус:** завершён.

**Что сделано:**

- Добавлен `featureFlags.contentRulesEnabled` в `GameState` (`src/simulation/types.ts`).
- Создан `src/simulation/content-rules/feature-flags.ts`:
  - `isContentRulesEnabled`;
  - `setContentRulesEnabled`;
  - `ensureFeatureFlags` для обратной совместимости со старыми сохранениями.
- Созданы точки врезки:
  - `src/simulation/content-rules/intent-modifiers.ts` — `applyIntentModifiersIfEnabled`;
  - `src/simulation/content-rules/event-reactions.ts` — `runContentRuleReactionsIfEnabled`.
- Изменён `src/simulation/systems/intents/execute-intent.ts`:
  - модификаторы применяются перед `IntentExecutor`;
  - контентные реакции запускаются после `IntentExecutor`, перед системными `runWorldReactions`.
- При выключенном флаге новая система не вызывается; все guardian tests проходят.
- Добавлены интеграционные и unit-тесты.

**Тесты:**

- `tests/unit/simulation/content-rules/feature-flags.test.ts`
- `tests/unit/simulation/content-rules/execute-intent-integration.test.ts`

---

## Принятые архитектурные решения

- **Слой `world` на фазе 2 содержит только глобальные правила (`worldLayer: 'global'`).**
  Тайловые эффекты (`tileEffect`) и встроенные свойства тайла (`tileIntrinsic`) отложены до фазы работы с картой.

- **Слой `radius` охватывает всех живых акторов в радиусе 1 от `eventPosition`.**
  Используется расстояние Чебышёва (`Chebyshev`). Source и target исключаются из этого слоя, чтобы не дублировать их `activeRules`.

- **Feature flag новой системы хранится в `GameState.featureFlags.contentRulesEnabled`.**
  По умолчанию флаг выключен (`false`), поэтому старый боевой цикл работает без изменений. Включение происходит явно — в тестах или в пилотном сценарии фазы 3.

---

## Проверки

| Проверка | Результат | Дата |
|---|---|---|
| `npm test` | ✅ 119 файлов, 939 тестов | 2026-07-13 |
| `npm run build` | ✅ успешно | 2026-07-13 |

---

## Следующее действие

Перейти к **фазе 3 — Пилот**:

1. Реализовать пилотную реакцию «огненный урон → горение» через `ContentRuleReaction`.
2. Реализовать пилотный модификатор «огненный урон ×1,5».
3. Временно изолировать или отключить старую `fireDamageReaction`, чтобы избежать дублирования.
4. Покрыть пилотные сценарии тестами с включённым `contentRulesEnabled`.


---

## Обновление 2026-07-13

Фаза 2 полностью завершена. Переход к фазе 3 выполнен.

> **Устарело:** блок «Следующее действие» выше относился к запуску фазы 3; актуальный статус фазы 3 см. в [`../phase-03/STATUS.md`](../phase-03/STATUS.md).
