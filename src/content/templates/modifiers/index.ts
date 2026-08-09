import type {ModifierTemplateInput} from '../../schemas';
import {modAmuletFireDamageMultiplier} from './mod-amulet-fire-damage-multiplier';
import {modBluntDaze} from './mod-blunt-daze';
import {modDull} from './mod-dull';
import {modFireDamageMultiplier} from './mod-fire-damage-multiplier';
import {modFragile} from './mod-fragile';
import {modGuardianVitality} from './mod-guardian-vitality';
import {modPoisonOnHit} from './mod-poison-on-hit';
import {modRestoreApOnHit} from './mod-restore-ap-on-hit';
import {modSpikedThorns} from './mod-spiked-thorns';
import {modSturdyArmor} from './mod-sturdy-armor';

/** Все шаблоны категории «modifiers». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const modifierTemplates: ModifierTemplateInput[] = [
  modSturdyArmor,
  modPoisonOnHit,
  modFragile,
  modDull,
  modBluntDaze,
  modFireDamageMultiplier,
  modSpikedThorns,
  modAmuletFireDamageMultiplier,
  modRestoreApOnHit,
  modGuardianVitality,
];
