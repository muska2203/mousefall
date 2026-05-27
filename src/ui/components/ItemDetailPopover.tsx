/**
 * Тултип с детальной информацией о предмете.
 *
 * Отображает карточку предмета с иконкой, редкостью, характеристиками и описанием.
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 *
 * Потребляет ItemDetailViewModel, подготовленный Presentation через
 * {@link mapItemTemplateToDetail}. UI не знает о ItemTemplate.
 *
 * Пример использования:
 * <ItemDetailPopover
 *   item={mapItemTemplateToDetail(template, { stackCount: 3 })}
 *   visible={isVisible}
 *   x={mouseX}
 *   y={mouseY}
 * />
 */

import { useLayoutEffect, useRef } from 'react';
import type { ItemDetailViewModel } from '@presentation/itemDetailMapper';
import { resolveItemFrame } from '@utils/assetResolver';

interface Props {
  /** Данные предмета для отображения (готовый ViewModel). */
  item: ItemDetailViewModel;
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

const POPOVER_OFFSET = 16;
const VIEWPORT_PADDING = 8;

export function ItemDetailPopover({ item, visible, x, y }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || x === undefined || y === undefined) return;

    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + POPOVER_OFFSET;
    let top = y + POPOVER_OFFSET;

    // Если карточка не влезает справа — отображаем слева от курсора
    if (left + rect.width > viewportWidth - VIEWPORT_PADDING) {
      left = x - rect.width - POPOVER_OFFSET;
    }
    // Если карточка не влезает снизу — отображаем сверху от курсора
    if (top + rect.height > viewportHeight - VIEWPORT_PADDING) {
      top = y - rect.height - POPOVER_OFFSET;
    }

    // Не даём уйти за левый/верхний край viewport
    left = Math.max(VIEWPORT_PADDING, left);
    top = Math.max(VIEWPORT_PADDING, top);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, visible, item]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="inventory-item-detail-popover"
      role="tooltip"
    >
      <div className={`item-detail-card item-detail-rarity-${item.rarity}`}>
        <header className="item-detail-head">
          <span className="item-detail-rarity">{item.rarityLabel}</span>
          <span className="item-detail-type">{item.typeLabel}</span>
          {item.stackCount !== undefined && item.stackCount > 1 && (
            <span className="item-detail-stack-pill">{item.stackCount}</span>
          )}
        </header>

        <div className="item-detail-title-row">
          <span
            className={`item-detail-icon cm-inv-cell item-rarity-${item.rarity}`}
            aria-hidden="true"
          >
            <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
              <img
                className="cm-sprite-stack__frame"
                src={resolveItemFrame(item.rarity)}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <img
                className="cm-sprite-stack__body"
                src={item.icon}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className="cm-sprite-fallback">
                {item.fallbackIcon ?? '—'}
              </span>
            </span>
          </span>
          <span className="item-detail-name">{item.name}</span>
        </div>

        {item.sections.map((section, index) => {
          if (section.kind === 'stat-list') {
            return (
              <div className="item-detail-section" key={index}>
                <h4 className="item-detail-section-title">{section.title}</h4>
                <ul className="item-detail-list item-detail-list-plain">
                  {section.stats.map((stat, sIndex) => (
                    <li key={sIndex}>
                      {stat.label}: <strong>{stat.value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          if (section.kind === 'description') {
            return (
              <div className="item-detail-section" key={index}>
                <h4 className="item-detail-section-title">Описание</h4>
                <p className="item-detail-desc">{section.text}</p>
              </div>
            );
          }

          return (
            <div className="item-detail-section" key={index}>
              <h4 className="item-detail-section-title">{section.title}</h4>
              {section.content as React.ReactNode}
            </div>
          );
        })}
      </div>
    </div>
  );
}
