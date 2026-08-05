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
   - `chargeSpentOn` — когда тратится заряд: `activation` (default) или `resolution` (оконные poi).
   - `window` — опциональный дескриптор окна выбора (см. раздел «Объект с окном (window)»).
   - `renderScale` — масштаб спрайта относительно тайла.
   - `spriteVariants` — опциональные переопределения спрайтов по визуальным стейтам
     (например, `{depleted: 'altar_drained'}`); см. раздел «Варианты спрайтов по состоянию».
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

   Если у poi есть состояние с исчерпанными зарядами (`charges: 0`), добавь спрайт
   `public/assets/objects/pois/{id}_depleted.png` — он подхватится автоматически
   (см. «Варианты спрайтов по состоянию» ниже).

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

## Варианты спрайтов по состоянию

Спрайт объекта зависит от его **визуального стейта** — производной строки, которую Presentation
вычисляет из полей сущности при каждом перестроении `RenderInput`
(`src/presentation/objectSpriteResolver.ts`, реестр `STATE_RESOLVERS`). Стейт нигде не хранится:
Simulation меняет исходные поля (например, `charges` тратит исполнитель `ACTIVATE_POI`),
а стейт пересчитывается при ближайшем рендере.

Известные стейты poi:
- `default` — есть заряды (`charges > 0`), спрайт `{id}.png`;
- `depleted` — заряды исчерпаны (`charges === 0`), спрайт `{id}_depleted.png`.

Приоритет выбора spriteId: `spriteVariants[state]` из шаблона → конвенция `{id}_{state}.png`.
Предвычисленные пути приходят в UI через `RenderInput.objectSprites` (entityId → путь);
тот же resolver используется для спрайта в popover'е.

Новый стейт для любого объекта (дверь, проп, лестница, ловушка) = запись в `STATE_RESOLVERS`
+ ассет по конвенции (или `spriteVariants` в шаблоне).

---

## Объект с окном (window)

Poi может открывать **окно выбора** — модальный UI с опциями (пример: алтарь выбора
реликвии `relic_altar`, выбор 1 из 3). Механика задаётся дескриптором `window` в шаблоне
и кодом механики в `src/simulation/systems/poi-windows/`.

### Поля шаблона

- `window` — дескриптор окна (discriminated union `PoiWindowSchema` по `kind`, расширяемый
  новыми видами окон). Вариант `relic_choice`: `{kind: 'relic_choice', offerSize: N}` —
  предложение из N реликвий пула `relicPool` текущей карты (`MapParamsSchema.relicPool`,
  валидируется в `validate-references.ts`).
- `chargeSpentOn: 'activation' | 'resolution'` (default `'activation'`) — когда тратится заряд:
  `activation` — при активации (обычные poi), `resolution` — при выборе опции в окне
  (оконные poi: активация только открывает окно).

### Как это работает

1. `INTERACT` → `ACTIVATE_POI`: если у шаблона есть `window`, исполнитель делегирует
   механике (`POI_WINDOW_MECHANICS[template.window.kind]`): `onActivate` готовит предложение
   и записывает id опций в `poi.offer` (плоское поле сущности — переживает снапшот этажа;
   генерация только через `state.rng`, детерминизм забега). При `chargeSpentOn: 'resolution'`
   заряд на активации не тратится и сама активация бесплатна (`INTERACT` = 0 AP — AP
   списывается при выборе, «на выходе из окна»); `POI_USED` эмитится в любом случае.
   Если механика не смогла открыть окно (пустой пул и пр.), активация отклоняется ещё
   в validate `INTERACT` (`canOpen` механики, reasonCode `poi_window_unavailable`) — AP не тратится.
2. Presentation видит poi с заполненным `offer` и открывает модалку
   (`GameSession.pendingWindow` → `RenderInput.pendingWindow`, ввод блокируется,
   автопуть гасится; открытие — только после завершения анимаций).
3. Выбор опции → action `RESOLVE_POI_CHOICE {entityId, poiId, optionId}` (стоимость 1 AP,
   стандартная валидация AP: при 0 AP — отказ)
   → одноимённый интент → `mechanic.resolve`: применяет эффект (для `relic_choice` —
   интент `GRANT_RELIC`), тратит заряд и очищает `poi.offer`.
   Отказ — чисто UI (`GameSession.dismissWindow()`), без dispatch; повторная активация
   открывает то же предложение.

### Как добавить новый вид окна

1. Новый вариант в `PoiWindowSchema` (`src/content/schemas.ts`) — discriminated union по `kind`.
2. Механика с интерфейсом `PoiWindowMechanic` (`onActivate` / `resolve`, опционально `canOpen`)
   в `src/simulation/systems/poi-windows/` + регистрация в `POI_WINDOW_MECHANICS`.
3. Расширить литерал `kind` в presentation: `GameSession.pendingWindow` и
   `PendingWindowViewModel` (`src/presentation/types.ts`).
4. Оконный UI-компонент + регистрация в `WINDOW_COMPONENTS` (`src/ui/screens/GameScreen.tsx`).
5. i18n-ключи компонента (schema + ru + en синхронно).

---

## Спавн в игре

Гарантированный poi стартовой комнаты размещается генератором этажа через
`MapParams.startPoiId` (8-соседняя со спавном клетка; временная мера до типов комнат —
этап 1 roadmap). Случайного спавна poi из пула нет.

Проверка — через debug-режим:
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
