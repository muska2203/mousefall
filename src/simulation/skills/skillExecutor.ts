import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';

export interface SkillExecutor {
  id: string;

  /** Описание режима выбора целей (для UI) */
  getTargetMode(state: GameState, caster: Entity): TargetMode;

  /** Доступные клетки для выбора (для подсветки) */
  getValidTargets(state: GameState, caster: Entity): Position[];

  /** Превью интентов при наведении на клетку */
  preview(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Intent[];

  /** Все клетки, попадающие в зону действия при касте на выбранные + hovered цели */
  getAffectedPositions(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Position[];

  /** Резолв в интенты для исполнения */
  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[];
}

/** Реестр SkillExecutor'ов */
const skillRegistry = new Map<string, SkillExecutor>();

export function registerSkill(skill: SkillExecutor): void {
  skillRegistry.set(skill.id, skill);
}

export function getSkillExecutor(abilityId: string): SkillExecutor | undefined {
  return skillRegistry.get(abilityId);
}
