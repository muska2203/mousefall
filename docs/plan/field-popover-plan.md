# План: Popover объектов на игровом поле

## Общий контекст

Проект — пошаговый рогалик с трёхслойной архитектурой:
- **Content** (`src/content/`, `public/content/`) — Zod-схемы и JSON-шаблоны сущностей, предметов, способностей.
- **Simulation** (`src/simulation/`) — безголовая игровая логика. UI и Presentation не импортируют из simulation напрямую (кроме Presentation).
- **Presentation** (`src/presentation/`) — мост между UI и Simulation. Готовит ViewModel для UI.
- **UI** (`src/ui/`) — React-компоненты, PixiJS-рендерер, стили (глобальные CSS, BEM-префикс `cm-`).

**Правило зависимостей:** UI → Presentation → Simulation → Content. UI не знает о Simulation. Presentation не знает о UI.

**Существующие тултипы:**
- `src/ui/components/ItemDetailPopover.tsx` — для предметов в инвентаре. Использует `createPortal` в `document.body`, фиксированное позиционирование с viewport edge detection.
- `src/ui/components/DetailPopover.tsx` — универсальный тултип.

**Стили поповеров** живут в `src/ui/styles/runtime.css`:
- `.inventory-item-detail-popover` — внешний контейнер (fixed, z-index 99990)
- `.item-detail-card` — карточка с градиентом фона, бронзовой рамкой, скруглением 8px

**Игровое поле:**
- `src/ui/components/GameField.tsx` — React-обёртка, внутри PixiJS canvas. Обрабатывает `mousemove` и `click`, переводит экранные координаты в мировые через `WorldRenderer.screenToWorld()`.
- `src/ui/screens/GameScreen.tsx` — собирает экран из трёх колонок, передаёт `renderInput` в `GameField`.
- `src/presentation/gameSession.ts` — хранит состояние сессии, строит `RenderInput`, управляет таргетингом (`targetingHover`).

**Данные на клетке:**
- `RenderInput.state.entities` — `Map<string, Entity>` (враги, предметы на полу, лестницы).
- Враг: `EnemyEntity` (hp, maxHp, damage, templateId, abilities[], statusEffects[])
- Предмет на полу: `ItemEntity` (item: InventoryItem с templateId)
- Лестница: `StairsEntity` (templateId)
- Игрок: `PlayerEntity` (popover для игрока НЕ нужен)

**Реестр контента:** `src/content/registry.ts` — `tryGetEntity(id)`, `tryGetItem(id)`, `tryGetAbility(id)`, `tryGetStairs(id)`.

**Ассеты:**
- Враги: `/assets/enemies/{templateId}.png`
- Лестницы: `/assets/objects/{templateId}.png`
- Предметы: `/assets/items/{templateId}.png`
- Функции разрешения путей: `src/utils/assetResolver.ts` (Presentation может импортировать).

---

## Задача 1. Добавление поля `flavorText` (и `name` для лестниц)

### Цель
Добавить поддержку кратких шуточных описаний в шаблоны врагов и лестниц, чтобы Presentation мог отдавать их в ViewModel поповера.

### Контекст для агента
- Схемы контента: `src/content/schemas.ts`
  - `EntityTemplateSchema` — шаблон врага (есть `id`, `name`, `health`, `combat`, `lootTable`…)
  - `StairsTemplateSchema` — шаблон лестницы (сейчас только `id`, `renderScale`)
- JSON-файлы контента:
  - Враги: `public/content/entities/enemies/*.json` (`cat_small.json`, `cat_mid.json`, `cat_big.json`)
  - Лестницы: `public/content/entities/stairs/stairs_down.json`, `stairs_up.json`
- Сохранение/загрузка: `src/simulation/schemas/saveSchemas.ts` — схема `StairsEntitySchema` не читает поля шаблона, но при изменении схемы контента нужно убедиться, что загрузчик контента (`src/content/loader.ts`) парсит новые поля.

### Пошаговые действия

1. **Обновить `src/content/schemas.ts`:**
   - В `EntityTemplateSchema` добавить опциональное поле `flavorText: z.string().optional().describe('Краткое шуточное описание для popover')`.
   - В `StairsTemplateSchema` добавить `name: z.string().min(1)` и `flavorText: z.string().optional()`.

2. **Обновить `src/utils/assetResolver.ts`:**
   - Добавить `resolveEnemySprite(templateId: string): string` → `/assets/enemies/${templateId}.png`
   - Добавить `resolveStairsSprite(templateId: string): string` → `/assets/objects/${templateId}.png`
   *(Presentation-преобразователи будут использовать эти функции для формирования URL спрайтов, не импортируя UI.)*

