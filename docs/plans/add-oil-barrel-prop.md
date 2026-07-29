# План: добавление разрушаемого объекта «бочка с маслом»

> Задача: добавить в проект новый игровой объект — разрушаемую бочку с маслом (`oil_barel`).
> Спавн только через debug. Логика разлива масла при уничтожении и наполнения бутылок — отдельная задача.

---

## Параметры объекта

| Параметр | Значение |
|---|---|
| `id` | `oil_barel` |
| Название (ru) | Бочка с маслом |
| Название (en) | Oil Barrel |
| Описание (ru) | Деревянная, потрескавшаяся, с характерным запахом. Не бейте огнём. |
| Описание (en) | Wooden, cracked, and unmistakably greasy. Don't hit it with fire. |
| `maxHp` | 10 |
| `armor` | 0 |
| `renderScale` | 1.0 |
| `propKind` | `barrel` |
| `blocksMovement` | `true` |
| `blocksLOS` | `false` |
| Теги | `["prop.barrel", "contains.oil"]` |
| Спавн | только через `DEBUG_SPAWN_ENTITY` |
| Спрайт | placeholder, генерируется скриптом `scripts/gen-placeholder-sprite.py` |

---

## Этапы реализации

1. **Контент / схемы** — добавить `PropTemplateSchema` (универсальный разрушаемый объект) и включить `props` в `LoadedContent` (`src/content/schemas.ts`).
2. **Загрузчик / манифест** — добавить массив `props` в `ManifestSchema` (`src/content/loader.ts`) и в `public/content/manifest.json`.
3. **Реестр контента** — добавить `getProp`, `tryGetProp`, `getLocalizedProp`, `getAllProps` и тип `LocalizedPropTemplate` (`src/content/registry.ts`).
4. **Тексты** — добавить категорию `props` в `ContentTexts` (`src/content/texts/types.ts`), экспортировать тексты из `ru/environment.ts` и `en/environment.ts`, подключить в `ru/index.ts` и `en/index.ts`.
5. **Симуляция / типы** — добавить `PropEntity` в union `Entity` и `EntityType`, расширить `EntityInteractionKind` значением `prop` (`src/simulation/types.ts`).
6. **Симуляция / хелперы состояния** — добавить `prop` в `TARGET_PRIORITY`, убедиться, что `isDamageable` и `isBlocked` корректно обрабатывают пропы (`src/simulation/state.ts`).
7. **Симуляция / фабрика** — добавить `createProp` в `src/simulation/systems/map-generation/shared.ts`.
8. **Симуляция / debug** — расширить `DebugSpawnEntityAction.spawnType` значением `prop` и обновить обработчик (`src/simulation/systems/actions/debug-spawn-entity.ts`).
9. **Контент** — создать JSON-шаблон `public/content/entities/props/oil_barel.json`.
10. **Спрайт** — сгенерировать `public/assets/entities/oil_barel.png` через `scripts/gen-placeholder-sprite.py`.
11. **Презентация** — добавить `src/presentation/propDetailMapper.ts`, обновить `displayState/builder.ts` и `src/ui/renderer/EntityRenderer.ts` для отрисовки и отображения деталей пропа.
12. **Тесты** — добавить/обновить тесты на загрузку шаблона и разрушение пропа.
13. **Проверки** — запустить `npm run validate:content`, `npm run typecheck`, `npm test`.

---

## Прогресс

| Этап | Статус | Примечание |
|---|---|---|
| 1. Контент / схемы | ✅ | `PropTemplateSchema`, `props` в `LoadedContent` |
| 2. Загрузчик / манифест | ✅ | массив `props` в `loader.ts` и `manifest.json` |
| 3. Реестр контента | ✅ | `getProp`, `tryGetProp`, `getLocalizedProp` |
| 4. Тексты | ✅ | категория `props` в `ContentTexts` и переводах |
| 5. Симуляция / типы | ✅ | `PropEntity`, `'prop'` в `EntityType`/`EntityInteractionKind` |
| 6. Симуляция / хелперы | ✅ | `findPropAt`, `TARGET_PRIORITY`, `blocksLOS` |
| 7. Симуляция / фабрика | ✅ | `createProp` в `map-generation/shared.ts` |
| 8. Симуляция / debug | ✅ | `spawnType: 'prop'` в `DEBUG_SPAWN_ENTITY` |
| 9. JSON-шаблон бочки | ✅ | `public/content/entities/props/oil_barel.json` |
| 10. Placeholder-спрайт | ✅ | `public/assets/objects/props/oil_barel.png` |
| 11. Презентация | ✅ | `propDetailMapper`, `FieldObjectPopover`, `EntityRenderer` |
| 12. Тесты | ✅ | `tests/unit/simulation/prop.test.ts`, пропы в `tests/unit/content/registry.test.ts` |
| 13. Проверки | ✅ | `validate:content`, `typecheck`, `test` — все проходят |
| 14. Документация | ✅ | `docs/recipes/add-prop.md` + обновлён `docs/recipes/README.md` |
