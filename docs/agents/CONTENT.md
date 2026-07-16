# CONTENT — Контент-пайплайн

> Контент — это данные, не код. JSON-файлы читаются при старте и валидируются через Zod.

---

## Где лежит контент

```
public/content/           # JSON-шаблоны: только механика (статы, пулы, ID)
├── entities/
│   ├── enemies/
│   ├── player/
│   ├── doors/
│   └── stairs/
├── items/
│   ├── weapons/
│   ├── armor/
│   ├── amulet/
│   └── consumables/
├── abilities/
├── statuses/             # Шаблоны статусов (длительность, категория, ruleIds)
└── maps/

src/content/texts/        # Пользовательские тексты: name, description, flavorText
├── ru.ts                 # Русские тексты врагов, предметов, способностей, статусов
├── en.ts                 # Английские тексты врагов, предметов, способностей, статусов
├── statuses.ts           # Локализованные описания эффектов статусов
└── lookup.ts             # getContentText(category, id, locale)
```

> **Важно:** JSON-шаблоны НЕ содержат `name`, `description`, `flavorText`. Все тексты живут в `src/content/texts/{ru,en}.ts` и мержатся с шаблоном через `getLocalizedItem()` / `getLocalizedEntity()`.

---

## Добавление контента

1. Создайте JSON-файл по существующей схеме.
2. Добавьте путь в `public/content/manifest.json`.
3. Пересборка не требуется.

Контент валидируется при загрузке через Zod. Невалидный контент приводит к fail-fast с понятным сообщением об ошибке.

---

## Реестр контента

- `loadAllContent(fetchJson)` — асинхронная загрузка всех JSON-файлов
- `getEntityTemplate(id)` — получить шаблон сущности
- `getItemTemplate(id)` — получить шаблон предмета

Реализация: `src/content/loader.ts`, `src/content/registry.ts`.

## Реестр статусов

- `getStatusTemplate(id)` — получить шаблон статуса.
- Шаблоны статусов хранятся в `public/content/statuses/` и ссылаются на `ruleIds` в `src/simulation/content-rules/`.
- Локализованные описания эффектов статусов живут в `src/content/texts/statuses.ts`.

---

## Что контент контролирует (и не контролирует)

**Контролирует:** только data values (статы, названия, пулы спавна).

**НЕ контролирует:**
- ❌ Игровую логику (как считается урон, как AI ведёт себя)
- ❌ Рендеринг (как рисуются спрайты)
- ❌ UI layout
- ❌ Формат сохранений

---

## Моддинг

Замена или добавление файлов в `public/content/` работает без изменения кода.

Ограничения:
- Должен проходить Zod-валидацию
- ID должны быть уникальны
- Нельзя переопределить core game logic
