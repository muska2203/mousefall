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
| C | 0.4 Спавн poi в генераторе этажей | ✅ Выполнено 2026-08-05 |
| D | 0.5 Алтарь выбора реликвии (выбор 1 из 3) | ✅ Выполнено 2026-08-05 |
| E | 0.3 UI панель коллекции реликвий | ✅ Выполнено 2026-08-05 |
| F | 0.6 Стартовый пул реликвий | ✅ Выполнено 2026-08-05 (до фазы E) |
| Финал | Полная проверка + документация | ✅ Выполнено 2026-08-06 |

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

Решения при проектировании (2026-08-05): система типов комнат (решение №4 roadMap) в фазу C **не входит** — реализуется в этапе 1; вместо `poiPool` из исходного текста — временное `startPoiId`; случайный спавн poi из пула не делаем; шаблон `relic_altar` перенесён сюда из фазы D; соседство со спавном — 8 клеток.

**Контент (перенесено из фазы D):**
- `templates/pois/relic-altar.ts` (`interactionKind: 'poi'`, `ruleIds: []`, `charges: 1`, `tags: ['relic_altar']`, без `spriteVariants` — `depleted` работает по конвенции `<id>_depleted.png`) + регистрация в `templates/pois/index.ts`, тексты `texts/{ru,en}/environment.ts` (запись `pois.relic_altar`), спрайты-заглушки `public/assets/objects/pois/relic_altar.png` + `relic_altar_depleted.png` (`scripts/gen-placeholder-sprite.py`), перегенерация манифеста. Механика предложения — в фазе D.

**Схема:**
- `MapParamsSchema.startPoiId: string?` (`schemas.ts`) — poi, гарантированно размещаемый в стартовой комнате; помечен как временная мера до типов комнат. Шаблоны `templates/maps/{floor-1,floor-2,default}.ts`: `startPoiId: 'relic_altar'`. Валидация ссылки `startPoiId → pois` в `validate-references.ts`.

**Генератор:**
- `map-generation/types.ts`: `GeneratedMap.pois: PointOfInterestEntity[]`.
- `tree-room-strategy.ts`: `spawnStartPoi` — после спавна врагов/предметов, до дверей; 8 соседей `playerStart` внутри корневой комнаты, фильтр `canPlaceObjectAt(state, 'solid', pos, index)`, `rngShuffle` по `state.rng`, poi попадает в индекс занятых слотов перед `buildDoors`. Нет валидной клетки — `console.warn`, без падения. Лестницы создаются потребителями после `generate()`, поэтому клетка спавна (stairsUp на этажах > 1) исключена из кандидатов по построению.
- Потребители: `simulation.ts` и `floor-transition-planner.ts` — `...generated.pois` в сущности этажа; снапшоты сохраняют poi без дополнительной работы.

**Тесты:** `tests/unit/simulation/tree-room-strategy.test.ts` — алтарь смежен спавну (8-соседство), внутри корневой комнаты, не перекрывает двери/клетку спавна, отсутствует без `startPoiId`, детерминизм по seed; `floor-transition-planner.test.ts` — poi в сущностях нового этажа и переживает снапшот-возврат.

→ **Коммит 3: «Спавн poi в генераторе этажей (roadmap 0.4)»**.

---

## Фаза D — 0.5 Алтарь выбора реликвии

Решения при проектировании (2026-08-05, сравнительный анализ вариантов — частная механика / pending choice в `GameState` / дескриптор окна + реестры; выбран третий как обобщённый каркас под будущие оконные объекты — магазин и пр.):
- Дескриптор `window` в шаблоне poi + реестр механик окон вместо ветки по тегу в исполнителе; универсальный action `RESOLVE_POI_CHOICE` вместо специфичного `CHOOSE_RELIC`; единое поле `pendingWindow` в presentation вместо `relicChoice`.
- Семантика заряда — явное поле шаблона `chargeSpentOn: 'activation' | 'resolution'`: у алтаря заряд тратится на выбор, у обычных poi — на активацию; многоразовый магазин (этап 2) — окно без списания заряда на открытие.
- Активация окна = 0 AP, выбор = 1 AP (уточнено 2026-08-05: AP списывается при выходе из окна по образцу пошаговых игр; отказ — чисто UI, 0 AP, без dispatch). Открытое окно не ставит мир на паузу; повторная активация открывает то же предложение.
- Состояние предложения хранится на сущности (`poi.offer`) — снапшот этажа и детерминизм бесплатно; в union `PoiWindowKind` пока только `'relic_choice'`.

