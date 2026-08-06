/**
 * Тесты открытого окна poi в GameSession (roadmap 0.5, фаза D).
 *
 * Покрытие:
 * - выставление pendingWindow после активации оконного poi (INTERACT);
 * - ViewModel окна: kind, заголовок, опции из предложения poi;
 * - resolveWindowChoice: dispatch RESOLVE_POI_CHOICE + сброс поля;
 * - dismissWindow: сброс поля без dispatch (реликвия не выдаётся,
 *   предложение poi сохраняется и окно открывается повторной активацией);
 * - регрессия: активация последним AP не блокирует выбор (AP списывается на выборе).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import '@i18n/config';
import {GameSession} from '../../../src/presentation/gameSession';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import type {PoiTemplate, RelicTemplate} from '../../../src/content/schemas';
import type {Entity, EntityId} from '../../../src/simulation/types';
import {
  createObjectContent,
  defaultTestMapParams,
  makeGameState,
  makePlayer,
  makePoi,
} from '../../fixtures/gameState';

function mockRelic(id: string): RelicTemplate {
  return {
    id,
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
  };
}

const windowAltarTemplate: PoiTemplate = {
  id: 'relic_altar',
  interactionKind: 'poi',
  ruleIds: [],
  charges: 1,
  chargeSpentOn: 'resolution',
  window: { kind: 'relic_choice', offerSize: 3 },
  renderScale: 1,
  tags: ['relic_altar'],
};

function makeAltarState(options: { ap?: number } = {}) {
  const player = makePlayer({ x: 3, y: 5, maxAp: 2, ap: options.ap ?? 2 });
  const poi = makePoi({
    id: 'poi_altar_1',
    templateId: 'relic_altar',
    x: 4, y: 5,
    charges: 1,
  });
  const state = makeGameState({
    player,
    entities: new Map<EntityId, Entity>([[player.id, player], [poi.id, poi]]),
    mapParams: { ...defaultTestMapParams, relicPool: ['relic_a', 'relic_b', 'relic_c'] },
  });
  return { state, player, poi };
}

function makeSession(options: { ap?: number } = {}) {
  const { state, player, poi } = makeAltarState(options);
  const session = new GameSession();
  session.loadGame(state);
  return { session, player, poi };
}

function activateAltar(session: GameSession, poiId: string) {
  session.dispatch({ type: 'INTERACT', entityId: 'player', targetId: poiId });
  // Окно открывается только после завершения анимаций (FOV и пр.).
  session.onAnimationsComplete();
}

beforeEach(() => {
  resetRegistry();
  initRegistry(createObjectContent({
    pois: new Map<string, PoiTemplate>([['relic_altar', windowAltarTemplate]]),
    relics: new Map([
      ['relic_a', mockRelic('relic_a')],
      ['relic_b', mockRelic('relic_b')],
      ['relic_c', mockRelic('relic_c')],
    ]),
  }));
});

afterEach(() => {
  resetRegistry();
});

describe('GameSession — pendingWindow', () => {
  it('закрыто до активации и открывается после активации оконного poi', () => {
    const { session, poi } = makeSession();

    expect(session.isWindowOpen()).toBe(false);
    expect(session.getViewModel().renderInput?.pendingWindow).toBeNull();

    activateAltar(session, poi.id);

    expect(session.isWindowOpen()).toBe(true);
    const window = session.getViewModel().renderInput?.pendingWindow;
    expect(window?.kind).toBe('relic_choice');
    expect(window?.options).toHaveLength(3);
    expect(window?.options.map(o => o.id).sort()).toEqual(['relic_a', 'relic_b', 'relic_c']);
    // Опции — готовые ViewModel: id, имя и список эффектов (у моков пустой).
    expect(window?.options[0]).toMatchObject({
      id: poi.offer![0],
      name: `[${poi.offer![0]}]`,
      rarity: 'common',
      effects: [],
    });
  });

  it('resolveWindowChoice отправляет RESOLVE_POI_CHOICE и закрывает окно', () => {
    const { session, player, poi } = makeSession();
    activateAltar(session, poi.id);
    const optionId = poi.offer![0]!;

    session.resolveWindowChoice(optionId);

    expect(session.isWindowOpen()).toBe(false);
    expect(session.getViewModel().renderInput?.pendingWindow).toBeNull();
    expect(player.relics).toEqual([{ instanceId: 'relic_1', templateId: optionId }]);
    expect(poi.charges).toBe(0);
  });

  it('dismissWindow закрывает окно без dispatch: состояние не меняется', () => {
    const { session, player, poi } = makeSession();
    activateAltar(session, poi.id);
    const offer = [...poi.offer!];

    session.dismissWindow();

    expect(session.isWindowOpen()).toBe(false);
    expect(player.relics).toEqual([]);
    expect(poi.charges).toBe(1);
    expect(poi.offer).toEqual(offer);

    // Предложение сохранилось: повторная активация открывает то же окно.
    player.ap = 2;
    activateAltar(session, poi.id);
    expect(session.isWindowOpen()).toBe(true);
    expect(session.getViewModel().renderInput?.pendingWindow?.options.map(o => o.id))
      .toEqual(offer);
  });

  it('регрессия: активация последним AP — окно открывается, выбор проходит', () => {
    // Раньше INTERACT тратил последний AP при открытии окна, и RESOLVE_POI_CHOICE
    // отклонялся как wrong_actor. Теперь открытие бесплатно, AP списывается на выборе.
    const { session, player, poi } = makeSession({ ap: 1 });

    activateAltar(session, poi.id);

    expect(session.isWindowOpen()).toBe(true);
    expect(player.ap).toBe(1);

    session.resolveWindowChoice(poi.offer![0]!);

    expect(session.isWindowOpen()).toBe(false);
    expect(player.relics).toHaveLength(1);
    expect(poi.charges).toBe(0);
    // Выбор списал последний AP — GameSession инициирует авто-END_TURN.
    expect(player.ap).toBe(0);
  });
});
