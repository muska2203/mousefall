# План: отвязка тестов от значений контента

> Статус: черновик. Дата: 2026-09-02.
> Тип задачи: `refactor` (тесты) + `docs_update` (правила тестирования).

## Цель

Контентные правки в `src/content/**` (балансные числа, статы, урон, значения
расходников и экипировки) не должны ломать тесты. Тесты проверяют
функциональность движка на синтетических фикстурах; корректность реального
контента охраняют Zod-схемы и `npm run validate:content`.

Прецедент уже есть: `crit-on-dazed-scenario.test.ts` и
`on-kill-rules-scenario.test.ts` работают на собственных мок-шаблонах
(`test_blade` {6,6} и т.п.) и устойчивы к правкам контента.

## Аудит: текущее состояние

Из ~213 тестовых файлов ~185 уже моковые (`initRegistry` с синтетическими
шаблонами) — не трогаем. Контентный риск сосредоточен в файлах ниже.

### Ломаются при числовой правке контента

| Файл | Хрупкие assert'ы | Источник чисел |
|---|---|---|
| `tests/integration/combat-scenarios/fire-scenario.test.ts:122-123` | `door.hp).toBe(30 - 8 * 2)`, `rat.hp).toBe(15 - 8)` | рейнж {4,6} реального `weapon_sword_flaming` + ×1.5 legacy-модификатора |
| `tests/integration/combat-scenarios/ground-slam-scenario.test.ts:94,134,154` | HP после удара, 25 поражённых клеток, `duration === 2` | реальный `ground_slam` (урон 12, зона 5×5, daze 2) |
| `tests/integration/combat-scenarios/guardian-boss-scenario.test.ts:130,244,173` | кулдаун 4, `maxHp).toBe(150)`, HP игрока | реальные `cat_guardian`, `bulwark`, `ground_slam` |
| `tests/integration/tile-effects/oil-ignition-rules.test.ts:134` | `hp).toBe(hpBefore - 6)` («1 + 3 + 2») | урон поджога/взрыва реального `oil` |
| `tests/integration/tile-effects/flour-cloud.test.ts:196` | `enemy.hp).toBe(15)` (20 − 5) | урон взрыва реального `flour_cloud` |
| `tests/unit/simulation/status-effects/status-stat-modifiers.test.ts:202` | `player.ap).toBe(2)` | штраф −1 maxAp реального статуса `dazed` |
| `tests/unit/simulation/content-rules/execute-intent-integration.test.ts:147,193` | `damage: 17`, `enemy.hp).toBe(83)` | множитель ×1.5 реального правила `item_fire_damage_multiplier` |

### Ломаются при удалении/переименовании шаблона (не при числах)

- `tests/unit/content/cat-guardian-template.test.ts:58` — требует
  `mod_guardian_vitality` в `fixedModifiers` лат стражника (legacy-snapshot).
- `tests/unit/content/sudden-strike-texts.test.ts` — требует тексты
  `sudden_strike` в ru/en.
- Сценарии на legacy-шаблонах: `blunt-daze-scenario`, `bulwark-scenario`,
  `poison-counter-scenario`, `relics/salamander-fire-infusion` — зависят от
  существования архивных id (`cat-guardian-maul`, `mod-blunt-daze`,
  `mod-poison-on-hit`, `mod-fire-damage-multiplier`, `relic-salamander-heart`).
  Числа там свои — оставляем как есть (осознанная связка «носитель механики»).
- `tests/unit/simulation/status-effects/bleeding-blood-pact-repro.test.ts` —
  зависит от id правил `relic_blood_pact_power`/`price` — оставляем.

## Шаги

### 1. Перевести числовые сценарии на мок-шаблоны

В каждом файле заменить реальный шаблон на локальный мок с теми же
механиками (теги урона, ruleIds, kind способности), но собственными числами,
и пересчитать assert'ы от этих чисел. Образец — `crit-on-dazed-scenario`
(свой `test_blade`, числа из фикстуры теста).

