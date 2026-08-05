# План: Этап 0 — Прогрессия: реликвии и алтарь выбора

> Источники: [`roadMap.md`](../../roadMap.md) (этап 0, критерий готовности), [`docs/game-design/progression-concept.md`](../game-design/progression-concept.md) (утверждён, все 7 вопросов закрыты).
> Нерешённых вопросов не осталось — оба документа закрыты (последние решения 2026-08-04).
> Режим: system_design, кросс-системная задача (simulation + content + presentation + ui + i18n).
> Коммиты: по этапам (0.1 — строго отдельным коммитом по требованию roadmap).
> **Прогресс** отмечается в этом файле по завершении фаз.

## Статус фаз

| Фаза | Содержание | Статус |
|---|---|---|
| A | 0.1 Удаление XP-задела (отдельный коммит) | ✅ Выполнено 2026-08-05 |
| B | 0.2 Контентный тип «реликвия» + коллекция игрока | ✅ Выполнено 2026-08-05 |
| C | 0.4 Спавн poi в генераторе этажей | ⬜ |
| D | 0.5 Алтарь выбора реликвии (выбор 1 из 3) | ⬜ |
| E | 0.3 UI панель коллекции реликвий | ⬜ |
| F | 0.6 Стартовый пул реликвий | ⬜ |
| Финал | Полная проверка + документация | ⬜ |

## Ключевые факты из исследования кода

- XP-механика **никогда не работала**: `xp` не инкрементируется, `XP_PER_LEVEL` не читается, `PLAYER_LEVELED_UP` не эмитится, xp-бар в `HeroPanel` — мёртвый код (`maxXp` никому не передаётся). Виден только бейдж «1» на портрете.
- Контентная категория = 6 точек подключения: схема (`src/content/schemas.ts`), шаблоны (`src/content/templates/<кат>/` + index), `buildContent()` (`templates/index.ts`), реестр (`src/content/registry.ts`), тексты (`src/content/texts/{ru,en}/`), валидация (3 места: `content-rules/validation.ts`, `validate-references.ts`, `scripts/validate-content.ts`). Поля `LoadedContent` опциональны ради тестовых моков — `relics?` делать так же.
- Правила экипировки: `addActiveRulesForItem` кладёт `ownerContext = { type: 'entity', entityId }`, дедуп по `(ruleId, ownerContext)`; `rebuildActiveRules` (`src/simulation/systems/rules/active-rule-lifecycle.ts:205`) пересобирает всё — сюда добавится сбор правил реликвий.
- **Стаки**: `addModifier` мержит по `(source, stat)` → каждый стак реликвии обязан иметь уникальный source (`relic_{instanceId}`), тогда N стаков = N суммируемых записей и N регистраций правил (= «каждый стак — дополнительный экземпляр эффекта», вопрос №6 концепта).
- Игрок **не входит** в `FloorSnapshot` → коллекция реликвий в `PlayerEntity` живёт через этажи автоматически. Поле предложения в `PointOfInterestEntity` попадёт в снапшот без дополнительной работы.
- Генератор poi сейчас **не спавнит вообще**; фабрика `createPoi` есть (`map-generation/shared.ts:331`). `GeneratedMap` не имеет поля `pois`; потребителей два: `simulation.ts:771-824` и `floor-transition-planner.ts:59-78`.
- Контракт poi: `executeActivatePoiIntent` тратит `charges` **при активации**. Концепт требует тратить заряд только на взятие реликвии → для алтаря выбора заряд тратит отдельное действие выбора.
- Модальных окон в проекте нет; ближайший паттерн «ожидание выбора» — таргетинг (`itemTargeting` в `gameSession.ts`). Модалка = поле в `GameViewModel` + методы session. Осиротевшие стили `.cm-skill-choice*` в `runtime.css:72-183` — готовая база для окна «1 из 3».
- Генерация предложения — только через `state.rng` (детерминизм забега).
- i18n две системы: i18next (`src/i18n/`) для UI-строк и `src/content/texts/` для контентных имён/описаний — для реликвий трогаем обе, зеркаля ru/en.

---

## Фаза A — 0.1 Удаление XP-задела (ОТДЕЛЬНЫЙ КОММИТ)

Не трогать: уровни способностей (`grantedAbilities[].level`, `RuntimeAbility.level`, `level: 1` у innate-способностей врагов, формулы урона), `debugPanel.levelLabel` (этаж), `itemDetail.abilityLevelPrefix`.