3. **Обновить JSON-шаблоны врагов** (`public/content/entities/enemies/*.json`):
   - Добавить поле `"flavorText"` с кратким смешным описанием. Примеры (не придумывать новые, заполнить в стиле проекта):
     - `cat_small`: `"Ещё вчера он мяукал под окном. Сегодня — грабит караваны."`
     - `cat_mid`: `"Средний бизнес-кот. Нанимает котят и не платит налоги."`
     - `cat_big`: `"Главный кот района. Его гремучее мурлыканье слышно за три квартала."`

4. **Обновить JSON-шаблоны лестниц** (`public/content/entities/stairs/*.json`):
   - `stairs_down`: добавить `"name": "Лестница вниз"`, `"flavorText": "Ведёт в ещё более противную вонь."`
   - `stairs_up`: добавить `"name": "Лестница вверх"`, `"flavorText": "Обратно к солнечному свету и неоплаченным счетам."`

5. **Проверить загрузчик контента:**
   - Открыть `src/content/loader.ts` (или где инициализируется реестр) и убедиться, что новые поля автоматически прокидываются через Zod-схемы. Если загрузчик явно перечисляет поля — добавить новые.

---

## Задача 2. Создание popover-компонентов и ViewModel

### Цель
Создать в UI слое компоненты для отображения popover'ов над объектами на поле, и в Presentation слое — мапперы, которые превращают игровые сущности в готовые ViewModel.

### Контекст для агента
- **Типы Presentation:** `src/presentation/types.ts` — здесь живут `RenderInput`, `InventoryItemViewModel`, `ItemDetailViewModel` и т.д.
- **ItemDetailViewModel:** определён в `src/presentation/itemDetailMapper.ts`. `ItemDetailPopover` принимает его как проп `item`.
- **GameSession:** `src/presentation/gameSession.ts` — класс, который строит `RenderInput` в методе `buildRenderInput()`. Там же живут `targetingHover` и логика таргетинга.
- **Реестр:** `src/content/registry.ts` — `tryGetEntity()`, `tryGetItem()`, `tryGetAbility()`, `tryGetStairs()`.
- **Компонент ItemDetailPopover:** `src/ui/components/ItemDetailPopover.tsx` — рендерит карточку предмета через портал. Для переиспользования внутри `FieldObjectPopover` нужно вынести тело карточки в отдельный компонент без портала.
- **Стили:** `src/ui/styles/runtime.css` — классы `.inventory-item-detail-popover`, `.item-detail-card` и т.д.

### Что показывать в popover

| Тип объекта | Данные |
|-------------|--------|
| **Враг** | Спрайт (`resolveEnemySprite`), название, `flavorText`, урон (`enemy.damage`), текущие HP / макс HP (`enemy.hp` / `enemy.maxHp`), скиллы (если `abilities.length > 0`: имя, иконка, кулдаун), возможный лут (список имён предметов из `lootTable` без вероятностей) |
| **Предмет на земле** | Полная карточка предмета — точно такая же, как в инвентаре. Переиспользовать `ItemDetailViewModel` и визуал `ItemDetailPopover` |
| **Лестница** | Спрайт (`resolveStairsSprite`), название, `flavorText` |
| **Игрок** | Не показывать |
| **Тайлы/стены/пол** | Не показывать |

### Пошаговые действия

1. **Вынести `ItemDetailCard` из `ItemDetailPopover`:**
   - Создать `src/ui/components/ItemDetailCard.tsx` — принимает `ItemDetailViewModel` и рендерит только внутреннюю разметку карточки (без портала, без позиционирования).
   - Обновить `src/ui/components/ItemDetailPopover.tsx` — использовать `ItemDetailCard` внутри, оставив портал и позиционирование.
   - Убедиться, что существующие импорты (`InventoryPanel`, `EquipmentPanel`) продолжают работать с `ItemDetailPopover` без изменений.

2. **Добавить ViewModel-типы в `src/presentation/types.ts`:**
   ```ts
   export type FieldObjectPopoverViewModel =
     | { kind: 'enemy'; data: EnemyPopoverViewModel }
     | { kind: 'item'; data: ItemDetailViewModel }
     | { kind: 'stairs'; data: StairsPopoverViewModel };

   export type EnemyPopoverViewModel = {
     name: string;
     sprite: string;
     flavorText: string;
     damage: number;
     hp: number;
     maxHp: number;
     skills: Array<{ name: string; icon: string | null; cooldown: number; maxCooldown: number }>;
     loot: Array<{ name: string; icon: string }>;
   };

   export type StairsPopoverViewModel = {
     name: string;
     sprite: string;
     flavorText: string;
   };
   ```
   - Добавить поле `fieldObjectPopover: FieldObjectPopoverViewModel | null` в `RenderInput`.

