# Рецепт: добавление нового статуса

## Когда применять

Нужно добавить новый временный эффект, накладываемый на актора (горение, яд, заморозка и т.п.).

---

## Что понадобится

- JSON-шаблон статуса в `public/content/statuses/`.
- Тексты в `src/content/texts/ru/statuses.ts` и `src/content/texts/en/statuses.ts`.
- Если статус что-то делает — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/examples/status-template.json`](../../public/content/examples/status-template.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_status",
     "ruleIds": ["my_status_tick"],
     "statusCategory": "poison",
     "categoryPriority": 0,
     "mutuallyExclusiveWith": [],
     "blockedBy": []
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `ruleIds` — ID контентных правил, активируемых статусом.
   - `statusCategory` — категория для разрешения конфликтов.
   - `categoryPriority` — приоритет внутри категории (выше — важнее).
   - `mutuallyExclusiveWith` — статусы, которые снимаются при наложении этого.
   - `blockedBy` — статусы, которые блокируют наложение этого.

2. **Добавь тексты** в `src/content/texts/ru/statuses.ts` и `src/content/texts/en/statuses.ts`:

   ```ts
   my_status: {
     name: 'Мой статус',
     description: 'Что делает статус каждый ход или при наложении.',
   },
   ```

3. **Добавь контентное правило**, если статус влияет на игру:
   - Например, урон в начале хода, восстановление HP, контратака.
   - Рецепт: [`add-content-rule.md`](./add-content-rule.md).

4. **Зарегистрируй в манифесте**. Добавь путь в массив `statuses` в `public/content/manifest.json`.

5. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/statuses/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/statuses.ts` и `en/statuses.ts`.
- [ ] Если статус делает что-то в игре — правило создано и зарегистрировано.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
