# SESSION_PROMPTS — Шаблоны промптов для перехода на protocol-driven работу

> Эти шаблоны рассчитаны на отдельные сессии, чтобы не забивать контекст. Каждый промпт — одна фаза или один тип задачи.

---

## Общие правила для всех сессий

1. В начале сессии агент читает:
   - `docs/agents/PROTOCOL.md` — чтобы классифицировать задачу;
   - `docs/agents/SYNC_STATUS.md` — чтобы понять, чему доверять;
   - `docs/agents/TRANSITION_PLAN.md` — чтобы видеть общий план и текущий статус.

2. Агент определяет тип задачи по `PROTOCOL.md` и следует соответствующему протоколу из `docs/agents/protocols/`.

3. Если задача завершает фазу из `TRANSITION_PLAN.md` — агент отмечает пункты `[x]` в плане.

4. Если контекст заполнен более чем на 70% — агент останавливается, кратко суммирует сделанное и указывает, с чего начать следующую сессию.

5. Агент не берёт задачи вне запрошенной фазы.

---

## Шаблон хэндоффа (если сессия прерывается)

В конце любой сессии агент может выдать блок:

```
## Сводка сессии
- Выполнено: [кратко]
- Изменённые файлы: [список]
- Открытые вопросы: [если есть]
- Следующая сессия начинается с: [конкретно]
```

---

## Этап 3. Аудит документации

### Сессия 3.1 — Ядро симуляции

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Проведи аудит актуальности трёх документов:
- docs/agents/ACTION_SYSTEM.md
- docs/agents/TURN_FLOW.md
- docs/agents/CONTENT.md

Для каждого документа:
1. Проверь, что все пути к файлам кода существуют.
2. Проверь, что примеры кода соответствуют текущей реализации.
3. Проверь, что чеклисты актуальны.
4. При мелком рассинхроне — исправь документ.
5. При серьёзном рассинхроне — переведи документ в [DRAFT] и занеси в docs/agents/SYNC_STATUS.md.

После выполнения:
- Обнови docs/agents/TRANSITION_PLAN.md: отметь выполненные пункты аудита.
- Если аудит завершён — обнови статус фазы 3.

Не меняй игровую логику. Только актуализация документации.
```

### Сессия 3.2 — Presentation, UI, тесты

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Проведи аудит актуальности:
- docs/agents/PRESENTATION_CONTRACT.md
- docs/agents/I18N.md
- docs/agents/TESTING.md

Проверь:
1. Все пути к файлам.
2. Примеры кода.
3. Чеклисты.
4. Соответствие текущей структуре src/presentation/ и src/i18n/.

Исправь мелочи сразу. Серьёзный рассинхрон — в [DRAFT] + docs/agents/SYNC_STATUS.md.

После выполнения обнови docs/agents/TRANSITION_PLAN.md.
```

### Сессия 3.3 — Контентные правила, тайлы, глоссарий

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Проведи аудит актуальности:
- docs/agents/CONTENT_RULES_EDGE_CASES.md
- docs/agents/TILE_EFFECTS.md
- docs/agents/LAYERS.md
- docs/agents/GLOSSARY.md

Проверь соответствие с src/simulation/content-rules/ и src/simulation/systems/.

Особое внимание:
- порядок слоёв правил;
- список поддерживаемых условий и эффектов;
- пути к исполнителям интентов.

Результат — обновлённые документы и/или записи в SYNC_STATUS.md.

После выполнения обнови docs/agents/TRANSITION_PLAN.md: отметь фазу 3 завершённой, если все аудиты пройдены.
```

---

## Этап 2. Расширенные рецепты

### Сессия 4.1 — Броня и амулеты

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Создай два рецепта:
1. docs/recipes/add-armor.md
2. docs/recipes/add-amulet.md

Ориентируйся на docs/recipes/add-weapon.md. Для примеров используй:
- public/content/items/armor/common_patch_cloak.json
- public/content/items/amulet/common_ember_amulet.json

Каждый рецепт должен содержать: шаблон JSON, куда тексты, как привязать ruleIds, чеклист.

После выполнения:
- Обнови docs/recipes/README.md.
- Обнови docs/agents/TRANSITION_PLAN.md: отметь созданные рецепты.
```

### Сессия 4.2 — Расходники и способности

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Создай два рецепта:
1. docs/recipes/add-consumable.md — на основе public/content/items/consumables/health_potion.json
2. docs/recipes/add-ability.md — на основе public/content/abilities/cleave.json

Учти, что способности могут требовать executor в src/simulation/skills/executors/.

