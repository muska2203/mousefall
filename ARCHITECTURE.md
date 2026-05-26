# Architecture Overview

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Core Philosophy

> **Simplicity over scalability. Working game over perfect architecture.**
> **Clear boundaries over clever abstractions.**

Архитектура построена вокруг четырёх слоёв с жёсткими правилами зависимостей.
Ключевой принцип: **Presentation — единственный слой, имеющий право вызывать API Simulation.**
UI не знает о существовании Simulation. Content не знает ни о ком.

Цели архитектуры:
- Быть **сразу понятной** без документации
- Поддерживать **детерминированную симуляцию** для отладки и реплеев
- **Строго разделять** игровую логику, оркестрацию и отображение
- Позволять добавлять **контент без изменения логики**
- Быть **тестируемой без браузера**

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│  src/ui/                                                │
│  Отрисовка, анимации, ввод. Только рендеринг и ввод.    │
│  ↓ передаёт события ввода в Presentation                │
│  ↑ получает ViewModel и анимационные команды            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               Presentation Layer                        │
│  src/presentation/                                      │
│  Оркестратор. Единственный мост между UI и Simulation.  │
│  Хранит сессионное состояние UI. Готовит анимации.      │
│  Переводит события UI → команды Simulation.             │
│  Переводит результат Simulation → язык UI.              │
│  ↓ вызывает API Simulation                              │
│  ↑ отдаёт ViewModel + анимационные планы в UI           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Simulation Layer                        │
│  src/simulation/                                        │
│  Чистая игровая логика. Headless. Детерминированная.    │
│  API: dispatch, preview, getState, generateMap.         │
│  ↓ читает контент                                       │
│  ↓ использует утилиты                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Content Layer                           │
│  public/content/                                        │
│  JSON-данные: сущности, карты, способности, предметы    │
│  Чистые данные, без логики                              │
└─────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Content Layer (`public/content/`)

**Ответственность:**
- Шаблоны сущностей (враги, предметы, способности)
- Параметры карт и генерации
- Игровые баланс-значения
- Чистые данные, не код

**Разрешено:**
- Не зависеть ни от чего (pure data)

**Запрещено:**
- Импортировать код
- Содержать логику
- Ссылаться на runtime-состояние

---

### Simulation Layer (`src/simulation/`)

**Ответственность:**
- Вся игровая логика и правила
- Мутация игрового состояния
- Управление ходами (Action → Intent → Event)
- Генерация карт
- AI-стратегии (как данные поведения, не как отображение)

**Публичный API:**
См. интерфейс `Simulation` в `src/simulation/types.ts`.
Методы: `dispatch`, `preview`, `getState`, `generateMap`.

**Разрешено зависеть от:**
- `src/simulation/content/` (реестр контента)
- `src/utils/` (математика, RNG, константы)

**Запрещено:**
- Импортировать React, PixiJS, любые browser API
- Обращаться к DOM
- Делать сетевые запросы
- Импортировать из `src/presentation/` или `src/ui/`
- Использовать `Math.random()` (только seeded RNG)

**Критическое правило:**
> Любое прямое взаимодействие с игровым миром (вызов `dispatch`, чтение `getState`) из слоёв **UI** или **Content** считается архитектурной ошибкой.
> Единственный легальный вызывающий Simulation API — это **Presentation Layer**.

---

### Presentation Layer (`src/presentation/`)

**Ответственность:**
- **Единственный мост** между UI и Simulation
- Хранение сессионного состояния UI (выбранный тайл, режим ввода, текущий автопуть)
- Перевод "сырых" событий UI в команды Simulation
- Перевод дерева событий Simulation (`ExecutionNode`) в анимационные планы для UI
- Управление автопутём и другими UI-специфичными механиками
- Сохранение/загрузка (оркестрация, не логика)

**Разрешено зависеть от:**
- `src/simulation/` (только через публичный API: `dispatch`, `preview`, `getState`)
- `src/utils/` (математические утилиты, константы)

**Запрещено:**
- Содержать игровую логику (как считается урон, можно ли ходить)
- Мутировать `GameState` напрямую — только через `simulation.dispatch()`
- Импортировать из `src/ui/` (UI зависит от Presentation, а не наоборот)
- Использовать browser API (DOM, localStorage и т.д.) — это ответственность UI

---

### UI Layer (`src/ui/`)

**Ответственность:**
- **Только отрисовка** — рендеринг игрового мира и интерфейса
- **Только ввод** — захват клавиатуры, мыши, тач-событий
- **Только анимация** — исполнение анимационных планов, полученных от Presentation
- Тики/кадры (requestAnimationFrame или PixiJS ticker)

**Структура внутри UI:**
```
src/ui/
  ├── renderer/       # PixiJS — отрисовка мира, спрайтов, тайлов
  ├── components/     # React — HUD, меню, панели, инвентарь
  └── input/          # Обработчики ввода
```

