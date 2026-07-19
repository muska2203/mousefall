/**
 * Квадратный слот хотбара.
 *
 * Отображает назначенный скилл или расходник, цифру клавиши, AP, кулдаун,
 * количество и тултип при наведении.
 */

import {useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {HotbarItemViewModel} from '@presentation/types';
import {resolveItemFrame} from '@utils/assetResolver';
import {CircularCooldown} from './CircularCooldown';
import {ItemDetailPopover} from './ItemDetailPopover';
import {SkillDetailPopover} from './SkillDetailPopover';

interface Props {
  /** Индекс слота (0–9). */
  index: number;
  /** Данные слота из Presentation. */
  item: HotbarItemViewModel;
  /** Блокировать интерактивность независимо от состояния слота. */
  disabled?: boolean;
  /** Вызывается при клике или активации с клавиатуры. */
  onClick?: () => void;
}

function slotLabel(index: number): string {
  return index < 9 ? String(index + 1) : '0';
}

function formatApCost(cost: number | 'all' | undefined): string {
  if (cost === 'all') return '∞';
  return cost != null && cost > 0 ? String(cost) : '';
}

export function HotbarSlot({ index, item, disabled, onClick }: Props) {
  const { t } = useTranslation('components');
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isEmpty = item.kind === 'empty';
  const showCooldown =
    item.cooldown != null && item.cooldown > 0 && item.maxCooldown != null && item.maxCooldown > 0;
  const showAp = formatApCost(item.apCost) !== '';
  const showQty = item.kind === 'consumable' && item.quantity !== undefined;
  const isUnavailable = !isEmpty && !item.isAvailable && !item.isActive;

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => setIsHovered(false);

  const className = [
    'cm-quick-slot',
    item.isActive ? 'cm-quick-slot--active' : '',
    isEmpty ? 'cm-quick-slot--empty' : '',
    item.depleted ? 'cm-quick-slot--depleted' : '',
    isUnavailable ? 'cm-quick-slot--unavailable' : '',
  ].join(' ');

  return (
    <>
      <button
        type="button"
        className={className}
        data-slot-index={index}
        aria-label={
          isEmpty
            ? t('hotbar.emptySlotAria', { index: slotLabel(index) })
            : t('hotbar.occupiedSlotAria', { index: slotLabel(index) })
        }
        tabIndex={isEmpty ? -1 : 0}
        disabled={isEmpty || disabled}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <span className="cm-quick-slot__key">{slotLabel(index)}</span>

        {!isEmpty && item.icon && item.kind === 'consumable' && (
          <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
            <img
              className="cm-sprite-stack__frame"
              src={resolveItemFrame(item.rarity ?? 'common')}
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
            <span className="cm-sprite-fallback">{item.fallback ?? '—'}</span>
          </span>
        )}

        {!isEmpty && item.icon && item.kind === 'skill' && (
          <span className="cm-sprite-stack cm-sprite-stack--skill" aria-hidden="true">
            <img
              className="cm-sprite-stack__skill"
              src={item.icon}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="cm-sprite-fallback">{item.fallback ?? '—'}</span>
          </span>
        )}

        {isEmpty && <span className="cm-sprite-fallback">{item.fallback ?? ''}</span>}

        {showQty && (
          <span
            className={`cm-quick-slot__qty ${
              item.quantity === 0 ? 'cm-quick-slot__qty--zero' : ''
            }`}
          >
            {item.quantity}
          </span>
        )}

        {showAp && <span className="cm-quick-slot__ap">{formatApCost(item.apCost)}</span>}

        {showCooldown && (
          <span className="cm-quick-slot__cooldown">
            <CircularCooldown value={item.cooldown!} max={item.maxCooldown!} />
          </span>
        )}
      </button>

      {isHovered && item.tooltip?.kind === 'consumable' && (
        <ItemDetailPopover
          item={item.tooltip.item}
          visible={true}
          x={mousePos.x + 16}
          y={mousePos.y + 16}
        />
      )}

      {isHovered && item.tooltip?.kind === 'skill' && (
        <SkillDetailPopover
          skill={item.tooltip}
          visible={true}
          x={mousePos.x + 16}
          y={mousePos.y + 16}
        />
      )}
    </>
  );
}
