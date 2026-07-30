# Рецепт: добавление точки интереса (poi)

## Когда применять

Нужно добавить непроходимый **неразрушаемый** интерактивный объект: алтарь, фонтан, рычаг-событие и т.п.
Точка интереса не реализует `Attackable` (атаковать её нельзя на уровне типов), взаимодействие идёт
через `INTERACT` с соседней клетки, эффекты — декларативно через `ruleIds` (мировой слой `object`),
разовость — процедурно через `charges` в исполнителе `ACTIVATE_POI`.

---

## Что понадобится

- TS-шаблон в `src/content/templates/pois/`.
- Тексты в `src/content/texts/ru/environment.ts` и `src/content/texts/en/environment.ts` (секция `pois`).
- Спрайт в `public/assets/objects/pois/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Контентное правило эффекта в `src/simulation/content-rules/rules.ts` (`CONTENT_RULES`).
- Регистрация в `src/content/templates/pois/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/pois/altar.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {PoiTemplateInput} from '../../schemas';

   export const altar = {
     id: 'altar',
     interactionKind: 'poi',
     ruleIds: ['altar_heals_player'],
     charges: 1,
     renderScale: 1.0,
     tags: [],
   } satisfies PoiTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case.
   - `interactionKind` — всегда `"poi"`.
   - `ruleIds` — декларативные правила эффекта; срабатывают на событие `POI_USED` (слой `object`).
   - `charges` — количество использований; при 0 взаимодействие недоступно (`resolveInteraction` → null).
   - `renderScale` — масштаб спрайта относительно тайла.
   - `tags` — игровые теги для классификации.

2. **Добавь правило эффекта** в `CONTENT_RULES` (`src/simulation/content-rules/rules.ts`):

   ```ts
   {
     id: 'altar_heals_player',
     trigger: { event: 'POI_USED' },
     effect: { type: 'heal', amount: 25 },
     target: { type: 'eventSource' },
     priority: 0,
   }
   ```

   Правило собирается из `ruleIds` шаблона poi на клетке события, поэтому срабатывает только
   при активации этой точки интереса. Разовость в правиле НЕ описывается — её обеспечивает
   исполнитель `ACTIVATE_POI` (декремент `charges`).

3. **Добавь тексты** в секцию `pois` файлов `src/content/texts/ru/environment.ts` и `en/environment.ts`:

   ```ts
   export const pois: Record<string, ContentText> = {
     altar: {
       name: 'Алтарь',
       flavorText: '...',
     },
   };
   ```

4. **Добавь спрайт** в `public/assets/objects/pois/{id}.png`.
   Для placeholder'а:
   ```bash
   py scripts/gen-placeholder-sprite.py --name altar --dir public/assets/objects/pois --size 32 --color "#c9a227"
   ```

5. **Зарегистрируй шаблон** в `src/content/templates/pois/index.ts` — добавь импорт и строку в массив `poiTemplates`:

   ```ts
   import {altar} from './altar';
   // ...
   export const poiTemplates: PoiTemplateInput[] = [
     // ...
     altar,
   ];
   ```

6. **Проверь валидацию**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Спавн в игре

Размещение генератором этажа не реализовано. Проверка — через debug-режим:
панель debug → спавн сущности → тип `poi` (действие `DEBUG_SPAWN_ENTITY` с `spawnType: 'poi'`).
Слот размещения poi — `solid`: объект нельзя поставить на клетку с любым другим объектом
(`canPlaceObjectAt`, `src/simulation/state.ts`).

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/pois/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Правило эффекта добавлено в `CONTENT_RULES` и перечислено в `ruleIds` шаблона.
- [ ] Тексты добавлены в `ru/environment.ts` и `en/environment.ts` (секция `pois`).
- [ ] Спрайт добавлен в `public/assets/objects/pois/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/pois/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
