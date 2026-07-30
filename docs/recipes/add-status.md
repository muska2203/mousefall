# Рецепт: добавление нового статуса

## Когда применять

Нужно добавить новый временный эффект, накладываемый на актора (горение, яд, заморозка и т.п.).

---

## Что понадобится

- TS-шаблон статуса в `src/content/templates/statuses/`.
- Тексты в `src/content/texts/ru/statuses.ts` и `src/content/texts/en/statuses.ts`.
- Если статус что-то делает — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Регистрация в `src/content/templates/statuses/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/statuses/my-status.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {StatusTemplateInput} from '../../schemas';

   export const myStatus = {
     id: 'my_status',
     ruleIds: ['my_status_tick'],
     statusCategory: 'poison',
     categoryPriority: 0,
     mutuallyExclusiveWith: [],
     blockedBy: [],
   } satisfies StatusTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_status` → `my-status.ts`).
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

4. **Зарегистрируй шаблон** в `src/content/templates/statuses/index.ts` — добавь импорт и строку в массив `statusTemplates`:

   ```ts
   import {myStatus} from './my-status';
   // ...
   export const statusTemplates: StatusTemplateInput[] = [
     // ...
     myStatus,
   ];
   ```

5. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/statuses/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/statuses.ts` и `en/statuses.ts`.
- [ ] Если статус делает что-то в игре — правило создано и зарегистрировано.
- [ ] Шаблон зарегистрирован в `src/content/templates/statuses/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
