/**
 * Тесты окна poi «relic_choice» — алтарь выбора реликвии (roadmap 0.5, фаза D).
 *
 * Покрытие:
 * - генерация предложения при первой активации и его неизменность при повторной;
 * - исключение нестакаемых реликвий, уже имеющихся у игрока;
 * - заряд тратится на выбор (chargeSpentOn: 'resolution'), а не на активацию;
 * - активация окна бесплатна (0 AP), выбор опции стоит 1 AP и выдаёт реликвию (RELIC_GRANTED);
 * - выбор последним AP проходит (нет отказа wrong_actor), при 0 AP — отклоняется;
 * - невалидный optionId — отказ без изменения состояния;
 * - протухшая опция (нестакаемая реликвия получена после генерации offer) —
 *   отказ без траты AP и заряда, валидная опция по-прежнему выбирается;
 * - пустой relicPool — активация отклоняется, окно не открывается;
 * - детерминизм предложения по seed;
 * - предложение переживает снапшот этажа;
 * - регрессия: poi без window тратит заряд при активации, как раньше.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {computeFloorTransition} from '../../../src/simulation/systems/floor-transition-planner';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {ExecutionNode, GameEvent} from '../../../src/simulation/core-types';
import type {PoiTemplate, RelicTemplate} from '../../../src/content/schemas';
import type {PointOfInterestEntity, Entity, EntityId} from '../../../src/simulation/types';
import {
  createObjectContent,
  defaultTestMapParams,
  makeGameState,
  makePlayer,
  makePoi,
  mockAltarTemplate,
} from '../../fixtures/gameState';

function mockRelic(id: string, overrides: Partial<RelicTemplate> = {}): RelicTemplate {
  return {
    id,
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
    ...overrides,
  };
}

/** Шаблон алтаря выбора: окно relic_choice на 3 опции, заряд на выбор. */
const windowAltarTemplate: PoiTemplate = {
  id: 'relic_altar',
  interactionKind: 'poi',
  ruleIds: [],
  charges: 1,
  chargeSpentOn: 'resolution',
  window: { kind: 'relic_choice', offerSize: 3 },
  tags: ['relic_altar'],
};

const RELIC_POOL = ['relic_a', 'relic_b', 'relic_c', 'relic_d'];

function initWindowContent(): void {
  resetRegistry();
  initRegistry(createObjectContent({
    pois: new Map<string, PoiTemplate>([
      ['altar', mockAltarTemplate()],
      ['relic_altar', windowAltarTemplate],
    ]),
    relics: new Map([
      ['relic_a', mockRelic('relic_a')],
      ['relic_b', mockRelic('relic_b', { stackable: true })],
      ['relic_c', mockRelic('relic_c')],
      ['relic_d', mockRelic('relic_d', { stackable: true })],
    ]),
  }));
}

function makeAltarState(options: {
  relicPool?: string[];
  ownedRelics?: Array<{ instanceId: string; templateId: string }>;
  ap?: number;
} = {}) {
  const player = makePlayer({
    x: 3, y: 5, maxAp: 2, ap: options.ap ?? 2,
    relics: options.ownedRelics ?? [],
  });
  const poi = makePoi({
    id: 'poi_altar_1',
    templateId: 'relic_altar',
    x: 4, y: 5,
    charges: 1,
  });
  const state = makeGameState({
    player,
    entities: new Map<EntityId, Entity>([[player.id, player], [poi.id, poi]]),
    mapParams: {
      ...defaultTestMapParams,
      relicPool: options.relicPool ?? RELIC_POOL,
    },
  });
  return { state, player, poi };
}

function collectEvents(node: ExecutionNode, out: GameEvent[] = []): GameEvent[] {
  out.push(node.event);
  for (const child of node.children) {
    collectEvents(child, out);
  }
  return out;
}

beforeEach(() => {
  initWindowContent();
});

afterEach(() => {
  resetRegistry();
});

