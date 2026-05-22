# AGENTS.md — Mousefall

> **Вся документация в этом проекте ведётся на русском языке.**
> Этот файл предназначен для AI-агентов и описывает архитектуру, соглашения и правила проекта.

---

## Обзор проекта

**Mousefall** — 2D пошаговый roguelike на TypeScript, работающий в браузере.
Архитектура строго слоистая, с безголовым (headless) детерминированным игровым движком в центре.
Приоритеты: простота, тестируемость, чёткое разделение ответственности.

**Ключевые документы** (в корне проекта):
- `ARCHITECTURE.md` — ответственность слоёв, правила зависимостей, примеры потоков
- `DATA_FLOW.md` — движение данных от ввода до экрана
- `EVENT_FLOW.md` — доменные события: порождение, потребление, жизненный цикл
- `SAVE_SYSTEM.md` — снапшоты, сериализация, миграции версий
- `CONTENT_PIPELINE.md` — JSON-контент, схемы Zod, моддинг
- `TESTING_STRATEGY.md` — что и как тестировать, фикстуры

---

## Технологический стек

| Слой | Технология |
|------|------------|
| Язык | TypeScript 5.5+ (ES2022, strict mode) |
| Сборка | Vite 5.4+ с плагином `@vitejs/plugin-react` |
| UI | React 18.3+ |
| Рендерер мира | PixiJS 8.0+ (входит в UI Layer) |
| Валидация | Zod 3.23+ |
| Тестирование | Vitest 2.0+ (среда Node.js, без браузера) |
| Покрытие | `@vitest/coverage-v8` |

---

## Команды сборки и тестирования

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка (type-check + bundle)
npm run build

# Предпросмотр production-сборки
npm run preview

# Запуск всех тестов
npm test

# Запуск тестов в режиме watch
npm run test:watch

# Запуск с отчётом о покрытии
npm run test:coverage

# Только type-check (без эмита)
npm run typecheck
```

> **Важно:** скрипт `build` запускает `tsc && vite build`. TypeScript настроен с `noEmit: true`, поэтому `tsc` только проверяет типы.

---

## Структура проекта

```
src/
  simulation/          # Ядро игры (headless, детерминированное)
    systems/           # Игровые системы
      actions/         # Обработчики действий
      intents/         # Исполнители интентов
      world-reactions/ # Реакции мира на события
    ai/                # (устаревший слой)
    content/           # Загрузка и валидация JSON-контента
    schemas/           # Zod-схемы
  presentation/        # Слой-оркестратор между UI и Simulation
  ui/                  # React, PixiJS, ввод, отрисовка, анимация
    animation/
    components/
    input/
    renderer/
    screens/
    styles/
  utils/               # Чистые утилиты

public/
  assets/              # Графические ассеты (тайлы, спрайты, иконки)
  content/             # Игровой контент в JSON (модифицируемый)
    abilities/
    entities/
      enemies/
      player/
    items/
    maps/

tests/
  unit/
    presentation/
    simulation/
    ui/
    utils/
  integration/
  fixtures/
