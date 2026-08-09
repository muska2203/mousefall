# Концепт: экипировка — подтипы, уровни, аффиксы

> Статус: `[DRAFT]` → утверждён пользователем 2026-08-08 (ответы на вопросы фазы 1); **реализация завершена 2026-08-08**; **унификация свойств экипировки через модификаторы завершена 2026-08-09**.
> Источник правды — код + этот концепт.

---

## 1. Цель

Ввести систему прогрессии экипировки внутри забега:

- у каждого предмета экипировки есть **подтип** (меч, кинжал, магический посох, магическая броня и т.д.);
- у каждого темплейта экипировки есть **уровень** (`level ≥ 1`) — в дальнейшем определяющий показатель для выпадения на этажах (привязка дропа к этажам — отдельная задача, здесь только поле);
- у экземпляра предмета может быть **до 2 случайных аффиксов (модификаторов/правил)**: 1 положительный + до 1 отрицательного;
- значения случайных аффиксов **роллятся один раз в момент создания экземпляра предмета** из диапазона, зависящего от уровня темплейта, и далее фиксируются в экземпляре;
- формулы урона оружия **удаляются полностью**; урон оружия — фиксированный рейнж `{min, max}` с роллом в момент удара, смещённым вверх ловкостью.

---

## 2. Решения, утверждённые в фазе 1

| Вопрос | Решение |
|---|---|
| Где описывать аффиксы | Новая контентная категория `modifiers` (правила в `CONTENT_RULES` не трогаем) |
| Источник случайных аффиксов предмета | Глобальные пулы по подтипу, ролл при создании экземпляра |
| Смещение ролла урона от ловкости | Плавная формула `u^(1/(1 + dex·k))` |
| Охват уровней и аффиксов | Все три слота: оружие, броня, амулеты |
| Броня | Фиксированное `baseArmor`, рейнж только у урона |
| Отрицательный аффикс | С шансом (константа `NEGATIVE_AFFIX_CHANCE = 0.5`), не гарантирован |
| Коэффициент смещения | `DEX_DAMAGE_BIAS_K = 0.05` (балансная константа) |

---

## 3. Контент-модель

### 3.1. Шаблон предмета (`ItemTemplateSchema`)

- Новое поле `level: int ≥ 1` — **обязательно** для `type: 'weapon' | 'armor' | 'amulet'` (refine).
- Новое поле `subtype` — обязательно для тех же типов. Замкнутые наборы в `src/content/ids.ts`:
  - `WEAPON_SUBTYPE_IDS = ['sword', 'dagger', 'club', 'staff', 'unarmed']`;
  - `ARMOR_SUBTYPE_IDS = ['light', 'heavy', 'magic']`;
  - `AMULET_SUBTYPE_IDS = ['bead', 'charm', 'talisman']`.
  - Единый тип `EquipmentSubtypeId` = объединение; refine проверяет, что `subtype` принадлежит набору своего `type`.
  - `unarmed` — подтип fallback-оружия; на него аффиксы не выпадают (нет модификаторов с таким `applicableSubtypes`).
- `weapon.baseDamage` заменяется на `weapon.damage: { min: int ≥ 0, max: int ≥ min }`. Стартовый меч: `{ min: 2, max: 4 }`. Безоружный: `{ min: 1, max: 1 }`.
- `weapon.damageFormulaId` **удаляется** вместе с `WEAPON_FORMULA_IDS` и `src/simulation/systems/stats/weapon-formulas.ts`. Статы (str/int/dex) больше не добавляют урон оружия; они остаются в формулах скиллов (`src/simulation/skills/damageFormula.ts` — не трогаем).
- Поле `fixedModifiers: string[]` (default `[]`) — **фирменные модификаторы предмета**: ID из категории `modifiers`, детерминированные свойства шаблона (и stat-, и rule-модификаторы). Заменяет удалённые 2026-08-09 поля `equipModifiers` и `ruleIds`: единый источник свойств предмета — модификаторы. Поле только у экипировки (`weapon`/`armor`/`amulet`); расходники/ключи/золото не затронуты (у них этих полей не было).

