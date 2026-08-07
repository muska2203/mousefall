/**
 * Builder для события ENTITY_DAMAGED.
 *
 * Возвращает DAMAGE-узел с детьми (например, смерть).
 * HP отображается через sticker-рамку сущности, отдельная анимация
 * HP-бара больше не требуется.
 * При теге 'crit' (правило core_crit_on_dazed_stunned) добавляет
 * всплывающий текст «Крит!» рядом с уроном.
 */

import type {AnimationBuilder} from '../core/registry';
import {damageNode, floatingTextNode} from '../core/primitives';

export const entityDamagedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;

  const nodes = [damageNode(event, children)];
  if (event.tags.includes('crit')) {
    // styleKey мёртв (текст белый, как у всех floating text) — отдельный цвет не задаём.
    nodes.push(floatingTextNode(undefined, 'system.animation.crit', event.position, 'info'));
  }
  return nodes;
};
