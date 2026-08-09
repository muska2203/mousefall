# Рецепт: добавление нового амулета

## Когда применять

Нужно добавить новый амулет — предмет, который обычно даёт пассивный эффект через фирменные модификаторы (`fixedModifiers`): rule-модификаторы со ссылкой на контентные правила и/или stat-модификаторы характеристик.

---

## Что понадобится

- TS-шаблон амулета в `src/content/templates/items/amulet/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Контентное правило в `src/simulation/content-rules/rules.ts` (если амулет что-то меняет в бою).
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Регистрация в `src/content/templates/items/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/items/amulet/my-amulet.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {ItemTemplateInput} from '../../../schemas';

   export const myAmulet = {
     id: 'my_amulet',
     spriteId: 'my_amulet',
     icon: '/assets/items/my_amulet.png',
     fallback: '📿',
     type: 'amulet',
     stackable: false,
     maxStack: 1,
     value: 8,
     fixedModifiers: ['mod_my_amulet'],
   } satisfies ItemTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_amulet` → `my-amulet.ts`).
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"amulet"`.
   - `stackable`, `maxStack` — для амулетов обычно `false` / `1`.
   - `value` — цена продажи.
   - `fixedModifiers` — ID фирменных модификаторов из категории `modifiers` (опционально, но для амулета — основной способ задать эффект). Модификатор создаётся по рецепту [`add-modifier.md`](./add-modifier.md): rule-модификатор ссылается на контентное правило, stat-модификатор (scaling `fixed`) задаёт детерминированный бонус характеристики.

   > Амулет не имеет отдельного блока характеристик, как `weapon` или `armor`. Его эффект реализуется через `fixedModifiers`.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_amulet: {
     name: 'Мой амулет',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Привяжи контентные правила** через rule-модификатор:
   - Создай правило по рецепту [`add-content-rule.md`](./add-content-rule.md) и убедись, что его ID существует в `src/simulation/content-rules/rules.ts`.
   - Создай rule-модификатор (`effect: {kind: 'rule', ruleId}`) по рецепту [`add-modifier.md`](./add-modifier.md) — обычно с `poolEligible: false` (фирменное свойство, не участвует в случайном ролле).
   - Укажи ID модификатора в `fixedModifiers` шаблона амулета.
   - Добавь тексты для правил в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`, тексты модификатора — в `src/content/texts/ru/modifiers.ts` и `src/content/texts/en/modifiers.ts`.

4. **Добавь спрайт и иконку** в `public/assets/items/my_amulet.png`.

5. **Зарегистрируй шаблон** в `src/content/templates/items/index.ts` — добавь импорт и строку в массив `itemTemplates`:

   ```ts
   import {myAmulet} from './amulet/my-amulet';
   // ...
   export const itemTemplates: ItemTemplateInput[] = [
     // ...
     myAmulet,
   ];
   ```

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/items/amulet/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `fixedModifiers` — модификаторы существуют, применимы к подтипу амулета, их тексты добавлены; для rule-модификаторов правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/items/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