> Renderer (PixiJS) — **не отдельный архитектурный слой**, а техническая подсистема внутри UI.
> Presentation готовит анимационные команды, UI решает, через PixiJS или React их исполнять.

**Разрешено зависеть от:**
- `src/presentation/` (получение ViewModel, отправка событий ввода)
- `src/utils/constants.ts` (TILE_SIZE и визуальные константы)

**Запрещено:**
- Мутировать игровое состояние напрямую
- Содержать игровую логику
- Импортировать из `src/simulation/` напрямую
- Делать решения о том, "что произошло" — только "что отобразить"

---

## Dependency Rules (Strict)

```
ui/           → presentation/, utils/constants.ts
presentation/ → simulation/ (только публичный API), utils/
simulation/   → content/, utils/
content/      → (nothing)
utils/        → (nothing)
```

**No circular dependencies. Ever.**

### Запрещённые зависимости (архитектурные нарушения)

| Нарушение | Почему запрещено |
|-----------|-----------------|
| `ui/` → `simulation/` | UI не должен знать о существовании Simulation. Только Presentation вызывает API. |
| `presentation/` → `ui/` | Presentation не зависит от способа отрисовки. UI зависит от Presentation. |
| `simulation/` → `presentation/` | Simulation headless и не знает об UI-сессии. |
| `simulation/` → `ui/` | Simulation не использует browser API. |

---

## Communication Patterns

### Пример 1: Наведение на тайл (Hover)

```
Пользователь навёл курсор на тайл (x, y)
    │
    ▼
┌─────────────────────────────────────────┐
│ UI Layer                                │
│ Определил hover на элементе карты.      │
│ Не решает, что делать.                  │
│ Отправляет в Presentation:              │
│   "пользователь навёл на тайл (x, y)"   │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ Presentation Layer                      │
│ Смотрит на своё сессионное состояние:   │
│   "фаза = ожидание ввода игрока"        │
│ Решает:                                 │
│   "в этой фазе hover должен показать    │
│    автопуть до этого тайла"             │
│                                         │
│ Вызывает utils/math.ts (pathfinding)    │
│ или Simulation API (если pathfinding    │
│ требует игровых правил)                 │
│                                         │
│ Формирует ViewModel:                    │
│   { highlightedPath: Position[] }       │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ UI Layer                                │
│ Получает ViewModel с highlightedPath.   │
│ Рендерит подсветку пути через PixiJS.   │
└─────────────────────────────────────────┘
```

### Пример 2: Клик на тайл с автопутём (Auto-path)

```
Пользователь кликнул на тайл (x, y)
    │
    ▼
┌─────────────────────────────────────────┐
│ UI Layer                                │
│ Определил клик на элементе карты.       │
│ Отправляет в Presentation:              │
│   "пользователь кликнул на тайл (x, y)" │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ Presentation Layer                      │
│ Решает: "в этой фазе клик = начать      │
│          движение по автопути"          │
│                                         │
│ Сохраняет автопуть в сессионном         │
│ состоянии.                              │
│                                         │
│ Пока автопуть не пуст:                  │
│   1. Берёт следующий шаг                │
│   2. Вызывает simulation.dispatch(MOVE) │
│   3. Получает SimulationResult с        │
│      деревом ExecutionNode              │
│   4. Переводит дерево событий в         │
│      анимационный план                  │
│   5. Отдаёт план в UI                   │
│   6. Ждёт сигнала "анимация завершена"  │
│      от UI                              │
│   7. Переходит к шагу 1                 │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ UI Layer                                │
│ Получает анимационный план.             │
│ Исполняет через PixiJS (tweens,         │
│ перемещение спрайтов).                  │
│                                         │
│ По завершении всех анимаций:            │
│   Отправляет в Presentation:            │
│   "анимация завершена"                  │
└─────────────────────────────────────────┘
```

### Пример 3: Прямое действие (Атака соседнего врага)

```
Пользователь нажал клавишу атаки
    │
    ▼
UI Layer → Presentation: "атака в направлении (dx, dy)"
    │
    ▼
Presentation:
  1. Может вызвать simulation.preview(ATTACK)
     чтобы показать подсказку (сколько урона).
  2. Вызывает simulation.dispatch(ATTACK).
  3. Получает ExecutionNode с ACTION_APPLIED (ATTACK),
     ENTITY_DAMAGED, ENTITY_DIED и т.д.
  4. Формирует анимационный план:
     { type: 'ATTACK_ANIMATION', ... }
  5. Отдаёт план в UI.
    │
    ▼
UI Layer исполняет анимацию атаки.
```

---

## Key Architectural Decisions

### 1. Mutable State with Controlled Access

Игровое состояние мутируется напрямую внутри Simulation. Внешние слои получают доступ только через `Readonly<GameState>` или ViewModel от Presentation.

**Tradeoff:** Менее "чисто", чем immutable-подход, но гораздо проще в отладке и разработке.

