import type {ModifierTemplateInput} from '../../schemas';
import {modBloodExecute} from './mod-blood-execute';
import {modBloodFrenzy} from './mod-blood-frenzy';
import {modBloodOnHit} from './mod-blood-on-hit';
import {modBloodThorns} from './mod-blood-thorns';
import {modBloodWideningWound} from './mod-blood-widening-wound';
import {modSpikedThorns} from './mod-spiked-thorns';

/**
 * Все шаблоны категории «modifiers». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Модификаторы первой итерации архивированы в `templates/legacy/modifiers/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`). Три модификатора
 * кровавой ветки билдов возвращены в активный реестр (этап 0 плана
 * `docs/plans/bleed-builds-implementation.md`): mod_blood_on_hit,
 * mod_blood_execute, mod_spiked_thorns. Этап 2 того же плана добавил
 * mod_blood_widening_wound, mod_blood_thorns и mod_blood_frenzy.
 */
export const modifierTemplates: ModifierTemplateInput[] = [
  modBloodOnHit,
  modBloodExecute,
  modBloodWideningWound,
  modBloodThorns,
  modBloodFrenzy,
  modSpikedThorns,
];