**Контент:**
- `PoiTemplateSchema` (`schemas.ts:380-390`): `window?: { kind: 'relic_choice'; offerSize: number }` (discriminated union, расширяемый новыми видами окон) + `chargeSpentOn?: 'activation' | 'resolution'` (default `'activation'`).
- `templates/pois/relic-altar.ts`: `window: { kind: 'relic_choice', offerSize: 3 }`, `chargeSpentOn: 'resolution'` (`charges: 1`, `ruleIds: []`, спрайты и тексты — уже из фазы C).
- `MapParamsSchema.relicPool: string[]` (по образцу `itemPool`) + шаблоны карт (пустые пулы до фазы F); валидация ссылок `relicPool → relics` в `validate-references.ts`.

**Simulation:**
- `PointOfInterestEntity` (`types.ts:313-319`): поле `offer?: string[]` (id реликвий/товаров) — автоматически входит в снапшот этажа.
- Новый модуль `src/simulation/systems/poi-windows/`: интерфейс `PoiWindowMechanic { onActivate, resolve }` + реестр `POI_WINDOW_MECHANICS`. Механика `relic_choice`: `generateRelicOffer` — `offerSize` уникальных id из `relicPool` этажа через `state.rng`, исключая нестакаемые реликвии, уже имеющиеся у игрока; повторная активация — тот же offer; пустой пул — окно не открывается. `grantChosenRelic` — проверки (poi жив, `charges > 0`, `optionId ∈ offer`), `GRANT_RELIC`, декремент `charges` (спрайт → `depleted` автоматически через `STATE_RESOLVERS`), очистка `offer`.
- `executeActivatePoiIntent`: при наличии `template.window` — делегировать `mechanic.onActivate`; при `chargeSpentOn: 'resolution'` заряд не списывать; событие `POI_USED` эмитится в любом случае. Обычные poi — без изменений.
- Новый `GameAction RESOLVE_POI_CHOICE { entityId, poiId, optionId }` (validate → intent → исполнитель → `mechanic.resolve`). Стоимость 1 AP (активация окна — 0 AP).

**Presentation/UI (модалка «1 из 3»):**
- `GameSession`: поле `pendingWindow: { kind, poiId } | null` + `isWindowOpen()` (рядом с `isTargeting()`); выставление после `dispatchAction`/`onAnimationsComplete` (только после завершения анимаций; poi с `window`, заполненным `offer` и `charges > 0`); гашение `autoPath` по образцу `beginItemTargetingIfNeeded`.
- `RenderInput.pendingWindow`: `{ kind, title, options: LocalizedRelicTemplate[] }` — сборка из реестра контента по `poi.offer`.
- Методы session: `resolveWindowChoice(optionId)` → dispatch `RESOLVE_POI_CHOICE` + сброс поля; `dismissWindow()` → сброс поля без dispatch.
- `src/ui/components/RelicChoiceModal.tsx`: `createPortal` по образцу `DetailPopover` + `.cm-modal-backdrop` (`runtime.css:1-13`), карточки 3 реликвий (иконка, имя, описание) на базе осиротевших стилей `.cm-skill-choice*` (`runtime.css:72-185`, переименовать/обобщить в `.cm-choice-*`), кнопка отказа; реестр `WINDOW_COMPONENTS` по `kind` в `GameScreen` (рендер рядом с `ToastContainer`); блокировка ввода через `isWindowOpen()` во всех входных точках `GameScreen`.
- i18n: `components.relicChoice*` в `schema.ts` + ru/en.
- Лог-запись при взятии реликвии: case `RELIC_GRANTED` в `gameEventToLog` (`logBuilder.ts`).

