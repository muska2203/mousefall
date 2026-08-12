/**
 * Builder для события ENTITY_DAMAGED.
 *
 * Возвращает DAMAGE-узел с детьми (например, смерть).
 * HP отображается через sticker-рамку сущности, отдельная анимация
 * HP-бара больше не требуется.
 * При теге 'crit' (правило core_crit_on_dazed_stunned) отдельный текст не добавляется:
 * крит отображается в самом числе урона («N!») в PixiFloatingTextExecutor.
 */

import type {AnimationBuilder} from '../core/registry';
import {damageNode} from '../core/primitives';

export const entityDamagedBuilder: AnimationBuilder = (event, children) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;

  return [damageNode(event, children)];
};
