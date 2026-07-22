import {registerSkill} from './skillExecutor';
import {fireballSkill} from './executors/fireballSkill';
import {magicSlapSkill} from './executors/magicSlapSkill';
import {dashSkill} from './executors/dashSkill';
import {counterattackSkill} from './executors/counterattackSkill';
import {swoopSkill} from './executors/swoopSkill';
import {cleaveSkill} from './executors/cleaveSkill';
import {suddenStrikeSkill} from './executors/suddenStrikeSkill';
import {rainSkill} from './executors/rainSkill';
import {oilFlaskSkill} from './executors/oilFlaskSkill';

let initialized = false;

export function initSkillRegistry(): void {
  if (initialized) return;
  initialized = true;
  registerSkill(fireballSkill);
  registerSkill(magicSlapSkill);
  registerSkill(dashSkill);
  registerSkill(counterattackSkill);
  registerSkill(swoopSkill);
  registerSkill(cleaveSkill);
  registerSkill(suddenStrikeSkill);
  registerSkill(rainSkill);
  registerSkill(oilFlaskSkill);
}

export { getSkillExecutor } from './skillExecutor';
