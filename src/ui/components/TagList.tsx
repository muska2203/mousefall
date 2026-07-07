/**
 * Список игровых тегов.
 *
 * Локализует каждый тег через content-тексты и отрисовывает бейджи.
 */

import { getTagText } from '@content/texts/lookup';
import type { Locale } from '@content/texts/lookup';
import type { GameplayTag } from '@presentation/types';
import { TagBadge } from './TagBadge';

interface Props {
  /** Теги для отображения. */
  tags: GameplayTag[];
  /** Локаль перевода. */
  locale?: Locale;
}

export function TagList({ tags, locale = 'ru' }: Props) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="cm-tag-list">
      {tags.map((tag) => {
        const text = getTagText(tag, locale);
        return <TagBadge key={tag} tag={tag} label={text.name} />;
      })}
    </div>
  );
}
