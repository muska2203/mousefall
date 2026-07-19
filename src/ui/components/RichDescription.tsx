/**
 * Компонент для рендера описаний с inline-ссылками на теги.
 *
 * Парсит строку вида `[метка](tag:tagId)` и превращает ссылки в `<TagLink>`.
 */

import type {ReactNode} from 'react';
import {TagLink} from './TagLink';

interface Props {
  /** Текст с markdown-like тег-ссылками. */
  text: string;
}

const TAG_LINK_REGEX = /\[([^\]]+)]\(tag:([^)]+)\)/g;

export function RichDescription({ text }: Props) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let keyIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={keyIndex++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const label = match[1] ?? '';
    const tag = match[2] ?? '';
    nodes.push(<TagLink key={keyIndex++} tag={tag} label={label} />);

    lastIndex = TAG_LINK_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={keyIndex++}>{text.slice(lastIndex)}</span>);
  }

  return <>{nodes}</>;
}
