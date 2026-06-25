/**
 * Реестр скилловых анимационных композеров.
 *
 * Ответственность:
 * - Хранение соответствия abilityId → SkillComposer.
 * - Позволяет добавлять новые скиллы без изменения базовых builders.
 */

import type { GameState } from '@simulation/types';
import type { AnimationNode } from '@presentation/types';
import type { AbilityEvent } from '../core/primitives';

/** Композер, строящий анимацию для конкретной способности. */
export type SkillComposer = (
  event: AbilityEvent,
  childNodes: AnimationNode[],
  state: GameState,
) => AnimationNode[] | null;

const skillComposers = new Map<string, SkillComposer>();

/** Зарегистрировать композер для способности. */
export function registerSkillComposer(abilityId: string, composer: SkillComposer): void {
  skillComposers.set(abilityId, composer);
}

/** Получить композер по abilityId. */
export function getSkillComposer(abilityId: string): SkillComposer | undefined {
  return skillComposers.get(abilityId);
}
