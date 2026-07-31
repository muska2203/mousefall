import {describe, expect, it} from 'vitest';
import type {DoorTemplate, PoiTemplate} from '../../../src/content/schemas';
import {
  buildObjectSprites,
  getObjectSpriteState,
  resolveEntitySprite,
} from '../../../src/presentation/objectSpriteResolver';
import type {Entity, GameState} from '../../../src/simulation/types';
import {
  initObjectContentRegistry,
  makeDoor,
  makePoi,
  makeTrap,
  mockAltarTemplate,
  mockWoodenDoorTemplate,
} from '../../fixtures/gameState';

/** Контент с дверью с legacy openSpriteId, дверью со spriteVariants и алтарём со spriteVariants. */
function initContent(): void {
  const doors = new Map<string, DoorTemplate>([
    ['wooden_door', mockWoodenDoorTemplate()],
    ['legacy_door', {...mockWoodenDoorTemplate(), id: 'legacy_door', openSpriteId: 'custom_open'}],
    // spriteVariants имеет приоритет над legacy openSpriteId
    ['variant_door', {
      ...mockWoodenDoorTemplate(),
      id: 'variant_door',
      openSpriteId: 'legacy_open',
      spriteVariants: {open: 'variant_open'},
    }],
  ]);
  const pois = new Map<string, PoiTemplate>([
    ['altar', mockAltarTemplate()],
    ['variant_altar', {...mockAltarTemplate(), id: 'variant_altar', spriteVariants: {depleted: 'altar_drained'}}],
  ]);
  initObjectContentRegistry({doors, pois});
}

describe('objectSpriteResolver', () => {
  describe('getObjectSpriteState', () => {
    it('закрытая дверь — default, открытая — open', () => {
      expect(getObjectSpriteState(makeDoor())).toBe('default');
      expect(getObjectSpriteState(makeDoor({isOpen: true}))).toBe('open');
    });

    it('poi с зарядами — default, без зарядов — depleted', () => {
      expect(getObjectSpriteState(makePoi({charges: 2}))).toBe('default');
      expect(getObjectSpriteState(makePoi({charges: 0}))).toBe('depleted');
    });

    it('типы без резолвера — всегда default', () => {
      expect(getObjectSpriteState(makeTrap())).toBe('default');
    });
  });

  describe('resolveEntitySprite', () => {
    it('закрытая дверь — базовый спрайт по конвенции', () => {
      initContent();
      expect(resolveEntitySprite(makeDoor())).toBe('/assets/objects/doors/wooden_door.png');
    });

    it('открытая дверь — legacy openSpriteId из шаблона', () => {
      initContent();
      expect(resolveEntitySprite(makeDoor({templateId: 'legacy_door', isOpen: true})))
        .toBe('/assets/objects/doors/custom_open.png');
    });

    it('spriteVariants имеет приоритет над openSpriteId', () => {
      initContent();
      expect(resolveEntitySprite(makeDoor({templateId: 'variant_door', isOpen: true})))
        .toBe('/assets/objects/doors/variant_open.png');
    });

    it('открытая дверь без шаблона — конвенция <id>_open', () => {
      initContent();
      expect(resolveEntitySprite(makeDoor({templateId: 'unknown_door', isOpen: true})))
        .toBe('/assets/objects/doors/unknown_door_open.png');
    });

    it('poi с зарядами — базовый спрайт, без зарядов — <id>_depleted', () => {
      initContent();
      expect(resolveEntitySprite(makePoi({charges: 1}))).toBe('/assets/objects/pois/altar.png');
      expect(resolveEntitySprite(makePoi({charges: 0}))).toBe('/assets/objects/pois/altar_depleted.png');
    });

    it('depleted-спрайт poi переопределяется через spriteVariants', () => {
      initContent();
      expect(resolveEntitySprite(makePoi({templateId: 'variant_altar', charges: 0})))
        .toBe('/assets/objects/pois/altar_drained.png');
    });

    it('типы без категории спрайтов возвращают null', () => {
      initContent();
      const enemy = {id: 'e1', type: 'enemy', templateId: 'cat_big'} as unknown as Entity;
      expect(resolveEntitySprite(enemy)).toBeNull();
    });
  });

  describe('buildObjectSprites', () => {
    it('собирает пути для объектов и пропускает разрушенные двери', () => {
      initContent();
      const openDoor = makeDoor({id: 'door1', templateId: 'legacy_door', isOpen: true});
      const deadDoor = makeDoor({id: 'door2', isAlive: false});
      const depletedPoi = makePoi({id: 'poi1', charges: 0});
      const trap = makeTrap({id: 'trap1'});
      const entities = new Map<string, Entity>();
      entities.set(openDoor.id, openDoor);
      entities.set(deadDoor.id, deadDoor);
      entities.set(depletedPoi.id, depletedPoi);
      entities.set(trap.id, trap);
      const state = {entities} as unknown as GameState;

      const sprites = buildObjectSprites(state);

      expect(sprites.get('door1')).toBe('/assets/objects/doors/custom_open.png');
      expect(sprites.has('door2')).toBe(false);
      expect(sprites.get('poi1')).toBe('/assets/objects/pois/altar_depleted.png');
      expect(sprites.get('trap1')).toBe('/assets/objects/traps/spikes.png');
      expect(sprites.size).toBe(3);
    });
  });
});
