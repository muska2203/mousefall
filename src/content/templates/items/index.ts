import type {ItemTemplateInput} from '../../schemas';
import {commonEmberAmulet} from './amulet/common-ember-amulet';
import {commonEnergizedBead} from './amulet/common-energized-bead';
import {commonGlassBead} from './amulet/common-glass-bead';
import {commonKnottedFang} from './amulet/common-knotted-fang';
import {catGuardianPlate} from './armor/cat-guardian-plate';
import {commonPatchCloak} from './armor/common-patch-cloak';
import {commonSpikedCloak} from './armor/common-spiked-cloak';
import {commonTinPlate} from './armor/common-tin-plate';
import {healthPotion} from './consumables/health-potion';
import {flourPouch} from './consumables/flour-pouch';
import {fragBomb} from './consumables/frag-bomb';
import {incendiaryBomb} from './consumables/incendiary-bomb';
import {oilBottle} from './consumables/oil-bottle';
import {smokeBomb} from './consumables/smoke-bomb';
import {waterBall} from './consumables/water-ball';
import {catClawBig} from './weapons/cat-claw-big';
import {catClawMid} from './weapons/cat-claw-mid';
import {catClawSmall} from './weapons/cat-claw-small';
import {catGuardianMaul} from './weapons/cat-guardian-maul';
import {commonFlamingSword} from './weapons/common-flaming-sword';
import {commonHatPin} from './weapons/common-hat-pin';
import {commonSchoolWand} from './weapons/common-school-wand';
import {commonSling} from './weapons/common-sling';
import {commonSplinterBlade} from './weapons/common-splinter-blade';
import {commonVenomDagger} from './weapons/common-venom-dagger';
import {unarmed} from './weapons/unarmed';

/** Все шаблоны категории «items». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const itemTemplates: ItemTemplateInput[] = [
  commonEmberAmulet,
  commonEnergizedBead,
  commonGlassBead,
  commonKnottedFang,
  catGuardianPlate,
  commonPatchCloak,
  commonSpikedCloak,
  commonTinPlate,
  healthPotion,
  flourPouch,
  fragBomb,
  incendiaryBomb,
  oilBottle,
  smokeBomb,
  waterBall,
  catClawBig,
  catClawMid,
  catClawSmall,
  catGuardianMaul,
  commonFlamingSword,
  commonHatPin,
  commonSchoolWand,
  commonSling,
  commonSplinterBlade,
  commonVenomDagger,
  unarmed,
];
