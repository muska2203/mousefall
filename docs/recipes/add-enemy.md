# Рецепт: добавление нового врага

## Когда применять

Нужно добавить нового врага (NPC, который видит игрока, ходит и атакует).

---

## Что понадобится

- JSON-шаблон врага в `public/content/entities/enemies/`.
- Тексты в `src/content/texts/ru/entities.ts` и `src/content/texts/en/entities.ts`.
- AI-стратегия в `src/simulation/ai/` (если врагу нужно нестандартное поведение).
- Спрайт в `public/assets/entities/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/examples/enemy-template.json`](../../public/content/examples/enemy-template.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_enemy",
     "maxAp": 2,
     "aiStrategyId": "hunter",
     "aiSightRadius": 4,
     "health": {
       "max": 15
     },
     "baseStats": {
       "str": 1,
       "dex": 3,
       "int": 0,
       "vit": 0
     },
     "equipment": {
       "weapon": "common_splinter_blade"
     },
     "lootTable": [
       {
         "templateId": "health_potion",
         "weight": 3
       }
     ],
     "lootDropTable": [
       {
         "count": 0,
         "weight": 5
       },
       {
         "count": 1,
         "weight": 1
       }
     ],
     "xpReward": 8,
     "renderScale": 1.0
   }
   ```

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла.
   - `maxAp` — максимум очков действий за ход.
   - `aiStrategyId` — ID стратегии из `src/simulation/ai/`. Если нужна новая — сначала добавь стратегию (`system_design`).
   - `aiSightRadius` — радиус обнаружения.
   - `health.max` — максимальное HP.
   - `baseStats` — базовые характеристики (`str`, `dex`, `int`, `vit`).
   - `equipment.weapon` — ID оружия из `public/content/items/weapons/`.
   - `lootTable` — предметы, которые может нести в инвентаре.
   - `lootDropTable` — сколько предметов из `lootTable` выпадет при смерти.
   - `xpReward` — опыт за убийство.
   - `renderScale` — масштаб спрайта.

2. **Добавь тексты** в `src/content/texts/ru/entities.ts` и `src/content/texts/en/entities.ts`:

   ```ts
   my_enemy: {
     name: 'Мой враг',
     flavorText: 'Краткое описание для лора.',
   },
   ```

3. **Добавь спрайт** в `public/assets/entities/my_enemy.png`.

4. **Зарегистрируй в манифесте**. Добавь путь в массив `entities` в `public/content/manifest.json`.

5. **Добавь тест** (опционально, но рекомендуется):
   - `tests/unit/simulation/content-loading.test.ts` — проверка загрузки шаблона.
   - Интеграционный тест на бой с новым врагом.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/entities/enemies/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/entities.ts` и `en/entities.ts`.
- [ ] Спрайт добавлен в `public/assets/entities/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
