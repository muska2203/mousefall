/**
 * Контроллер таргетинга способностей (Presentation Layer).
 *
 * Ответственность: жизненный цикл выбора целей, валидация,
 * превью интентов при наведении.
 */

import type { Position, Simulation, GameState } from '@simulation/types';
import type { PresentationActionPreview } from './types';
import { toPresentationIntent } from './types';

export type TargetingPhase = 'normal' | 'targeting';

export type TargetingState = {
  abilityId: string;
  stepIndex: number;
  selectedTargets: Position[];
  validTargets: Position[];
};

export class TargetingController {
  phase: TargetingPhase = 'normal';
  state: TargetingState | null = null;

  beginTargeting(abilityId: string, simulation: Simulation): boolean {
    const targetMode = simulation.getAbilityTargetMode(abilityId);
    if (!targetMode) return false;

    const validTargets = simulation.getAbilityValidTargets(abilityId);
    this.phase = 'targeting';
    this.state = {
      abilityId,
      stepIndex: 0,
      selectedTargets: [],
      validTargets,
    };
    return true;
  }

  cancelTargeting(): void {
    this.phase = 'normal';
    this.state = null;
  }

  submitTarget(position: Position): boolean {
    if (!this.state) return false;
    const isValid = this.state.validTargets.some(
      (p: Position) => p.x === position.x && p.y === position.y,
    );
    if (!isValid) return false;
    this.state.selectedTargets.push(position);
    this.state.stepIndex += 1;
    return true;
  }

  getRemainingSelections(simulation: Simulation): number {
    if (!this.state) return 0;
    const targetMode = simulation.getAbilityTargetMode(this.state.abilityId);
    if (!targetMode) return 0;
    return targetMode.type === 'multi'
      ? targetMode.count - this.state.selectedTargets.length
      : 0;
  }

  previewTarget(
    hoveredPosition: Position | null,
    simulation: Simulation,
    state: GameState,
  ): PresentationActionPreview {
    if (!this.state || !hoveredPosition) {
      return { valid: false, intents: [], affectedPositions: [] };
    }

    const targetMode = simulation.getAbilityTargetMode(this.state.abilityId);
    if (!targetMode) return { valid: false, intents: [], affectedPositions: [] };

    const isValid = this.state.validTargets.some(
      (p: Position) => p.x === hoveredPosition.x && p.y === hoveredPosition.y,
    );
    if (!isValid) {
      return { valid: false, intents: [], affectedPositions: [] };
    }

    const intents = simulation.getAbilityPreview(
      this.state.abilityId,
      this.state.selectedTargets,
      hoveredPosition,
    );

    const affectedPositions = simulation.getAbilityAffectedPositions(
      this.state.abilityId,
      this.state.selectedTargets,
      hoveredPosition,
    );

    const presentationIntents = intents
      .map((intent) => toPresentationIntent(intent, state))
      .filter((pi): pi is NonNullable<typeof pi> => pi !== null);

    return { valid: true, intents: presentationIntents, affectedPositions };
  }
}