### 2. Presentation as the Sole API Consumer

Только Presentation знает о существовании Simulation API. UI работает с абстракцией Presentation.

**Tradeoff:** Дополнительный слой кода для простых действий, но зато UI полностью заменяем и независим от игровой логики.

### 3. Direct Function Calls (No Command Pattern)

Игровые действия — plain functions, не объекты-команды. Достаточно для одиночной игры.

**Tradeoff:** Сложнее добавить replay/undo позже, но сейчас значительно проще.

### 4. Seeded RNG in Simulation State

Вся случайность через seeded PRNG, хранимый в `GameState`.

**Tradeoff:** Чуть сложнее `Math.random()`, но критично для детерминизма.

### 5. JSON Content with Runtime Validation

Контент в JSON, валидация при загрузке через Zod.

**Tradeoff:** Нет compile-time проверки контента, но можно редактировать без пересборки.

### 6. Action → Intent → Event Tree

Simulation использует трёхфазную систему:
- **Action** — высокоуровневое намерение (MOVE, ATTACK, WAIT)
- **Intent** — низкоуровневые операции после разрешения (MOVE, DAMAGE, DIE)
- **Event** — неизменяемая запись о произошедшем, организованная в дерево `ExecutionNode`

Presentation потребляет дерево `ExecutionNode` и превращает его в анимационные планы.

---

## Determinism Contract

Simulation layer **должна** быть детерминированной:
- Одно начальное состояние + одна последовательность действий = один результат
- Вся случайность только через seeded RNG
- Нет `Date.now()`, `Math.random()`, async-операций в Simulation
- Порядок обработки сущностей консистентен (сортировка по ID)

---

## Testability Contract

Simulation layer **должна** тестироваться без браузера:
- Нет DOM-зависимостей
- Нет browser API
- Чистые функции где возможно
- Контролируемые мутации состояния с чёткими точками входа

Presentation layer тестируется отдельно:
- Мокается Simulation API
- Проверяется логика перевода событий UI → команды Simulation
- Проверяется формирование анимационных планов из `ExecutionNode`

---

## File Naming Conventions

```
src/simulation/systems/movement.ts   # System files: lowercase
src/simulation/types.ts              # Types: lowercase
src/presentation/gameSession.ts      # Presentation: PascalCase для классов
src/ui/components/Grid.tsx           # React components: PascalCase
src/ui/renderer/WorldRenderer.ts     # Renderer classes: PascalCase
public/content/entities/cat_small.json  # Content: lowercase
```

---

## Adding New Features

### Новый тип врага
1. Добавить JSON-определение в `public/content/entities/`
2. Добавить AI-стратегию (код поведения) в `src/simulation/ai/`
3. Добавить спрайт в `src/ui/renderer/sprites/`
4. Не требует изменений в Presentation и UI (если нет новых анимаций)

### Новая игровая механика
1. Добавить типы в `src/simulation/types.ts`
2. Добавить логику в `src/simulation/systems/`
3. Добавить обработчик действия в `src/simulation/systems/actions/`
4. Добавить контент-определения при необходимости
5. Обновить Presentation: добавить перевод новых событий в анимации
6. Обновить UI: добавить визуализацию новых анимаций при необходимости

### Новый UI-экран (например, экран крафта)
1. Добавить React-компонент в `src/ui/components/`
2. Добавить сессионное состояние экрана в Presentation
3. Добавить обработку событий экрана в Presentation
4. Не требует изменений в Simulation

---

## Current Implementation Status

### Реализовано и работает
- **Simulation:** ядро полностью работает (`types.ts`, `state.ts`, `simulation.ts`)
- **Action/Intent/Event:** система полностью реализована (`systems/actions/`, `systems/intents/`, `systems/world-reactions/`)
- **Content:** загрузка и валидация JSON через Zod (`content/loader.ts`, `content/registry.ts`)
- **Map generation:** процедурная генерация подземелий (`systems/mapgen.ts`)
- **RNG / Math:** seeded PRNG, сеточная математика, pathfinding (`utils/rng.ts`, `utils/math.ts`)
- **Presentation:** полностью реализован (`gameSession.ts`, `animationPlanner.ts`, `logBuilder.ts`, `types.ts`)
- **UI Layer:** полностью реализован (`screens/`, `components/`, `input/`, `styles/`)
- **Renderer (PixiJS):** полностью реализован (`ui/renderer/` — WorldRenderer, TileRenderer, EntityRenderer, FogRenderer и др.)
- **World Reactions:** динамическая регистрация с приоритетами (`registerReaction`)

### В рефакторе / закомментировано
- `src/simulation/serialization.ts` — полностью закомментирован; save/load заблокирован
- `src/simulation/turn.ts` — устаревший turn flow (не используется, на удаление)

### Запланировано / не реализовано
- **Save/Load UI** — зависит от восстановления `serialization.ts`
