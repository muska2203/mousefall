import { registerSkill } from './skillExecutor';
import { fireballSkill } from './executors/fireballSkill';
import { magicSlapSkill } from './executors/magicSlapSkill';
import { dashSkill } from './executors/dashSkill';

let initialized = false;

export function initSkillRegistry(): void {
  if (initialized) return;
  initialized = true;
  registerSkill(fireballSkill);
  registerSkill(magicSlapSkill);
  registerSkill(dashSkill);
}

export { getSkillExecutor } from './skillExecutor';
