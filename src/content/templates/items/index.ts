import type {ItemTemplateInput} from '../../schemas';
import {amuletBeadEnergized} from './amulet/amulet-bead-energized';
import {amuletBeadGlass} from './amulet/amulet-bead-glass';
import {amuletCharmEmber} from './amulet/amulet-charm-ember';
import {amuletTalismanKnottedFang} from './amulet/amulet-talisman-knotted-fang';
import {armorHeavyTinPlate} from './armor/armor-heavy-tin-plate';
import {armorLightPatchCloak} from './armor/armor-light-patch-cloak';
import {armorLightSpikedCloak} from './armor/armor-light-spiked-cloak';
import {healthPotion} from './consumables/health-potion';
import {flourPouch} from './consumables/flour-pouch';
import {fragBomb} from './consumables/frag-bomb';
import {incendiaryBomb} from './consumables/incendiary-bomb';
import {oilBottle} from './consumables/oil-bottle';
import {smokeBomb} from './consumables/smoke-bomb';
import {waterBall} from './consumables/water-ball';
import {unarmed} from './weapons/unarmed';
import {weaponDaggerVenom} from './weapons/weapon-dagger-venom';
import {weaponSling} from './weapons/weapon-sling';
import {weaponStaffSchoolWand} from './weapons/weapon-staff-school-wand';
import {weaponSwordFlaming} from './weapons/weapon-sword-flaming';
import {weaponSwordHatPin} from './weapons/weapon-sword-hat-pin';
import {weaponSwordSplinterBlade} from './weapons/weapon-sword-splinter-blade';

/**
 * Все шаблоны категории «items». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Конвенция id экипировки: `{type}_{subtype}_{name}` (weapon_sword_hat_pin) —
 * сортировка по имени группирует схожие предметы. Исключения: `unarmed`
 * (захардкожен в движке, не переименовывать) и расходники (плоские id).
 *
 * Часть снаряжения первой итерации архивирована в `templates/legacy/items/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`): ждёт переработки
 * под билды. Возвращены предметы со скиллами и предметы со спрайтами без
 * скиллов (2 оружия, 4 амулета); их fixedModifiers сняты до переработки
 * модификаторов. Пулы дропа/спавна намеренно пусты — распределение по этажам
 * будет частью билдов.
 */
export const itemTemplates: ItemTemplateInput[] = [
  amuletBeadEnergized,
  amuletBeadGlass,
  amuletCharmEmber,
  amuletTalismanKnottedFang,
  armorHeavyTinPlate,
  armorLightPatchCloak,
  armorLightSpikedCloak,
  healthPotion,
  flourPouch,
  fragBomb,
  incendiaryBomb,
  oilBottle,
  smokeBomb,
  waterBall,
  unarmed,
  weaponDaggerVenom,
  weaponSling,
  weaponStaffSchoolWand,
  weaponSwordFlaming,
  weaponSwordHatPin,
  weaponSwordSplinterBlade,
];
