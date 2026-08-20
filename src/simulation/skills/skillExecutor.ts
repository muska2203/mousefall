import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {StatusEffectType, TargetMode} from '@simulation/core-types';
import {tryGetAbility} from '@content/registry';
import type {AbilityTemplate} from '@content/schemas';
import {createSelfBuffSkill} from '@simulation/skills/executors/selfBuffSkill';
import {createSwoopSkill} from '@simulation/skills/executors/swoopSkill';
import {createGroundSlamSkill} from '@simulation/skills/executors/groundSlamSkill';
import {createFireballSkill} from '@simulation/skills/executors/fireballSkill';
import {createMagicSlapSkill} from '@simulation/skills/executors/magicSlapSkill';
import {createDashSkill} from '@simulation/skills/executors/dashSkill';
import {createSuddenStrikeSkill} from '@simulation/skills/executors/suddenStrikeSkill';
import {createCleaveSkill} from '@simulation/skills/executors/cleaveSkill';
import {createThrowSkill} from '@simulation/skills/executors/throwSkill';

export interface SkillExecutor {
  id: string;

  /** Описание режима выбора целей (для UI) */
  getTargetMode(state: GameState, caster: Entity): TargetMode;

  /** Доступные клетки для выбора (для подсветки) */
  getValidTargets(state: GameState, caster: Entity): Position[];

  /**
   * Паттерн прицеливания: все клетки, куда способность в принципе может быть
   * нацелена, независимо от наличия целей на них (для тусклой подсветки зоны
   * каста в UI). Опционально: вид способности без метода не показывает паттерн.
   */
  getCastableCells?(state: GameState, caster: Entity): Position[];

  /** Превью интентов при наведении на клетку */
  preview(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Intent[];

  /** Все клетки, попадающие в зону действия при касте на выбранные + hovered цели */
  getAffectedPositions(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Position[];

  /** Резолв в интенты для исполнения */
  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[];
}

/** Кэш собранных SkillExecutor'ов (по контентному id способности). */
const executorCache = new Map<string, SkillExecutor>();

/**
 * Фабрики исполнителей по виду способности (kind шаблона).
 * Каждый kind union обязан иметь фабрику — забытый вид ловится компилятором:
 * исполнитель собирается из параметров шаблона и кэшируется.
 */
const KIND_FACTORIES: Record<AbilityTemplate['kind'], (template: AbilityTemplate) => SkillExecutor> = {
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
  groundSlam: (template) => {
    if (template.kind !== 'groundSlam') throw new Error(`Ожидался kind 'groundSlam', получен '${template.kind}'`);
    return createGroundSlamSkill({
      id: template.id,
      radius: template.radius,
      baseDamage: template.baseDamage,
    });
  },
  fireball: (template) => {
    if (template.kind !== 'fireball') throw new Error(`Ожидался kind 'fireball', получен '${template.kind}'`);
    return createFireballSkill({
      id: template.id,
      range: template.range,
      aoeRadius: template.aoeRadius,
      centerDamage: template.centerDamage,
      aoeDamage: template.aoeDamage,
    });
  },
  magicSlap: (template) => {
    if (template.kind !== 'magicSlap') throw new Error(`Ожидался kind 'magicSlap', получен '${template.kind}'`);
    return createMagicSlapSkill({
      id: template.id,
      range: template.range,
      targetCount: template.targetCount,
      baseDamage: template.baseDamage,
    });
  },
  dash: (template) => {
    if (template.kind !== 'dash') throw new Error(`Ожидался kind 'dash', получен '${template.kind}'`);
    return createDashSkill({
      id: template.id,
      distance: template.distance,
      bumpDamage: template.bumpDamage,
    });
  },
  suddenStrike: (template) => {
    if (template.kind !== 'suddenStrike') throw new Error(`Ожидался kind 'suddenStrike', получен '${template.kind}'`);
    return createSuddenStrikeSkill({
      id: template.id,
      silenceDuration: template.silenceDuration,
    });
  },
  cleave: (template) => {
    if (template.kind !== 'cleave') throw new Error(`Ожидался kind 'cleave', получен '${template.kind}'`);
    return createCleaveSkill({ id: template.id });
  },
  throw: (template) => {
    if (template.kind !== 'throw') throw new Error(`Ожидался kind 'throw', получен '${template.kind}'`);
    return createThrowSkill({
      id: template.id,
      range: template.range,
      baseDamage: template.baseDamage,
      pushDistance: template.pushDistance,
    });
  },
};

export function getSkillExecutor(abilityId: string): SkillExecutor | undefined {
  // Исполнитель собирается фабрикой по kind шаблона
  // из параметров шаблона и кэшируется.
  const template = tryGetAbility(abilityId);
  if (!template) return undefined;

  const factory = KIND_FACTORIES[template.kind];
  const cached = executorCache.get(abilityId);
  if (cached) return cached;

  const executor = factory(template);
  executorCache.set(abilityId, executor);
  return executor;
}
