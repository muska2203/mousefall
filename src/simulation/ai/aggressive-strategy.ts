import { registerStrategy } from './strategy-registry';
import type { EnemyEntity, GameState } from '@simulation/types';
import { getCastableAbilities } from './cast-helpers';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';

registerStrategy('aggressive', {
  decideAction(actor, state) {
    const enemy = actor as EnemyEntity;

    // Если уже в касте — ждём
    if (enemy.activeCast) {
      return { type: 'WAIT', entityId: enemy.id };
    }

    // Пробуем начать каст, если есть подходящий скилл
    const castAbilities = getCastableAbilities(enemy, state);
    if (castAbilities.length > 0) {
      const ability = castAbilities[0]!;
      const executor = getSkillExecutor(ability.templateId);
      const targets = executor ? executor.getValidTargets(state, actor as import('@simulation/types').Entity) : [];
      if (targets.length > 0) {
        // Приоритет: клетка с игроком, иначе первая доступная
        const player = state.player;
        const targetWithPlayer = targets.find(t => t.x === player.x && t.y === player.y);
        const chosenTarget = targetWithPlayer ?? targets[0];
        if (chosenTarget) {
          return {
            type: 'USE_ABILITY',
            entityId: enemy.id,
            abilityId: ability.templateId,
            targets: [chosenTarget],
          };
        }
      }
    }

    // Простое приближение к игроку
    const player = state.player;
    const dx = player.x - actor.x;
    const dy = player.y - actor.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist === 1) {
      return { type: 'ATTACK', entityId: actor.id, dx: Math.sign(dx), dy: Math.sign(dy) };
    }

    if (dx !== 0) {
      return { type: 'MOVE', entityId: actor.id, dx: Math.sign(dx), dy: 0 };
    }
    if (dy !== 0) {
      return { type: 'MOVE', entityId: actor.id, dx: 0, dy: Math.sign(dy) };
    }

    return { type: 'WAIT', entityId: actor.id };
  },
});
