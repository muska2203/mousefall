# Правила работы с content-rules

> Локальные инструкции для папки `src/simulation/content-rules/`. Работая здесь, соблюдай эти правила в дополнение к [`src/simulation/AGENTS.md`](../AGENTS.md) и [`AGENTS.md`](../../../AGENTS.md).

---

## Быстрый старт

1. **Первый раз в content-rules?** → прочитай [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../../../docs/agents/CONTENT_RULES_EDGE_CASES.md).
2. **Хочешь добавить новое правило?** → раздел [«Как добавить новое правило»](#как-добавить-новое-правило) ниже.
3. **Ищешь описание типов?** → `src/simulation/content-rules/types.ts`.

---

## Архитектура слоя

```text
src/simulation/content-rules/
├── types.ts                  # Все типы: ContentRule, RuleTrigger, RuleEffect, TargetSelector и т.д.
├── rules.ts                  # Реестр source-bound правил (CONTENT_RULES).
├── registry.ts               # Быстрый доступ по id, защита от дубликатов, тестовые override.
├── validation.ts             # Валидация ссылок и семантики контентных правил.
├── value-resolver.ts         # Разрешение ParametrizedValue в число.
├── condition-evaluator.ts    # Оценка декларативных условий (chance, hasStatus, hasTag, and/or/not).
├── rule-context.ts           # Построение RuleContext из события/интента.
├── feature-flags.ts          # Флаг contentRulesEnabled.
├── event-reactions.ts        # Точка врезки реакций на события.
├── intent-modifiers.ts       # Точка врезки модификаторов интентов.
├── counterattack-rules.ts    # Правила контратаки.
├── world-rules/
│   └── global-rules.ts       # Мировые правила (worldLayer: 'global').
└── reaction/
    └── content-rule-reaction.ts  # Сбор правил по слоям, фильтрация, сортировка, исполнение.
└── modifiers/
    └── apply-intent-modifiers.ts # Применение modifyDamage к DAMAGE-интентам.
```

---

## Как добавить новое правило

### Чек-лист

1. **Определить тип правила.**
   - Модификатор на интенте (`modifyDamage`) → триггер `DAMAGE` (или другой интент, когда поддержка расширится).
   - Реакция на событие (`applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `counterAttack`) → триггер `GameEvent`.

2. **Добавить объект правила в реестр.**
   - Source-bound правило: `src/simulation/content-rules/rules.ts`, массив `CONTENT_RULES`.
   - Мировое правило: `src/simulation/content-rules/world-rules/global-rules.ts`, массив `GLOBAL_WORLD_CONTENT_RULES`.
   - `id` должен быть уникален среди всех правил. Дубликат на этапе импорта выбросит ошибку.

3. **Привязать правило к контенту.**
   - Предмет: `public/content/items/...json`, поле `ruleIds`.
   - Статус: `public/content/statuses/...json`, поле `ruleIds`.
   - Способность: `public/content/abilities/...json`, поле `ruleIds`.

4. **Проверить валидацию.**
   - `npm run validate:content` должен проходить.
   - `applyStatus.statusType` должен существовать в `public/content/statuses/`.
   - `counterAttack.skillId` (если указан) должен существовать в `public/content/abilities/`.

5. **Обновить тексты.**
   - `src/content/texts/ru.ts` и `src/content/texts/en.ts` — `name`, `description`, `flavorText` для связанных предметов/статусов/способностей.
   - JSON-шаблоны не содержат текстов.

6. **Написать тесты.**
   - Unit: `tests/unit/simulation/content-rules/`.
   - Интеграционный сценарий: `tests/integration/combat-scenarios/`.
   - Проверьте edge cases: self-эффекты, пустые селекторы, mid-chain статусы, конфликты статусов.

7. **Обновить документацию.**
   - Новое правило в стартовом наборе → `docs/design/starting-rules-catalog.md`.
   - Новый edge case → `docs/agents/CONTENT_RULES_EDGE_CASES.md`.
   - Изменения в жизненном цикле/порядке → этот файл и [`docs/plans/Концепт боевой системы.md`](../../../docs/plans/Концепт%20боевой%20системы.md).

8. **Запустить проверки.**
   - `npm run typecheck`
   - `npm test`
   - `npm run validate:content`

### Шаблон нового source-bound правила

```ts
{
  id: 'my_new_rule',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['damage.physical.slashing'],
  },
  conditions: [{ type: 'chance', probability: 30 }],
  effect: {
    type: 'applyStatus',
    statusType: 'bleeding',
    duration: 3,
  },
  target: { type: 'eventTarget' },
  priority: 0,
}
```

### Шаблон нового мирового правила

```ts
{
  id: 'my_world_rule',
  trigger: {
    event: 'ENTITY_COLLIDED',
    tags: ['displacement.push'],
  },
  effect: {
    type: 'dealDamage',
    amount: 5,
    tags: ['damage.physical.blunt'],
  },
  target: { type: 'eventTarget' },
  priority: 0,
  ownerContext: { type: 'world' },
  worldLayer: 'global',
}
```

---

## Важные edge cases

Краткая сводка; подробности — в [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../../../docs/agents/CONTENT_RULES_EDGE_CASES.md).

- **Self-эффекты:** при `source === target` слои `source` и `target` не дублируются.
- **Циклы:** лимит 1000 реакций за цепочку; при превышении ветвь прерывается.
- **Mid-chain статусы:** статус, наложенный реакцией, не участвует в текущей цепочке.
- **Конфликты статусов:** `mutuallyExclusiveWith` снимает, `blockedBy` блокирует.
- **Пустые селекторы:** правило пропускается без ошибки.
- **Порядок слоёв:** `source` → `target` → `world` → `radius`; внутри слоя — `priority`, затем `ruleId`.
- **Модификаторы на интенте:** только `DAMAGE`; порядок `multiply` → `add`; условия пока не оцениваются.

---

## Связанные документы

- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../../../docs/agents/CONTENT_RULES_EDGE_CASES.md) — крайние случаи и отладка.
- [`docs/agents/CONTENT.md`](../../../docs/agents/CONTENT.md) — контент-пайплайн.
- [`docs/design/starting-rules-catalog.md`](../../../docs/design/starting-rules-catalog.md) — каталог стартовых правил.
- [`docs/plans/Концепт боевой системы.md`](../../../docs/plans/Концепт%20боевой%20системы.md) — концепт боевой системы.
