import {registerSkill} from './skillExecutor';
import {fireballSkill} from './executors/fireballSkill';
import {magicSlapSkill} from './executors/magicSlapSkill';
import {dashSkill} from './executors/dashSkill';
import {cleaveSkill} from './executors/cleaveSkill';
import {suddenStrikeSkill} from './executors/suddenStrikeSkill';

let initialized = false;

export function initSkillRegistry(): void {
  if (initialized) return;
  initialized = true;
  registerSkill(fireballSkill);
  registerSkill(magicSlapSkill);
  registerSkill(dashSkill);
  registerSkill(cleaveSkill);
  registerSkill(suddenStrikeSkill);
}

export { getSkillExecutor } from './skillExecutor';
