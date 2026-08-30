# План: архивация текущего снаряжения (legacy-контент)

> Статус: утверждён пользователем (вариант A — архивная подпапка). Дата: 2026-09-01.

## Цель

Убрать из игры всё текущее снаряжение, реликвии и модификаторы, чтобы
реализовывать предметы для билдов, не отвлекаясь на тестовые объекты.
Шаблоны не удаляются: спрайты, тексты и механики сохраняются для
последующей переработки. Расходники (consumables) остаются активными.

## Решение

Перенос шаблонов в `src/content/templates/legacy/` без регистрации в
`buildContent()`. Файлы остаются под `typecheck` (не протухают при
изменении схем), спрайты и тексты не трогаем (валидация идёт от реестра,
лишние ключи/ассеты — не ошибка).

## Скоуп

Архивируются:

- `items/amulet/` — все 4 шаблона;
- `items/armor/` — все 4 шаблона;
- `items/weapons/` — все, КРОМЕ `unarmed` (захардкожен в движке:
  `starting-equipment.ts`, `unequip-action.ts`, `equip-action.ts`);
- `modifiers/` — все 13 шаблонов (включая модификаторы врагов);
- `relics/` — все 8 шаблонов.

Остаются активными: расходники (7) и `unarmed`.

## Шаги

1. Переместить файлы в `src/content/templates/legacy/{items/{amulet,armor,weapons},modifiers,relics}/`.
   Импорты `schemas` в перемещённых файлах — поправить (+1 уровень `../`).
2. Обновить реестры:
   - `items/index.ts` — только расходники + `unarmed`;
   - `modifiers/index.ts`, `relics/index.ts` — пустые массивы.
3. Почистить перекрёстные ссылки (иначе падает `validate:content`):
   - `entities/cat-small.ts`, `cat-mid.ts`, `cat-big.ts`, `cat-guardian.ts`:
     из `lootTable` убрать архивные предметы (остаётся `health_potion`),
     поле `modifiers` убрать;
   - `players/*.ts` (7 файлов): убрать `starterEquipment` (движок сам
     экипирует `unarmed`), у ведьмака убрать `starterRelicPool`;
   - `room-types/normal-deep.ts`: `itemPool` → `['health_potion']`
     (`normal.ts` не трогаем — там только расходники);
   - `maps/default.ts`, `floor-1.ts`, `floor-2.ts`: убрать `relicPool`.
4. Тесты:
   - `cat-guardian-template.test.ts` — обновить пути импортов на legacy
     и ожидания (HP 100 → 90, lootTable, modifiers);
   - боевые сценарии на реальном контенте (`combat-scenarios/`):
     `blunt-daze`, `fire`, `burning-object`, `poison-counter`, `bulwark` —
     перевести с архивных шаблонов на мок-шаблоны с теми же ruleIds
     (прецедент — `on-kill-rules-scenario.test.ts`);
   - `guardian-boss-scenario.test.ts` — ожидание HP;
   - прогнать полный `npm test`, починить остальной fallout.
5. Прогоны: `npm run validate:content`, `npm run typecheck`, `npm test`.
6. Документация: `src/content/AGENTS.md` (структура + пометка про legacy),
   `docs/agents/SYNC_STATUS.md` (статусы equipment-modifiers-concept и
   progression-concept → контент архивирован, переработка предстоит).

## Не делаем

- Не удаляем файлы, спрайты (`public/assets/items/`, `public/assets/relics/`),
  тексты (`texts/{ru,en}/`), правила в `simulation/content-rules/rules.ts`
  (без источников они не активируются — мёртвый, но безопасный код).
- Не меняем схемы и движок.

## Возврат предметов (2026-09-01)

7 предметов со скиллами и спрайтами возвращены из legacy в активный контент
с новыми id по схеме `{type}_{subtype}_{name}`:

| Старый id | Новый id |
|---|---|
| `common_hat_pin` | `weapon_sword_hat_pin` |
| `common_splinter_blade` | `weapon_sword_splinter_blade` |
| `common_school_wand` | `weapon_staff_school_wand` |
| `common_sling` | `weapon_sling` |
| `common_patch_cloak` | `armor_light_patch_cloak` |
| `common_spiked_cloak` | `armor_light_spiked_cloak` |
| `common_tin_plate` | `armor_heavy_tin_plate` |

`fixedModifiers` сняты (модификаторы не возвращаются — ждут переработки
под билды). Предметы не добавлялись в дроп/спавн (`lootTable`, `itemPool`,
`starterEquipment`).

Там же 2026-09-01 возвращены оставшиеся 6 предметов со спрайтами (без
скиллов, `fixedModifiers` сняты):

| Старый id | Новый id |
|---|---|
| `common_flaming_sword` | `weapon_sword_flaming` |
| `common_venom_dagger` | `weapon_dagger_venom` |
| `common_ember_amulet` | `amulet_charm_ember` |
| `common_energized_bead` | `amulet_bead_energized` |
| `common_glass_bead` | `amulet_bead_glass` |
| `common_knotted_fang` | `amulet_talisman_knotted_fang` |

Боевые сценарии механик (огонь ×1.5, яд) регистрируют в тестах копии
активных шаблонов с восстановленным `fixedModifiers` поверх реестра,
модификаторы — из legacy как раньше.

В legacy остались только: `cat_guardian_maul`, `cat_guardian_plate`
(спрайтов нет), все модификаторы, все реликвии.
