# Save System

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Система сохранений использует **снапшоты**: всё игровое состояние сериализуется в JSON и сохраняется. Это простейший подход, корректно работающий для одиночного roguelike.

---

## Decision: Snapshot vs Event Sourcing

| Аспект | Snapshot | Event Sourcing |
|--------|----------|----------------|
| Реализация | Простая JSON serialize/deserialize | Сложный replay-движок |
| Время загрузки | Мгновенно | Пропорционально длине игры |
| Размер файла | Больше (полное состояние) | Меньше (только события) |
| Изменения кода | Безопасно | Опасно (старые события могут не replay-иться) |
| Отладка | Легко | Сложно |
| Solo dev | ✅ Практично | ❌ Overengineering |

**Решение:** Snapshot — правильный выбор для solo-developed roguelike. Event sourcing оправдан только для multiplayer или audit-trail.

---

## Save Data Structure

Сохранение — это метаданные + полный снапшот `GameState`.

Структура определена в `src/simulation/types.ts` (тип `GameState`). Zod-схема сохранений и модули миграции отсутствуют.

**Важно:** timestamp сохранения — только метаданные для отображения. Simulation не использует wall-clock time.

---

## Serialization

### Что сериализуется

Всё из `GameState`:
- Карта (2D массив тайлов)
- Сущности (включая игрока, врагов, предметы)
- Состояние ходов (активная сторона, номер раунда)
- RNG state (seed + текущее состояние — критично для детерминизма)
- Туман войны (visible/explored)
- Фаза игры (playing/dead/victory)
- Номер этажа

### Что НЕ сериализуется

- Дерево событий (эфемерно, очищается каждый ход)
- Состояние UI (выделенный тайл, открытые панели)
- Состояние Presentation (автопуть, анимационные планы)
- Content registry (перезагружается из JSON при старте)

Реализация: **не реализована** (модуль `src/simulation/serialization.ts` удалён).

---

## Storage Backends

### LocalStorage (по умолчанию)

- Ключи с префиксом `mousefall:save:`
- 3 ручных слота + 1 слот автосохранения (слот 0)

**Поток сохранения:**
1. Presentation запрашивает `simulation.getState()`
2. Presentation (или SaveManager) вызывает `serialize(gameState)` → JSON string
3. UI Layer выполняет запись в `localStorage` (единственный слой с доступом к browser API)

**Поток загрузки:**
1. UI Layer читает JSON из `localStorage`
2. Presentation вызывает `deserialize(json)` → `GameState`
3. Presentation создаёт новый экземпляр Simulation с загруженным состоянием

### File Export/Import (опционально)

- Export: JSON → Blob → download
- Import: File → text → deserialize

Реализация хранения планируется в UI Layer, сериализация/десериализация — в Simulation Layer.

---

## Save Slots

```typescript
// Метаданные слота для отображения в UI
// Не используются в simulation
type SaveSlotInfo = {
  slot: number;
  isEmpty: boolean;
  floorNumber?: number;
  turnNumber?: number;
  savedAt?: string;
  playerName?: string;
};
```

### Autosave

Триггеры:
- После каждого хода игрока
- Перед спуском на следующий этаж
- При game over (для post-mortem)

Autosave оркестрируется Presentation: после успешного `simulation.dispatch()` вызывается сохранение текущего состояния.

---

## Version Migration

При изменении формата сохранений старые сейвы должны мигрироваться.

```
raw save → migrateIfNeeded → Zod validation → GameState
```

**Правила миграции:**
- Только добавление полей (никогда удаление)
- Старые сохранения всегда должны загружаться
- Миграция применяется **до** Zod-валидации

Реализация миграций: отсутствует (если потребуется при появлении сохранений).

---

## Error Handling

| Ошибка | Причина | UI behavior |
|--------|---------|-------------|
| `SaveVersionError` | Несовпадение версии сохранения | Попытка миграции, предупреждение или ошибка |
| `SaveCorruptError` | Повреждённые данные | Диалог ошибки, предложение удалить corrupt save |

---

## RNG State in Saves

RNG state входит в `GameState` и сериализуется вместе с сохранением. Это гарантирует:
- Загрузка save даёт идентичные результаты продолжению с этого момента
- Детерминизм across save/load cycles

**Критично:** При загрузке восстанавливать **точное** RNG-состояние из сохранения. Никогда не сбрасывать.

---

## What This System Does NOT Support

- ❌ **Cloud saves** — вне скоупа
- ❌ **Cross-device sync** — вне скоупа
- ❌ **Replay from save** — снапшоты, не логи команд
- ❌ **Undo/redo** — используйте autosave
- ❌ **Save compression** — JSON читаем и отлаживаем; компрессия только если размер станет проблемой
