import type {ItemTemplateInput} from '../../schemas';
import {healthPotion} from './consumables/health-potion';
import {flourPouch} from './consumables/flour-pouch';
import {fragBomb} from './consumables/frag-bomb';
import {incendiaryBomb} from './consumables/incendiary-bomb';
import {oilBottle} from './consumables/oil-bottle';
import {smokeBomb} from './consumables/smoke-bomb';
import {waterBall} from './consumables/water-ball';
import {unarmed} from './weapons/unarmed';

/**
 * Все шаблоны категории «items». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Снаряжение первой итерации (оружие, броня, амулеты) архивировано в
 * `templates/legacy/items/` (2026-09-01, план `docs/plans/legacy-content-archival.md`):
 * ждёт переработки под билды. Активны только расходники и `unarmed`
 * (движковая заглушка слота оружия — удалять нельзя).
 */
export const itemTemplates: ItemTemplateInput[] = [
  healthPotion,
  flourPouch,
  fragBomb,
  incendiaryBomb,
  oilBottle,
  smokeBomb,
  waterBall,
  unarmed,
];
