# Рецепт: добавление нового модификатора (аффикса) экипировки

## Когда применять

Нужно добавить новый модификатор экипировки — случайный аффикс, выпадающий на экземпляры (1 положительный + до 1 отрицательного на предмет; ролл — один раз при создании экземпляра), или фирменное свойство конкретных предметов (через `fixedModifiers` шаблона). Дизайн системы: [`docs/game-design/equipment-modifiers-concept.md`](../game-design/equipment-modifiers-concept.md).

---

## Что понадобится

- TS-шаблон модификатора в `src/content/templates/modifiers/`.
- Тексты в `src/content/texts/ru/modifiers.ts` и `src/content/texts/en/modifiers.ts`.
- Для rule-аффикса — контентное правило в `src/simulation/content-rules/rules.ts` и его тексты в `src/content/texts/{ru,en}/rules.ts`.
- Регистрация в `src/content/templates/modifiers/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/modifiers/my-modifier.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {ModifierTemplateInput} from '../../schemas';

   export const myModifier = {
     id: 'my_modifier',
     polarity: 'positive',
     effect: { kind: 'stat', stat: 'armor', op: 'add' },
     scaling: {
       kind: 'perLevel',
       ranges: [
         { min: 1, max: 2 },
         { min: 2, max: 3 },
       ],
     },
     applicableSubtypes: ['light', 'heavy'],
     weight: 1,
   } satisfies ModifierTemplateInput;
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case.
   - `polarity` — `positive` (default; всегда 1 на предмет при непустом пуле) или `negative` (до 1, с шансом `NEGATIVE_AFFIX_CHANCE = 0.5`). У отрицательных аффиксов рейнжи значений отрицательные. Для `poolEligible: false` не используется.
   - `effect` — `stat` (модификатор характеристики со значением; применяется при экипировке как обычный `StatModifier`) или `rule` (ID контентного правила из `CONTENT_RULES`; правило добавляется в `activeRules` при экипировке).
   - `scaling` — `perLevel`: значение роллится из `ranges[level-1]` шаблона предмета (уровень выше длины — clamp к последнему рейнжу); `fixed`: детерминированное `value` (для фирменных stat-модификаторов); `none`: значение не роллится (`value = null`).
   - `applicableSubtypes` — непустой список подтипов из `EQUIPMENT_SUBTYPE_IDS` (`src/content/ids.ts`), к которым модификатор применим; без дубликатов.
   - `poolEligible` — участвует ли в случайном ролле (default `true`); `false` — только фирменное свойство конкретных предметов (задаётся через `fixedModifiers` шаблона предмета, в пул ролла не входит).
   - `weight` — вес во взвешенном выборе из пула (default 1, игнорируется при `poolEligible: false`).

   Пример rule-аффикса без ролла значения:

   ```ts
   export const modPoisonOnHit = {
     id: 'mod_poison_on_hit',
     polarity: 'positive',
     effect: { kind: 'rule', ruleId: 'weapon_poison_on_hit' },
     scaling: { kind: 'none' },
     applicableSubtypes: ['sword', 'dagger', 'club', 'staff'],
     weight: 1,
   } satisfies ModifierTemplateInput;
   ```

   Пример фирменного stat-модификатора (не участвует в ролле, подключается через `fixedModifiers` предмета):

   ```ts
   export const modGuardianVitality = {
     id: 'mod_guardian_vitality',
     effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
     scaling: { kind: 'fixed', value: 10 },
     applicableSubtypes: ['heavy'],
     poolEligible: false,
   } satisfies ModifierTemplateInput;
   ```

   > Rule-аффикс со `scaling: perLevel` обязан ссылаться на правило, чей эффект содержит `{type: 'ownerParam'}` — ролленное значение аффикса попадает в `ActiveRule.paramValue` и читается правилом через `ownerParam`. Инвариант проверяется `validateContentRuleSemantics`.
   >
   > Stat-модификатор обязан иметь `scaling: perLevel` или `fixed` — при `none` значения нет, и модификатор применился бы со значением 0. Тоже проверяется `validateContentRuleSemantics`.
   >
   > Модификатор, указанный в `fixedModifiers` предмета, не может иметь `scaling: perLevel` (фирменные свойства детерминированы), обязан существовать и включать `subtype` предмета в `applicableSubtypes` — проверяется `validateContentReferences`. Модификаторы из `fixedModifiers` и rule-модификаторы с конфликтующим ruleId исключаются из пула ролла этого предмета, поэтому один и тот же модификатор может быть и фирменным, и случайным (`poolEligible: true`) — дубля на предмете не будет.

2. **Добавь тексты** в `src/content/texts/ru/modifiers.ts` и `src/content/texts/en/modifiers.ts`. Плейсхолдер `{value}` в описании заменяется значением экземпляра и допустим только при `scaling: perLevel` или `fixed` (проверяется `validateModifierTextPlaceholders` в `npm run validate:content`):

   ```ts
   my_modifier: {
     name: 'Крепкая',
     description: 'Броня увеличена на {value}.',
   },
   ```

3. **Для rule-аффикса** добавь контентное правило и его тексты:
   - Рецепт: [`add-content-rule.md`](./add-content-rule.md).

4. **Зарегистрируй шаблон** в `src/content/templates/modifiers/index.ts` — добавь импорт и строку в массив `modifierTemplates`.

5. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/modifiers/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] `applicableSubtypes` — непустой список из `EQUIPMENT_SUBTYPE_IDS`, без дубликатов.
- [ ] Для stat-модификатора — `scaling: perLevel` или `fixed` (при `none` значения нет и модификатор был бы нулевым — валидация не пропустит).
- [ ] Для `scaling: perLevel` уровни покрыты нужным числом рейнжей (`ranges[level-1]`, избыток уровней клампится).
- [ ] Для rule-аффикса: правило существует в `CONTENT_RULES`, тексты правила добавлены; при `perLevel` эффект правила использует `{type: 'ownerParam'}`.
- [ ] Если модификатор — только фирменное свойство предметов: `poolEligible: false` и ID добавлен в `fixedModifiers` нужных шаблонов предметов (scaling не `perLevel`).
- [ ] Тексты добавлены в `ru/modifiers.ts` и `en/modifiers.ts` (плейсхолдер `{value}` — только при `scaling: perLevel` или `fixed`).
- [ ] Шаблон зарегистрирован в `src/content/templates/modifiers/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
