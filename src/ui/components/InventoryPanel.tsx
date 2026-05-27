/**
 * Панель инвентаря (сетка ячеек).
 *
 * Используется в GameScreen (правая колонка).
 */

import { useState } from 'react';
import type { InventoryItemViewModel } from '@presentation/types';
import { ItemDetailPopover } from './ItemDetailPopover';
import { resolveItemFrame } from '@utils/assetResolver';
import { Panel } from './Panel';

interface Props {
  items: InventoryItemViewModel[];
  onItemClick?: (instanceId: string, templateId: string) => void;
}

export function InventoryPanel({ items, onItemClick }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const hoveredItem = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <Panel title="Инвентарь" className="cm-panel--inventory" fill={true}>
      <div className="cm-inv-wrap cm-scroll-wood">
        <div className="cm-inv-grid">
          {items.map((item, index) => (
            <div
              key={item.instanceId}
              className="cm-inv-cell"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onItemClick?.(item.instanceId, item.templateId)}
            >
              <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
                <img
                  className="cm-sprite-stack__frame"
                  src={resolveItemFrame(item.detail.rarity)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="cm-sprite-stack__body"
                  src={item.detail.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="cm-sprite-fallback">
                  {item.detail.fallbackIcon ?? '—'}
                </span>
              </span>
              {item.quantity > 1 && (
                <span className="cm-inv-cell__qty">{item.quantity}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {hoveredItem && (
        <ItemDetailPopover
          item={hoveredItem.detail}
          visible={true}
          x={mousePos.x + 16}
          y={mousePos.y + 16}
        />
      )}
    </Panel>
  );
}
