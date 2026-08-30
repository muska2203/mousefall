# legacy/ — архив контента первой итерации

Сюда перемещены шаблоны снаряжения, модификаторов и реликвий первой итерации
(2026-09-01, план [`docs/plans/legacy-content-archival.md`](../../../docs/plans/legacy-content-archival.md)).

- Файлы **не регистрируются** в `buildContent()` — в игре их нет.
- Файлы остаются под `typecheck`: при изменении схем (`src/content/schemas.ts`)
  их нужно поддерживать компилируемыми.
- Спрайты (`public/assets/items/`, `public/assets/relics/`) и тексты
  (`src/content/texts/{ru,en}/`) намеренно сохранены и будут переиспользованы
  при переработке предметов под билды.
- Движковые правила из `src/simulation/content-rules/rules.ts`, на которые
  ссылаются эти шаблоны, не удалены — без источников они не активируются.
- Тесты механик используют эти шаблоны через хелпер `registerLegacyTemplates()`
  (`tests/integration/combat-scenarios/helpers.ts`).

Текущий состав архива (после возврата 4 единиц кровавой ветки билдов,
этап 0 плана [`docs/plans/bleed-builds-implementation.md`](../../../docs/plans/bleed-builds-implementation.md)):

- `items/weapons/cat-guardian-maul.ts`, `items/armor/cat-guardian-plate.ts` —
  экипировка босса (спрайтов нет);
- `modifiers/` — 10 модификаторов первой итерации;
- `relics/` — 7 реликвий первой итерации.

Возвращены в активный контент (перенос + регистрация в `index.ts` категории):
модификаторы `mod_blood_on_hit`, `mod_blood_execute`, `mod_spiked_thorns`
и реликвия `relic_blood_pact`; `weapon_sword_splinter_blade` и
`armor_light_spiked_cloak` получили обратно свои `fixedModifiers`.

Остальное снаряжение возвращено в активный контент с новыми id по схеме
`{type}_{subtype}_{name}` (маппинг — раздел «Возврат предметов» в плане
архивации).

Возврат предмета в игру = переработка шаблона + перенос обратно в
`templates/<категория>/` + строка в `index.ts` категории + тексты (уже есть)
+ прогон `npm run validate:content`.
