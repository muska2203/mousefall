# Правила слоя I18N

> Работая в `src/i18n/` или добавляя/изменяя пользовательский текст в проекте, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Хардкод строк запрещён** — любой текст, видимый игроку, должен идти через i18n.
- **Все языковые файлы TypeScript** — не JSON. Type safety через `satisfies Resources`.
- **Fallback язык — русский** (`ru`). Английский (`en`) должен содержать зеркало каждого ключа.
- **Лимит 150 строк на файл перевода** — разбивай на подфайлы при росте.

---

## Структура

```
src/i18n/
  config.ts        # Инициализация i18next
  schema.ts        # Единая схема типов (источник truth для TS)
  i18next.d.ts     # Расширение типов i18next для type-safe переводов
  t.ts             # Wrapper i18next.t для кода вне React
  hooks.ts         # React hook wrapper
  locales/
    ru/            # Русские переводы
      common/
      screens/
      components/
      system/
      index.ts     # Агрегатор ruResources
    en/            # Английские переводы (зеркало ru/)
      index.ts     # Агрегатор enResources
```

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить строку в React UI | `src/i18n/locales/{ru,en}/<namespace>/...` + `schema.ts` |
| Добавить строку в Presentation / Simulation | `src/i18n/locales/{ru,en}/system/...` + `schema.ts` |
| Добавить текст врага/предмета/способности | `src/content/texts/{ru,en}.ts` (не в JSON!) |
| Изменить схему ключей | `src/i18n/schema.ts` |
| Добавить новый язык | Создать папку `locales/xx/` + подключить в `config.ts` |

---

## Правила именования ключей

- `camelCase`.
- Точка разделяет уровни вложенности: `gameSession.heroStatStrength`.
- Namespace НЕ входит в ключ при использовании через `useTranslation`.
- Namespace ВКЛЮЧАЕТСЯ в ключ при использовании через `t()` из `@i18n/t`.

---

## Разрешённые зависимости

- `src/i18n/` может импортировать только `i18next`, `react-i18next`, и свои внутренние модули.
- `src/i18n/` **не импортирует** `simulation/`, `presentation/`, `ui/`, `content/`.

---

## Полная документация

- [`docs/agents/I18N.md`](../docs/agents/I18N.md) — полное руководство по локализации
- [`docs/agents/CONTENT.md`](../docs/agents/CONTENT.md) — контент-пайплайн и тексты врагов/предметов
