/**
 * Хук для позиционирования поповера рядом с курсором с учётом границ viewport.
 *
 * Поповер отображается справа-снизу от курсора. Если не влезает —
 * переносится слева или сверху.
 */

import {useEffect, useRef} from 'react';

const POPOVER_OFFSET = 16;
const VIEWPORT_PADDING = 8;

interface Options {
  /** Координата X опорной точки (обычно clientX курсора). */
  x?: number;
  /** Координата Y опорной точки (обычно clientY курсора). */
  y?: number;
  /** Управляет запуском позиционирования. */
  enabled?: boolean;
}

/**
 * Привязывает ref поповера к DOM-элементу.
 * Позиционирование выполняется в useEffect, чтобы не вызывать warning
 * при серверном рендеринге.
 */
export function usePopoverPosition<T extends HTMLElement>({x, y, enabled = true}: Options) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || x === undefined || y === undefined) return;

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
  }, [x, y, enabled]);

  return ref;
}