**Тесты:** генерация предложения при первой активации и его неизменность при повторной; нестакаемые имеющиеся реликвии исключены; `charges` не тратится на активацию и тратится на выбор; активация окна = 0 AP, выбор = 1 AP; выбор последним AP проходит; выбор при 0 AP — отказ; невалидный `optionId` — отказ; пустой `relicPool` — окно не открывается; отказ не меняет состояние; `offer` переживает уход/возврат на этаж (снапшот); детерминизм через seeded rng; регрессионный — poi без `window` работает как раньше.

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

> **Реализовано 2026-08-05 (до фазы E).** Предлагаемый ниже набор заменён утверждённым пользователем пулом из 8 нестакаемых реликвий формата «плюс + минус» — см. запись в журнале.

Пул под существующую выразительность DSL (без расширения; `chance` не использовать — решение 2026-08-04). Предлагаемый набор (финальные числа — при реализации):
1. `relic_sharpened_instinct` — `damage add +2` (обычная).
2. `relic_thick_hide` — `armor add +1` (обычная).
3. `relic_vital_charm` — `maxHp add +10` (обычная).
4. `relic_ember_heart` — правило по образцу `amulet_fire_damage_multiplier` (уникальная).
5. `relic_venom_gland` — правило по образцу `weapon_poison_on_hit` (уникальная).
6. `relic_spiked_carapace` — правило по образцу `armor_spiked_thorns` (обычная).
- Новые ruleIds — в `CONTENT_RULES` (`content-rules/rules.ts`) в рамках существующего DSL.
- `relicPool` в `templates/maps/floor-1.ts` (и floor-2/default — тот же пул или подмножество); `startPoiId: 'relic_altar'` уже заполнен в фазе C.
- Тексты ru/en, иконки, манифест.

**Тесты:** валидация контента зелёная; юнит на каждое правило реликвии по образцу существующих rule-тестов.

→ **Коммит 6: «Стартовый пул реликвий (roadmap 0.6)»**.

---

## Документация (по ходу фаз)

