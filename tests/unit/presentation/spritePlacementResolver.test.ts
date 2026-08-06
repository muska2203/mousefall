import {describe, expect, it} from 'vitest';
import type {
  DoorTemplate,
  EntityTemplate,
  PlayerTemplate,
  TileEffectStatusTemplate,
  TileEffectTemplate,
} from '../../../src/content/schemas';
import {getSpritePlacement} from '../../../src/presentation/spritePlacementResolver';
import {initObjectContentRegistry} from '../../fixtures/gameState';

/** Минимальный шаблон врага с заданным placement (остальные поля резолверу не нужны). */
function entityTemplate(id: string, placement?: EntityTemplate['placement']): EntityTemplate {
  return {id, placement} as unknown as EntityTemplate;
}

/** Минимальный шаблон игрока. */
function playerTemplate(id: string, placement?: PlayerTemplate['placement']): PlayerTemplate {
  return {id, placement} as unknown as PlayerTemplate;
}

/** Минимальный шаблон тайлового эффекта. */
function tileEffectTemplate(
  id: string,
  layer: 'cover' | 'aboveGround',
  placement?: TileEffectTemplate['placement'],
): TileEffectTemplate {
  return {id, layer, placement} as unknown as TileEffectTemplate;
}

/** Минимальный шаблон статуса тайлового эффекта. */
function tileEffectStatusTemplate(
  id: string,
  placement?: TileEffectStatusTemplate['placement'],
): TileEffectStatusTemplate {
  return {id, placement} as unknown as TileEffectStatusTemplate;
}

/** Реестр с шаблонами для всех категорий спрайтов. */
function initContent(): void {
  initObjectContentRegistry({
    entities: new Map<string, EntityTemplate>([
      ['test_enemy', entityTemplate('test_enemy')],
      ['big_enemy', entityTemplate('big_enemy', {scale: 2.0})],
      ['shifted_enemy', entityTemplate('shifted_enemy', {anchorY: 1.0})],
    ]),
    players: new Map<string, PlayerTemplate>([
      ['test_player', playerTemplate('test_player')],
      ['floating_player', playerTemplate('floating_player', {anchorY: 0.6, anchorX: 0})],
    ]),
    doors: new Map<string, DoorTemplate>([
      ['scaled_door', {id: 'scaled_door', placement: {scale: 1.2}} as unknown as DoorTemplate],
    ]),
    tileEffects: new Map<string, TileEffectTemplate>([
      ['water', tileEffectTemplate('water', 'cover')],
      ['smoke', tileEffectTemplate('smoke', 'aboveGround')],
      ['tall_smoke', tileEffectTemplate('tall_smoke', 'aboveGround', {scale: 1.5, anchorY: 1.0})],
    ]),
    tileEffectStatuses: new Map<string, TileEffectStatusTemplate>([
      ['burning', tileEffectStatusTemplate('burning')],
      ['big_status', tileEffectStatusTemplate('big_status', {scale: 1.0, anchorX: 0})],
    ]),
  });
}

describe('spritePlacementResolver', () => {
  describe('дефолты категорий (шаблон не найден или нет переопределений)', () => {
    it('actor без шаблона — опора по центру X, низ на 0.8', () => {
      initContent();
      expect(getSpritePlacement('unknown', 'actor')).toEqual({
        scale: 1.0,
        anchorX: 0.5,
        anchorY: 0.8,
        flattenY: false,
      });
    });

    it('object без шаблона — опора по левому краю, низ на 0.8', () => {
      initContent();
      expect(getSpritePlacement('unknown', 'object')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0.8,
        flattenY: false,
      });
    });

    it('trap без шаблона — сплющен в плоскость пола', () => {
      initContent();
      expect(getSpritePlacement('unknown', 'trap')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0,
        flattenY: true,
      });
    });

    it('tileEffectCover без шаблона — сплющен в плоскость пола', () => {
      initContent();
      expect(getSpritePlacement(undefined, 'tileEffectCover')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0,
        flattenY: true,
      });
    });

    it('tileEffectAboveGround без шаблона — полный размер, низ на 0.8', () => {
      initContent();
      expect(getSpritePlacement(undefined, 'tileEffectAboveGround')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0.8,
        flattenY: false,
      });
    });

    it('tileEffectStatus без шаблона — масштаб 0.7, опора по центру, низ на 0.5', () => {
      initContent();
      expect(getSpritePlacement(undefined, 'tileEffectStatus')).toEqual({
        scale: 0.7,
        anchorX: 0.5,
        anchorY: 0.5,
        flattenY: false,
      });
    });

    it('terrainStanding — полный размер, низ к низу клетки', () => {
      initContent();
      expect(getSpritePlacement(undefined, 'terrainStanding')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 1.0,
        flattenY: false,
      });
    });
  });

  describe('шаблоны без placement возвращают дефолт категории', () => {
    it('враг без placement — дефолт категории actor', () => {
      initContent();
      expect(getSpritePlacement('test_enemy', 'actor')).toEqual({
        scale: 1.0,
        anchorX: 0.5,
        anchorY: 0.8,
        flattenY: false,
      });
    });

    it('игрок без placement — дефолт категории actor', () => {
      initContent();
      expect(getSpritePlacement('test_player', 'actor')).toEqual({
        scale: 1.0,
        anchorX: 0.5,
        anchorY: 0.8,
        flattenY: false,
      });
    });

    it('cover-эффект без placement — сплющен', () => {
      initContent();
      expect(getSpritePlacement('water', 'tileEffectCover')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0,
        flattenY: true,
      });
    });

    it('статус без placement — дефолт категории tileEffectStatus', () => {
      initContent();
      expect(getSpritePlacement('burning', 'tileEffectStatus')).toEqual({
        scale: 0.7,
        anchorX: 0.5,
        anchorY: 0.5,
        flattenY: false,
      });
    });
  });

  describe('placement-override шаблона', () => {
    it('placement.scale переопределяет дефолт категории', () => {
      initContent();
      expect(getSpritePlacement('scaled_door', 'object').scale).toBe(1.2);
      expect(getSpritePlacement('big_enemy', 'actor').scale).toBe(2.0);
    });

    it('частичный override: меняется только указанное поле', () => {
      initContent();
      expect(getSpritePlacement('shifted_enemy', 'actor')).toEqual({
        scale: 1.0,
        anchorX: 0.5,
        anchorY: 1.0,
        flattenY: false,
      });
    });

    it('override нескольких полей у игрока', () => {
      initContent();
      expect(getSpritePlacement('floating_player', 'actor')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0.6,
        flattenY: false,
      });
    });

    it('override размещения тайлового эффекта aboveGround', () => {
      initContent();
      expect(getSpritePlacement('tall_smoke', 'tileEffectAboveGround')).toEqual({
        scale: 1.5,
        anchorX: 0,
        anchorY: 1.0,
        flattenY: false,
      });
    });

    it('override размещения статуса тайлового эффекта', () => {
      initContent();
      expect(getSpritePlacement('big_status', 'tileEffectStatus')).toEqual({
        scale: 1.0,
        anchorX: 0,
        anchorY: 0.5,
        flattenY: false,
      });
    });
  });
});
