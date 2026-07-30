/**
 * Тесты отображения ловушек в DisplayState (фаза 5 слоистой модели клетки).
 *
 * Зафиксированное поведение: ловушка присутствует в DisplayState с флагом
 * `hidden` (скрытая — hidden: true). Решение о рендере принимает EntityRenderer
 * (скрытая не рисуется вне debug-режима), а DisplayState отражает состояние
 * симуляции как есть.
 */

import { describe, expect, it } from 'vitest';
import { applyPatch, buildDisplayState, createPatch } from '../../../src/presentation/displayState/builder';
import { makeGameState, makeTrap } from '../../fixtures/gameState';
import type { ObjectDestroyedEvent, ObjectRevealedEvent } from '../../../src/simulation/core-types';

describe('DisplayState — ловушка', () => {
  it('скрытая ловушка попадает в DisplayState с hidden: true', () => {
    const trap = makeTrap({ hidden: true });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });

    const display = buildDisplayState(state);
    const displayTrap = display.entities.get(trap.id);

    expect(displayTrap).toBeDefined();
    expect(displayTrap).toMatchObject({
      type: 'trap',
      templateId: 'spikes',
      hidden: true,
    });
  });

  it('видимая ловушка отображается с hidden: false', () => {
    const trap = makeTrap({ hidden: false });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });

    const display = buildDisplayState(state);

    expect(display.entities.get(trap.id)?.hidden).toBe(false);
  });

  it('OBJECT_REVEALED снимает hidden в DisplayState', () => {
    const trap = makeTrap({ hidden: true });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });
    trap.hidden = false; // состояние симуляции уже обновлено исполнителем

    const display = buildDisplayState(state);

    const event: ObjectRevealedEvent = {
      type: 'OBJECT_REVEALED', isFieldEvent: true,
      entityId: trap.id,
      objectType: 'spikes',
      position: { x: trap.x, y: trap.y },
    };
    const patched = applyPatch(display, createPatch(event, state));

    expect(patched.entities.get(trap.id)?.hidden).toBe(false);
  });

  it('OBJECT_DESTROYED удаляет ловушку из DisplayState', () => {
    const trap = makeTrap({ hidden: false });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });

    const display = buildDisplayState(state);

    const event: ObjectDestroyedEvent = {
      type: 'OBJECT_DESTROYED', isFieldEvent: true,
      entityId: trap.id,
      objectType: 'spikes',
      position: { x: trap.x, y: trap.y },
    };
    const patched = applyPatch(display, createPatch(event, state));

    expect(patched.entities.has(trap.id)).toBe(false);
  });
});