- Новый рецепт `docs/recipes/add-relic.md` (по образцу `add-poi.md`) — фаза B.
- `docs/recipes/add-poi.md` — раздел «объект с окном» (`window`, `chargeSpentOn`, реестр механик) — фаза D.
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
| 2026-08-05 | C (0.4) | Спавн poi в генераторе этажей. Решения при проектировании: типы комнат отложены в этап 1, вместо `poiPool` — временное `MapParamsSchema.startPoiId`; случайного спавна из пула нет; шаблон `relic_altar` перенесён сюда из фазы D (тексты ru/en в `environment.ts`, спрайты-заглушки `relic_altar.png` + `_depleted` + манифест); соседство со спавном — 8 клеток. Генератор: `GeneratedMap.pois`, `spawnStartPoi` в `tree-room-strategy` (8 соседей `playerStart` в корневой комнате, `canPlaceObjectAt` с индексом, `rngShuffle` по `state.rng`, poi в индексе перед `buildDoors`, warn без падения). Потребители: `simulation.ts`, `floor-transition-planner.ts`. Валидация `startPoiId → pois` в `validate-references.ts`. Тесты: новый `tree-room-strategy.test.ts` (4 теста) + 2 теста в `floor-transition-planner.test.ts`. Доки: `mechanics-overview.md` (§6.4, §10.2), примечание в `SYNC_STATUS.md`. | typecheck ✅, 167 файлов / 1404 теста ✅ (в т.ч. 6 новых), validate:content ✅, validate:i18n ✅ |
| 2026-08-05 | D (0.5) | Алтарь выбора реликвии (выбор 1 из 3). Контент: `PoiWindowSchema` (discriminated union по `kind`, вариант `relic_choice` с `offerSize`) + `chargeSpentOn` в `PoiTemplateSchema`; `relic_altar` — `window: {kind: 'relic_choice', offerSize: 3}`, `chargeSpentOn: 'resolution'`; `MapParamsSchema.relicPool?` (пустые пулы в floor-1/floor-2/default до фазы F) + валидация ссылок `relicPool → relics`. Simulation: `PointOfInterestEntity.offer?`; новый модуль `systems/poi-windows/` (интерфейс `PoiWindowMechanic` — `onActivate`/`resolve` + опциональный `canOpen`, реестр `POI_WINDOW_MECHANICS`, механика `relic_choice`: offer через `state.rng`, исключение нестакаемых имеющихся, GRANT_RELIC + заряд на выбор); `executeActivatePoiIntent` — делегация окну, заряд по `chargeSpentOn`, `POI_USED` всегда; action `RESOLVE_POI_CHOICE` (0 AP) + интент + исполнитель. Presentation: `GameSession.pendingWindow` + `isWindowOpen()`/`resolveWindowChoice()`/`dismissWindow()`, `refreshPendingWindow` после dispatch и в `onAnimationsComplete` (гашение автопути), `RenderInput.pendingWindow` (сборка из реестра по `poi.offer`), лог `RELIC_GRANTED` (+ ключ `system.logBuilder.relicGranted` ru/en). UI: `RelicChoiceModal` (portal, `.cm-modal-backdrop`, стили `cm-skill-choice*` обобщены в `.cm-choice-*`), реестр `WINDOW_COMPONENTS` в GameScreen, блокировка ввода через `isWindowOpen()`, Escape — отказ; i18n `components.relicChoice*`. Отклонение от первоначального текста фазы: в `PoiWindowMechanic` добавлен опциональный `canOpen` + guard в validate `INTERACT` (`poi_window_unavailable`) — иначе активация алтаря с пустым пулом молча тратила 1 AP. Тесты: `poi-window-relic-choice.test.ts` (9), `pendingWindow.test.ts` (3); моки PoiTemplate дополнены `chargeSpentOn`, моки RenderInput — `pendingWindow`. Доки: `add-poi.md` (раздел «Объект с окном» + актуализирован «Спавн в игре»), `src/simulation/AGENTS.md`, `mechanics-overview.md` (§6.4, §11). Коммит не выполнялся (по инструкции). | typecheck ✅, 169 файлов / 1416 тестов ✅, validate:content ✅, validate:i18n ✅ |
| 2026-08-05 | D (0.5), уточнение | Перенос списания AP «при выходе из окна» (решение пользователя, паттерн пошаговых игр): `INTERACT` на poi с `window` и `chargeSpentOn: 'resolution'` — 0 AP (динамическая стоимость в `action-cost-resolver`, `getActionCost`/`preview` отражают её), `RESOLVE_POI_CHOICE` — 1 AP со стандартной валидацией AP; `dismissWindow` без изменений. Заодно устранён баг: активация алтаря последним AP раньше списывала его на открытие окна, и последующий выбор отклонялся как `wrong_actor`. Тесты: в `poi-window-relic-choice.test.ts` обновлены ожидания AP + добавлены регрессионный (выбор последним AP) и отказ выбора при 0 AP; в `pendingWindow.test.ts` — регрессионный на сессию с 1 AP. Доки: `add-poi.md`, `mechanics-overview.md` (§6.4). Коммит не выполнялся (по инструкции). | typecheck ✅, 169 файлов / 1419 тестов ✅, validate:content ✅, validate:i18n ✅ |
| 2026-08-05 | F (0.6) | Стартовый пул реликвий — выполнена до фазы E (решение пользователя). Пул заменён утверждённым: 8 нестакаемых реликвий формата «плюс (правило) + минус (правило или отрицательный statModifier)», общий `relicPool` на всех этажах — `relic_salamander_heart` (rare, урон оружия огненный / входящий огонь ×1.25), `relic_venom_gland` (common, яд 3 при ударе / -1 по неотравленным), `relic_acid_blood` (rare, яд 2 атакующему в melee / -1 броня), `relic_plague_bearer` (rare, зараза на врагов в радиусе 1 / яд 1 себе), `relic_thunderhead` (common, daze 1 дробящим / -1 недробящим), `relic_opportunist` (rare, +3 по ослабленным / -1 по полноценным), `relic_blood_pact` (rare, +4 ко всему урону / входящий ×1.25), `relic_scavenger` (common, heal 5 при поднятии / -5 maxHp). Контент: 13 новых правил в `CONTENT_RULES` (префикс `relic_*`, без `chance`), шаблоны `templates/relics/*.ts` + регистрация, тексты ru/en, иконки-заглушки `public/assets/relics/` (32×32, gen-placeholder-sprite) + манифест, `relicPool` во floor-1/floor-2/default. Два уточнения движка (минимальные): (1) `buildRuleContext` — case `ITEM_PICKED_UP` (sourceEntityId = entityId), иначе правило scavenger не собиралось ни в один слой; (2) `addTags` правил-модификаторов в `apply-intent-modifiers.ts` больше не проходит через `mergeDamageIntentTags` — правило может добавить вторую «школу» урона (иначе fire-тег salamander отбрасывался инвариантом «ровно один damage.*-тег»); инвариант сохранён на этапе формирования базового интента, warn о multiple damage tags в `apply-damage.ts` заменён комментарием, тест `damage-tag-invariant.test.ts` и `src/simulation/AGENTS.md` актуализированы. Тесты: `content-rules/relic-rules.test.ts` (21: плюс и минус каждого правила, нестакаемость всех 8 на реальном контенте, statModifier-минусы), интеграционный `integration/relics/salamander-fire-infusion.test.ts` (удар по врагу на масле → fire-тег → поджог). Доки: `add-relic.md` (пример «реликвия с минусом»), `mechanics-overview.md` (§9, журнал), `SYNC_STATUS.md`. Коммит не выполнялся (по инструкции). | typecheck ✅, 171 файл / 1441 тест ✅, validate:content ✅, validate:i18n ✅ |
| 2026-08-05 | E (0.3) | Панель коллекции реликвий. При старте фазы D и F обнаружены реализованными ранее (см. записи журнала выше: `RelicChoiceModal`, `pendingWindow`, 8 шаблонов + иконки `public/assets/relics/` и манифест) — статусы плана соответствуют коду. Content: `LocalizedRelicTemplate` получил `flavorText` (мерж в `getLocalizedRelic`/`tryGetLocalizedRelic`/`getAllLocalizedRelics`), всем 8 реликвиям добавлены атмосферные `flavorText` в `texts/{ru,en}/relics.ts`. Presentation: `RelicViewModel` + поле `relics` в `RenderInput`, сборка в `buildRenderInput` — группировка по templateId (порядок = порядок первого получения), count = стак, локализация через `tryGetLocalizedRelic`, `frameUrl` через `resolveItemFrame`, неизвестные шаблоны пропускаются. UI: `RelicsPanel` (панель рендерится всегда, даже пустая; одна строка ячеек `.cm-relics-*` с горизонтальным скроллом по образцу `.cm-cons-*`, бейдж стака, клик без действия) + `RelicDetailPopover` (portal, иконка в рамке редкости, описание через `RichDescription`, `flavorText`, строка стака); вставлена в GameScreen между экипировкой и инвентарём (уточнение пользователя; в плане было «рядом со SkillsPanel»). Моки RenderInput в 6 renderer-тестах дополнены `relics: []`. i18n: `components.relicsPanel*` (title/listAriaLabel/stackCount, schema + ru/en). Тесты: `relicViewModel.test.ts` (4), `relicsPanel.test.tsx` (4), `relic-registry.test.ts` (+2 на реальном контенте). Доки: `mechanics-overview.md` (§9, журнал), `SYNC_STATUS.md`. Коммит не выполнялся (по инструкции). | typecheck ✅, 173 файла / 1451 тест ✅, validate:content ✅, validate:i18n ✅ |
| 2026-08-05 | Доработка отображения реликвий (решение пользователя) | Монолитное `description` реликвий убрано совсем: механика переехала в тексты правил. Content: поле `description` удалено из всех 8 записей `texts/{ru,en}/relics.ts` (остались `name` + `flavorText`) и из `LocalizedRelicTemplate` (реестр мержит только name/flavorText); добавлены 15 записей для реликвийных ruleIds в `texts/{ru,en}/rules.ts` (name + краткое description, числа/условия сверены с `CONTENT_RULES`, тег-ссылки на существующие теги). i18n: новая группа `system.statNames` (11 ключей, schema + ru/en). Presentation: новый `RelicEffectViewModel { key, name, description }` и билдер `buildRelicEffects` (`relicDetailMapper.ts`) — правила из `getContentText('rules', …)`, затем statModifiers (имя из `system.statNames.<stat>`, значение «+N»/«−N» для add, «×N» для multiply); `RelicViewModel` — поле `effects` вместо `description`; `PendingWindowViewModel.options` — выделенный `RelicChoiceOptionViewModel` (id/name/icon/fallback/rarity/flavorText/effects) вместо `LocalizedRelicTemplate[]` (onChoose по id не сломан). UI: `RelicDetailPopover` и `RelicChoiceModal` рендерят список эффектов пунктами «имя + описание через RichDescription» (по образцу properties карточки предмета), flavorText курсивом внизу; стили `field-popover-effect*` и `cm-choice-card__effect*`/`__flavor` в `runtime.css`. Тесты: новый `relicEffects.test.ts` (7), обновлены `relicViewModel.test.ts` (+1), `pendingWindow.test.ts` (форма опций), `relic-registry.test.ts`, `relicsPanel.test.tsx`. Доки: `docs/recipes/add-relic.md` (тексты реликвий и правил), `SYNC_STATUS.md`. Отклонение: рендер-тесты модалки/поповера не добавлены — оба компонента на createPortal, а тестовая среда node (renderToString), по существующей конвенции порталы не покрываются. Коммит не выполнялся (по инструкции). | typecheck ✅, 174 файла / 1459 тестов ✅, validate:content ✅, validate:i18n ✅ |
| 2026-08-06 | Финал — ревью функциональности реликвий | Тщательное ревью (simulation + content + presentation/UI). Найдены и исправлены 3 major-бага: (1) `relic_thunderhead_daze` без `eventRole: 'source'` — правило собиралось из target-слоя и гарантированно дезило самого владельца при каждом дробящем ударе по нему (безоружные атаки котов несут `damage.physical.blunt` + `delivery.weapon`); заодно `eventRole: 'source'` добавлен в `relic_scavenger_heal_on_pickup` (латентный баг radius-слоя). Тот же изъян у исходного образца `weapon_blunt_daze` (смягчён `chance: 25`) — оставлен как pre-existing, кандидат на отдельный фикс. (2) Протухший `offer`: выбор нестакаемой реликвии, полученной на другом этаже после генерации предложения, проходил validate и молча тратил 1 AP без эффекта — добавлен опциональный `canResolve` в `PoiWindowMechanic` (зеркалит отказы GRANT_RELIC) и его вызов в validate `RESOLVE_POI_CHOICE`. (3) `refreshPendingWindow` переоткрывал окно после ЛЮБОГО dispatch — отказ (dismissWindow) фактически не работал, игрока принуждали к выбору; окно теперь открывается только по факту активации poi (`windowCandidatePoiId` выставляют действия INTERACT/RESOLVE_POI_CHOICE), dismiss больше не переоткрывается; заодно `debugRegenerateMap` сбрасывает окно (ранее — soft-lock ввода, dev-only). Minor без фикса (задокументированы): клик по backdrop модалки не закрывает её (по плану достаточно Escape/кнопки); `setHeldDirection` выставляется до проверки блокировки ввода; тексты правил не покрыты валидацией переводов; `RESOLVE_POI_CHOICE` не проверяет смежность с poi (недостижимо при заблокированном вводе). Наблюдение: поэтажные `relicPool` (floor-2) сейчас мёртвый контент — `mapParams` фиксируются на floor_1 на весь забег. Тесты: +1 в `relic-rules.test.ts` (владелец не дезится от удара по нему), +1 в `poi-window-relic-choice.test.ts` (протухшая опция), +2 в `pendingWindow.test.ts` (dismiss не переоткрывается, протухшая опция в сессии). Доки: `add-relic.md` (eventRole обязателен для плюсовых правил), `add-poi.md` (canResolve, семантика открытия окна). Коммит не выполнялся (по инструкции). | typecheck ✅, 174 файла / 1463 теста ✅, validate:content ✅, validate:i18n ✅ |
