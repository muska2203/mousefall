/**
 * Универсальный тултип с подробным описанием.
 *
 * Используется для характеристик, эффектов и прочего, где нужно
 * показать название, шуточное описание и список влияний.
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 *
 * Пример использования:
 * <DetailPopover
 *   title="Сила"
 *   icon="💪"
 *   flavorText="Чем больше мышцы, тем громче звук при ударе."
 *   details={["+1 к урону от оружия", "+5 к максимальному переносимому весу"]}
 *   visible={isVisible}
 *   x={mouseX}
 *   y={mouseY}
 * />
 */

import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@i18n/hooks';

interface Props {
  /** Название описываемого элемента. */
  title: string;
  /** Иконка (эмодзи или символ). */
  icon?: string;
  /** Краткое шуточное описание. */
  flavorText: string;
  /** Список строк с подробностями влияния. */
  details: string[];
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

const POPOVER_OFFSET = 16;
const VIEWPORT_PADDING = 8;

export function DetailPopover({ title, icon, flavorText, details, visible, x, y }: Props) {
  const { t } = useTranslation('components');
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
  }, [x, y, visible, title, flavorText, details]);

  if (!visible) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="detail-popover" role="tooltip">
      <div className="detail-popover-card">
        <div className="detail-popover-head">
          {icon && (
            <span className="detail-popover-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="detail-popover-title">{title}</span>
        </div>

        <p className="detail-popover-flavor">{flavorText}</p>

        {details.length > 0 && (
          <div className="detail-popover-section">
            <h4 className="detail-popover-section-title">{t('detailPopover.impactTitle')}</h4>
            <ul className="detail-popover-list">
              {details.map((line, index) => (
                <li key={index} className="detail-popover-list-item">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