3. **Создать `src/presentation/enemyDetailMapper.ts`:**
   - Принимает `EnemyEntity`.
   - Читает `tryGetEntity(enemy.templateId)` для `flavorText` и `lootTable`.
   - Для каждого `ability` в `enemy.abilities` читает `tryGetAbility(ability.templateId)` для имени/иконки.
   - Для лута: пройтись по `template.lootTable`, для каждого `templateId` вызвать `tryGetItem()` и собрать `{ name, icon: resolveItemIcon(item.spriteId ?? item.id) }`.
   - Формирует `EnemyPopoverViewModel`.

4. **Создать `src/presentation/stairsDetailMapper.ts`:**
   - Принимает `StairsEntity`.
   - Читает `tryGetStairs(entity.templateId)` для `name` и `flavorText`.
   - Формирует `StairsPopoverViewModel` с `sprite: resolveStairsSprite(entity.templateId)`.

5. **Обновить `src/presentation/gameSession.ts`:**
   - Добавить приватное поле `fieldHover: Position | null = null`.
   - Добавить публичный метод `isTargeting(): boolean` → `return this.targeting.phase === 'targeting'`.
   - Добавить публичный метод:
     ```ts
     setFieldHover(hoveredPosition: Position | null): void {
       const prevHover = this.fieldHover;
       const canShow = this.mode === 'playing'
         && this.animation.phase !== 'animating'
         && this.targeting.phase !== 'targeting';
       this.fieldHover = canShow ? hoveredPosition : null;
       if (this.fieldHover?.x !== prevHover?.x || this.fieldHover?.y !== prevHover?.y) {
         this.notify();
       }
     }
     ```
   - В `buildRenderInput()` добавить построение `fieldObjectPopover`:
     - Если `this.fieldHover` null → `null`.
     - Иначе пройтись по `state.entities.values()`, найти entity на клетке `fieldHover` (исключая игрока).
     - Приоритет: `enemy` → `item` → `stairs` (если несколько, первый найденный).
     - Для `enemy`: вызвать `enemyDetailMapper`, вернуть `{ kind: 'enemy', data: ... }`.
     - Для `item`: вызвать `mapItemTemplateToDetail(tryGetItem(entity.item.templateId)!)`, вернуть `{ kind: 'item', data: ... }`.
     - Для `stairs`: вызвать `stairsDetailMapper`, вернуть `{ kind: 'stairs', data: ... }`.
     - Если ничего нет → `null`.
   - Добавить `fieldObjectPopover` в возвращаемый объект `RenderInput`.

6. **Создать `src/ui/components/FieldObjectPopover.tsx`:**
   - Компонент принимает:
     ```ts
     interface Props {
       popover: FieldObjectPopoverViewModel | null;
       visible: boolean;
       x?: number;
       y?: number;
     }
     ```
   - Использует тот же паттерн позиционирования, что и `ItemDetailPopover` / `DetailPopover`:
     - `createPortal(document.body)`
     - `useLayoutEffect` для viewport edge detection
     - `POPOVER_OFFSET = 16`, `VIEWPORT_PADDING = 8`
   - Внешний класс: `field-object-popover` (fixed, z-index 99990, pointer-events none).
   - Внутри переключение по `popover.kind`:
     - `'enemy'` → рендер карточки врага (спрайт слева, имя, flavorText, HP-бар, урон, список скиллов, список лута). Карточка использует класс `item-detail-card` (или `field-popover-card` с такими же цветами/рамкой).
     - `'item'` → рендер `ItemDetailCard` с `popover.data`.
     - `'stairs'` → рендер карточки лестницы (спрайт, название, flavorText).
   - **Важно:** не импортировать типы из `src/simulation/` — только из `src/presentation/types.ts`.

7. **Добавить стили в `src/ui/styles/runtime.css`:**
   - `.field-object-popover` — копия позиционирования `.inventory-item-detail-popover`
   - `.field-popover-card` — визуально идентично `.item-detail-card` (градиент, рамка, скругление)
   - `.enemy-popover-head`, `.enemy-popover-sprite`, `.enemy-popover-hp`, `.enemy-popover-stat` — стили для внутренней разметки карточки врага.
   - Убедиться, что текст, отступы и цвета совпадают с `.item-detail-card`.

---

## Задача 3. Интеграция popover на игровое поле

### Цель
Подключить обработку hover на игровом поле в обычном режиме (фаза хода игрока, без таргетинга, без анимаций) и отображать `FieldObjectPopover` поверх поля.

