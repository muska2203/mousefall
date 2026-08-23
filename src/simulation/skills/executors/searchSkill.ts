import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getVisiblePositionsWithinRange} from '@simulation/skills/targeting';

/** Параметры исполнителя способности вида «поиск» (соответствуют полям шаблона kind 'search'). */
export interface SearchSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Радиус поиска скрытых ловушек вокруг кастера (квадрат по Чебышёву). */
  radius: number;
}

/**
 * Фабрика исполнителя способности вида «поиск»:
 * раскрывает все скрытые ловушки в радиусе вокруг кастера.
 *
 * Механика:
 * - Цель — сам кастер (self), способность применяется мгновенно, без таргетинга.
 * - Раскрываются только скрытые ловушки (entity.type === 'trap', hidden === true)
 *   на клетках в прямой видимости кастера (LOS через computeFOV — стены и двери
 *   блокируют поиск, радиус — дистанция Чебышёва, как у FOV).
 * - Раскрытие идёт через интент REVEAL_OBJECT: исполнитель интента сам отсекает
 *   не-ловушки и уже раскрытые объекты и порождает полевое событие OBJECT_REVEALED.
 *
 * Параметры механики приходят из шаблона способности (kind 'search'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createSearchSkill(params: SearchSkillParams): SkillExecutor {
  /**
   * Возвращает скрытые ловушки в радиусе поиска в прямой видимости кастера.
   * Порядок консистентен: сортировка по id (детерминизм порядка интентов).
   */
  function findHiddenTrapsInSight(state: GameState, caster: Entity): Entity[] {
    const visibleKeys = new Set(
      getVisiblePositionsWithinRange(state, caster, params.radius).map(pos => `${pos.x},${pos.y}`),
    );
    const traps: Entity[] = [];
    for (const entity of state.entities.values()) {
      if (entity.type !== 'trap' || !entity.hidden) continue;
      if (!visibleKeys.has(`${entity.x},${entity.y}`)) continue;
      traps.push(entity);
    }
    return traps.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'self' };
    },

    getValidTargets(_state: GameState, caster: Entity): Position[] {
      return [{ x: caster.x, y: caster.y }];
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return this.resolve(state, caster, [hoveredTarget]);
    },

    getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], _hoveredTarget: Position | null): Position[] {
      return [{ x: caster.x, y: caster.y }];
    },

    resolve(state: GameState, caster: Entity, _targets: Position[]): Intent[] {
      return findHiddenTrapsInSight(state, caster).map(trap => ({
        type: 'REVEAL_OBJECT' as const,
        entityId: trap.id,
      }));
    },
  };
}