```

---

## Архитектурные слои

Запрещены циклические зависимости.

```
ui/           → presentation/, utils/constants.ts
presentation/ → simulation/ (только публичный API), utils/
simulation/   → content/, utils/
content/      → (ничего — чистые данные)
utils/        → (ничего — чистые функции)
```

**Критическое правило:**
> **Presentation — единственный слой, имеющий право вызывать API Simulation.**
> UI не знает о существовании Simulation. Content не знает ни о ком.

### Слой Content (`public/content/`)
- JSON-файлы сущностей, предметов, способностей, карт.
- Валидация при загрузке через Zod.
- Модифицируемый без пересборки.

### Слой Simulation (`src/simulation/`)
- **Headless** — без браузерных API, без React, без PixiJS, без DOM.
- **Детерминированный** — одинаковое состояние + одинаковые действия = одинаковый результат.
- **Тестируется в Node.js** — все тесты работают без браузера.
- Использует seedable PRNG (`utils/rng.ts`) — никогда `Math.random()`.
- Состояние мутируется напрямую внутри функций симуляции.
- Функции возвращают дерево `GameEvent` через `ExecutionBuilder`, описывая, что произошло.
- **Публичный API:** `dispatch(action)`, `preview(action)`, `getState()`, `generateMap()`.

### Слой Presentation (`src/presentation/`)
- **Единственный мост** между UI и Simulation.
- Хранит сессионное состояние UI (выбранный тайл, автопуть, фаза ввода).
- Переводит события UI → команды Simulation (`dispatch`, `preview`).
- Переводит дерево событий Simulation (`ExecutionNode`) → анимационные планы и combat log для UI.
- Управляет автопутём и другими UI-специфичными механиками.

### Слой UI (`src/ui/`)
- **Только отрисовка** — рендеринг игрового мира и интерфейса.
- **Только ввод** — захват клавиатуры, мыши, тач-событий.
- **Только анимация** — исполнение анимационных планов, полученных от Presentation.
- PixiJS (renderer мира) — **не отдельный слой**, а техническая подсистема внутри UI.

---

## Система действий (Action / Intent / Event)

Симуляция использует трёхфазную систему:

1. **Action (`GameAction`)** — высокоуровневое намерение игрока/врага (MOVE, ATTACK, WAIT).
2. **Intent (`Intent`)** — низкоуровневые операции после разрешения (MOVE, DAMAGE, DIE).
3. **Event (`GameEvent`)** — неизменяемая запись о произошедшем, возвращается через дерево `ExecutionNode`.

```
Action → validate() → resolve() → Intent[]
  → execute() → Events → World Reactions → дополнительные Intents / Events
```

### ExecutionBuilder и ExecutionNode

События организованы в дерево `ExecutionNode` (см. `src/simulation/systems/actions/types.ts`).

`ExecutionBuilder` создаёт корневое событие (`ACTION_APPLIED`) и позволяет
присоединять дочерние узлы при порождении интентов и реакций.

### ActionHandler<T>

Каждый обработчик действия реализует:
- `validate(state, action): ValidationResult`
- `resolve(state, action): Intent[]`
- `execute(state, action, intents, builder, parentNode): void`

Оркестратор `runActionHandler` (`systems/actions/action-utils.ts`) вызывает их последовательно.

### IntentExecutor<T>

Исполнители интентов (`systems/intents/`) мутируют состояние и создают узлы событий:
- **MOVE** — обновляет `entity.x / entity.y`, порождает `ENTITY_MOVED`
- **DAMAGE** — обновляет `target.hp`, порождает `ENTITY_DAMAGED`
- **DIE** — удаляет врага или переводит игрока в `phase: 'dead'`, порождает `ENTITY_DIED` / `PLAYER_DIED`

### Мировые реакции (`WorldReaction`)

После выполнения интента `runWorldReactions` проверяет зарегистрированные реакции.
Сейчас реализована только `deathReaction`: при `ENTITY_DAMAGED`, если `hp <= 0`,
порождается интент `DIE`.

---

## Ход игры (Turn Flow)

Реализован в `DefaultTestSimulation.dispatch()` (`src/simulation/simulation.ts`).

### Поток хода игрока

1. Создаётся `ExecutionBuilder` с событием `ACTION_APPLIED`.
2. Определяется актёр (`resolveActionActor`) — для хода игрока это всегда игрок.
3. Действие исполняется через `executeAction` (списываются AP).
4. Корневой узел игрока добавляется в фазу `PLAYER` результата.
5. Если у игрока закончились AP (`isPlayerExhausted`):
   - Запускается `runEnvironmentTurn` — все живые AI-актёры делают ходы.
   - Каждое действие врага получает собственный `ExecutionBuilder` и корневой узел; все они собираются в фазу `ENVIRONMENT`.
   - Запускается `beginNextPlayerTurn` — увеличивается раунд, AP игрока восстанавливаются.
6. Выполняется ASCII-рендер карты в консоль.
7. Возвращается `{ success, stateChanged, phases }`, где `phases` — массив фаз хода в порядке выполнения.

### Ход окружения (Environment Turn)

Для каждого живого AI-актёра:
- Восстанавливаются AP (`ap = maxAp`).
- Пока `ap > 0`: вызывается `enemy.aiStrategy.decideAction(enemy, state)`, результат исполняется.
- Каждое успешное действие врага порождает отдельное дерево `ExecutionNode` (корень `ACTION_APPLIED`).
- Если действие невозможно — ход прерывается.

---

## Тестирование

### Среда
- **Runtime:** Node.js (не браузер).
- **Фреймворк:** Vitest.
- **Конфиг:** `vitest.config.ts`.

### Цели покрытия

| Путь | Цель |
|------|------|
| `src/simulation/systems/actions/` | 90%+ |
| `src/simulation/systems/intents/` | 90%+ |
| `src/simulation/systems/world-reactions/` | 90%+ |
| `src/simulation/systems/mapgen.ts` | 80%+ |
| `src/utils/rng.ts` | 100% |
| `src/simulation/serialization.ts` | 90%+ |
| `src/ui/`, `src/presentation/` | Не измеряется |

### Правила написания тестов
1. **Без браузера** — `environment: 'node'`.
2. **Детерминированность** — фиксированные seed для RNG (`createRNG(12345)`).
3. **Быстрота** — без async, без таймаутов.
4. **Независимость** — нет общего мутабельного состояния между тестами.
5. **Фикстуры вместо setup** — используйте готовые состояния из `tests/fixtures/`.
6. **Тестируйте поведение, а не реализацию**.

### Запуск конкретных тестов

```bash
# По имени файла
npm test movement

