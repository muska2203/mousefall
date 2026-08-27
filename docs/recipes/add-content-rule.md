# Рецепт: добавление нового контентного правила

## Когда применять

Нужно добавить data-driven реакцию на событие или модификатор интента: эффект предмета, пассивка статуса, мировое правило.

---

## Что понадобится

- Определение правила в `src/simulation/content-rules/rules.ts` или `src/simulation/content-rules/world-rules/global-rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Ссылка `ruleIds` в шаблоне статуса, способности или тайлового эффекта; у предметов экипировки — rule-модификатор (`effect: {kind: 'rule', ruleId}`) в `fixedModifiers` шаблона.
- Тест в `tests/unit/simulation/content-rules/`.

---

## Шаги

1. **Выбери тип правила:**
   - **Source-bound** — привязано к предмету/статусу/способности. Добавляй в `CONTENT_RULES` в `src/simulation/content-rules/rules.ts`.
   - **Мировое** — не привязано к сущности (физика столкновений, тайловые эффекты). Добавляй в `GLOBAL_WORLD_CONTENT_RULES` в `src/simulation/content-rules/world-rules/global-rules.ts`.

2. **Создай правило** по образцу:

   ```ts
   {
     id: 'my_rule',
     trigger: {
       event: 'ENTITY_DAMAGED',
       tags: ['attack.melee', 'delivery.weapon'],
     },
     conditions: [
       { type: 'chance', probability: 0.25 },
     ],
     effect: {
       type: 'applyStatus',
       statusType: 'dazed',
       duration: 1,
     },
     target: { type: 'eventTarget' },
     priority: 0,
   }
   ```

   Основные поля:
   - `id` — уникальный ID правила.
   - `trigger.event` — событие или интент (`ENTITY_DAMAGED`, `DAMAGE`, `ENTITY_MOVED` и т.д.).
   - `trigger.tags` — обязательные теги.
   - `conditions` — глобальные условия (`chance`, `hasStatus`, `hasTag`, `entityHasTag`, `inTileEffect`, `tileEffectHasStatus`, `eventFieldEquals`, `eventRole`, `notSelfHit`, `and`, `or`, `not`).
   - `targetConditions` — условия, проверяемые для каждой цели.
   - `effect` — что делает правило (`applyStatus`, `applyTileEffectStatus`, `spawnTileEffect`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `modifyDamage`, `counterAttack`).
     `spawnTileEffect` может сразу наложить статус на созданный тайловый эффект через опциональные поля `statusType` и `statusDuration`.
   - `target` — селектор целей (`eventTarget`, `eventSource`, `self`, `collisionTarget`, `eventTileEffect`, `allInRadius`, `nearestEnemy`, `tilesInRadius`, `positionsInRadius`).
   - `priority` — порядок срабатывания (меньше — раньше).

3. **Добавь текст правила** в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`:

   ```ts
   my_rule: {
     name: 'Моё правило',
     description: 'Что происходит и с каким шансом.',
   },
   ```

4. **Привяжи правило к контенту**:
   - статуса, способности, тайлового эффекта, poi, ловушки, реликвии — добавь `ruleIds: ['my_rule']` в шаблон (`src/content/templates/...`);
   - предмета экипировки — создай rule-модификатор (`effect: {kind: 'rule', ruleId: 'my_rule'}`, рецепт [`add-modifier.md`](./add-modifier.md)) и укажи его в `fixedModifiers` шаблона предмета (`src/content/templates/items/...`).

5. **Напиши тест** в `tests/unit/simulation/content-rules/`. Проверь:
   - что правило срабатывает при нужном событии;
   - что не срабатывает, когда условия не выполнены;
   - edge cases: пустой селектор, self-эффект, конфликт статусов.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] Правило добавлено в `CONTENT_RULES` или `GLOBAL_WORLD_CONTENT_RULES`.
- [ ] `id` уникален в пределах всего реестра.
- [ ] Текст правила добавлен в `ru/rules.ts` и `en/rules.ts`.
- [ ] Правило привязано к контенту (`ruleIds` шаблона или rule-модификатор в `fixedModifiers` предмета).
- [ ] Тест на правило добавлен.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.

---

## Связанные документы

- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../agents/CONTENT_RULES_EDGE_CASES.md) — крайние случаи, порядок исполнения и отладка.
- [`src/simulation/content-rules/AGENTS.md`](../../src/simulation/content-rules/AGENTS.md) — локальные правила слоя content-rules.
- [`docs/agents/CONTENT.md`](../agents/CONTENT.md) — контент-пайплайн и добавление TS-шаблонов.