**Simulation:**
- `src/simulation/types.ts:167-170` — поля `PlayerEntity.xp/level`; `:469-471` — `PlayerStatsSnapshot.level/xp`.
- `src/simulation/core-types.ts:174` — убрать `'levelup'` из `RuntimeAbility.source`; `:508` и `:619` — удалить `PlayerLeveledUpEvent` из union и сам тип.
- `src/simulation/state.ts:68-69`, `src/simulation/characterCreation.ts:49-50` — инициализация/сброс.
- `src/simulation/simulation.ts:283-284, 937-938` — snapshot'ы.
- `src/utils/constants.ts:67-68` — `XP_PER_LEVEL`.
- Комментарии: `active-rule-lifecycle.ts:167`, `revoke-ability-intent-executor.ts:7-8,27`.

**Content:**
- `src/content/schemas.ts:96` — `xpReward` из `EntityTemplateSchema`; шаблоны `templates/entities/{cat-small:40, cat-mid:47, cat-big:52, cat-guardian:50}.ts`.

**Presentation:**
- `displayState/types.ts:29-30, 170-173, 230`; `displayState/builder.ts:34-36, 297-298, 516-521`; `fogFilter.ts:96` (case в fallthrough — typecheck сломается, если забыть); `presentation/types.ts:265-266` (`'levelup'` в `PlayerSkillViewModel.source`).

**UI:**
- `HeroPanel.tsx` (props `level`/`xp`/`maxXp`, xp-бар), `Portrait.tsx` (бейдж), `ResourceBar.tsx:6` (`'xp'` из union), `SkillsPanel.tsx:24-25,36-37` (ветки `'levelup'`).
- Вызовы: `GameScreen.tsx:355,360`, `EndingScreen.tsx:89,94`, `CharacterCreationScreen.tsx:254`.
- Стили: `game-screen.css:21-22, 436, 525-529`; `src/ui/README.md:38`.

**i18n (schema + ru + en синхронно, иначе упадёт `validate:i18n`):**
- `common.game.xp/level`, `components.heroPanel.xpLabel`, `components.skillsPanel.levelupSkillTooltip`, `components.portrait.levelAriaLabel`.

**Ассеты:** удалить `public/assets/icons/xp.svg`, перегенерировать `public/assets/manifest.json` (`scripts/generate-asset-manifest.js`).

**Тесты:** `tests/fixtures/gameState.ts:75-76`; `unit/simulation/getPlayerStats.test.ts:120-121`; `unit/presentation/displayState/builder.test.ts:58, 611-617`; `unit/content/cat-guardian-template.test.ts:40`; `unit/simulation/mapgen.test.ts:17`, `post-death-loot-reaction.test.ts:17`, `integration/loot-drop-cycle.test.ts:20`; ручные моки в `unit/ui/renderer/{WorldRenderer,EntityRenderer,TargetingRenderer,UnitInfoRenderer}.test.ts`.

**Документация:** актуализировать упоминания XP в `docs/game-design/mechanics-overview.md`, `docs/recipes/add-enemy.md`, `docs/architecture/CONTENT_PIPELINE.md`, `docs/agents/I18N.md`, `src/utils/README.md`; запись в `SYNC_STATUS.md` (требование roadmap).

**Проверка:** `npm run typecheck`, тесты изменённых областей, `npm run validate:i18n`, `validate:content`. → **Коммит 1: «Удаление XP-задела (roadmap 0.1)»**.

---

## Фаза B — 0.2 Контентный тип «реликвия» + коллекция игрока

**Схема и пайплайн:**
- `src/content/schemas.ts`: `RelicTemplateSchema` — `id`, `ruleIds: RuleIdsSchema`, `statModifiers` (shape как `equipModifiers`, schemas.ts:155-159), `stackable: boolean`, опционально `grantedAbilities` (по образцу schemas.ts:166; в MVP не используется), `icon`/`fallback`/`rarity` для UI. `RelicTemplateInput` через `z.input<>`; `relics?: Map<string, RelicTemplate>` в `LoadedContent`.
- `src/content/templates/relics/index.ts` (пустой массив `relicTemplates` до фазы F) + `buildCategory('relics', …)` в `templates/index.ts`.
- `src/content/registry.ts`: `LocalizedRelicTemplate` + геттеры (`getRelic`/`tryGetRelic`/`getLocalizedRelic`/`getAllRelics`/`getAllLocalizedRelics`).
- Тексты: категория `relics` в `ContentTexts` (`texts/types.ts`), файлы `texts/ru/relics.ts` + `texts/en/relics.ts`, регистрация в `texts/{ru,en}/index.ts`.
- Валидация: цикл ruleIds для relics в `src/simulation/content-rules/validation.ts:34-91`; `grantedAbilities → abilities` в `src/content/validate-references.ts`; категория в `scripts/validate-content.ts:43-57`.

