# ONBOARDING — Быстрый старт для агентов

> **Статус:** `[STABLE]` — общая информация о проекте актуальна.
> **Источник правды:** этот файл.

> **Mousefall** — 2D пошаговый roguelike на TypeScript, работающий в браузере.
> Архитектура строго слоистая, с безголовым (headless) детерминированным игровым движком в центре.
> Приоритеты: простота, тестируемость, чёткое разделение ответственности.

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

## Команды

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
  content/             # Реестр контента: Zod-схемы, загрузчик, read-only доступ
    schemas.ts         # Zod-схемы и типы шаблонов
    registry.ts        # In-memory реестр загруженного контента
    loader.ts          # Async fetch + валидация JSON-контента
  simulation/          # Ядро игры (headless, детерминированное)
    systems/           # Игровые системы
      actions/         # Обработчики действий
      intents/         # Исполнители интентов
      world-reactions/ # Реакции мира на события
    ai/                # AI-стратегии и вспомогательные утилиты
  presentation/        # Слой-оркестратор между UI и Simulation
  ui/                  # React, PixiJS, ввод, отрисовка, анимация
    animation/
    components/
    input/
    renderer/
    screens/
    styles/
  i18n/                # Локализация: i18next, схемы, переводы
    locales/
  utils/               # Чистые утилиты

public/
  assets/              # Графические ассеты
  content/             # Игровой контент в JSON (модифицируемый)
    abilities/
    entities/
      enemies/
      player/
      doors/
      stairs/
    items/
      weapons/
      armor/
      amulet/
      consumables/
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

## Ключевые файлы

| Задача | Файл |
|--------|------|
| Понять форму состояния игры | `src/simulation/types.ts` |
| Добавить новую игровую систему | `src/simulation/systems/` + `src/simulation/types.ts` |
| Добавить новый тип действия | `src/simulation/core-types.ts` (union `GameAction`) |
| Добавить новый тип события | `src/simulation/core-types.ts` (union `GameEvent`) |
| Добавить контент (враг, предмет, карта) | `public/content/` + `src/content/loader.ts` |
| Изменить генерацию карт | `src/simulation/systems/mapgen.ts` |
| Добавить тест | `tests/unit/simulation/` или `tests/integration/` |
| Изучить схемы контента | `src/content/schemas.ts` |
| Понять поток хода | `src/simulation/simulation.ts` (`GameSimulation.dispatch` / `GameSimulation.step`) |
| Понять переход между этажами | `src/simulation/systems/world-reactions/floor-transition-reaction.ts` |
| Добавить или изменить перевод | `src/i18n/schema.ts` + `src/i18n/locales/` |
| Добавить текст врага/предмета | `src/content/texts/{ru,en}.ts` |

---

## Соглашения об именовании файлов

```
src/simulation/systems/movement.ts      # System files: lowercase
src/simulation/types.ts                 # Types: lowercase
src/presentation/gameSession.ts         # Presentation: PascalCase для классов
src/ui/components/Grid.tsx              # React components: PascalCase
src/ui/renderer/WorldRenderer.ts        # Renderer classes: PascalCase
public/content/entities/cat_small.json  # Content: lowercase
```

---

## Дальше

- **Правила слоёв и зависимостей** → [`LAYERS.md`](./LAYERS.md)
- **Система действий** → [`ACTION_SYSTEM.md`](./ACTION_SYSTEM.md)
- **Тестирование** → [`TESTING.md`](./TESTING.md)
