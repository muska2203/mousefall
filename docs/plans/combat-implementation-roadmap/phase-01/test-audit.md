# Фаза 1.4. Аудит тестов и фикстур боевых сценариев

> Результат аудита существующих тестов, guardian-набора и пробелов в покрытии.
> Baseline на момент фазы 1: **111 тестовых файлов, 880 тестов, все проходят** (`npm test`).

---

## Фикстуры

- `tests/fixtures/gameState.ts` — минимальные валидные `GameState`, `PlayerEntity`, `EnemyEntity`, карта, предметы.
- Дополнительные фикстуры используются в конкретных тестах (например, предметы, способности, карты).

---

## Guardian tests

Guardian tests — это тесты, которые обязаны проходить на каждом этапе миграции. Они покрывают критические боевые цепочки и инфраструктуру хода.

### Боевые цепочки

| Файл | Что покрывает | Почему guardian |
|---|---|---|
| `tests/integration/loot-drop-cycle.test.ts` | Атака → урон → смерть врага → дроп → поднятие лута | Полная цепочка боевого сценария. |
| `tests/unit/simulation/intent-executors.test.ts` | `executeDamageIntent`, `executeDieIntent`, `executeMoveIntent`, цепочки реакций | Ядро исполнителей и рекурсия реакций. |
| `tests/unit/simulation/damage-handlers.test.ts` | Физический/магический урон, броня | Корректность расчёта урона. |
| `tests/unit/simulation/deferred-deletion.test.ts` | Смерть, `isAlive=false`, отложенное удаление | Инварианты жизненного цикла сущности. |
| `tests/unit/simulation/world-reactions/fire-damage-reaction.test.ts` | Горение от огненного урона | Пилотная реакция для переноса. |
| `tests/unit/simulation/world-reactions/collision-reactions.test.ts` | Урон и стан от столкновений | Базовая физика, переносимая в контентные правила. |
| `tests/unit/simulation/world-reactions/burning-tick-reaction.test.ts` | Урон при тике горения | Статус-эффект → урон. |
| `tests/unit/simulation/world-reactions/counter-attack-reaction.test.ts` | Контратака по тегам и статусу | Контентная реакция, требующая переноса. |
| `tests/unit/simulation/status-effects/burning.test.ts` | Тики горения, смерть от горения | Жизненный цикл статуса. |
| `tests/unit/simulation/status-effects/stun.test.ts` | Оглушение, пропуск хода | Инфраструктура хода + статус. |
| `tests/unit/simulation/status-effects/tick-phases.test.ts` | Фазы тиков статусов | Порядок тиков в ходе. |
| `tests/unit/simulation/skills/cleave.test.ts` | AoE-урон | Несколько целей, теги. |
| `tests/unit/simulation/skills/fireball.test.ts` | Огненный урон по области | Пилотный сценарий огня. |
| `tests/unit/simulation/skills/suddenStrike.test.ts` | Урон с условиями | Модификаторы скилла. |
| `tests/unit/simulation/skills/counterattack.test.ts` | Контратака | Скилл + статус + реакция. |
| `tests/unit/simulation/actions/attack-action.test.ts` | Действие атаки | Валидация, порождение DAMAGE. |
| `tests/unit/simulation/actions/use-ability-action.test.ts` | Действие способности | ABILITY_USED → интенты. |
| `tests/unit/simulation/actions/equip-action.test.ts` | Экипировка | EQUIP_ITEM → ITEM_EQUIPPED. |
| `tests/unit/simulation/intents/equip-item-intent.test.ts` | Исполнитель экипировки | Добавление правил в activeRules в будущем. |
| `tests/unit/simulation/ap-system.test.ts` | Расход и восстановление AP | Инфраструктура хода. |
| `tests/unit/simulation/faction-scheduler.test.ts` | Порядок ходов фракций | Инфраструктура хода. |
| `tests/unit/simulation/environment-turn.test.ts` | Ход окружения | Тики не-акторов. |

### Инфраструктура хода и системные реакции

| Файл | Что покрывает |
|---|---|
| `tests/unit/simulation/faction-scheduler.test.ts` | Порядок фракций, сетап, round recovery. |
| `tests/unit/simulation/ap-system.test.ts` | Расход AP, восстановление. |
| `tests/unit/simulation/environment-turn.test.ts` | Тики окружения. |
| `tests/unit/simulation/intents/begin-turn-intent.test.ts` | BEGIN_TURN. |
| `tests/unit/simulation/intents/restore-ap-intent.test.ts` | RESTORE_AP. |
| `tests/unit/simulation/intents/tick-cooldown-intent.test.ts` | TICK_COOLDOWN. |
| `tests/unit/simulation/intents/cleanup-dead-entities-intent.test.ts` | CLEANUP_DEAD_ENTITIES. |
| `tests/unit/simulation/world-reactions/ai-perception-reaction.test.ts` | AI-уведомления. |
| `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts` | Переход этажа. |
| `tests/integration/equipment-ability-cycle.test.ts` | Экипировка даёт/забирает скилл. |