**Симуляция:**
- `src/simulation/types.ts`: в `PlayerEntity` — `relics: Array<{ instanceId: string; templateId: string }>` (плоская сериализуемая запись по правилам types.ts:5-8). Технический лимит — `MAX_RELICS = 100` в `src/utils/constants.ts`.
- `state.ts` (`createInitialPlayer`) — `relics: []`; `characterCreation.ts` (`applyCharacterConfig`) — сброс коллекции при новом забеге.
- Новый интент `GRANT_RELIC` + исполнитель (по образцу `grant-ability-intent-executor`): запись в коллекцию (с проверкой лимита), `addModifier` × N с `source: 'relic_{instanceId}'`, пересборка правил; `instanceId` — через `state.nextEntityCounter`.
- `active-rule-lifecycle.ts`: в `rebuildActiveRules` — сбор правил из коллекции реликвий с `ownerContext.entityId = relic.instanceId` (уникально на стак → стаки суммируются и модификаторами, и срабатываниями правил).
- Пара remove-хелперов (`removeModifiersBySource('relic_…')` уже есть) — заложить remove-функцию правил по префиксу для будущей «замены реликвий» (без UI).

**Тесты:** схема/реестр/локализация (по образцу `tests/unit/content/registry.test.ts`); юнит на GRANT_RELIC: модификаторы суммируются по стакам (уникальный source), правила регистрируются N раз, лимит 100, сброс в `applyCharacterConfig`.

→ **Коммит 2: «Контентный тип реликвии и коллекция игрока (roadmap 0.2)»**.

---

## Фаза C — 0.4 Спавн poi в генераторе этажей

- `MapParamsSchema` (`schemas.ts:300`): `poiPool: string[]` (по образцу `itemPool`); обновить шаблоны `templates/maps/{floor-1,floor-2,default}.ts`.
- `map-generation/types.ts`: `GeneratedMap.pois: PointOfInterestEntity[]`.
- `tree-room-strategy.ts`: после вычисления `playerStart` — гарантированный спавн алтаря выбора: клетка **соседняя** со спавном в корневой комнате (`rooms[0]`), пол, свободная по `canPlaceObjectAt(state, 'solid', pos)` (на этажах >1 на клетке спавна стоит лестница вверх — ставить рядом, не на спавн). Случайность — только `state.rng`.
- Потребители: `simulation.ts:771-824` и `floor-transition-planner.ts:59-78` — добавить `...generated.pois` в сущности этажа (иначе алтарь будет только на 1-м этаже).
- Остальные poi из `poiPool` — по плотности/комнатам по образцу item-спавна (минимально: только гарантированный алтарь + опциональный спавн из пула, если пул задан).

**Тесты:** `tests/unit/simulation/tree-room-strategy.test.ts` — алтарь есть на каждом этаже, смежен спавну, не перекрывает лестницу/двери; снапшот-возврат сохраняет poi.

→ **Коммит 3: «Спавн poi в генераторе этажей (roadmap 0.4)»**.

---

## Фаза D — 0.5 Алтарь выбора реликвии

**Simulation:**
- `MapParamsSchema.relicPool: string[]` (по образцу `itemPool`) + шаблоны карт (пустые пулы до фазы F); валидация ссылок `relicPool → relics` в `validate-references.ts`.
- `PointOfInterestEntity` (`types.ts:308-314`): поле `relicOffer?: string[]` (id реликвий) — автоматически входит в снапшот этажа.
- Новый шаблон poi `relic_altar` (`templates/pois/relic-altar.ts`, `interactionKind: 'poi'`, `charges: 1`, `spriteVariants` для `depleted`) + тексты ru/en + спрайты `public/assets/objects/pois/relic-altar.png` (+ `_depleted`, заглушки по образцу существующих скриптов `scripts/gen-*.py`).
- `executeActivatePoiIntent`: ветка для poi с `relicOffer`-механикой (по тегу шаблона, напр. `tags: ['relic_altar']`): первая активация генерирует 3 реликвии из `relicPool` через `state.rng` (исключая уникальные, уже имеющиеся у игрока), пишет в `relicOffer`, **не тратит `charges`**; повторные активации — только событие `POI_USED`. Обычные poi — без изменений.
- Новый `GameAction CHOOSE_RELIC { poiId, relicId }` → интент → исполнитель: проверки (poi жив, заряд > 0, реликвия из `relicOffer`), `GRANT_RELIC`, декремент `charges` (спрайт → `depleted` автоматически через `STATE_RESOLVERS`), очистка `relicOffer`. Отказ — чисто UI, без dispatch.

