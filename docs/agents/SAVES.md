# SAVES — Система сохранений

> Снапшотные сохранения. Полный `GameState` сериализуется в JSON.

---

## Общие принципы

- `SAVE_VERSION = 1` в `src/utils/constants.ts`.
- Состояние RNG включается в сохранения для детерминизма.
- Хранение: `localStorage` с префиксом ключей `mousefall:save:`.
- 3 ручных слота + 1 слот автосохранения (слот 0).
- **Оркестрация save/load** — ответственность Presentation.

---

## Что сериализуется

Всё из `GameState`:
- Карта (2D массив тайлов)
- Сущности (включая игрока, врагов, предметы)
- Состояние ходов (активная сторона, номер раунда)
- RNG state (seed + текущее состояние)
- Туман войны (visible/explored)
- Фаза игры (playing/dead/victory)
- Номер этажа

---

## Что НЕ сериализуется

- Дерево событий (эфемерно)
- Состояние UI (выделенный тайл, открытые панели)
- Состояние Presentation (автопуть, анимационные планы)
- Content registry (перезагружается при старте)

---

## Поток сохранения

```
Пользователь выбирает "Сохранить"
    │
    ▼
Presentation: simulation.getState() → Readonly<GameState>
    │
    ▼
Presentation: serialize(gameState) → JSON string
    │
    ▼
UI Layer: localStorage.setItem('mousefall:save:slot', json)
```

---

## Поток загрузки

```
Пользователь выбирает "Загрузить"
    │
    ▼
UI Layer: localStorage.getItem('mousefall:save:slot') → JSON string
    │
    ▼
Presentation: deserialize(json) → GameState
    │
    ├── Zod validation (throws on corrupt save)
    └── Version check (warns on version mismatch)
    │
    ▼
Presentation создаёт новый экземпляр Simulation с загруженным состоянием
    │
    ▼
Presentation обновляет ViewModel → UI перерисовывается
```

---

## Миграции версий

При изменении формата сохранений:
```
raw save → migrateIfNeeded → Zod validation → GameState
```

Правила:
- Только добавление полей (никогда удаление)
- Старые сохранения всегда должны загружаться
- Миграция применяется **до** Zod-валидации

---

## Статус реализации

- `src/simulation/serialization.ts` — сейчас полностью закомментирован; save/load заблокирован.
- Save/load UI — зависит от восстановления `serialization.ts`.
