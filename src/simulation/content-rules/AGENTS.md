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
   - Модификатор на интенте (`modifyDamage`) → триггер `DAMAGE` или `DAMAGE_TILE`.
   - Реакция на событие (`applyStatus`, `applyTileEffectStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `counterAttack`) → триггер `GameEvent`.

2. **Добавить объект правила в реестр.**
   - Source-bound правило: `src/simulation/content-rules/rules.ts`, массив `CONTENT_RULES`.
   - Мировое правило: `src/simulation/content-rules/world-rules/global-rules.ts`, массив `GLOBAL_WORLD_CONTENT_RULES`.
   - `id` должен быть уникален среди всех правил. Дубликат на этапе импорта выбросит ошибку.

3. **Привязать правило к контенту.**
   - Предмет: rule-модификатор (`effect: {kind: 'rule', ruleId}`) в `src/content/templates/modifiers/`, подключённый через `fixedModifiers` шаблона в `src/content/templates/items/...ts` (поле `ruleIds` предметов удалено 2026-08-09).
   - Статус: `src/content/templates/statuses/...ts`, поле `ruleIds`.
   - Способность: `src/content/templates/abilities/...ts`, поле `ruleIds`.
   - Тайловый эффект: `src/content/templates/tile-effects/...ts`, поле `ruleIds` (слой `tileEffect`).
   - Точка интереса: `src/content/templates/pois/...ts`, поле `ruleIds` (слой `object`).
   - Ловушка: `src/content/templates/traps/...ts`, поле `ruleIds` (слой `object`).

4. **Проверить валидацию.**
   - `npm run validate:content` должен проходить.
   - `applyStatus.statusType` должен существовать в `src/content/templates/statuses/`.
   - `applyTileEffectStatus.statusType` должен существовать в `src/content/templates/tile-effect-statuses/`.
   - `applyTileEffectStatus` требует `target.type === 'eventTileEffect'` или `'tilesInRadius'`.
   - `spawnTileEffect.effectType` должен существовать в `src/content/templates/tile-effects/`.
   - `spawnTileEffect` требует `target.type === 'positionsInRadius'`.

5. **Обновить тексты.**
   - Тексты самого правила — в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
   - Тексты связанных предметов/статусов/способностей — в соответствующих файлах `src/content/texts/ru/` и `src/content/texts/en/`.
   - Шаблоны не содержат текстов.

6. **Написать тесты.**
   - Unit: `tests/unit/simulation/content-rules/`.
   - Интеграционный сценарий: `tests/integration/combat-scenarios/`.
   - Проверьте edge cases: self-эффекты, пустые селекторы, mid-chain статусы, конфликты статусов.

7. **Обновить документацию.**
   - Новый edge case → `docs/agents/CONTENT_RULES_EDGE_CASES.md`.
   - Изменения в жизненном цикле/порядке → этот файл.

8. **Запустить проверки.**
   - `npm run typecheck`
   - `npm test`
   - `npm run validate:content`

### Условие `chance` — только по явному указанию

Основные механики игры детерминированы (решение 2026-08-04, `roadMap.md`, вопрос 1):
статусы накладываются по типу урона / состоянию цели, а не по вероятности.
`chance` — опциональная «рандомная» механика по выбору игрока (пример: `amulet_restore_ap_on_hit`).
Не добавляй `chance` в новые правила без явного указания пользователя.

### Шаблон нового source-bound правила

```ts
{
  id: 'my_new_rule',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['damage.physical.slashing'],
  },
  // Детерминированное условие: правило срабатывает только по цели в масле.
  conditions: [{ type: 'hasStatus', statusType: 'oiled', subject: 'target' }],
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
- **Порядок слоёв:** `source` → `target` → `world` → `radius`; внутри `world` — `global` → `tileEffect` → `tileEffectStatus` → `object` → `tileIntrinsic`, затем `priority`, затем `ruleId`.
- **Слой `radius` и правила владельца:** правило, которое должно срабатывать только для своего владельца (тик статуса и т.п.), обязано иметь условие `eventRole` — иначе копия правила соседнего актора сработает повторно (см. `CONTENT_RULES_EDGE_CASES.md`, раздел «Слой radius»).
- **Слой `object`:** правила из `ruleIds` объектов (poi, ловушки) на клетке события; разовость — процедурно (`charges` в исполнителе интента у poi; `DESTROY_OBJECT`/`REVEAL_OBJECT` из lifecycle-хука у ловушек), правило остаётся декларативным. Правила ловушек собираются независимо от `hidden` (скрытая ловушка срабатывает).
- **Самоурон и реакции на `eventSource`:** правило, отвечающее уроном источнику события (шипы и т.п.), обязано иметь условие `notSelfHit` — иначе self-hit владельца (например, собственный Налёт с тегом `attack.melee`) разворачивает реакцию против самого владельца (прецедент: `armor_spiked_thorns`, исправлено 2026-08-26). Мировой урон без источника самоуроном не считается.
- **Модификаторы на интенте:** только `DAMAGE` и `DAMAGE_TILE`; порядок `multiply` → `add`; условия оцениваются, поэтому `modifyDamage`-правила владельца тоже обязаны иметь `eventRole` — иначе копия соседнего владельца из слоя `radius` модифицирует урон повторно.

---

## Связанные документы

- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../../../docs/agents/CONTENT_RULES_EDGE_CASES.md) — крайние случаи и отладка.
- [`docs/agents/CONTENT.md`](../../../docs/agents/CONTENT.md) — контент-пайплайн.
