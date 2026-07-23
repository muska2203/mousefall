# Рецепт: добавление нового тайлового эффекта

## Когда применять

Нужно добавить динамический материал на клетки карты (вода, масло, огонь) и/или его временное состояние (горение, замерзание и т.п.).

---

## Что понадобится

- JSON-шаблон тайлового эффекта в `public/content/tile-effects/`.
- (Опционально) JSON-шаблон статуса тайлового эффекта в `public/content/tile-effect-statuses/`.
- Тексты в `src/content/texts/{ru,en}/tile-effects.ts` и `src/content/texts/{ru,en}/tile-effect-statuses.ts`.
- Спрайты в `public/assets/tile-effects/`.
- Записи в `public/content/manifest.json`.
- Контентные правила в `src/simulation/content-rules/rules.ts` или `src/simulation/content-rules/world-rules/global-rules.ts`, если эффект должен что-то делать.
- Тесты, если эффект влияет на геймплей.

---

## Шаги

1. **Создай шаблон материала** в `public/content/tile-effects/<id>.json`:

   ```json
   {
     "id": "oil",
     "layer": "cover",
     "duration": 5,
     "renderOrder": 2,
     "ruleIds": ["oil_applies_oiled", "fire_damage_ignites_oil", "fire_tile_damage_ignites_oil"],
     "blockedByTileEffects": [],
     "mutuallyExclusiveWithTileEffects": ["water"],
     "canHaveStatus": ["burning"],
     "durationDecreasesWhenHasStatus": ["burning"]
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `layer` — на текущем этапе всегда `"cover"`.
   - `duration` — базовая длительность материала в ходах.
   - `renderOrder` — порядок отрисовки относительно других эффектов на клетке.
   - `ruleIds` — ID контентных правил, которые срабатывают на клетке с эффектом.
   - `blockedByTileEffects` — эффекты, при наличии которых этот не накладывается.
   - `mutuallyExclusiveWithTileEffects` — эффекты, которые заменяются этим при наложении.
   - `canHaveStatus` — статусы тайловых эффектов, которые можно наложить на этот материал.
   - `durationDecreasesWhenHasStatus` — материал тикает только при указанных статусах (например, масло исчезает, пока горит).

2. **Если материал может менять поведение**, создай статус тайлового эффекта в `public/content/tile-effect-statuses/<id>.json`:

   ```json
   {
     "id": "burning",
     "duration": 3,
     "neverExpires": true,
     "ruleIds": ["burning_spreads_to_flammable", "burning_deals_damage_on_entry", "burning_applies_burning"],
     "statusCategory": "elemental",
     "categoryPriority": 1,
     "mutuallyExclusiveWith": [],
     "blockedBy": [],
     "renderOrder": 10
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `duration` — базовая длительность статуса.
   - `neverExpires` — если `true`, статус не тикает по длительности и снимается только вместе с родительским эффектом.
   - `ruleIds` — правила, активируемые, когда статус присутствует на клетке события.
   - `statusCategory` / `categoryPriority` — для разрешения конфликтов между статусами.
   - `mutuallyExclusiveWith` — статусы, снимаемые при наложении этого.
   - `blockedBy` — статусы, блокирующие наложение этого.
   - `renderOrder` — порядок отрисовки поверх базового материала.

3. **Разреши статус у материала**. Добавь ID статуса в `canHaveStatus` шаблона тайлового эффекта. Без этого исполнитель наложения статуса отклонит интент.

4. **Добавь тексты** в `src/content/texts/ru/tile-effects.ts`, `src/content/texts/en/tile-effects.ts`, а при наличии статуса — в `src/content/texts/{ru,en}/tile-effect-statuses.ts`:

   ```ts
   oil: {name: 'Масло'},
   burning: {name: 'Горящая поверхность'},
   ```

5. **Добавь спрайты** в `public/assets/tile-effects/<id>.png`. Рендерер ищет спрайты только в этой папке.

6. **Зарегистрируй в манифесте**. Добавь пути в массивы `tileEffects` и `tileEffectStatuses` в `public/content/manifest.json`.

7. **Добавь контентные правила**, если эффект должен что-то делать (наносить урон, распространяться, накладывать статус и т.п.):
   - Материал и статус тайлового эффекта автоматически попадают в мировые слои `tileEffect` и `tileEffectStatus` соответственно.
   - Глобальные правила без привязки к конкретному эффекту добавляй в `GLOBAL_WORLD_CONTENT_RULES` в `src/simulation/content-rules/world-rules/global-rules.ts`.
   - Полезные условия и селекторы: `inTileEffect`, `tileEffectHasStatus`, `tilesInRadius`.
   - Рецепт правил: [`add-content-rule.md`](./add-content-rule.md).

8. **Добавь способность или предмет для появления в игре** (опционально):
   - Например, масло появляется из способности `oil_flask`.
   - Создай шаблон способности в `public/content/abilities/<id>.json`.
   - Создай `SkillExecutor` в `src/simulation/skills/executors/<id>Skill.ts`, который порождает интент `SPAWN_TILE_EFFECT`.
   - Зарегистрируй executor в `src/simulation/skills/index.ts`.
   - Добавь анимацию в `src/presentation/animation/skills/` и текст/спрайт для UI.

9. **Напиши тесты** (если эффект влияет на геймплей):
   - `tests/unit/simulation/intents/tile-effect-intent-executor.test.ts` — исполнители интентов.
   - `tests/unit/simulation/content-rules/<правило>.test.ts` — отдельные правила.
   - `tests/integration/tile-effects/<сценарий>.test.ts` — сквозные сценарии.

   Проверь edge cases: замена через `mutuallyExclusiveWithTileEffects`, блокировка через `blockedByTileEffects`, обновление длительности при повторном спавне, удаление вместе со статусами.

10. **Запусти проверки**:
    ```bash
    npm run validate:content
    npm run typecheck
    npm test
    ```

---

## Чеклист

- [ ] JSON-шаблон тайлового эффекта создан в `public/content/tile-effects/`.
- [ ] `id` совпадает с именем файла.
- [ ] Если есть статус — JSON-шаблон создан в `public/content/tile-effect-statuses/` и статус разрешён в `canHaveStatus`.
- [ ] Тексты добавлены в `ru/en/tile-effects.ts` (и `tile-effect-statuses.ts`, если есть статус).
- [ ] Спрайты добавлены в `public/assets/tile-effects/`.
- [ ] Пути добавлены в `public/content/manifest.json`.
- [ ] Контентные правила созданы и привязаны через `ruleIds` (если эффект делает что-то в игре).
- [ ] Тесты написаны (если эффект влияет на геймплей).
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
