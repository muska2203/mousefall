/**
 * Бейдж игрового тега.
 *
 * Рендерит локализованную метку с цветовым модификатором по категории тега.
 */

import type {GameplayTag} from '@presentation/types';

interface Props {
  /** Игровой тег классификации. */
  tag: GameplayTag;
  /** Локализованное название тега. */
  label: string;
}

const KNOWN_CATEGORIES = new Set(['attack', 'target', 'delivery', 'effect', 'buff']);

export function TagBadge({ tag, label }: Props) {
  const category = tag.split('.')[0] ?? '';
  const modifier = KNOWN_CATEGORIES.has(category) ? category : 'other';

  return (
    <span className={`cm-tag-badge cm-tag-badge--${modifier}`}>
      {label}
    </span>
  );
}
