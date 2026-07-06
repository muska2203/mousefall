import { registerSkill } from './skillExecutor';
import { fireballSkill } from './executors/fireballSkill';
import { magicSlapSkill } from './executors/magicSlapSkill';
import { dashSkill } from './executors/dashSkill';
import { counterattackSkill } from './executors/counterattackSkill';
import { swoopSkill } from './executors/swoopSkill';
import { cleaveSkill } from './executors/cleaveSkill';

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
}

export { getSkillExecutor } from './skillExecutor';
