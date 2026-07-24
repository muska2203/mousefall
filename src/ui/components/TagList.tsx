/**
 * Список игровых тегов.
 *
 * Отрисовывает бейджи по уже локализованным меткам, полученным от Presentation.
 */

import type {GameplayTag} from '@presentation/types';
import {TagBadge} from './TagBadge';

interface Props {
  /** Теги с локализованными метками для отображения. */
  items: Array<{ tag: GameplayTag; label: string }>;
}

export function TagList({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="cm-tag-list">
      {items.map(({ tag, label }) => (
        <TagBadge key={tag} tag={tag} label={label} />
      ))}
    </div>
  );
}
