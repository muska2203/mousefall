# План реализации кровавой ветки билдов (этап 1 этажа 1)

> Реализация концепта [`docs/game-design/bleed-builds-concept.md`](../game-design/bleed-builds-concept.md).
> Статус: план утверждён в части архитектурных решений (см. §1). Этап 0 выполнен (2026-08-30).

---

## 1. Принятые решения (в дополнение к §2 концепта)

1. **Возврат из legacy — 4 единицы** (утверждено, выполнено): модификаторы `mod_bleeding_on_hit`, `mod_bleeding_execute`, `mod_spiked_thorns` и реликвия `relic_blood_pact` возвращены в активный контент. `weapon_sword_splinter_blade` получил обратно `fixedModifiers: ['mod_blood_on_hit']` и урон `{4,6}`; `armor_light_spiked_cloak` — `fixedModifiers: ['mod_spiked_thorns']`.
2. **Порядок смерти — «модель 1» (утверждено):** смерть — последнее, что происходит в волне. Все реакции на смертельный урон (включая наложение on-hit статусов) разрешаются до `ENTITY_DIED`; реакции на смерть видят финальное состояние, включая только что наложенное. Это текущее поведение волновой модели — оно **фиксируется тестами и документацией**, код не меняется. Следствие: один удар может и наложить статус, и убить, и вызвать on-death реакцию на этот статус (бочки с маслом уже работают так; «Разрыватель» будет детонировать и от ваншота рубящим оружием — принимается как свойство модели).
3. **Минус «Кровавого эха» заменён (утверждено):** вместо «убийство без кровотечения отнимает 2 HP» (нереализуемо в модели 1 без снапшотов) — **«когда у кого-нибудь спадает статус кровотечения, владелец получает 1 внутренний урон»** (триггер `STATUS_REMOVED` по `bleeding` у любой сущности). Важное следствие из кода: смерть НЕ порождает `STATUS_REMOVED` (статусы остаются на трупе до cleanup) — добивание кровоточащего не штрафуется; штрафуются естественное спадание, вытеснение и стеки → 0.
4. **Глобальный слой сбора правил (утверждено):** правила реликвий, реагирующие на события вне радиуса 1 от владельца (минус «Жатвы», минус «Кровавого эха»), собираются независимо от дистанции. Слой `radius` имеет `RADIUS_LAYER_RADIUS = 1` и для этих механик недостаточен.
5. **`ritual_cut` — массив статусов в эффекте расходника (утверждено):** эффект `applyStatus` принимает список `{statusType, duration}` (generic-решение; один эффект на предмет, но несколько статусов в нём).
6. **`mod_blood_widening_wound` — корректировка дизайна:** `applyStatus` на висящем статусе обновляет длительность до входящего значения (`apply-status-intent-executer.ts`), поэтому «обновляет ещё на 3» дублирует `mod_blood_on_hit`. Новая формулировка: **удар по уже кровоточащей цели продлевает рану — длительность кровотечения обновляется до 5 ходов** (число черновое, баланс — roadMap 1.4). Правило с условием `hasStatus bleeding`, чтобы не дублировать on-hit на свежих целях.
7. **Конвенция именования контента веток (утверждено, 2026-08-30):** `mod_{ветка}_{имя}` / `relic_{ветка}_{имя}` для контента, созданного под ветку билда; универсальные модификаторы и реликвии — без слова ветки (`mod_spiked_thorns`). Слово кровавой ветки — **`blood`**. Файл — id в kebab-case. Выполнено: `mod_bleeding_on_hit` → `mod_blood_on_hit`, `mod_bleeding_execute` → `mod_blood_execute`. **id правил движка** (`weapon_bleeding_on_hit` и т.д. в `rules.ts`) **не переименовываются** — это отдельный рефакторинг реестра правил, не входит в план.

## 2. Что уже проверено разведкой (доработка НЕ нужна)

- **Край `ENTITY_DIED` + статусы трупа:** статусы с трупа не снимаются, труп живёт в `state.entities` до конца раунда, `hasStatus` на нём работает (прецеденты — правила детонации бочек с `hasStatus burning` на трупе). Снапшот статусов не требуется. Фиксируется unit-тестом (этап 1.1).
- **Все bleed-правила активны в реестре** (`src/simulation/content-rules/rules.ts`): `weapon_bleeding_on_hit`, `weapon_bleeding_execute`, `armor_spiked_thorns`, `status_bleeding_tick_damage`. Архивированы были только модификаторы-источники.
- **`STATUS_REMOVED`** существует как событие и поддержан в `rule-context.ts`.
- **Модели для копирования:** `water`/`wet` (тайловый эффект + 2 правила: `ENTITY_MOVED` и `TILE_EFFECT_CHANGED`+`isNew`) для `blood_puddle`; `flour_pouch` (`spawn_tile_effect`, radius 1, range 2) для `blood_flask`.
- **Тестовая инфраструктура:** `tests/fixtures/content-rules.ts` (`withContentRules`), паттерн `ownedRule`, образец `tests/unit/simulation/content-rules/weapon-sword-rules.test.ts`, интеграционный `registerLegacyTemplates()` (`tests/integration/combat-scenarios/helpers.ts`).

