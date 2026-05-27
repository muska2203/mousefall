# TESTING — Правила тестирования

> Тестирование сфокусировано на **simulation layer** — единственном слое, содержащем игровую логику.

---

## Среда

- **Runtime:** Node.js (не браузер).
- **Фреймворк:** Vitest.
- **Конфиг:** `vitest.config.ts`.

---

## Цели покрытия

| Путь | Цель |
|------|------|
| `src/simulation/systems/actions/` | 90%+ |
| `src/simulation/systems/intents/` | 90%+ |
| `src/simulation/systems/world-reactions/` | 90%+ |
| `src/simulation/systems/mapgen.ts` | 80%+ |
| `src/utils/rng.ts` | 100% |
| `src/simulation/serialization.ts` | 90%+ |
| `src/ui/`, `src/presentation/` | Не измеряется |

---

## Правила написания тестов

1. **Без браузера** — `environment: 'node'`.
2. **Детерминированность** — фиксированные seed для RNG (`createRNG(12345)`).
3. **Быстрота** — без async, без таймаутов.
4. **Независимость** — нет общего мутабельного состояния между тестами.
5. **Фикстуры вместо setup** — используйте готовые состояния из `tests/fixtures/`.
6. **Тестируйте поведение, а не реализацию**.

---

## Запуск тестов

```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage

# По имени файла
npm test movement

# По имени теста
npm test -- -t "moves player to valid adjacent tile"

# Watch mode
npm run test:watch
```

---

## Структура тестов

```
tests/
├── unit/
│   ├── simulation/        # Unit-тесты систем simulation
│   ├── presentation/      # Unit-тесты presentation (мокаем Simulation)
│   ├── ui/                # Unit-тесты утилит UI
│   └── utils/             # Тесты утилит (RNG, math)
├── integration/           # Последовательности ходов, save/load
└── fixtures/              # Предсобранные GameState для тестов
```

---

## Что тестировать, а что нет

### ✅ Unit-тестируем (Simulation)
- Валидация действий, разрешение в интенты, исполнение
- Мутации состояния, порождение событий
- Реакции мира (смерть от урона и т.д.)
- Генерация карт (валидность, связность комнат)
- Seeded RNG (детерминированность)
- Round-trip serialize/deserialize

### ✅ Интеграционно тестируем
- Полный ход игрока → AI отвечает → состояние консистентно
- Боевая последовательность: Attack → damage → death
- Save/load cycle
- Переход этажа

### ❌ НЕ юнит-тестируем
- React-компоненты (визуальные)
- PixiJS renderer (визуальный)
- Input handlers (browser events)
- Presentation layer (тонкая оркестрация)
