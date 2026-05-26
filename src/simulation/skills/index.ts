import { registerSkill } from './skillExecutor';
import { fireballSkill } from './executors/fireballSkill';
import { magicSlapSkill } from './executors/magicSlapSkill';

let initialized = false;

export function initSkillRegistry(): void {
  if (initialized) return;
  initialized = true;
  registerSkill(fireballSkill);
  registerSkill(magicSlapSkill);
}

export { getSkillExecutor } from './skillExecutor';
