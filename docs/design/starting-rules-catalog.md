# Каталог стартовых контентных правил (WP6.3)

> Статус: утверждёно для MVP первого этажа.
> Цель: зафиксировать набор стартовых декларативных правил, их числа и типичные комбо.

---

## Как читать это описание

Каждое правило в таблицах описано в терминах системы content-rules:

- **Триггер** — событие (`ENTITY_DAMAGED`, `DAMAGE`, `STATUS_TICKED` и т.д.) и теги, при которых правило проверяется.
- **Условие** — декларативные проверки (`chance`, `hasStatus`, `hasTag` и комбинации `and`/`or`/`not`).
- **Эффект** — что делает правило (`modifyDamage`, `applyStatus`, `dealDamage`, `restoreAp`, `counterAttack`).
- **Числа** — текущие параметры для баланса (шансы, множители, длительности).

Подробнее о том, как интерпретировать эти поля, как работают слои `source/target/world/radius`, порядок срабатывания, self-эффекты, циклы и другие крайние случаи, см. в [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../agents/CONTENT_RULES_EDGE_CASES.md).

---

## 1. Аудит существующих правил

| `ruleId` | Источник | Триггер | Условие | Эффект | Числа |
|---|---|---|---|---|---|
| `counterattack_trigger` | Статус `counterattack` | `ENTITY_DAMAGED` `attack.melee` `target.single` `delivery.weapon` | `hasStatus counterattack self` + `chance 50` + `not hasTag target.aoe` + `not hasTag target.multi` | `counterAttack` | шанс 50% |
| `counterattack_damage` | Статус `counterattack` | `COUNTER_ATTACK_APPLIED` | — | `dealDamage` от `eventDamage` | урон из события |
| `fire_damage_ignites` | Мир | `ENTITY_DAMAGED` `damage.magical.fire` | `chance 30` | `applyStatus burning` 3 хода | шанс 30%, длительность 3 |
| `burning_tick_damage` | Мир | `STATUS_TICKED` `status.burning` | — | `dealDamage` `eventMaxHp×0.1` min 1, тег `damage.magical.fire` | 10% max HP, округление |
| `collision_damage` | Мир | `ENTITY_COLLIDED` `displacement.push` | — | `dealDamage` 5 `damage.physical.blunt` | урон 5 |
| `collision_damage_actor` | Мир | `ENTITY_COLLIDED` `displacement.push` `collision.actor` | — | `dealDamage` 5 `damage.physical.blunt` по `collisionTarget` | урон 5 |
| `collision_daze` | Мир | `ENTITY_COLLIDED` `displacement.push` | — | `applyStatus dazed` 2 хода | длительность 2 |
| `collision_daze_actor` | Мир | `ENTITY_COLLIDED` `displacement.push` `collision.actor` | — | `applyStatus dazed` 2 хода по `collisionTarget` | длительность 2 |
| `item_fire_damage_multiplier` | Предмет/способность (сейчас не привязано) | `DAMAGE` `damage.magical.fire` | — | `modifyDamage multiply` 1.5 | множитель ×1.5 |

---

## 2. Стартовый набор правил MVP

В таблице ниже 12 правил, которые использует реальный контент первого этажа. Все они реализованы существующими `RuleEffect` и `RuleCondition` (`types.ts`).

| # | `ruleId` | Источник | Триггер | Условие | Эффект | Числа |
|---|---|---|---|---|---|---|
| 1 | `weapon_fire_damage_boost` | Оружие (`common_flaming_sword`) | `DAMAGE` `damage.magical.fire` `delivery.weapon` | — | `modifyDamage multiply` 1.15 | +15% к урону огненного оружия |
| 2 | `weapon_poison_on_hit` | Оружие (`common_venom_dagger`) | `ENTITY_DAMAGED` `damage.physical.piercing` `delivery.weapon` | `chance 40` | `applyStatus poisoned` 3 хода | шанс 40%, яд 3 хода |
| 3 | `weapon_blunt_daze` | Оружие (`cat_guardian_maul`) | `ENTITY_DAMAGED` `damage.physical.blunt` `delivery.weapon` | `chance 25` | `applyStatus dazed` 1 ход | шанс 25%, оглушение 1 ход |
| 4 | `armor_spiked_thorns` | Броня (`common_spiked_cloak`) | `ENTITY_DAMAGED` `attack.melee` | — | `dealDamage` 2 `damage.physical.piercing` по атакующему | ответный урон 2 |
| 5 | `amulet_restore_ap_on_hit` | Амулет (`common_energized_bead`) | `ENTITY_DAMAGED` `attack.melee` `delivery.weapon` | `chance 15` | `restoreAp` себе | шанс 15%, восстановление AP до максимума |
| 6 | `amulet_fire_damage_multiplier` | Амулет (`common_ember_amulet`) | `DAMAGE` `damage.magical.fire` | — | `modifyDamage multiply` 1.15 | +15% ко всему огненному урону |
| 7 | `status_poison_tick_damage` | Статус `poisoned` | `STATUS_TICKED` `status.poisoned` | — | `dealDamage` `eventMaxHp×0.08` min 1, тег `damage.magical.poison` | 8% max HP/ход |
| 8 | `status_burning_vulnerability` | Статус `burning` | `DAMAGE` `damage.magical.fire` | `hasStatus burning self` | `modifyDamage multiply` 1.2 | +20% входящего огненного урона по горящей цели |
| 9 | `counterattack_trigger` | Статус `counterattack` | `ENTITY_DAMAGED` `attack.melee` `target.single` `delivery.weapon` | `hasStatus counterattack self` + `chance 50` + `not target.aoe/multi` | `counterAttack` | шанс 50% |
| 10 | `counterattack_damage` | Статус `counterattack` | `COUNTER_ATTACK_APPLIED` | — | `dealDamage` от `eventDamage` | урон контратаки |
| 11 | `fire_damage_ignites` | Мир | `ENTITY_DAMAGED` `damage.magical.fire` | `chance 30` | `applyStatus burning` 3 хода | шанс 30% |
| 12 | `burning_tick_damage` | Мир | `STATUS_TICKED` `status.burning` | — | `dealDamage` `eventMaxHp×0.1` min 1 `damage.magical.fire` | 10% max HP/ход |

