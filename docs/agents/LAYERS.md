# LAYERS — Правила архитектурных слоёв

> Запрещены циклические зависимости. Никогда.

---

## Зависимости (строгие)

```
ui/           → presentation/, utils/constants.ts
presentation/ → simulation/ (только публичный API), content/, utils/
simulation/   → content/, utils/
content/      → (ничего — чистые функции и типы)
utils/        → (ничего — чистые функции)
```

---

## Критическое правило

> **Presentation — единственный слой, имеющий право вызывать API Simulation.**
> UI не знает о существовании Simulation. Content не знает ни о ком.

---

## Ответственность слоёв

### Content (`src/content/` + `public/content/`)
- **Data:** `public/content/` — JSON-файлы сущностей, предметов, способностей, карт. Модифицируемый без пересборки.
- **Code:** `src/content/` — Zod-схемы, загрузчик (`loader.ts`), in-memory реестр (`registry.ts`).
- Read-only после инициализации.
- Доступен для чтения из `simulation/` и `presentation/`.

**Запрещено:** импортировать `simulation/`, `presentation/`, `ui/`. Содержать игровую логику. Ссылаться на runtime-состояние.

### Simulation (`src/simulation/`)
- **Headless** — без браузерных API, без React, без PixiJS, без DOM.
- **Детерминированный** — одинаковое состояние + одинаковые действия = одинаковый результат.
- **Тестируется в Node.js** — все тесты работают без браузера.
- Использует seeded PRNG (`utils/rng.ts`) для генерации мира и runtime random (`utils/random.ts`) для игровой логики. Никакого `Math.random()` напрямую.
- Состояние мутируется напрямую внутри функций симуляции.
- Функции возвращают дерево `GameEvent` через `ExecutionBuilder`, описывая, что произошло.
- **Публичный API:** `dispatch(action)`, `step()`, `preview(action)`, `getState()`, `isPlayerTurn()`, `generateMap(params)`, `regenerateMap()`, `getActionCost(action)`, `getPlayerStats()`, `setDebugEnabled(enabled)`, а также query-методы способностей, pathfinding'а и взаимодействий. Полный интерфейс — `src/simulation/types.ts` (`Simulation`).

**Запрещено:** импортировать React, PixiJS, любые browser API. Обращаться к DOM. Импортировать из `presentation/` или `ui/`.

### Presentation (`src/presentation/`)
- **Единственный мост** между UI и Simulation.
- Хранит сессионное состояние UI (выбранный тайл, автопуть, фаза ввода).
- Переводит события UI → команды Simulation (`dispatch`, `preview`).
- Переводит дерево событий Simulation (`ExecutionNode`) → анимационные планы и combat log для UI.
- Управляет автопутём и другими UI-специфичными механиками.
- Оркестрация save/load (запрос состояния у Simulation, вызов serialize/deserialize, передача UI для записи в localStorage).

**Запрещено:** содержать игровую логику. Мутировать `GameState` напрямую — только через `simulation.dispatch()`. Импортировать из `src/ui/`.

### UI (`src/ui/`)
- **Только отрисовка** — рендеринг игрового мира и интерфейса.
- **Только ввод** — захват клавиатуры, мыши, тач-событий.
- **Только анимация** — исполнение анимационных планов, полученных от Presentation.
- PixiJS (renderer мира) — **не отдельный слой**, а техническая подсистема внутри UI.

**Запрещено:** мутировать игровое состояние напрямую. Содержать игровую логику. Импортировать из `src/simulation/` напрямую.

**Разрешено зависеть от:**
- `src/presentation/` (получение ViewModel, отправка событий ввода)
- `src/utils/constants.ts` (TILE_SIZE и визуальные константы)
- `src/utils/animationConfig.ts`, `src/utils/tween.ts`, `src/utils/assetResolver.ts` (визуальные утилиты и ассеты)

---

## Запрещённые зависимости

| Нарушение | Почему запрещено |
|-----------|-----------------|
| `ui/` → `simulation/` | UI не должен знать о существовании Simulation. Только Presentation вызывает API. |
| `presentation/` → `ui/` | Presentation не зависит от способа отрисовки. UI зависит от Presentation. |
| `simulation/` → `presentation/` | Simulation headless и не знает об UI-сессии. |
| `simulation/` → `ui/` | Simulation не использует browser API. |

---

## Добавление фичи: куда идти

### Новый тип врага
1. JSON-определение в `public/content/entities/`
2. AI-стратегия (код поведения) в `src/simulation/ai/`
3. Спрайт в `public/assets/` (регистрация через `src/ui/renderer/spriteRegistry.ts` / `utils/assetResolver.ts`)
4. Не требует изменений в Presentation и UI (если нет новых анимаций)

### Новая игровая механика
1. Типы в `src/simulation/types.ts`
2. Логика в `src/simulation/systems/`
3. Обработчик действия в `src/simulation/systems/actions/`
4. Контент-определения при необходимости
5. Обновить Presentation: перевод новых событий в анимации
6. Обновить UI: визуализация новых анимаций при необходимости

### Новый UI-экран
1. React-компонент/экран в `src/ui/components/` или `src/ui/screens/`
2. Сессионное состояние экрана в Presentation
3. Обработка событий экрана в Presentation
4. Не требует изменений в Simulation