# По имени теста
npm test -- -t "moves player to valid adjacent tile"
```

---

## Контент-пайплайн

Игровой контент хранится в `public/content/` в виде JSON-файлов:
- `entities/` — шаблоны врагов и игрока
- `items/` — оружие, броня, расходуемые предметы
- `abilities/` — шаблоны способностей
- `maps/` — параметры генерации карт

### Добавление контента
1. Создайте JSON-файл по существующей схеме.
2. Добавьте путь в `public/content/manifest.json`.
3. Пересборка не требуется.

Контент валидируется при загрузке через Zod. Невалидный контент приводит к
fail-fast с понятным сообщением об ошибке.

---

## Система сохранений

- **Снапшотные сохранения** — полный `GameState` сериализуется в JSON.
- `SAVE_VERSION = 1` в `src/utils/constants.ts`.
- Состояние RNG включается в сохранения для детерминизма.
- Хранение: `localStorage` с префиксом ключей `mousefall:save:`.
- 3 ручных слота + 1 слот автосохранения (слот 0).
- **Оркестрация save/load** — ответственность Presentation (запрос состояния у Simulation, вызов serialize/deserialize, передача UI для записи в localStorage).

---

## Ключевые файлы для агентов

| Задача | Файл |
|--------|------|
| Понять форму состояния игры | `src/simulation/types.ts` |
| Добавить новую игровую систему | `src/simulation/systems/` + `src/simulation/types.ts` |
| Добавить новый тип действия | `src/simulation/systems/actions/types.ts` |
| Добавить новый тип события | `src/simulation/types.ts` (union `GameEvent`) |
| Добавить контент (враг, предмет, карта) | `public/content/` + `src/simulation/content/loader.ts` |
| Изменить генерацию карт | `src/simulation/systems/mapgen.ts` |
| Добавить тест | `tests/unit/simulation/` или `tests/integration/` |
| Изучить схемы контента | `src/simulation/schemas/contentSchemas.ts` |
| Понять поток хода | `src/simulation/simulation.ts` (`DefaultTestSimulation.dispatch`) |
| Понять переход между этажами | `src/simulation/systems/world-reactions/stairs-reaction.ts` |
| Понять архитектуру слоёв | `ARCHITECTURE.md` |
| Понять движение данных | `DATA_FLOW.md` |
| Понять жизненный цикл событий | `EVENT_FLOW.md` |

---

## Язык документации

**Вся документация, комментарии к коду и текстовые сопровождения в проекте должны писаться на русском языке.**
Это включает README, AGENTS.md, архитектурные документы, комментарии в коде и описания коммитов.
Исключение: имена переменных, типов, функций и ключей в коде остаются на английском.

### Комментарии в коде

- Все JSDoc-, однострочные (`//`) и многострочные (`/* */`) комментарии в исходном коде (`*.ts`, `*.tsx`, `*.js`, `*.jsx`) пишутся на русском языке.
- Закомментированный код (временно отключённые фрагменты) переводить не требуется, но если внутри него есть текстовые пояснения — они тоже должны быть на русском.
- `eslint-disable` и прочие директивы линтера остаются на английском (это технические метки).
- Содержимое `.describe()` в Zod-схемах считается комментарием к коду и также переводится на русский.