describe('окно relic_choice — активация', () => {
  it('генерирует предложение при первой активации и не меняет его при повторной', () => {
    const { state, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);

    const first = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    expect(first.success).toBe(true);

    const offer = poi.offer;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    for (const id of offer!) {
      expect(RELIC_POOL).toContain(id);
    }

    // Открытие окна бесплатно (0 AP) — и в getActionCost, и по факту.
    expect(sim.getActionCost({ type: 'INTERACT', entityId: 'player', targetId: poi.id })).toBe(0);
    expect(state.player.ap).toBe(2);

    // Заряд на активацию не тратится (chargeSpentOn: 'resolution').
    expect(poi.charges).toBe(1);
    // POI_USED эмитится с неизрасходованным зарядом.
    const events = first.phases.flatMap(p => p.actions.flatMap(a => collectEvents(a)));
    expect(events.some(e => e.type === 'POI_USED' && e.remainingCharges === 1)).toBe(true);

    // Повторная активация открывает то же предложение.
    const second = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    expect(second.success).toBe(true);
    expect(poi.offer).toEqual(offer);
    expect(poi.charges).toBe(1);
    expect(state.player.ap).toBe(2);
  });

  it('исключает нестакаемые реликвии, уже имеющиеся у игрока', () => {
    const { state, poi } = makeAltarState({
      ownedRelics: [{ instanceId: 'relic_99', templateId: 'relic_a' }],
    });
    const sim = GameSimulation.loadSavedGame(state);

    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });

    expect(poi.offer).not.toContain('relic_a');
    // Осталось ровно три кандидата — все они в предложении.
    expect([...(poi.offer ?? [])].sort()).toEqual(['relic_b', 'relic_c', 'relic_d']);
  });

  it('не открывается при пустом relicPool: активация отклонена, AP и заряд не тратятся', () => {
    const { state, player, poi } = makeAltarState({ relicPool: [] });
    const sim = GameSimulation.loadSavedGame(state);

    const result = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });

    expect(result.success).toBe(false);
    expect(poi.offer).toBeUndefined();
    expect(poi.charges).toBe(1);
    expect(player.ap).toBe(2);
  });

  it('детерминировано по seed: два состояния дают одинаковое предложение', () => {
    const first = makeAltarState();
    const second = makeAltarState();

    GameSimulation.loadSavedGame(first.state)
      .dispatch({ type: 'INTERACT', entityId: 'player', targetId: first.poi.id });
    GameSimulation.loadSavedGame(second.state)
      .dispatch({ type: 'INTERACT', entityId: 'player', targetId: second.poi.id });

    expect(first.poi.offer).toEqual(second.poi.offer);
  });

  it('предложение переживает снапшот этажа', () => {
    const { state, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    const offer = poi.offer;

    // Снапшот целевого этажа заранее заполнен — переход не генерирует карту.
    state.floorSnapshots[1] = {
      floor: 2,
      map: state.map,
      entities: [],
      explored: state.explored,
      tileEffects: state.tileEffects,
      rngState: state.rng.state,
    };
    computeFloorTransition(state, 'down');

    const snapshot = state.floorSnapshots[0]!;
    const snapPoi = snapshot.entities.find(e => e.id === poi.id) as PointOfInterestEntity;
    expect(snapPoi).toBeDefined();
    expect(snapPoi.offer).toEqual(offer);
  });
});