После выполнения:
- Обнови docs/recipes/README.md.
- Обнови docs/agents/TRANSITION_PLAN.md.
```

### Сессия 4.3 — Тайловые эффекты и карты

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Создай два рецепта:
1. docs/recipes/add-tile-effect.md — на основе docs/agents/TILE_EFFECTS.md и public/content/tile-effects/oil.json
2. docs/recipes/add-map.md — на основе public/content/maps/floor_1.json

После выполнения:
- Обнови docs/recipes/README.md.
- Обнови docs/agents/TRANSITION_PLAN.md: отметь фазу 2 завершённой, если все рецепты созданы.
```

---

## Этап 5. Живые примеры контента

### Сессия 5.1 — Шаблоны для оставшихся типов

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Создай недостающие шаблоны в public/content/examples/:
- armor-template.json
- amulet-template.json
- consumable-template.json
- tile-effect-template.json
- map-template.json

Шаблоны должны быть валидными JSON, но не добавляй их в manifest.json.
Обнови public/content/examples/README.md.

После выполнения обнови docs/agents/TRANSITION_PLAN.md.
```

---

## Этап 4. Рефакторинг монолитных справочников

### Сессия 6.1 — ACTION_SYSTEM.md

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

docs/agents/ACTION_SYSTEM.md слишком большой. Раздели его:

1. В docs/agents/ACTION_SYSTEM.md оставь только общие принципы Action → Intent → Event, ExecutionBuilder, правило «IntentExecutor не исполняет другие интенты». Цель — не больше 80 строк.
2. Создай docs/recipes/add-action.md — чеклист добавления нового Action.
3. Создай docs/recipes/add-event.md — чеклист добавления нового Event.
4. docs/recipes/add-intent.md уже есть — используй как образец.

Не меняй игровую логику. Только реструктуризация документации.

После выполнения обнови docs/agents/TRANSITION_PLAN.md.
```

### Сессия 6.2 — CONTENT_RULES_EDGE_CASES.md

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md
- docs/agents/TRANSITION_PLAN.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

docs/agents/CONTENT_RULES_EDGE_CASES.md остаётся справочником по edge cases, но чеклист добавления нового правила уже вынесен в docs/recipes/add-content-rule.md. Убедись, что ссылки между документами консистентны.

Укороти документ, убрав дублирование с рецептом. Если при этом обнаружится устаревшая информация — исправь или занеси в SYNC_STATUS.md.

После выполнения обнови docs/agents/TRANSITION_PLAN.md.
```

---

## Этап 6. Валидация нового подхода

### Сессия 7.1 — Тестовая задача на контент

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Добавь тестового врага "rat_scout":
- 10 HP, 2 AP
- стратегия hunter
- оружие common_venom_dagger
- lootTable с health_potion
- текст в ru/entities.ts и en/entities.ts

Используй рецепт docs/recipes/add-enemy.md.

После выполнения отчитайся: сработал ли протокол, были ли проблемы.
```

### Сессия 7.2 — Тестовая задача на системную механику

```
Перед задачей прочитай:
- docs/agents/PROTOCOL.md
- docs/agents/SYNC_STATUS.md

Определи тип задачи по PROTOCOL.md и следуй протоколу.

Сделай так, чтобы огненный урон с шансом 30% накладывал статус burning на 2 хода при попадании по цели, находящейся в тайловом эффекте oil.

Используй двухфазный режим: сначала предложи план, потом реализуй.

После выполнения отчитайся: сработал ли протокол, были ли проблемы.
```

---

## Рекомендуемый порядок сессий

1. Аудит ядра симуляции.
2. Аудит presentation / i18n / testing.
3. Аудит content-rules / tile-effects / glossary.
4. Рецепты: броня + амулет.
5. Рецепты: расходник + способность.
6. Рецепты: тайловый эффект + карта.
7. Шаблоны для оставшихся типов контента.
8. Рефакторинг ACTION_SYSTEM.md.
9. Тестовая задача на контент.
10. Тестовая задача на системную механику.

---

## Почему эти промпты лучше базовых

| Что добавлено | Зачем |
|---|---|
| `TRANSITION_PLAN.md` в преамбуле | Агент видит общий план и не повторяет уже сделанное. |
| Обязательное обновление `TRANSITION_PLAN.md` | Прогресс фиксируется в репозитории, а не только в контексте сессии. |
| Чёткие границы сессии | Один тип задачи = меньше контекста. |
| Хэндофф-шаблон | Если сессия прерывается, следующая начнётся без потерь. |
| Лимит контекста 70% | Предотвращает деградацию качества в конце сессии. |
