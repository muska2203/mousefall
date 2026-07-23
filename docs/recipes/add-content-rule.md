# Рецепт: добавление нового контентного правила

## Когда применять

Нужно добавить data-driven реакцию на событие или модификатор интента: эффект предмета, пассивка статуса, мировое правило.

---

## Что понадобится

- Определение правила в `src/simulation/content-rules/rules.ts` или `src/simulation/content-rules/world-rules/global-rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Ссылка `ruleIds` в шаблоне предмета, статуса, способности или тайлового эффекта.
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
   - `conditions` — глобальные условия (`chance`, `hasStatus`, `distance`, `faction`, `and`, `or`, `not`).
   - `targetConditions` — условия, проверяемые для каждой цели.
   - `effect` — что делает правило (`applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `modifyDamage`, `counterAttack`).
   - `target` — селектор целей (`eventTarget`, `eventSource`, `self`, `allInRadius`, `nearestEnemy`).
   - `priority` — порядок срабатывания (меньше — раньше).

3. **Добавь текст правила** в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`:

   ```ts
   my_rule: {
     name: 'Моё правило',
     description: 'Что происходит и с каким шансом.',
   },
   ```

4. **Привяжи правило к контенту**. Добавь `ruleIds: ["my_rule"]` в шаблон:
   - предмета (`public/content/items/...`);
   - статуса (`public/content/statuses/...`);
   - способности (`public/content/abilities/...`);
   - тайлового эффекта (`public/content/tile-effects/...`).

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
- [ ] `ruleIds` указан в соответствующем шаблоне контента.
- [ ] Тест на правило добавлен.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