## 3. Этапы

### Этап 0 — возврат из legacy (решение 1) — ✅ выполнен 2026-08-30

- Перенесены `legacy/modifiers/{mod-bleeding-on-hit, mod-bleeding-execute, mod-spiked-thorns}.ts` → `templates/modifiers/`, `legacy/relics/relic-blood-pact.ts` → `templates/relics/`; зарегистрированы в `index.ts`.
- `weapon-sword-splinter-blade.ts`: `fixedModifiers: ['mod_blood_on_hit']`, урон `{1,2}` → `{4,6}`; `armor-light-spiked-cloak.ts`: `fixedModifiers: ['mod_spiked_thorns']`.
- Тексты ru/en были на месте; `registerLegacyTemplates()` дублей не дал — правок тестов не потребовалось.
- Обновлены `legacy/README.md`, `src/content/AGENTS.md`.
- Переименование по решению 7: `mod_bleeding_on_hit` → `mod_blood_on_hit`, `mod_bleeding_execute` → `mod_blood_execute` (файлы, id, ключи текстов).
- Проверки: `validate:content`, `validate:i18n`, `typecheck`, полный прогон — 1936 тестов, зелёные.

### Этап 1 — движок

**1.1. Фиксация модели 1 (без изменения кода).**
- Unit-тесты: «on-hit bleed, наложенный смертельным ударом, виден реакциям на `ENTITY_DIED`» (ваншот); «труп не собирается как актор в последующих волнах».
- Доки: `CONTENT_RULES_EDGE_CASES.md` — новый раздел «Порядок смерти (модель 1)»; уточнить раздел «Mid-chain статусы» (он неточен относительно `ENTITY_DIED` следующей волны).

**1.2. Глобальный слой сбора правил (решение 4).**
- Опт-in поле правила (рабочее название `reach: 'global'`); `collectRules` (`content-rule-reaction.ts`) собирает помеченные правила всех живых акторов независимо от дистанции, с дедупликацией против слоёв `source`/`target`/`radius`.
- Тесты: правило владельца срабатывает на смерть в другом конце карты; помеченное правило не исполняется дважды при совпадении слоёв.
- Доки: `src/simulation/content-rules/AGENTS.md` (порядок слоёв), `CONTENT_RULES_EDGE_CASES.md`.

**1.3. `applyStatus` в эффектах расходников (решение 5).**
- `src/content/schemas.ts`: `'applyStatus'` в enum `ConsumableEffectSchema.effect`, поле `statuses: [{statusType, duration}]`, `superRefine` на обязательность.
- `src/simulation/systems/actions/use-item-action.ts`: `supportedEffects` + ветка `resolve` → `APPLY_STATUS` на `action.entityId` по каждому статусу (self-таргетинг уже фактически есть у `heal`/`buff`).
- `scripts/validate-content.ts`: проверка существования `statusType` в реестре статусов.
- `src/presentation/itemDetailMapper.ts`: отображение эффекта; таргетинг по клетке не требуется (`getConsumableTargetMode` вернёт null, как у `heal`).
- Тесты по образцу `tests/unit/simulation/actions/use-item-action.test.ts`.
- Открытый вопрос (не блокер): хардкод `buff` → `regenerating` (`use-item-action.ts`) оставляем как есть — минимальные изменения.

### Этап 2 — модификаторы (чистый контент, §4.1 концепта)

- `mod_blood_widening_wound` «Рваные края» (sword): правило `ENTITY_DAMAGED` (weapon, slashing) + `eventRole: source` + `hasStatus bleeding (target)` → `applyStatus bleeding` длительность 5 (решение 6). `scaling: none`.
- `mod_blood_thorns` «Кровавые шипы» (light, heavy): по образцу `armor_spiked_thorns` — `ENTITY_DAMAGED` (`attack.melee`) + `eventRole: target` + `notSelfHit` → `applyStatus bleeding` 2 хода на `eventSource`.
- `mod_blood_frenzy` «Берсерк» (talisman): `modifyDamage add` (значение `ownerParam`, `scaling: perLevel`) на `DAMAGE` (`delivery.weapon`) + `eventRole: source` + `hasStatus bleeding (subject: source)`.
- Новые правила — в `rules.ts`; тексты ru/en (`texts/*/modifiers.ts`, `rules.ts`); unit-тесты по образцу `weapon-sword-rules.test.ts`.