---

## Пробелы в покрытии, критичные для новой системы

| Пробел | Почему критично | Когда закрывать |
|---|---|---|
| Нет тестов на `activeRules` | Новая система полностью построена вокруг кэша правил. | Фаза 2 (введение абстракций). |
| Нет тестов на `RuleContext` builder | Контекст — основа триггеров и условий правил. | Фаза 2–3. |
| Нет тестов на модификаторы урона (`MODIFY_DAMAGE`) | Ключевая фаза боевой системы. | Фаза 3 (пилот модификатора огня). |
| Нет тестов на селекторы целей (`allInRadius`, `nearestEnemy`, `chain`) | Ауры и мультитаргетные эффекты. | Фаза 4–5 (по мере переноса). |
| Нет тестов на параметризованные значения (`ParametrizedValue`) | Формулы вроде «лечение на 50% от урона». | Фаза 4–5. |
| Нет тестов на статус `dazed` | В концепте `dazed` — промежуточный статус перед `stunned`. | Фаза 4 (перенос collision-реакций). |
| Нет тестов на тайловые эффекты (`water`, `oil`, `fog`) | Базовые стихийные комбо. | Фаза 5 (перенос мировых контентных правил). |
| Нет тестов на `STATUS_BLOCKED` | Разрешение конфликтов статусов. | Фаза 4–5. |
| Нет тестов на `EXPLOSION_TRIGGERED`, `IGNITE_TILE_EFFECT` | Сложные зональные эффекты. | Фаза 5 и далее. |

---

## План покрытия по фазам

### Фаза 2. Введение абстракций

- Тесты на добавление/удаление правил в `activeRules` при `EQUIP_ITEM`, `UNEQUIP_ITEM`, `STATUS_APPLIED`, `STATUS_REMOVED`, `GRANT_ABILITY`, `REVOKE_ABILITY`.
- Тесты на построение `RuleContext` для `ENTITY_DAMAGED` и `DAMAGE_INTENT`.
- Тесты на сортировку правил по слоям и приоритетам.

### Фаза 3. Пилот

- Тесты на реакцию «огненный урон → горение» через `ContentRuleReaction`.
- Тесты на модификатор «огненный урон ×1,5».
- Тесты на feature-flag в `Simulation`: пилот включён / выключен.
- Тесты на изоляцию старой `fireDamageReaction` во время пилота.

### Фаза 4. Параллельный перенос

- Тесты на контентные правила столкновений (`collision_damage`, `collision_daze`).
- Тесты на статус `dazed` и его взаимоисключение со `stunned`.
- Тесты на контентные правила от оружия (рубящее → кровотечение, дробящее → оглушение, колющее → крит).
- Тесты на `REMOVE_STATUS`, `blockedBy`, `STATUS_BLOCKED`.

### Фаза 5. Переключение

- Тесты на тайловые эффекты: `water_applies_wet`, `oil_ignites_on_fire_damage`, `burning_oil_applies_burning`.
- Тесты на `EXPLOSION_TRIGGERED` и `IGNITE_TILE_EFFECT`.
- Интеграционный тест: полный боевой сценарий от атаки до смерти/лута без старых контентных реакций.

### Фаза 5.5. Адаптация Presentation

- Тесты на отображение новых событий в `logBuilder` и анимациях.

### Фаза 6. Полировка

- Тесты на лимит цепочки реакций (1000).
- Тесты на детерминированность рандома в правилах.
- Тесты на производительность большого количества правил.

---

## Риски

| Риск | Как заметить | Митигация |
|---|---|---|
| Низкое покрытие боевых цепочек | Миграция ломает поведение, а тесты не ловят. | Каждая фаза сопровождается добавлением тестов перед или одновременно с кодом. |
| Тесты зависят от деталей старой реализации | Приходится переписывать тесты вместо дополнения. | Новые тесты проверяют вход-выход, а не внутренние детали. Старые guardian tests сохраняются. |

---

## Результат

- Guardian tests зафиксированы.
- Пробелы в покрытии идентифицированы.
- План покрытия привязан к фазам миграции.
- Все существующие тесты проходят (`npm test`).
