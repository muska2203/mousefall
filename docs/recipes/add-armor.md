# Рецепт: добавление новой брони

## Когда применять

Нужно добавить новый предмет брони: нагрудник, плащ, шлем или другой элемент экипировки, который даёт `baseArmor`.

---

## Что понадобится

- TS-шаблон брони в `src/content/templates/items/armor/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Если броня даёт пассивный эффект — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Регистрация в `src/content/templates/items/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/items/armor/my-armor.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {ItemTemplateInput} from '../../../schemas';

   export const myArmor = {
     id: 'my_armor',
     spriteId: 'my_armor',
     icon: '/assets/items/my_armor.png',
     fallback: '🛡️',
     type: 'armor',
     stackable: false,
     maxStack: 1,
     value: 10,
     armor: {
       baseArmor: 2,
     },
     grantedAbilities: [],
     fixedModifiers: ['mod_my_armor'],
   } satisfies ItemTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_armor` → `my-armor.ts`).
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"armor"`.
   - `stackable`, `maxStack` — для брони обычно `false` / `1`.
   - `value` — цена продажи.
   - `armor.baseArmor` — плоское снижение получаемого урона.
   - `fixedModifiers` — ID фирменных модификаторов из категории `modifiers` (опционально). Модификатор создаётся по рецепту [`add-modifier.md`](./add-modifier.md): rule-модификатор ссылается на контентное правило, stat-модификатор (scaling `fixed`) задаёт детерминированный бонус характеристики.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_armor: {
     name: 'Моя броня',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Если нужен пассивный эффект**, добавь контентное правило и rule-модификатор:
   - Рецепт правила: [`add-content-rule.md`](./add-content-rule.md); рецепт модификатора: [`add-modifier.md`](./add-modifier.md) (`effect: {kind: 'rule', ruleId}`, обычно `poolEligible: false`).
   - Убедись, что ID модификатора указан в `fixedModifiers` шаблона брони.

4. **Добавь спрайт и иконку** в `public/assets/items/my_armor.png`.

5. **Зарегистрируй шаблон** в `src/content/templates/items/index.ts` — добавь импорт и строку в массив `itemTemplates`:

   ```ts
   import {myArmor} from './armor/my-armor';
   // ...
   export const itemTemplates: ItemTemplateInput[] = [
     // ...
     myArmor,
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

- [ ] TS-шаблон создан в `src/content/templates/items/armor/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `fixedModifiers` — модификаторы существуют, применимы к подтипу брони, их тексты добавлены; для rule-модификаторов правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/items/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
