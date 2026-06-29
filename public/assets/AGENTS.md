# AGENTS.md — Assets

> Правила для AI-агентов, работающих с игровыми ассетами в `public/assets/`.

---

## Структура

```
public/assets/
├── actors/        # Спрайты игрока
├── enemies/       # Спрайты врагов
├── items/         # Спрайты предметов
├── skills/        # Иконки способностей
├── statuses/      # Иконки статус-эффектов и главного статуса
├── objects/       # Двери, лестницы, сундуки
├── tiles/         # Тайлы пола и стен
├── portraits/     # Портреты персонажей
└── icons/         # SVG-иконки HUD
```

---

## Добавление нового спрайта

1. Поместите PNG-файл в соответствующую подпапку.
2. Рекомендуемый размер для иконок статусов — **32×32 px**.
3. Убедитесь, что путь совпадает с соглашением в `src/ui/renderer/spriteRegistry.ts`.

---

## Генерация заглушек

Для быстрого получения простого цветного квадрата-заглушки используйте скрипт:

```bash
python scripts/gen-placeholder-sprite.py --name <name> --dir public/assets/statuses --size 32 --color "#RRGGBB"
```

Подробности и примеры — в `scripts/README.md`.

---

## Соглашения

- Имена файлов совпадают с ключами, которые использует `spriteRegistry.ts`.
- Статусы-эффекты: `public/assets/statuses/<statusType>.png`.
- Главный статус (AI-режим или overlay): `public/assets/statuses/<primaryStatus>.png`.
- Способности: `public/assets/skills/<spriteId>.png`.
