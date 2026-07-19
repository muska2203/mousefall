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

import {useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {ItemDetailViewModel} from '@presentation/types';
import {ItemDetailCard} from './ItemDetailCard';

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

  return createPortal(
    <div
      ref={ref}
      className="inventory-item-detail-popover"
      role="tooltip"
    >
      <ItemDetailCard item={item} />
    </div>,
    document.body,
  );
}