### Контекст для агента
- **GameField:** `src/ui/components/GameField.tsx`
  - Принимает `onMouseMove?: (pos: {x: number; y: number}) => void` — сейчас передаёт только тайловые координаты.
  - Обработчики `mousemove` и `click` висят на HTML-контейнере `div.cm-field`.
  - Нет `onMouseLeave` — при уходе мыши с поля hover не сбрасывается.
- **GameScreen:** `src/ui/screens/GameScreen.tsx`
  - Использует `useSyncExternalStore` для подписки на `GameSession`.
  - Передаёт `handleMouseMove` и `handleMouseClick` в `GameField`.
  - Рендерит `GameField` в центральной колонке.
  - Сейчас `handleMouseMove` вызывает `session.previewTarget(pos)` для таргетинга.
  - `isInputBlocked = renderInput?.phase === 'animating'`.
- **GameSession:** `src/presentation/gameSession.ts`
  - Новый метод `setFieldHover(pos)` — см. Задачу 2.
  - Новый метод `isTargeting()` — см. Задачу 2.
  - Новое поле в `RenderInput`: `fieldObjectPopover` — см. Задачу 2.

### Пошаговые действия

1. **Обновить `src/ui/components/GameField.tsx`:**
   - Добавить в `Props`:
     ```ts
     onMouseMoveScreen?: (pos: {screenX: number; screenY: number}) => void;
     onMouseLeave?: () => void;
     ```
   - В `handleMouseMove` (строка ~201) добавить вызов:
     ```ts
     onMouseMoveScreen?.({ screenX: e.clientX, screenY: e.clientY });
     ```
   - Добавить обработчик `handleMouseLeave`:
     ```ts
     const handleMouseLeave = () => {
       onMouseLeave?.();
     };
     ```
   - Подписать `handleMouseLeave` на событие `mouseleave` контейнера (рядом с `mousemove` и `click`) и отписать в cleanup.

2. **Обновить `src/ui/screens/GameScreen.tsx`:**
   - Добавить `useState` для хранения экранных координат курсора:
     ```ts
     const [fieldHoverPos, setFieldHoverPos] = useState<{x: number; y: number} | null>(null);
     ```
   - Обновить `handleMouseMove`:
     ```ts
     const handleMouseMove = useCallback(
       (pos: {x: number; y: number}) => {
         if (session.getMode() !== 'playing') return;
         if (isInputBlocked) return;
         session.previewTarget(pos);
       },
       [session, isInputBlocked],
     );
     ```
     *(Оставить без изменений — `previewTarget` нужен для таргетинга.)*
   - Добавить `handleMouseMoveScreen`:
     ```ts
     const handleMouseMoveScreen = useCallback(
       (pos: {screenX: number; screenY: number}) => {
         if (session.getMode() !== 'playing') return;
         if (isInputBlocked) return;
         if (session.isTargeting()) return;
         setFieldHoverPos({x: pos.screenX, y: pos.screenY});
       },
       [session, isInputBlocked],
     );
     ```
   - Добавить `handleMouseLeave`:
     ```ts
     const handleMouseLeave = useCallback(() => {
       session.setFieldHover(null);
       setFieldHoverPos(null);
     }, [session]);
     ```
   - Обновить вызов `GameField`:
     ```tsx
     <GameField
       floor={renderInput.state.floor}
       renderInput={renderInput}
       onWait={handleWait}
       onAnimationsComplete={() => session.onAnimationsComplete()}
       onZoomDelta={handleZoom}
       onMouseMove={handleMouseMove}
       onMouseClick={handleMouseClick}
       onMouseMoveScreen={handleMouseMoveScreen}
       onMouseLeave={handleMouseLeave}
     />
     ```
   - Добавить рендер `FieldObjectPopover` рядом с `GameField` (или внутри центральной колонки, но вне `GameField`):
     ```tsx
     {renderInput.fieldObjectPopover && fieldHoverPos && (
       <FieldObjectPopover
         popover={renderInput.fieldObjectPopover}
         visible={true}
         x={fieldHoverPos.x + 16}
         y={fieldHoverPos.y + 16}
       />
     )}
     ```
     *(Смещение +16 совпадает с `POPOVER_OFFSET` в `ItemDetailPopover`.)*
   - Импортировать `FieldObjectPopover` в `GameScreen`.

