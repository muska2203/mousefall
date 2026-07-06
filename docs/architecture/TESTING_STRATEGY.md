# Testing Strategy

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Тестирование сфокусировано на **simulation layer** — единственном слое, содержащем игровую логику. UI и Presentation не юнит-тестируются (Presentation — оркестрация, UI — визуал).

Simulation layer **headless** (нет browser API), что делает тестирование тривиальным через Vitest.

---

## Testing Pyramid

```
        ┌─────────────┐
        │   Manual    │  Visual testing, gameplay feel
        │   Testing   │  (animations, UI)
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ Integration │  Full turn sequences, save/load
        │   Tests     │  (simulation + content)
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │    Unit     │  Individual systems, pure functions
        │    Tests    │  (movement, combat, AI, RNG, FOV)
        └─────────────┘
```

**Фокус:** Unit-тесты для систем simulation. Integration-тесты для последовательностей ходов и save/load.

---

## What Gets Tested

### ✅ Unit Tested (Simulation Layer)

| Модуль | Что тестировать |
|--------|----------------|
| `systems/actions/` | Валидация действий, разрешение в интенты, исполнение |
| `systems/intents/` | Мутации состояния, порождение событий |
| `systems/world-reactions/` | Реакции мира (смерть от урона и т.д.) |
| `systems/mapgen.ts` | Генерация порождает валидные карты, комнаты связаны |
| `utils/rng.ts` | Seeded RNG даёт детерминированные последовательности |

### ✅ Integration Tested

| Сценарий | Что тестировать |
|----------|----------------|
| Полный ход игрока | Move → AI отвечает → состояние консистентно |
| Боевая последовательность | Attack → damage → death |
| Переход этажа | Спуск → новая карта → игрок размещён |
| Save/load cycle | Пока не реализован |
| Game over | Игрок умирает → phase меняется → save сохраняется |

### ❌ NOT Unit Tested

| Модуль | Почему |
|--------|--------|
| React components | Визуальные, ручное тестирование |
| PixiJS renderer | Визуальный, ручное тестирование |
| Input handlers | Browser events, ручное тестирование |
| Presentation layer | Тонкая оркестрация, покрывается integration-тестами |

---

## Test File Structure

```
tests/
├── unit/
│   ├── simulation/        # Unit-тесты систем simulation
│   │   ├── systems/
│   │   ├── actions/
│   │   ├── intents/
│   │   ├── world-reactions/
│   │   ├── skills/
│   │   └── ai/
│   ├── presentation/      # Unit-тесты presentation
│   ├── ui/                # Unit-тесты утилит UI
│   └── utils/             # Тесты утилит (RNG, math)
├── integration/           # Последовательности ходов
└── fixtures/              # Предсобранные GameState для тестов
```

Фикстуры — это предсобранные `GameState`, делающие тесты читаемыми. См. `tests/fixtures/`.

---

## Test Environment

- **Runtime:** Node.js (не браузер)
- **Фреймворк:** Vitest
- **Конфиг:** `vitest.config.ts`

**`environment: 'node'`** — подтверждает, что simulation не имеет browser-зависимостей.

Coverage настроен на `src/simulation/**`. UI и Presentation исключены из измерения.

---

## Coverage Targets

| Модуль | Цель покрытия |
|--------|--------------|
| `simulation/systems/` | 90%+ |
| `simulation/rng.ts` | 100% |

| `simulation/mapgen.ts` | 80%+ |
| `ui/`, `presentation/` | Не измеряется |

---

## Testing Rules

1. **Без браузера** — `environment: 'node'`
2. **Детерминированность** — фиксированные seed для RNG (`createRNG(12345)`)
3. **Быстрота** — без async, без таймаутов
4. **Независимость** — нет общего мутабельного состояния между тестами
5. **Фикстуры вместо setup** — используйте предсобранные состояния из `tests/fixtures/`
6. **Тестируйте поведение, а не реализацию** — тестируйте что функция делает, не как

---

## Running Tests

```bash
# Запуск всех тестов
npm test

# С покрытием
npm run test:coverage

# По имени файла
npm test movement

# Watch mode
npm run test:watch
```

---

## Current Test Status

- ✅ Unit-тесты simulation (действия, интенты, реакции, скиллы, AI, генерация карт, RNG) — проходят.
- ✅ Unit-тесты presentation и UI — проходят.
- ✅ Integration-тесты ходов и перехода этажа — проходят.
- ⚠️ Save/load cycle — не тестируется, так как сохранения не реализованы (модуль `src/simulation/serialization.ts` удалён).
