import { registerSkill } from './skillExecutor';
import { fireballSkill } from './executors/fireballSkill';
import { magicSlapSkill } from './executors/magicSlapSkill';
import { dashSkill } from './executors/dashSkill';
import { parrySkill } from './executors/parrySkill';
import { swoopSkill } from './executors/swoopSkill';

let initialized = false;

export function initSkillRegistry(): void {
  if (initialized) return;
  initialized = true;
  registerSkill(fireballSkill);
  registerSkill(magicSlapSkill);
  registerSkill(dashSkill);
  registerSkill(parrySkill);
  registerSkill(swoopSkill);
}

export { getSkillExecutor } from './skillExecutor';