### 3.2. Категория контента `modifiers`

`src/content/templates/modifiers/` + `ModifierTemplateSchema`:

```ts
ModifierTemplate = {
  id: string;
  polarity: 'positive' | 'negative';  // default 'positive'; для poolEligible: false не используется
  effect:
    | { kind: 'stat'; stat: StatName; op: 'add' | 'multiply' }  // «крепкая броня»: armor, add
    | { kind: 'rule'; ruleId: string };                         // «отравление при ударе»
  scaling:
    | { kind: 'perLevel'; ranges: Array<{ min: number; max: number }> }  // ranges[level-1]; level > длины → clamp к последнему
    | { kind: 'fixed'; value: number }   // детерминированное значение; для фирменных stat-модификаторов
    | { kind: 'none' };                  // значение не роллится (rule-модификаторы)
  applicableSubtypes: EquipmentSubtypeId[];  // непустой; по каким подтипам применим
  poolEligible: boolean;  // default true; false — только фирменное свойство (fixedModifiers), в случайном ролле не участвует
  weight: number > 0;  // вес в пуле ролла, дефолт 1 (игнорируется при poolEligible: false)
}
```

Пример «крепкая броня»: `scaling.perLevel.ranges = [{min:1,max:2},{min:1,max:3},{min:2,max:4}]` — уровень 1 → 1–2, уровень 2 → 1–3, уровень 3 → 2–4.

Для отрицательных stat-аффиксов рейнжи задаются отрицательными значениями (например `[{min:-2,max:-1}]`) — знак не инвертируется рантаймом.

Инварианты (валидация в `validate-content` и `validateContentRuleSemantics`):
- rule-модификатор со `scaling: perLevel` допустим только если в эффекте правила есть `ParametrizedValue { type: 'ownerParam' }` — куда подставлять ролленное значение;
- stat-модификатор обязан иметь `scaling: perLevel` или `fixed` (при `none` значения нет);
- модификатор в `fixedModifiers` предмета не может иметь `scaling: perLevel` — фирменные свойства детерминированы.

Тексты — `src/content/texts/{ru,en}/modifiers.ts` (`name`, `description`). В `description` поддерживается плейсхолдер `{value}` — интерполяция значения в presentation; допустим при `scaling: perLevel` или `fixed`.

---

## 4. Экземпляр предмета и ролл аффиксов

- `ItemAffix = { modifierId: string; value: number | null; origin: 'fixed' | 'rolled' }` (`value = null` при `scaling: 'none'`). Экземпляр несёт **единый список** `InventoryItem.affixes`: сначала фирменные аффиксы (из `fixedModifiers` шаблона, детерминированы, `origin: 'fixed'`), затем случайные (`origin: 'rolled'`).
- Фирменные аффиксы строит `buildFixedAffixes(template)`: значение — `scaling.fixed.value` (fixed) или `null` (none).
- Сборка списка при создании экземпляра — `createItemAffixes(state.rng, template)` (вызывается из `inventory-factory.ts`); случайный ролл (`rollItemAffixes`, по образцу `item-ability-roll.ts`):
  1. пул = модификаторы с `poolEligible: true`, у которых `applicableSubtypes` содержит `subtype` предмета;
  2. из пула исключаются `modifierId`, уже входящие в `fixedModifiers` предмета, и rule-модификаторы, чей `ruleId` уже есть среди фирменных (устраняет дубль эффекта — как ранее `mod_poison_on_hit` на мече с тем же правилом в `ruleIds`);
  3. из положительных — взвешенный выбор 1 (если пул непуст);
  4. отрицательный — с шансом `NEGATIVE_AFFIX_CHANCE = 0.5`, взвешенный выбор 1;
  5. `value = rngInt(state.rng, min, max)` из `ranges[level-1]` (с clamp к последнему рейнжу).