describe('окно relic_choice — выбор опции (RESOLVE_POI_CHOICE)', () => {
  it('выдаёт реликвию, тратит заряд и очищает предложение; стоимость 1 AP', () => {
    const { state, player, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    expect(player.ap).toBe(2);

    const optionId = poi.offer![0]!;
    const result = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId,
    });

    expect(result.success).toBe(true);
    // Выбор стоит 1 AP.
    expect(player.ap).toBe(1);
    // Заряд тратится на выбор, предложение очищается.
    expect(poi.charges).toBe(0);
    expect(poi.offer).toBeUndefined();
    // Реликвия в коллекции, событие RELIC_GRANTED в дереве.
    expect(player.relics).toEqual([{ instanceId: 'relic_1', templateId: optionId }]);
    const events = result.phases.flatMap(p => p.actions.flatMap(a => collectEvents(a)));
    expect(events.some(e => e.type === 'RELIC_GRANTED' && e.relicId === optionId)).toBe(true);
  });

  it('отклоняет невалидный optionId без изменения состояния', () => {
    const { state, player, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    const offer = [...poi.offer!];

    const result = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId: 'relic_not_in_offer',
    });

    expect(result.success).toBe(false);
    expect(poi.charges).toBe(1);
    expect(poi.offer).toEqual(offer);
    expect(player.relics).toEqual([]);
    expect(player.ap).toBe(2);
  });

  it('регрессия: активация последним AP не мешает выбору (ранее — отказ wrong_actor)', () => {
    const { state, player, poi } = makeAltarState({ ap: 1 });
    const sim = GameSimulation.loadSavedGame(state);

    // Открытие окна бесплатно: после активации AP не изменился, предложение сгенерировано.
    const interact = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    expect(interact.success).toBe(true);
    expect(player.ap).toBe(1);
    expect(poi.offer).toHaveLength(3);
    expect(poi.charges).toBe(1);

    // Выбор тратит последний AP и выдаёт реликвию.
    const optionId = poi.offer![0]!;
    const result = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId,
    });
    expect(result.success).toBe(true);
    expect(player.ap).toBe(0);
    expect(poi.charges).toBe(0);
    expect(player.relics).toEqual([{ instanceId: 'relic_1', templateId: optionId }]);
  });

  it('выбор при 0 AP отклоняется без изменения состояния', () => {
    const { state, player, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    const offer = [...poi.offer!];
    player.ap = 0;

    const result = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId: offer[0]!,
    });

    expect(result.success).toBe(false);
    expect(poi.charges).toBe(1);
    expect(poi.offer).toEqual(offer);
    expect(player.relics).toEqual([]);
  });

  it('после выбора алтарь исчерпан: повторная активация и выбор недоступны', () => {
    const { state, player, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId: poi.offer![0]!,
    });

    const again = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    expect(again.success).toBe(false);
    expect(player.relics).toHaveLength(1);
  });

  it('протухшая опция (нестакаемая уже получена) отклоняется без траты AP и заряда', () => {
    // Предложение генерируется один раз: нестакаемая реликвия из offer могла
    // быть получена на другом этаже того же пула. Раньше такой выбор проходил
    // validate и молча тратил 1 AP без эффекта.
    const { state, player, poi } = makeAltarState();
    const sim = GameSimulation.loadSavedGame(state);
    sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });
    const offer = [...poi.offer!];

    // «Получили» нестакаемую реликвию из предложения в другом месте.
    const staleOption = offer.find(id => id !== 'relic_b' && id !== 'relic_d')!;
    player.relics.push({ instanceId: 'relic_99', templateId: staleOption });

    const result = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId: staleOption,
    });

    expect(result.success).toBe(false);
    expect(player.ap).toBe(2);
    expect(poi.charges).toBe(1);
    expect(poi.offer).toEqual(offer);
    expect(player.relics).toEqual([{ instanceId: 'relic_99', templateId: staleOption }]);

    // Валидная опция из того же предложения по-прежнему выбирается.
    const validOption = offer.find(id => id !== staleOption)!;
    const ok = sim.dispatch({
      type: 'RESOLVE_POI_CHOICE',
      entityId: 'player',
      poiId: poi.id,
      optionId: validOption,
    });
    expect(ok.success).toBe(true);
    expect(player.ap).toBe(1);
    expect(player.relics).toHaveLength(2);
  });
});

describe('регрессия — poi без window', () => {
  it('лечебный алтарь тратит заряд при активации, как раньше', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 50, maxHp: 100, maxAp: 2, ap: 2 });
    const poi = makePoi({ x: 4, y: 5, charges: 1 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player], [poi.id, poi]]),
    });
    const sim = GameSimulation.loadSavedGame(state);

    const result = sim.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poi.id });

    expect(result.success).toBe(true);
    expect(poi.charges).toBe(0);
    expect(poi.offer).toBeUndefined();
    expect(player.hp).toBe(75);
    expect(player.ap).toBe(1);
  });
});
