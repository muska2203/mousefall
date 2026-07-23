# Рецепт: добавление новой карты

## Когда применять

Нужно добавить новый набор параметров процедурной генерации этажа (подземелья).

---

## Что понадобится

- JSON-файл параметров карты в `public/content/maps/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Создай JSON** в `public/content/maps/<id>.json`:

   ```json
   {
     "id": "floor_1",
     "strategy": "tree",
     "width": 50,
     "height": 50,
     "minRooms": 6,
     "maxRooms": 10,
     "minRoomSize": 4,
     "maxRoomSize": 10,
     "enemyDensity": 0.6,
     "itemDensity": 0.3,
     "enemyPool": [
       "cat_small"
     ],
     "itemPool": [
       "health_potion"
     ]
   }
   ```

   Поля:
   - `id` — уникальный идентификатор параметров карты, совпадает с именем файла.
   - `strategy` — алгоритм генерации. На текущем этапе поддерживается только `"tree"` (дерево комнат от спавна до выхода). Добавление нового алгоритма — задача `system_design`.
   - `width` / `height` — размеры карты в клетках (20–100).
   - `minRooms` / `maxRooms` — диапазон количества комнат.
   - `minRoomSize` / `maxRoomSize` — диапазон размеров комнат.
   - `enemyDensity` — плотность врагов (0.0–1.0). Значение 1.0 соответствует примерно одному врагу на каждые 4×4 клеток комнаты.
   - `itemDensity` — плотность спавна предметов (0.0–1.0).
   - `enemyPool` — ID шаблонов сущностей, которые могут появляться на этаже.
   - `itemPool` — ID шаблонов предметов, которые могут появляться на этаже.

2. **Зарегистрируй в манифесте**. Добавь путь в массив `maps` в `public/content/manifest.json`.

3. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-файл создан в `public/content/maps/`.
- [ ] `id` совпадает с именем файла.
- [ ] `strategy` — `"tree"` (единственная поддерживаемая стратегия).
- [ ] Все `enemyPool` и `itemPool` указывают на существующие шаблоны.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
