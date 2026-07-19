/**
 * Inline-ссылка игрового тега.
 *
 * Рендерит подчёркнутый текст с цветом, соответствующим категории тега.
 */

import type {GameplayTag} from '@presentation/types';

interface Props {
  /** Игровой тег классификации. */
  tag: GameplayTag;
  /** Локализованная метка тега. */
  label: string;
}

const KNOWN_CATEGORIES = new Set(['attack', 'target', 'delivery', 'effect', 'buff']);

export function TagLink({ tag, label }: Props) {
  const category = tag.split('.')[0] ?? '';
  const modifier = KNOWN_CATEGORIES.has(category) ? category : 'other';

  return (
    <span className={`cm-tag-link cm-tag-link--${modifier}`}>
      {label}
    </span>
  );
}
