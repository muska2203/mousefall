# Рецепт: добавление ловушки (trap)

## Когда применять

Нужно добавить **проходимый** объект, который срабатывает при входе сущности на его клетку:
колючки, мина, силок и т.п. Ловушка не реализует `Attackable` и `interactionKind`
(обезвреживание отложено), срабатывание идёт через триггер `ENTITY_MOVED`
(мировой слой `object`), эффекты — декларативно через `ruleIds`, жизненный цикл —
процедурно: одноразовая (`oneShot: true`) уничтожается интентом `DESTROY_OBJECT`,
постоянная раскрывается интентом `REVEAL_OBJECT` и срабатывает повторно.

---

## Что понадобится

- JSON-шаблон в `public/content/entities/traps/`.
- Тексты в `src/content/texts/ru/environment.ts` и `src/content/texts/en/environment.ts` (секция `traps`).
- Спрайт в `public/assets/objects/traps/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Контентное правило эффекта в `src/simulation/content-rules/rules.ts` (`CONTENT_RULES`).
- Запись в `public/content/manifest.json` в массиве `traps` (генерируется скриптом).

---

## Шаги

1. **Создай JSON-шаблон** в `public/content/entities/traps/{id}.json`:

   ```json
   {
     "id": "spikes",
     "ruleIds": ["spikes_deal_damage"],
     "oneShot": true,
     "initiallyHidden": true,
     "renderScale": 1.0,
     "tags": []
   }
   ```

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла.
   - `ruleIds` — декларативные правила эффекта; срабатывают на `ENTITY_MOVED` (слой `object`).
   - `oneShot` — `true`: ловушка уничтожается при срабатывании; `false`: раскрывается и остаётся.
   - `initiallyHidden` — `true`: ловушка создаётся скрытой (не рисуется вне debug-режима,
     не попадает в popover), но срабатывает.
   - `renderScale` — масштаб спрайта относительно тайла.
   - `tags` — игровые теги для классификации.

2. **Добавь правило эффекта** в `CONTENT_RULES` (`src/simulation/content-rules/rules.ts`):

   ```ts
   {
     id: 'spikes_deal_damage',
     trigger: { event: 'ENTITY_MOVED' },
     effect: { type: 'dealDamage', amount: 10, tags: ['damage.physical.piercing'] },
     target: { type: 'eventSource' },
     priority: 0,
   }
   ```

   Правило собирается из `ruleIds` шаблона ловушки на клетке события (независимо от `hidden`),
   поэтому срабатывает только при входе на клетку с этой ловушкой. Урон получает вошедший
   (игрок или враг) — `target: eventSource`. Уничтожение/раскрытие в правиле НЕ описывается —
   их порождает lifecycle-хук в `runContentRuleReactions` (`DESTROY_OBJECT`/`REVEAL_OBJECT`).

3. **Добавь тексты** в секцию `traps` файлов `src/content/texts/ru/environment.ts` и `en/environment.ts`:

   ```ts
   export const traps: Record<string, ContentText> = {
     spikes: {
       name: 'Колючки',
       flavorText: '...',
     },
   };
   ```

4. **Добавь спрайт** в `public/assets/objects/traps/{id}.png`.
   Для placeholder'а:
   ```bash
   py scripts/gen-placeholder-sprite.py --name spikes --dir public/assets/objects/traps --size 32 --color "#8b4513"
   ```

5. **Перегенерируй манифесты**:
   ```bash
   node scripts/generate-manifest.js
   node scripts/generate-asset-manifest.js
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
панель debug → спавн сущности → тип `trap` (действие `DEBUG_SPAWN_ENTITY` с `spawnType: 'trap'`).
Слот размещения ловушки — `floorFixture`: нельзя поставить на клетку с дверью/пропом/poi/лестницей,
но контейнер лута на клетке с ловушкой допустим (`canPlaceObjectAt`, `src/simulation/state.ts`).
Ловушка проходима (`blocksMovement: false`) и не влияет на автопуть и pathfinding.

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/entities/traps/`.
- [ ] `id` совпадает с именем файла.
- [ ] Правило эффекта добавлено в `CONTENT_RULES` и перечислено в `ruleIds` шаблона.
- [ ] Тексты добавлены в `ru/environment.ts` и `en/environment.ts` (секция `traps`).
- [ ] Спрайт добавлен в `public/assets/objects/traps/`.
- [ ] Манифесты перегенерированы.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