3. **Проверить логику `setFieldHover`:**
   - В `GameScreen.handleMouseMove` нужно ещё вызывать `session.setFieldHover(pos)` при движении мыши, потому что `setFieldHover` — это Presentation-слой, который определяет, есть ли объект на клетке и какой он.
   - Обновить `handleMouseMove`:
     ```ts
     const handleMouseMove = useCallback(
       (pos: {x: number; y: number}) => {
         if (session.getMode() !== 'playing') return;
         if (isInputBlocked) return;
         session.previewTarget(pos);
         session.setFieldHover(pos);
       },
       [session, isInputBlocked],
     );
     ```
   - `session.setFieldHover(null)` вызывается в `handleMouseLeave`.

4. **Проверить edge-cases:**
   - При начале таргетинга (`beginTargeting`) `setFieldHover(null)` должен скрыть popover. В `GameSession.beginTargeting` уже есть `this.targetingHover = null; this.notify();`, но `fieldHover` остаётся. Нужно сбросить `fieldHover` в `beginTargeting`:
     ```ts
     this.fieldHover = null;
     ```
   - При отмене таргетинга (`cancelTargeting`) — `fieldHover` может остаться null до следующего движения мыши, это нормально.
   - При dispatch/анимации (`animation.phase = 'animating'`) — `setFieldHover` сам обнуляет `fieldHover`, потому что проверяет `this.animation.phase !== 'animating'`.
   - При изменении клетки hover с предмета на пустую — `buildRenderInput` вернёт `null`, popover скроется.

5. **Проверить сборку и типы:**
   - Запустить `npm run build` или `npx tsc --noEmit` и устранить ошибки типизации.
   - Запустить `npm test` (если есть релевантные тесты) и убедиться, что ничего не сломалось.

---

## Итоговый чек-лист файлов

### Задача 1 ✅ ВЫПОЛНЕНО
- [x] `src/content/schemas.ts` — добавлен `flavorText` в `EntityTemplateSchema`; добавлены `name` и `flavorText` в `StairsTemplateSchema`
- [x] `src/utils/assetResolver.ts` — добавлены `resolveEnemySprite()` и `resolveStairsSprite()`
- [x] `public/content/entities/enemies/cat_small.json` — добавлен `flavorText`
- [x] `public/content/entities/enemies/cat_mid.json` — добавлен `flavorText`
- [x] `public/content/entities/enemies/cat_big.json` — добавлен `flavorText`
- [x] `public/content/entities/stairs/stairs_down.json` — добавлены `name` и `flavorText`
- [x] `public/content/entities/stairs/stairs_up.json` — добавлены `name` и `flavorText`
- [x] `src/content/loader.ts` — изменений не требовалось (Zod прокидывает поля автоматически)

### Задача 2 ✅ ВЫПОЛНЕНО
- [x] `src/ui/components/ItemDetailCard.tsx` (новый) — вынесена карточка предмета без портала
- [x] `src/ui/components/ItemDetailPopover.tsx` (рефактор) — теперь использует `ItemDetailCard`
- [x] `src/presentation/types.ts` — добавлены `EnemyPopoverViewModel`, `StairsPopoverViewModel`, `FieldObjectPopoverViewModel`, поле `fieldObjectPopover` в `RenderInput`
- [x] `src/presentation/enemyDetailMapper.ts` (новый) — маппер врага в `EnemyPopoverViewModel`
- [x] `src/presentation/stairsDetailMapper.ts` (новый) — маппер лестницы в `StairsPopoverViewModel`
- [x] `src/presentation/gameSession.ts` — добавлены `fieldHover`, `setFieldHover()`, `isTargeting()`, `buildFieldObjectPopover()`, интегрировано в `buildRenderInput`
- [x] `src/ui/components/FieldObjectPopover.tsx` (новый) — компонент с позиционированием и переключением по типам (enemy/item/stairs)
- [x] `src/ui/styles/runtime.css` — добавлены стили `.field-object-popover`, `.field-popover-card` и все дочерние классы
- [x] `tests/unit/ui/renderer/EntityRenderer.test.ts` — добавлено поле `fieldObjectPopover` в тестовую фабрику

### Задача 3 ✅ ВЫПОЛНЕНО
- [x] `src/ui/components/GameField.tsx` — добавлены пропы `onMouseMoveScreen` и `onMouseLeave`; обработчики `mousemove` (screen coords) и `mouseleave` на контейнере поля
- [x] `src/ui/screens/GameScreen.tsx` — добавлено состояние `fieldHoverPos`, обработчики `handleMouseMoveScreen` / `handleMouseLeave`, вызов `session.setFieldHover(pos)` в `handleMouseMove`, рендер `FieldObjectPopover` с координатами курсора
- [x] Сборка и тесты — `npx tsc --noEmit` проходит без ошибок, `npm test` — 39 файлов / 293 теста ✅
