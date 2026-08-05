# Рецепт: добавление реликвии

## Когда применять

Нужно добавить постоянный пассивный бонус забега — реликвию, которую игрок получает
в коллекцию (MVP: выбор 1 из 3 на алтаре). Реликвия не предмет: не лежит в инвентаре,
не экипируется и живёт через этажи вместе с `PlayerEntity` (игрок не входит в `FloorSnapshot`).

Эффект реликвии складывается из:
- `statModifiers` — постоянные модификаторы характеристик (тот же shape, что `equipModifiers` у предметов);
- `ruleIds` — декларативные правила, зарегистрированные в `CONTENT_RULES`.

---

## Что понадобится

- TS-шаблон в `src/content/templates/relics/`.
- Тексты в `src/content/texts/ru/relics.ts` и `src/content/texts/en/relics.ts`.
- Иконка в `public/assets/` (опционально, для UI панели коллекции).
- Контентное правило эффекта в `src/simulation/content-rules/rules.ts` (`CONTENT_RULES`), если эффект не покрывается `statModifiers`.
- Регистрация в `src/content/templates/relics/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/relics/<id>.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {RelicTemplateInput} from '../../schemas';

   export const sharpenedInstinct = {
     id: 'relic_sharpened_instinct',
     statModifiers: [{ stat: 'damage', value: 2, op: 'add' }],
     stackable: true,
     rarity: 'common',
   } satisfies RelicTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case.
   - `statModifiers` — постоянные модификаторы (`stat`, `value`, `op: 'add' | 'multiply'`).
   - `ruleIds` — декларативные правила эффекта.
   - `stackable` — можно ли брать несколько экземпляров. Каждый стак — дополнительный
     экземпляр эффекта: модификаторы суммируются (уникальный source `relic_{instanceId}`),
     правила регистрируются по разу на стак (уникальный `ownerContext`). Нестакаемую
     реликвию исполнитель `GRANT_RELIC` не выдаст повторно.
   - `grantedAbilities` — способности, выдаваемые реликвией (в MVP не используется).
   - `icon` / `fallback` — отображение в UI.
   - `rarity` — редкость (`common` / `rare` / `unique`), для UI.

2. **Если нужен эффект-правило — добавь его** в `CONTENT_RULES` (`src/simulation/content-rules/rules.ts`)
   по образцу существующих правил предметов и перечисли в `ruleIds` шаблона.

3. **Добавь тексты** в `src/content/texts/ru/relics.ts` и `src/content/texts/en/relics.ts`:

   ```ts
   export const relics: Record<string, ContentText> = {
     relic_sharpened_instinct: {
       name: 'Заточенный инстинкт',
       description: '+2 к урону.',
     },
   };
   ```

4. **Добавь иконку** (опционально) в `public/assets/` и перегенерируй манифест
   (`node scripts/generate-asset-manifest.js`).

5. **Зарегистрируй шаблон** в `src/content/templates/relics/index.ts` — добавь импорт и строку в массив `relicTemplates`.

6. **Проверь валидацию**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Как реликвия попадает к игроку

Выдача — только через интент `GRANT_RELIC` (`executeGrantRelicIntent`):
запись `{ instanceId, templateId }` в `player.relics` → `addModifier` × N с уникальным
source → `recalculateActorStats` → регистрация правил с `ownerContext.entityId = instanceId`.
Лимит коллекции — `MAX_RELICS = 100` (`src/utils/constants.ts`).

Снятие (заготовка для механики «замены реликвий», без UI) — `removeRelicFromPlayer(player, instanceId)`
из `grant-relic-intent-executor.ts`: удаляет запись, модификаторы по source и правила по `ownerContext`.

Правила реликвий переживают `rebuildActiveRules` — блок сбора в
`src/simulation/systems/rules/active-rule-lifecycle.ts`.

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/relics/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Правила эффекта (если нужны) добавлены в `CONTENT_RULES` и перечислены в `ruleIds` шаблона.
- [ ] Тексты добавлены в `ru/relics.ts` и `en/relics.ts`.
- [ ] Шаблон зарегистрирован в `src/content/templates/relics/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
