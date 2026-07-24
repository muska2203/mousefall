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

import {createPortal} from 'react-dom';
import type {ItemDetailViewModel} from '@presentation/types';
import {ItemDetailCard} from './ItemDetailCard';
import {usePopoverPosition} from './hooks/usePopoverPosition';

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

export function ItemDetailPopover({ item, visible, x, y }: Props) {
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

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