1.1. `fire-scenario.test.ts` — мок-меч с `damageDistribution`
`damage.magical.fire` + мок-модификатор множителя огня; убрать импорты
`weapon-sword-flaming` / `mod-fire-damage-multiplier` и
`registerLegacyTemplates` для них.

1.2. `ground-slam-scenario.test.ts` — мок-способность `kind: 'groundSlam'`
со своими `radius`/`baseDamage`/daze-duration.

1.3. `guardian-boss-scenario.test.ts` — мок-босс (`isBoss: true`, свои
`health.max`/`baseStats`), мок-`bulwark` и мок-`groundSlam`; убрать зависимость
от `cat_guardian`. Проверить, что сценарий не дублирует
`ai/guardian-boss-strategy.test.ts` (моковый) — не удалять покрытие.

1.4. `oil-ignition-rules.test.ts`, `flour-cloud.test.ts` — мок-шаблоны
тайловых эффектов/расходников со своими значениями урона и радиуса.

1.5. `status-stat-modifiers.test.ts` — мок-статус со `statModifiers`
вместо реального `dazed`.

1.6. `execute-intent-integration.test.ts` — тестовые правила через
`withContentRules` вместо `getContentRule('item_fire_damage_multiplier')` /
`getContentRule('amulet_restore_ap_on_hit')`.

### 2. Урезать snapshot-тесты контента

2.1. `cat-guardian-template.test.ts` — убрать data-asserts
(`toContain('mod_guardian_vitality')`, привязку к `attack.melee`-тегу
оставить только если это инвариант движка). Оставить структурную
Zod-валидацию; либо удалить файл целиком, если структура уже покрыта
`validate-content.test.ts` — решить при реализации, предпочтение: урезать.

2.2. `sudden-strike-texts.test.ts` — оставить (проверяет наличие текстов,
не значения), но отметить в правилах: новые текстовые тесты такого вида не
пишем — покрытие текстов даёт `validate:i18n`.

### 3. Обновить правила написания тестов

3.1. `docs/agents/TESTING.md`, правило 7 — усилить формулировку. Добавить
явный список запрещённых паттернов:

- ❌ assert'ы чисел, выведенных из реальных шаблонов
  (`expect(hp).toBe(30 - 8 * 2)` где 8 — из `src/content/templates/`);
- ❌ импорт реальных шаблонов ради их значений (допустимо только как
  «носитель механики» с assert'ами семантики: наличие статуса, типы событий);
- ❌ `toContain`/равенство по конкретным id модификаторов/правил/текстов
  реального контента вне тестов самого контентного пайплайна;
- ✅ образец правильного подхода: мок-шаблон + числа из фикстуры теста
  (ссылка на `crit-on-dazed-scenario.test.ts`).

3.2. `tests/README.md` — добавить в «Test Rules» пункт «независимость от
значений контента» со ссылкой на `docs/agents/TESTING.md` (правило 7).

3.3. `docs/agents/protocols/content-addition.md` — проверить, что протокол
добавления контента не требует писать data-assert'ы; при необходимости
добавить строку «тесты нового контента — только структурная валидация +
механика на моках».

### 4. Прогоны и приёмка

- `npm test` — полный прогон зелёный.
- `npm run typecheck`.
- `npm run validate:content`.
- Контрольная проверка цели: временно изменить балансное значение в
  `src/content/templates/items/weapons/weapon-sword-flaming.ts`
  (например, `damage.max`) → переписанные тесты остаются зелёными →
  откатить правку.

## Вне скоупа

- Сценарии-«носители механики» на legacy-id (шаг «Ломаются при удалении»,
  кроме cat-guardian-template) — оставляем: их падение при удалении шаблона
  — осознанный сигнал, что сценарий потерял носитель.
- Актуализация устаревшей структуры каталогов в `tests/README.md`
  (отдельная задача docs_update).
- Правки движка — не требуются, меняются только тесты и документация.
