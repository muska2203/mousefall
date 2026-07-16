# Scripts

Вспомогательные скрипты проекта Mousefall.

---

## `generate-manifest.js`

Сканирует `public/content/` и перегенерирует `public/content/manifest.json`.

Запуск:

```bash
node scripts/generate-manifest.js
```

Вызывается автоматически перед `npm run dev` и `npm run build`.

---

## `validate-content.ts`

Валидирует JSON-контент из `public/content/`:

- ссылки `ruleIds` на декларативные правила,
- семантику правил (статусы, формулы урона, способности),
- наличие переводов для всех content ID в `ru` и `en`.

Запуск:

```bash
npm run validate:content
```

Также входит в состав `npm run validate`.

---

## `gen-swoop-sprite.py`

Генерирует иконку способности `swoop` в `public/assets/skills/swoop.png`.

Запуск:

```bash
python scripts/gen-swoop-sprite.py
```

---

## `gen-placeholder-sprite.py`

Генератор простых PNG-заглушек: однотонный цветной квадрат произвольного размера.

### Зачем нужен

Быстро получить визуальный ассет для нового статуса, способности или предмета, который потом заменят настоящей иконкой.

### Параметры

| Параметр | Обязательный | Описание | По умолчанию |
|----------|--------------|----------|--------------|
| `--name` | Да | Имя файла без расширения `.png` | — |
| `--dir` | Да | Директория для сохранения | — |
| `--size` | Нет | Размер квадрата в пикселях | `32` |
| `--color` | Нет | Цвет в формате `#RRGGBB` или `#RGB` | `#808080` |

### Примеры

Одна иконка 32×32:

```bash
python scripts/gen-placeholder-sprite.py --name idle --dir public/assets/statuses --size 32 --color "#4caf50"
```

Несколько иконок подряд (bash / Git Bash):

```bash
python scripts/gen-placeholder-sprite.py --name idle    --dir public/assets/statuses --color "#4caf50"
python scripts/gen-placeholder-sprite.py --name alert   --dir public/assets/statuses --color "#ffeb3b"
python scripts/gen-placeholder-sprite.py --name chase   --dir public/assets/statuses --color "#f44336"
python scripts/gen-placeholder-sprite.py --name return  --dir public/assets/statuses --color "#2196f3"
python scripts/gen-placeholder-sprite.py --name casting --dir public/assets/statuses --color "#9c27b0"
python scripts/gen-placeholder-sprite.py --name prepared --dir public/assets/statuses --color "#ff9800"
```

### Зависимости

Скрипт работает без сторонних библиотек. Если установлен **Pillow**, используется он; иначе PNG генерируется вручную через `zlib`/`struct`.
