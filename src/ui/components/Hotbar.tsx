/**
 * Панель быстрого доступа (хотбар).
 *
 * Горизонтальный контейнер квадратных слотов для скиллов и расходников.
 * Получает готовый ViewModel от Presentation и делегирует активацию наружу.
 */

import {useTranslation} from '@i18n/hooks';
import type {HotbarItemViewModel} from '@presentation/types';
import {HotbarSlot} from './HotbarSlot';

interface Props {
  /** Список слотов хотбара. */
  items: HotbarItemViewModel[];
  /** Общее количество слотов (по умолчанию 10). */
  size?: number;
  /** Блокировать все слоты (например, во время анимаций). */
  disabled?: boolean;
  /** Обработчик активации слота по индексу. */
  onSlotClick?: (index: number) => void;
}

const EMPTY_ITEM = (index: number): HotbarItemViewModel => ({
  slotIndex: index,
  kind: 'empty',
  icon: null,
  apCost: 0,
  isAvailable: false,
  isActive: false,
});

export function Hotbar({ items, size = 10, disabled, onSlotClick }: Props) {
  const { t } = useTranslation('components');

  return (
    <div className="cm-quickbar-wrap cm-panel cm-quickbar-wrap--recessed">
      <span className="cm-rivet cm-rivet--tl" />
      <span className="cm-rivet cm-rivet--tr" />
      <span className="cm-rivet cm-rivet--bl" />
      <span className="cm-rivet cm-rivet--br" />
      <div
        className="cm-quickbar"
        role="toolbar"
        aria-label={t('hotbar.toolbarAria')}
      >
        {Array.from({ length: size }).map((_, index) => {
          const item = items[index] ?? EMPTY_ITEM(index);
          return (
            <HotbarSlot
              key={`quick-${index}`}
              index={index}
              item={item}
              disabled={disabled}
              onClick={() => onSlotClick?.(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