- Ролл через **`state.rng`** (детерминирован, воспроизводим); значения сериализуются в составе `InventoryItem` и **не переролливаются** ни при экипировке, ни при загрузке сейва.
- Враги экземпляров предметов не имеют — аффиксов у них нет (урон по рейнжу темплейта); их фирменные свойства читаются напрямую из шаблона: stat — `collectFixedStatModifiers(template)` (спавн в `map-generation/shared.ts`, превью в `simulation.ts`), правила — `collectFixedRuleIds(template)` (в `rebuildActiveRules`).

---

## 5. Рантайм-применение аффиксов

- `executeEquipItemIntent` и `rebuildActiveRules` применяют stat-аффиксы и правила **только из `item.affixes` единым проходом** — фирменные уже находятся в списке экземпляра, отдельной обработки `equipModifiers`/`ruleIds` шаблона больше нет.
- **stat-аффиксы**: при экипировке — через существующий движок `addModifier(source: item_{instanceId})` со значением экземпляра (для фирменных — детерминированное `scaling.fixed.value`); при снятии снимаются тем же `removeModifiersBySource`.
- **rule-аффиксы**: `addActiveRulesForItem` добавляет активные правила из аффиксов; `ActiveRule.paramValue` — значение экземпляра (для rule-модификаторов со `scaling: none` — `null`). Дедупликация `ruleId + ownerContext` в `addActiveRules` сохраняется как страховка.
- `ParametrizedValue` получает вариант `{ type: 'ownerParam', multiply?, min?, round? }` — резолвится из `paramValue` активного правила (по образцу `context`, fallback 0). Правило в каталоге пишет, например, `duration: { type: 'ownerParam' }`.

---

## 6. Урон рейнжем + смещение от ловкости

- `getBaseDamage` → `getBaseDamageRange(actor): { min, max }` (шаблон оружия; fallback безоружный `{1,1}`).
- Модификаторы `damage`: `add` применяется к обоим концам, `multiply` — к обоим (`×(1+Σmultiply)`), итог ≥ 0 по каждому концу.
- Derived-кэш `actor.damage` становится `{ min, max }` (затрагивает `recalculate.ts`, `PlayerStatsSnapshot`).
- Ролл в точке нанесения — `rollWeaponDamage(state, actor): number`:
  ```
  u = rngFloat(state.runtimeRng)
  roll = min + round((max − min) × u ^ (1 / (1 + dex · DEX_DAMAGE_BIAS_K)))
  ```
  `dex` — эффективная ловкость атакующего (включая врагов). Ролл детерминирован (`runtimeRng` сериализуется).
- Точки ролла: `attack-action.ts` (resolve ATTACK), `counter-attack-intent-executor.ts`, weapon-based скиллы (`cleaveSkill` — ролленное значение как `baseDamage` своей формулы). Остальные скиллы используют свои константы/формулы — без изменений.
- Публичные API `simulation.ts` (`getWeaponDamage`, `getWeaponDamageByTag`, `getEffectiveWeaponDamageForTemplate`) переводятся на возврат рейнжа `{min, max}` — для UI.

---

## 7. Presentation / UI

- Карточка предмета (`itemDetailMapper.ts`, `ItemDetailViewModel`): урон «2–4», броня как раньше; свойства — `properties: Array<{key, name, description, origin, polarity}>` (фирменные + случайные, с интерполяцией `{value}`). Отдельные секции «Аффиксы» и «При экипировке» (`equipModifiers`) удалены.
- Карточка (`ItemDetailCard`) выводит категории фиксированным порядком без заголовков, разделяя их горизонтальной полосой (`item-detail-divider`): статы → уникальные свойства (`origin: 'fixed'`, класс `item-detail-property--unique`) → случайные свойства (`origin: 'rolled'`, классы `item-detail-property--positive`/`--negative` по `polarity`) → скиллы (установленные, затем пул возможных для карточки шаблона с пометкой `itemDetail.possibleSkillHint`) → флейвор-описание (курсивом) → теги. Пометка ✦ у ролленных свойств удалена (категория подсвечена цветом).
- Для карточки шаблона (`isTemplate`) свойства строятся из `fixedModifiers`.
- Панель героя: `damage` из снапшота — отображение рейнжа.
- i18n: тексты модификаторов в `texts/{ru,en}/modifiers.ts`; ключи UI при необходимости.

