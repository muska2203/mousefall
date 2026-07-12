# Фаза 1.1. Инвентаризация мировых реакций

> Результат аудита текущего реестра мировых реакций.
> Все реакции распределены на **системные** (инварианты мира) и **контентные** (data-driven правила в будущем).

---

## Источник истины

- Реестр реакций: `src/simulation/systems/world-reactions/reactions.ts`
- Тип реакции: `src/simulation/systems/world-reactions/types.ts`
- Исполнительный цикл: `src/simulation/systems/intents/execute-intent.ts`

---

## Классификация

| Реакция | Файл | Триггер | Priority | Порождаемые интенты | Классификация | Обоснование |
|---|---|---|---|---|---|---|
| `deathReaction` | `death-reaction.ts` | `ENTITY_DAMAGED` | 0 | `DIE` | **Системная** | Смерть при `hp <= 0` — неизменный инвариант мира. |
| `postDeathLootReaction` | `post-death-loot-reaction.ts` | `ENTITY_DIED` | 0 | `SPAWN_ITEM` | **Системная** | Дроп лута из шаблона сущности — инфраструктура, не зависит от контента предметов/статусов. |
| `displacementMoveReaction` | `displacement-move-reaction.ts` | `ENTITY_DISPLACED` | 0 | `MOVE` | **Системная** | Геометрическое разрешение толчка. Без неё `PUSH` не превращается в перемещение. |
| `floorTransitionReaction` | `floor-transition-reaction.ts` | `FLOOR_CHANGED` | 0 | `SET_MAP`, `SET_ENTITIES`, `TELEPORT_ENTITY`, `BEGIN_TURN`, `RESTORE_AP`, `APPLY_FOG_EVENTS` | **Системная** | Атомарное применение плана перехода между этажами. |
| `aiPerceptionReaction` | `ai-perception-reaction.ts` | `ENTITY_MOVED`, `DOOR_OPENED`, `DOOR_CLOSED` | 0 | `NOTIFY_AI` | **Системная** | Уведомление AI о значимых изменениях мира. |
| `fireDamageReaction` | `fire-damage-reaction.ts` | `ENTITY_DAMAGED` | -1 | `APPLY_STATUS` (`burning`) | **Контентная** | Правило «огненный урон поджигает». Зависит от тега урона и статуса. Пилотная реакция для переноса. |
| `collisionDamageReaction` | `collision-damage-reaction.ts` | `ENTITY_COLLIDED` | 0 | `DAMAGE` | **Контентная** | Базовая физика столкновений. Будет мировым контентным правилом. |
| `collisionStunReaction` | `collision-stun-reaction.ts` | `ENTITY_COLLIDED` | 1 | `APPLY_STATUS` (`stunned`) | **Контентная** | Базовая физика столкновений. Будет мировым контентным правилом. |
| `burningTickReaction` | `burning-tick-reaction.ts` | `STATUS_TICKED` | 0 | `DAMAGE` | **Контентная** | Урон от тика статуса. Зависит от статуса `burning`. |
| `counterAttackReaction` | `counter-attack-reaction.ts` | `ENTITY_DAMAGED`, `COUNTER_ATTACK_APPLIED` | 1 / 0 | `COUNTER_ATTACK`, `DAMAGE` | **Контентная** | Правило от статуса/скилла `counterattack`. Hardcoded сейчас, но по семантике — контентное. |

---

## Примечания к пограничным случаям

### `displacementMoveReaction`

Хотя эта реакция касается толчка, она не описывает боевой эффект, а решает инфраструктурную задачу: успешное отталкивание должно превратиться в перемещение сущности. Если в будущем появится контент, изменяющий логику отталкивания (например, телепорт вместо шага), он будет реализован отдельным контентным правилом с более высоким приоритетом или альтернативным эффектом. Базовая `displacementMoveReaction` остаётся системной.

### `counterAttackReaction`

Сейчас реакция жёстко привязана к статусу `counterattack` и проверяет теги входящего урона. В новой системе это станет правилом статуса/скилла с `trigger: ENTITY_DAMAGED` и условиями на теги. Пока она остаётся hardcoded, но классифицируется как контентная для целей миграции.

### `postDeathLootReaction`

Реакция читает `lootTable` из шаблона врага. Это системная инфраструктура, потому что механизм дропа не зависит от активных правил экипировки/статусов/талантов. Сами таблицы лута — контент, но реакция, порождающая `SPAWN_ITEM`, — системная.

---

## Результат

- Все существующие реакции распределены.
- Нет нераспределённых реакций.
- Контентные реакции (`fireDamageReaction`, `collisionDamageReaction`, `collisionStunReaction`, `burningTickReaction`, `counterAttackReaction`) планируются к переносу в `ContentRuleReaction` в фазах 4–5.
- Системные реакции остаются кодом на всех фазах миграции.
