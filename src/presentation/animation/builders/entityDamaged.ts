/**
 * Builder для события ENTITY_DAMAGED.
 *
 * Возвращает DAMAGE-узел с детьми (например, смерть).
 * HP отображается через sticker-рамку сущности, отдельная анимация
 * HP-бара больше не требуется.
 */

import type {AnimationBuilder} from '../core/registry';
import {damageNode} from '../core/primitives';

export const entityDamagedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;

  return [damageNode(event, children)];
};
