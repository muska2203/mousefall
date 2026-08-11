import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {StatusEffectType, TargetMode} from '@simulation/core-types';
import {tryGetAbility} from '@content/registry';
import type {AbilityTemplate} from '@content/schemas';
import {createSelfBuffSkill} from '@simulation/skills/executors/selfBuffSkill';
import {createSwoopSkill} from '@simulation/skills/executors/swoopSkill';

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

/**
 * Фабрики исполнителей по виду способности (kind шаблона).
 * У kind с фабрикой зарегистрированного в реестре исполнителя быть не должно:
 * исполнитель собирается из параметров шаблона и кэшируется.
 * Legacy-виды без фабрики разрешаются через реестр по id.
 */
const KIND_FACTORIES: Partial<Record<AbilityTemplate['kind'], (template: AbilityTemplate) => SkillExecutor>> = {
  selfBuff: (template) => {
    if (template.kind !== 'selfBuff') throw new Error(`Ожидался kind 'selfBuff', получен '${template.kind}'`);
    return createSelfBuffSkill({
      id: template.id,
      statusType: template.statusType as StatusEffectType,
      duration: template.duration,
    });
  },
  swoop: (template) => {
    if (template.kind !== 'swoop') throw new Error(`Ожидался kind 'swoop', получен '${template.kind}'`);
    return createSwoopSkill({
      id: template.id,
      jumpRadius: template.jumpRadius,
      aoeRadius: template.aoeRadius,
      baseDamage: template.baseDamage,
    });
  },
};

export function getSkillExecutor(abilityId: string): SkillExecutor | undefined {
  // Шаблон с параметризованным kind: исполнитель собирается фабрикой
  // из параметров шаблона и кэшируется в реестре.
  const template = tryGetAbility(abilityId);
  if (template) {
    const factory = KIND_FACTORIES[template.kind];
    if (factory) {
      const cached = skillRegistry.get(abilityId);
      if (cached) return cached;

      const executor = factory(template);
      skillRegistry.set(abilityId, executor);
      return executor;
    }
  }

  // Legacy-виды: исполнитель регистрируется по id в initSkillRegistry.
  return skillRegistry.get(abilityId);
}
