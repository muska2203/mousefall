/**
 * Механика окна `relic_choice` — выбор одной реликвии из предложения.
 *
 * Предложение — `offerSize` уникальных id из `relicPool` текущей карты:
 * - генерируется один раз через `state.rng` (детерминизм забега),
 *   повторная активация открывает то же предложение;
 * - нестакаемые (`stackable === false`) реликвии, уже имеющиеся у игрока,
 *   исключаются из кандидатов;
 * - пустой/отсутствующий пул или отсутствие кандидатов — окно не открывается.
 *
 * Выбор порождает интент GRANT_RELIC, тратит заряд poi
 * (семантика `chargeSpentOn: 'resolution'`) и очищает предложение.
 */

import type {GameState, PointOfInterestEntity} from '@simulation/types';
import type {PoiTemplate} from '@content/schemas';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';
import {tryGetRelic} from '@content/registry';
import {rngShuffle} from '@utils/rng';
import {executeIntent} from '@simulation/systems/intents/execute-intent';
import type {PoiWindowMechanic} from './types';

/**
 * Кандидаты предложения окна `relic_choice` (без мутации состояния):
 * уникальные id из `relicPool` текущей карты с существующими шаблонами,
 * за вычетом нестакаемых реликвий, уже имеющихся у игрока.
 */
export function computeRelicChoiceCandidates(state: GameState): string[] {
  const pool = state.mapParams.relicPool;
  if (!pool || pool.length === 0) return [];

  const owned = new Set(state.player.relics.map(r => r.templateId));
  return [...new Set(pool)].filter(id => {
    const relic = tryGetRelic(id);
    if (!relic) return false;
    return relic.stackable || !owned.has(id);
  });
}

export const relicChoiceMechanic: PoiWindowMechanic = {
  onActivate(state: GameState, poi: PointOfInterestEntity, template: PoiTemplate): boolean {
    // Предложение уже сгенерировано — повторная активация открывает то же окно.
    if (poi.offer && poi.offer.length > 0) return true;

    const window = template.window;
    if (!window || window.kind !== 'relic_choice') return false;

    const candidates = computeRelicChoiceCandidates(state);
    if (candidates.length === 0) return false;

    // Только state.rng — предложение детерминировано seed'ом забега.
    const shuffled = rngShuffle(state.rng, candidates);
    poi.offer = shuffled.slice(0, window.offerSize);
    return poi.offer.length > 0;
  },

  canOpen(state: GameState, poi: PointOfInterestEntity, template: PoiTemplate): boolean {
    if (poi.offer && poi.offer.length > 0) return true;
    if (!template.window || template.window.kind !== 'relic_choice') return false;
    return computeRelicChoiceCandidates(state).length > 0;
  },

  resolve(
    state: GameState,
    poi: PointOfInterestEntity,
    optionId: string,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
  ): ExecutionNode | null {
    if (poi.charges <= 0) return null;
    if (!poi.offer || !poi.offer.includes(optionId)) return null;

    // Реликвии выдаются только игроку (см. исполнитель GRANT_RELIC).
    const node = executeIntent(
      state,
      { type: 'GRANT_RELIC', entityId: state.player.id, templateId: optionId },
      builder,
      parent,
    );
    if (!node) return null;

    // Заряд тратится на выбор (chargeSpentOn: 'resolution'), предложение закрывается.
    poi.charges -= 1;
    delete poi.offer;
    return node;
  },
};