**Presentation/UI (модалка «1 из 3»):**
- В `dispatchAction`/`onAnimationsComplete` (`gameSession.ts`): после активации алтаря (poi с заполненным `relicOffer` и `charges > 0`) — выставить `relicChoice: { poiId, options: LocalizedRelicTemplate[] } | null` в `GameViewModel`; гасить `autoPath` по образцу `beginItemTargetingIfNeeded`.
- Методы session: `chooseRelic(relicId)` → dispatch `CHOOSE_RELIC`, `dismissRelicChoice()` → сброс поля без dispatch.
- `src/ui/components/RelicChoiceModal.tsx`: `createPortal` по образцу `DetailPopover`, карточки 3 реликвий (иконка, имя, описание) на базе осиротевших стилей `.cm-skill-choice*` (`runtime.css:72-183`, переименовать/обобщить), кнопка отказа; блокировка ввода по образцу `isTargeting()` во всех входных точках `GameScreen`.
- i18n: `components.relicChoice*` в `schema.ts` + ru/en.
- Лог-запись при взятии реликвии (маппер логов рядом с `logs.append`).

**Тесты:** генерация предложения при первой активации и его неизменность при повторной; уникальные имеющиеся реликвии исключены; `charges` не тратится на активацию и тратится на выбор; отказ не меняет состояние; `relicOffer` переживает уход/возврат на этаж (снапшот); детерминизм через seeded rng.

→ **Коммит 4: «Алтарь выбора реликвии: выбор 1 из 3 (roadmap 0.5)»**.

---

## Фаза E — 0.3 UI коллекции реликвий

- Presentation: `RelicViewModel` + поле в `RenderInput` (`presentation/types.ts:547+`), сборка в `GameSession.buildRenderInput` из `player.relics` (группировка по templateId → стаки); маппер поповера по образцу `poiDetailMapper.ts`.
- `src/ui/components/RelicsPanel.tsx`: `Panel` + сетка ячеек по образцу `InventoryPanel` (`cm-sprite-stack`, бейдж количества при стаках > 1), поповер по образцу `ItemDetailPopover` (имя, описание, стаки, правила/модификаторы текстом из шаблона). Размещение в правой колонке `GameScreen` рядом с `SkillsPanel`.
- Иконки реликвий в `public/assets/` (заглушки) + перегенерация манифеста.
- i18n: `components.relicsPanel*` (schema + ru/en).

**Тесты:** сборка ViewModel (стаки, порядок); наличие панели в `GameScreen`.

→ **Коммит 5: «Панель коллекции реликвий (roadmap 0.3)»**.

---

## Фаза F — 0.6 Стартовый пул реликвий

Пул под существующую выразительность DSL (без расширения; `chance` не использовать — решение 2026-08-04). Предлагаемый набор (финальные числа — при реализации):
1. `relic_sharpened_instinct` — `damage add +2` (обычная).
2. `relic_thick_hide` — `armor add +1` (обычная).
3. `relic_vital_charm` — `maxHp add +10` (обычная).
4. `relic_ember_heart` — правило по образцу `amulet_fire_damage_multiplier` (уникальная).
5. `relic_venom_gland` — правило по образцу `weapon_poison_on_hit` (уникальная).
6. `relic_spiked_carapace` — правило по образцу `armor_spiked_thorns` (обычная).
- Новые ruleIds — в `CONTENT_RULES` (`content-rules/rules.ts`) в рамках существующего DSL.
- `relicPool` в `templates/maps/floor-1.ts` (и floor-2/default — тот же пул или подмножество), `poiPool: ['relic_altar']` (заполняется в фазе C/D).
- Тексты ru/en, иконки, манифест.

**Тесты:** валидация контента зелёная; юнит на каждое правило реликвии по образцу существующих rule-тестов.

→ **Коммит 6: «Стартовый пул реликвий (roadmap 0.6)»**.

---

## Документация (по ходу фаз)

