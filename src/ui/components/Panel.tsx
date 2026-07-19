/**
 * Деревянная панель с бронзовой рамкой и заклёпками.
 * Базовый визуальный компонент для всех секций UI.
 */

import {type ReactNode} from 'react';

interface Props {
  title: ReactNode;
  titleId?: string;
  children: ReactNode;
  className?: string;
  fill?: boolean;
}

export function Panel({title, titleId, children, className = '', fill = false}: Props) {
  // role="region" добавляем только когда есть именующий titleId,
  // иначе скринридер получает безымянный landmark.
  const hasLabel = Boolean(titleId);

  return (
    <section
      className={`cm-panel ${fill ? 'cm-panel--fill' : ''} ${className}`.trim()}
      role={hasLabel ? 'region' : undefined}
      aria-labelledby={titleId || undefined}
    >
      <span className="cm-rivet cm-rivet--tl" aria-hidden="true" />
      <span className="cm-rivet cm-rivet--tr" aria-hidden="true" />
      <span className="cm-rivet cm-rivet--bl" aria-hidden="true" />
      <span className="cm-rivet cm-rivet--br" aria-hidden="true" />
      <h2 className="cm-panel__title" id={titleId}>
        {title}
      </h2>
      <div className="cm-panel__body">{children}</div>
    </section>
  );
}
