# Рецепт: добавление реликвии

## Когда применять

Нужно добавить постоянный пассивный бонус забега — реликвию, которую игрок получает
в коллекцию (MVP: выбор 1 из 3 на алтаре). Реликвия не предмет: не лежит в инвентаре,
не экипируется и живёт через этажи вместе с `PlayerEntity` (игрок не входит в `FloorSnapshot`).

Эффект реликвии складывается из:
- `statModifiers` — постоянные модификаторы характеристик (записи `{stat, value, op}`);
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

### Пример: реликвия с минусом (плюс + цена)

Утверждённый стартовый пул (roadmap 0.6) построен по схеме «плюс + минус». Минус выражается
одним из двух способов:

- **Отрицательный `statModifier`** — без правила вовсе:
  `relic_acid_blood` (`statModifiers: [{ stat: 'armor', value: -1, op: 'add' }]`),
  `relic_scavenger` (`maxHp add -5`).
- **Второе правило с условиями-ограничителями** — второй id в `ruleIds`. Приёмы:
  - `eventRole: 'target'` — минус срабатывает на входящий урон по владельцу
    (`relic_blood_pact_price`: прямой входящий урон оружия +1);
  - `not(hasStatus ...)` / `not(hasTag ...)` — штраф в «холостом» случае
    (`relic_venom_gland_ramp_up`: -1 по неотравленным; `relic_thunderhead_clumsy`: -1 недробящим);
  - тот же триггер плюса с `target: { type: 'self' }` — откат на владельца
    (`relic_plague_bearer_self_poison`).

Тонкости DSL, всплывшие на пуле 0.6:
- условие `eventRole` (`source` = исходящее событие владельца, `target` = входящее) — основной
  способ разделить плюс и минус у одного триггера;
- **правило-плюс без `eventRole: 'source'` срабатывает и против владельца**: активные правила
  цели события собираются в target-слой, поэтому без условия эффект применится к владельцу
  при ударе ПО нему (баг `relic_thunderhead_daze`, найден ревью 2026-08-06). Правилу,
  которое должно работать только на исходящие события владельца, `eventRole: 'source'`
  обязателен — даже если триггер кажется «атакующим»;
- `addTags` у `modifyDamage` может добавить вторую «школу» урона (`damage.magical.fire`
  к физическому удару у `relic_salamander_heart`) — инвариант «ровно один damage.*-тег»
  действует только при формировании базового интента;
- правило на событие `ITEM_PICKED_UP` работает (контекст: `sourceEntityId` = поднявший).

3. **Добавь тексты** в `src/content/texts/ru/relics.ts` и `src/content/texts/en/relics.ts`:

   ```ts
   export const relics: Record<string, ContentText> = {
     relic_sharpened_instinct: {
       name: 'Заточенный инстинкт',
       flavorText: 'Когти точатся сами — было бы о что.',
     },
   };
   ```

   У реликвии в текстах — только `name` и `flavorText` (атмосферный текст, выводится курсивом
   в конце тултипа реликвии — поповера коллекции и поповера в окне выбора алтаря). Монолитного
   `description` у реликвий нет: механика отображается
   списком эффектов, который Presentation собирает автоматически (`buildRelicEffects`):

   - **Правила** — для каждого id из `ruleIds` обязан быть текст в
     `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts` (`name` + краткое
     `description`; в тултипе выводится только `description` одной строкой — имя правила не
     показывается; описания могут содержать тег-ссылки `[текст](tag:id)` — рендерятся через
     `RichDescription`). Числа и условия в тексте обязаны совпадать с определением правила
     в `CONTENT_RULES` — источник правды код, не наоборот.
     Эффекты подсвечиваются по полярности (по образцу свойств карточки экипировки):
     у негативного для владельца правила укажи `polarity: 'negative'` в определении
     (`ContentRule`); без поля правило считается позитивным.
   - **Модификаторы характеристик** (`statModifiers`) отображаются автоматически одной
     строкой «Имя: +N» — имя локализованное (`system.statNames.<stat>`), значение —
     «+N»/«−N» для `add`, «×N» для `multiply`. Отдельных текстов для них не нужно.
     Полярность выводится из значения: `add < 0` или `multiply < 1` — негативный эффект.

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
- [ ] У негативных для владельца правил проставлено `polarity: 'negative'` (подсветка в тултипе).
- [ ] Тексты добавлены в `ru/relics.ts` и `en/relics.ts` (только `name` + `flavorText`).
- [ ] Для каждого `ruleIds` добавлены тексты правила в `ru/rules.ts` и `en/rules.ts` (сверены с `CONTENT_RULES`).
- [ ] Шаблон зарегистрирован в `src/content/templates/relics/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