---

## 8. Миграция контента

- Все шаблоны `items/weapons|armor|amulet` (+ оружие котов-врагов): `+subtype`, `+level`, `baseDamage` → `damage{min,max}`, `−damageFormulaId` (выполнено 2026-08-08).
- Унификация свойств (выполнено 2026-08-09): `equipModifiers` и `ruleIds` шаблонов экипировки мигрированы в `fixedModifiers`; добавлены 6 фирменных модификаторов (`poolEligible: false`):
  - `mod_blunt_daze` (cat_guardian_maul);
  - `mod_fire_damage_multiplier` (common_flaming_sword);
  - `mod_spiked_thorns` (common_tin_plate, common_spiked_cloak);
  - `mod_amulet_fire_damage_multiplier` (common_ember_amulet);
  - `mod_restore_ap_on_hit` (common_energized_bead, common_knotted_fang);
  - `mod_guardian_vitality` (cat_guardian_plate, stat maxHp +10, `scaling: fixed`).
- `mod_poison_on_hit` стал фирменным у common_splinter_blade и common_venom_dagger и остался в пуле ролла (`poolEligible: true`) — на эти два предмета он больше не выпадает (фильтр ролла).
- Стартовые модификаторы для проверки системы:
  - `mod_sturdy_armor` (positive, stat armor add, perLevel `[{1,2},{1,3},{2,4}]`, подтипы брони);
  - `mod_poison_on_hit` (positive, rule `weapon_poison_on_hit`, scaling none, подтипы оружия);
  - 1–2 отрицательных stat-аффикса (например `mod_fragile`: maxHp add, рейнжи отрицательные).
- `validate-references.ts`: ссылки `effect.ruleId → CONTENT_RULES`, `applicableSubtypes` ⊂ известных подтипов; `fixedModifiers`: существование модификатора, `subtype` предмета ∈ `applicableSubtypes` модификатора, `perLevel` у фирменного модификатора — ошибка; `{value}` в описании допустим при `scaling: perLevel` или `fixed`. `scripts/validate-content.ts` — семантика (ownerParam-инвариант, stat-модификатор требует `perLevel` или `fixed`); валидация `ruleIds` предметов удалена (правила валидируются через rule-модификаторы, `effect.ruleId`).

---

## 9. Тесты

- Ролл аффиксов: фильтрация пула по подтипу и `poolEligible`, исключение фирменных модификаторов и конфликтующих ruleId, полярность (1+ / до 1−), рейнжи по уровням, clamp, детерминизм по seed.
- Bias-формула: границы [min, max], монотонность смещения по dex (на фиксированном rng).
- Применение аффиксов: stat-аффикс при equip/unequip; rule-аффикс с `ownerParam`; фирменные модификаторы (fixed stat/rule) у игрока и врагов.
- Эффективный рейнж урона с модификаторами add/multiply.
- Миграция существующих тестов, завязанных на `baseDamage`/`damageFormulaId`/`getEffectiveWeaponDamage`.

---

## 10. Связь с прогрессией

Уточняет `progression-concept.md`: ранее — «экипировка = числа + активки + максимум 1 фирменное правило». Теперь: экипировка = рейнж урона/броня + активки + **фирменные модификаторы** (`fixedModifiers` шаблона, детерминированы) + **до 2 случайных аффиксов** (1+/1−). И фирменные, и случайные свойства живут в едином списке `affixes` экземпляра.
