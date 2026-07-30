# Рецепт: добавление точки интереса (poi)

## Когда применять

Нужно добавить непроходимый **неразрушаемый** интерактивный объект: алтарь, фонтан, рычаг-событие и т.п.
Точка интереса не реализует `Attackable` (атаковать её нельзя на уровне типов), взаимодействие идёт
через `INTERACT` с соседней клетки, эффекты — декларативно через `ruleIds` (мировой слой `object`),
разовость — процедурно через `charges` в исполнителе `ACTIVATE_POI`.

---

## Что понадобится

- JSON-шаблон в `public/content/entities/pois/`.
- Тексты в `src/content/texts/ru/environment.ts` и `src/content/texts/en/environment.ts` (секция `pois`).
- Спрайт в `public/assets/objects/pois/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Контентное правило эффекта в `src/simulation/content-rules/rules.ts` (`CONTENT_RULES`).
- Запись в `public/content/manifest.json` в массиве `pois` (генерируется скриптом).

---

## Шаги

1. **Создай JSON-шаблон** в `public/content/entities/pois/{id}.json`:

   ```json
   {
     "id": "altar",
     "interactionKind": "poi",
     "ruleIds": ["altar_heals_player"],
     "charges": 1,
     "renderScale": 1.0,
     "tags": []
   }
   ```

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла.
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

5. **Перегенерируй манифест**:
   ```bash
   node scripts/generate-manifest.js
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

- [ ] JSON-шаблон создан в `public/content/entities/pois/`.
- [ ] `id` совпадает с именем файла.
- [ ] Правило эффекта добавлено в `CONTENT_RULES` и перечислено в `ruleIds` шаблона.
- [ ] Тексты добавлены в `ru/environment.ts` и `en/environment.ts` (секция `pois`).
- [ ] Спрайт добавлен в `public/assets/objects/pois/`.
- [ ] Манифест перегенерирован.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
