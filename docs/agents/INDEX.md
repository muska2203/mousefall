# INDEX — Навигация по документации для агентов

> Если ты агент, начни с этого файла. Он скажет, куда идти.

---

## Быстрый старт

1. **Первый раз в проекте?** → прочитай [`ONBOARDING.md`](./ONBOARDING.md)
2. **Агент, начинаешь задачу?** → прочитай [`PROTOCOL.md`](./PROTOCOL.md) и [`SYNC_STATUS.md`](./SYNC_STATUS.md)
3. **Работаешь в конкретной папке `src/X/`?** → прочитай `src/X/AGENTS.md` (локальные правила)
4. **Ищешь ответ на конкретный вопрос?** → используй таблицу ниже

---

## Карта документации

| Вопрос / Задача | Файл |
|-----------------|------|
| Какой стек, команды, структура проекта? | [`ONBOARDING.md`](./ONBOARDING.md) |
| Какие слои, кто от кого зависит, что запрещено? | [`LAYERS.md`](./LAYERS.md) |
| Как добавить Action / Intent / Event? | [`ACTION_SYSTEM.md`](./ACTION_SYSTEM.md) |
| Как работает фракционный ход? | [`TURN_FLOW.md`](./TURN_FLOW.md) |
| Как устроен AI врагов и реестр тактических утилит? | [`AI_SYSTEM.md`](./AI_SYSTEM.md) |
| Как писать тесты, какие цели покрытия? | [`TESTING.md`](./TESTING.md) |
| Как добавить контент (врага, предмет, карту)? | [`CONTENT.md`](./CONTENT.md) |
| Как работают контентные правила? | [`CONTENT_RULES_EDGE_CASES.md`](./CONTENT_RULES_EDGE_CASES.md) |
| Где описан концепт боевой системы? | [`../plans/Концепт боевой системы.md`](../plans/Концепт%20боевой%20системы.md) |
| Где архитектурный обзор боевой системы? | [`../plans/Архитектура_боевой_системы_на_основе_реакций.md`](../plans/Архитектура_боевой%20системы%20на%20основе%20реакций.md) |
| Каталог стартовых правил | [`../design/starting-rules-catalog.md`](../design/starting-rules-catalog.md) |
| Архитектура тайловых эффектов | [`../architecture/TILE_EFFECTS.md`](../architecture/TILE_EFFECTS.md) |
| Как добавить тайловый эффект? | [`TILE_EFFECTS.md`](./TILE_EFFECTS.md) |
| Как работают сохранения и загрузки? | [`SAVES.md`](./SAVES.md) |
| Как добавить/изменить перевод или текст? | [`I18N.md`](./I18N.md) |
| Что означает термин X? | [`GLOSSARY.md`](./GLOSSARY.md) |

---

## Локальные правила по папкам

| Папка | Локальный AGENTS.md |
|-------|---------------------|
| `src/simulation/` | [`src/simulation/AGENTS.md`](../../src/simulation/AGENTS.md) |
| `src/presentation/` | [`src/presentation/AGENTS.md`](../../src/presentation/AGENTS.md) |
| `src/ui/` | [`src/ui/AGENTS.md`](../../src/ui/AGENTS.md) |
| `src/content/` | [`src/content/AGENTS.md`](../../src/content/AGENTS.md) |
| `src/i18n/` | [`src/i18n/AGENTS.md`](../../src/i18n/AGENTS.md) |

---

## Планы и roadmaps

| Функциональность | Файл |
|------------------|------|
| Актуальный план разработки | [`../../roadMap.md`](../../roadMap.md) |

---

## Поведение агента и статус документации

| Вопрос / Задача | Файл |
|-----------------|------|
| Как агенту классифицировать задачу и что читать? | [`PROTOCOL.md`](./PROTOCOL.md) |
| Каким системам доверять, а где источник правды — код? | [`SYNC_STATUS.md`](./SYNC_STATUS.md) |
| Каков план перехода на новый подход? | [`TRANSITION_PLAN.md`](./TRANSITION_PLAN.md) |
| Где шаблоны промптов для следующих сессий? | [`SESSION_PROMPTS.md`](./SESSION_PROMPTS.md) |
| Какие рецепты для типовых задач есть? | [`docs/recipes/README.md`](../recipes/README.md) |

---

## Архитектурные справочники (глубже и подробнее)

Если нужно глубже разобраться в потоках данных или событий:

| Тема | Файл |
|------|------|
| Поток данных от ввода до экрана | [`../architecture/DATA_FLOW.md`](../architecture/DATA_FLOW.md) |
| Жизненный цикл доменных событий | [`../architecture/EVENT_FLOW.md`](../architecture/EVENT_FLOW.md) |
| Общий архитектурный обзор | [`../architecture/OVERVIEW.md`](../architecture/OVERVIEW.md) |
| Детали контент-пайплайна | [`../architecture/CONTENT_PIPELINE.md`](../architecture/CONTENT_PIPELINE.md) |
| Детали системы сохранений | [`../architecture/SAVE_SYSTEM.md`](../architecture/SAVE_SYSTEM.md) |
| Тайловые эффекты | [`../architecture/TILE_EFFECTS.md`](../architecture/TILE_EFFECTS.md) |
| Боевая система на основе реакций | [`../plans/Архитектура_боевой_системы_на_основе_реакций.md`](../plans/Архитектура_боевой%20системы%20на%20основе%20реакций.md) |

---

## Язык документации

**Вся документация, комментарии к коду и текстовые сопровождения в проекте пишутся на русском языке.**
Исключение: имена переменных, типов, функций и ключей в коде — на английском.
