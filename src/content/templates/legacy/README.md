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

Возврат предмета в игру = переработка шаблона + перенос обратно в
`templates/<категория>/` + строка в `index.ts` категории + тексты (уже есть)
+ прогон `npm run validate:content`.