### Этап 3 — реликвии (чистый контент поверх этапов 1.2, §4.2 концепта)

- `relic_blood_leech` «Пиявка»: плюс — `STATUS_TICKED bleeding` у врага в радиусе (слой `radius`, «рядом» = радиус 1 — соответствует концепту) → `heal 1` владельцу; минус `polarity: 'negative'` — `statModifiers` −5 maxHp.
- `relic_blood_echo` «Кровавое эхо»: плюс — `ENTITY_DIED` + `eventRole: source` + `hasStatus bleeding (target)` → `heal 2`; минус (решение 3) — `STATUS_REMOVED` по `bleeding` у любой сущности (`reach: global`) → `dealDamage 1 internal` владельцу.
- `relic_blood_reaper` «Жатва»: плюс — `ENTITY_DIED` + `eventRole: source` + `hasStatus bleeding` → `restoreAp 1`; минус — `ENTITY_DIED` + `hasStatus bleeding (target)` + NOT `eventRole: source` + цель не владелец (`reach: global`) → `consumeAp 1` владельца.
- `relic_blood_fuel` «Кровавое топливо»: плюс — `STATUS_TICKED bleeding` на владельце → `restoreAp 1`; минус — `STATUS_REMOVED bleeding` на владельце → `consumeAp 1`.
- `relic_blood_rupture` «Разрыватель»: два правила на `ENTITY_DIED` + `hasStatus bleeding (target)` — `dealDamage 4 internal` по `allInRadius 1` БЕЗ `excludeSelf` (минус: задевает владельца) и `applyStatus bleeding 2` выжившим в радиусе.
- У всех новых реликвий минусы помечаются `polarity: 'negative'`. Тексты ru/en, unit-тесты правил, интеграционный сценарий пары «плюс/минус» для «Эха» и «Жатвы».

### Этап 4 — `blood_puddle` + `blood_flask` (чистый контент, §4.3)

- `tile-effects/blood-puddle.ts` (слой `cover`): правила по образцу `water_applies_wet(_on_spawn)` — `ENTITY_MOVED` + `inTileEffect` и `TILE_EFFECT_CHANGED` + `isNew` → `applyStatus bleeding 2`. Статус-маркер не нужен — bleed вешается напрямую.
- `items/consumables/blood-flask.ts`: копия формы `flour_pouch` с `tileEffectType: 'blood_puddle'`.
- Тексты, спрайт/рендер лужи (presentation-маппинг тайловых эффектов; при отсутствии ассета — placeholder по `scripts/`), тесты по образцу `water-applies-wet.test.ts`.

### Этап 5 — `ritual_cut` (после 1.3)

- Расходник `applyStatus` self: `statuses: [{bleeding, 3}, {empowered, 2}]`. Тексты ru/en, тесты use-item.

### Этап 6 — пулы, тексты, финал

- Пулы: расходники в `itemPool` типов комнат (`normal`) рядом с `flour_pouch`; реликвии в общий `relicPool`; `starterRelicPool` шаблона «Боец» — если шаблон ещё не существует, отметить отложенным (floor-1 §4.10). Снаряжение в дроп/спавн — по floor-1-концепту (сейчас возвращённые предметы в пулах отсутствуют — отдельное решение контентного прохода).
- `npm run validate:content`, `npm run typecheck`, полный прогон `npm test`.
- Обновление документации:
  - `bleed-builds-concept.md` — решения §1 этого плана, статус концепта (частично сделано 2026-08-30: конвенция именования, минус «Эха», формулировка «Рваных краёв», миграция id);
  - `SYNC_STATUS.md` — запись о концепте и этапах;
  - `mechanics-overview.md` — новые механики;
  - `src/content/AGENTS.md` — конвенция именования веток;
  - `CONTENT_RULES_EDGE_CASES.md` — порядок смерти, глобальный слой, минус-семантика `STATUS_REMOVED`.

## 4. Отложенные / открытые вопросы

- Баланс всех чисел — roadMap 1.4 (плейтест).
- Мёртвый аффикс на piercing-мечах (`weapon_sword_hat_pin`) — §7 концепта, не в этом плане.
- Хардкод `buff` → `regenerating` в `use-item-action.ts` — не трогаем.
- Пул амулетов этажа и носитель `mod_blood_frenzy` (`amulet_talisman_knotted_fang`) — финализируется контентным проходом (§7 концепта).
