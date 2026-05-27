# Правила слоя Content

> Работая в `src/content/` или `public/content/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Чистые данные и типы** — никакой игровой логики.
- **Read-only после инициализации**.
- **Не импортировать** `simulation/`, `presentation/`, `ui/`.
- **Fail fast** — невалидный контент должен падать с понятной ошибкой при загрузке.

---

## Структура

```
src/content/
  schemas.ts         # Zod-схемы и типы шаблонов
  registry.ts        # In-memory реестр загруженного контента
  loader.ts          # Async fetch + валидация JSON-контента

public/content/
  entities/          # Шаблоны врагов и игрока
  items/             # Оружие, броня, расходники
  abilities/         # Шаблоны способностей
  maps/              # Параметры генерации карт
```

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить новый шаблон сущности | `public/content/entities/...` + `manifest.json` |
| Изменить схему валидации | `src/content/schemas.ts` |
| Добавить поле в реестр | `src/content/registry.ts` + `loader.ts` |

---

## Добавление контента

1. Создать JSON-файл по существующей схеме.
2. Добавить путь в `public/content/manifest.json`.
3. Пересборка не требуется.

---

## Полная документация

- [`docs/agents/CONTENT.md`](../../docs/agents/CONTENT.md) — контент-пайплайн
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