### Распределение по категориям

- **Оружие:** 3 правила (огонь, яд, оглушение).
- **Броня/щит:** 1 правило (шипы).
- **Кольца/амулеты:** 2 правила (AP при ударе, множитель огня).
- **Статусы:** 3 правила (яд, уязвимость к огню, контратака состоит из 2 правил).
- **Мир:** 2 правила (поджигание, тик горения).

---

## 3. Примеры комбо

### 3.1 «Огненный меч + поджигание + тик горения»

1. Игрок экипирует `common_flaming_sword`.
2. Обычная атака наносит урон `damage.magical.fire`.
3. `weapon_fire_damage_boost` увеличивает урон оружия на 15%.
4. Мировое правило `fire_damage_ignites` (30%) накладывает `burning` на 3 хода.
5. В начале хода врага `burning_tick_damage` наносит 10% max HP огнём.
6. Если цель уже горит, `status_burning_vulnerability` усиливает последующий огненный урон ещё на 20%.

**Баланс:** один удар не убивает крысу (≈10–12 урона против 15 HP); горение добавляет ~2 HP/ход. Комбо сильно, но не мгновенно.

### 3.2 «Ядовитый кинжал + контратака»

1. Игрок экипирует `common_venom_dagger`.
2. Атака накладывает `poisoned` с шансом 40% (`weapon_poison_on_hit`).
3. Игрок активирует `counterattack` (статус).
4. Когда враг атакует игрока, `counterattack_trigger` + `counterattack_damage` отвечают ударом.
5. В начале хода врага `status_poison_tick_damage` наносит 8% max HP ядом.

**Баланс:** яд и контратака медленно «добивают» врага без риска убить его за один ход.

### 3.3 «Рывок в стену + столкновение»

1. Игрок использует `dash` через врага.
2. Враг получает push.
3. Если за врагом стена/другой актор, срабатывают мировые правила `collision_damage` / `collision_daze`.
4. Враг получает 5 урона столкновения и статус `dazed` на 2 хода.

**Баланс:** dash уже наносит удар (≈7), столкновение добавляет 5 + daze. Для крысы 15 HP это ~12 суммарно, оставляет её живой.

---

## 4. Числа и баланс

| Параметр | Значение | Обоснование |
|---|---|---|
| Шанс поджечь (мир) | 30% | Достаточно часто, чтобы быть заметным, но не гарантированно. |
| Тик горения | 10% max HP, min 1 | Для крысы 15 HP — 2/ход; для босса 100 HP — 10/ход. Масштабируется. |
| Урон яда | 8% max HP, min 1 | Медленнее горения, компенсируется длительностью 3 хода. |
| Урон шипов | 2 piercing | Небольшой ответный урон, не доминирует. |
| Огненный бонус оружия/амулета | ×1.15 | Маленький стимул собирать fire-build. |
| Уязвимость горения | ×1.2 | Поощряет повторный огненный урон по горящей цели. |
| Шанс оглушения дробящим | 25%, 1 ход | Контроль, но ненадёжный. |
| Шанс яда кинжала | 40%, 3 хода | Надёжный DoT, но не 100%. |
| Шанс AP на удар | 15% | Случайный бонус, не ломает экономику AP. |
| Контратака | 50% | Заметная, но не гарантированная защита. |

---

## 5. Пост-MVP (требуют расширения типов)

Следующие идеи зафиксированы, но не включены, потому что текущий DSL не поддерживает нужное условие/эффект:

| Правило | Что не хватает |
|---|---|
| «AP при убийстве» | Условие «цель умерла от этого урона» / `ENTITY_DIED` с фильтром по источнику. |
| «Щит — шанс заблокировать удар» | Эффект `modifyDamage` с условием на входящий урон + возможностью свести урон к 0. |
| «Кольцо жизни — лечение при убийстве» | Триггер `ENTITY_DIED` + условие sourceIsKiller + эффект `heal`. |
| «Яд снижает урон» | Эффект `modifyDamage` на исходящий урон цели-носителя статуса. |

---

## 6. Утверждение дизайном

- Набор правил согласован с требованиями WP6.3.
- Числа проверены интеграционными сценариями (`tests/integration/combat-scenarios/`).
- Статус: **утверждено**.