- Новый рецепт `docs/recipes/add-relic.md` (по образцу `add-poi.md`) — фаза B.
- `src/content/AGENTS.md` (структура, таблица задач), `src/simulation/AGENTS.md` при необходимости.
- `docs/game-design/mechanics-overview.md`: убрать «генератор не размещает poi» из пробелов, добавить реликвии в обзор механик.
- `docs/agents/SYNC_STATUS.md`: записи по завершении 0.1 (требование roadmap) и этапа 0 целиком; `docs/agents/INDEX.md` — новый рецепт.
- `roadMap.md`: отметить этап 0 выполненным.

## Финальная проверка (критерий готовности roadmap)

- На каждом этаже у старта стоит алтарь выбора; выбор 1 из 3 работает, отказ и повторное открытие дают то же предложение; взятая реликвия регистрирует правила/модификаторы и видна в панели; XP-задел удалён.
- `npm run typecheck`, полный прогон тестов, `npm run validate:content`, `npm run validate:i18n` — зелёные.
- Ручная проверка в браузере (`npm run dev`): активация алтаря, модалка, выбор, стаки в панели, переход между этажами.

## Риски / подводные камни

1. Уникальность `source` модификаторов и `ownerContext` правил на стак — иначе стаки перезаписываются вместо суммирования (`modifier-engine.ts:64-70`, `hasActiveRule`).
2. Синхронность i18n schema↔ru↔en и явные перечисления категорий в трёх валидаторах — забытая строка = молча непокрытая категория.
3. Модалку открывать только после завершения анимаций (`phase === 'animating'` блокирует ввод) и гасить `autoPath`.
4. Генерация предложения — только `state.rng` (детерминизм).
5. Старые сейвы сломаются новым полем `PlayerEntity` — приемлемо: сейвы не реализованы.
6. Зависимость фаз: D опирается на B (GRANT_RELIC) и C (спавн алтаря); F заполняет пулы, без которых алтарь нечего предложит — порядок коммитов A→B→C→D→E→F.

---

## Журнал выполнения

| Дата | Фаза | Что сделано | Проверка |
|---|---|---|---|
| 2026-08-05 | A (0.1) | XP-задел удалён полностью: поля `xp`/`level` игрока и snapshot, `xpReward` (схема + 4 кота), `XP_PER_LEVEL`, событие `PLAYER_LEVELED_UP` (+обработка в presentation), `source: 'levelup'`, xp-бар и бейдж уровня в UI, 4 i18n-ключа (namespace `portrait` удалён целиком как опустевший), `xp.svg` + манифест, тесты и документация (`mechanics-overview`, `add-enemy`, `CONTENT_PIPELINE`, `I18N.md`, `src/ui/README.md`). Запись в `SYNC_STATUS.md`. Коммит `f4dd603`. В коммит случайно вошли незакоммиченные правки пользователя (`roadMap.md`, `content-rules/{types,AGENTS,README}`) — оставлено как есть. | typecheck ✅, 165 файлов / 1385 тестов ✅, validate:i18n ✅, validate:content ✅, Grep по остаткам XP — чисто ✅ |
| 2026-08-05 | B (0.2) | Контентный тип «реликвия» + коллекция игрока: `RelicTemplateSchema` (общая подсхема `StatModifierEntrySchema` вынесена из `equipModifiers`), категория `templates/relics/` (пустая до фазы F), `relics?` в `LoadedContent`, геттеры реестра + `LocalizedRelicTemplate`, тексты `texts/{ru,en}/relics.ts`, валидация ruleIds / `grantedAbilities → abilities` / категория в `validate-content.ts`. Simulation: `RelicInstance` + `PlayerEntity.relics` (инициализация в `state.ts`, сброс в `applyCharacterConfig`), `MAX_RELICS = 100`, интент `GRANT_RELIC` + исполнитель (отказы: лимит, нестакаемая повторно, неизвестный шаблон), source модификаторов `relic_{instanceId}` (двойной префикс — по конвенции `item_item_N` у предметов), блок реликвий в `rebuildActiveRules` + `addActiveRulesForRelic`/`removeActiveRulesForRelic`, `removeRelicFromPlayer` (заготовка «замены»). Уточнения к плану по итогам проектирования: добавлено событие `RELIC_GRANTED` (case `NO_OP` в `displayState/builder.ts`); `grantedAbilities` оставлено в схеме по решению пользователя. Тесты: `relic-registry.test.ts`, `grant-relic-intent.test.ts`; моки игрока (`makePlayer`, 4 ручных мока ui/renderer) дополнены полем `relics`. Доки: рецепт `docs/recipes/add-relic.md`, `src/content/AGENTS.md`, `docs/recipes/README.md`. | typecheck ✅, 167 файлов / 1405 тестов ✅, validate:content ✅, validate:i18n ✅ |
