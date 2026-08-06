/**
 * Панель коллекции реликвий (одна строка ячеек с горизонтальным скроллом).
 *
 * Используется в GameScreen (правая колонка, между экипировкой и инвентарём).
 * Рендерится всегда — при пустой коллекции показывает пустую строку.
 * Клик по ячейке не имеет действия; детали реликвии показываются по наведению.
 */

import {useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {RelicViewModel} from '@presentation/types';
import {RelicDetailPopover} from './RelicDetailPopover';

import {Panel} from './Panel';

interface Props {
  relics: RelicViewModel[];
}

export function RelicsPanel({ relics }: Props) {
  const { t } = useTranslation('components');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const hoveredRelic = hoveredIndex !== null ? relics[hoveredIndex] : null;

  return (
    <Panel title={t('relicsPanel.title')} className="cm-panel--relics">
      <div className="cm-relics-wrap cm-scroll-wood">
        <div className="cm-relics-row" role="list" aria-label={t('relicsPanel.listAriaLabel')}>
          {relics.map((relic, index) => (
            <div
              key={relic.templateId}
              className={`cm-inv-cell item-rarity-${relic.rarity}`}
              role="listitem"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
                <img
                  className="cm-sprite-stack__frame"
                  src={relic.frameUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                {relic.icon && (
                  <img
                    className="cm-sprite-stack__body"
                    src={relic.icon}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="cm-sprite-fallback">
                  {relic.fallback ?? '—'}
                </span>
              </span>
              {relic.count > 1 && (
                <span className="cm-inv-cell__qty">{relic.count}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {hoveredRelic && (
        <RelicDetailPopover
          relic={hoveredRelic}
          visible={true}
          x={mousePos.x + 16}
          y={mousePos.y + 16}
        />
      )}
    </Panel>
  );
}
