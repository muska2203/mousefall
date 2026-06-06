/**
 * Строка распределяемой характеристики с кнопками +/-.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from '@i18n/hooks';
import { DetailPopover } from './DetailPopover';

interface Props {
  icon: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  canIncrease: boolean;
  /** Краткое шуточное описание для тултипа. */
  flavorText?: string;
  /** Строки с подробным описанием влияния для тултипа. */
  detailLines?: string[];
}

export function StatRow({ icon, name, value, onChange, canIncrease, flavorText, detailLines }: Props) {
  const { t } = useTranslation('components');
  const canDecrease = value > 0;
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipPos(null);
  }, []);

  const showTooltip = Boolean(tooltipPos && (flavorText || (detailLines && detailLines.length > 0)));

  return (
    <>
      <li
        className="cm-stat-row cm-stat-row--alloc"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <span className="cm-stat-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="cm-stat-name">{name}</span>
        <button
          type="button"
          className="cm-stat-btn"
          onClick={() => canDecrease && onChange(value - 1)}
          disabled={!canDecrease}
          aria-label={t('statRow.decreaseAria', { name })}
        >
          −
        </button>
        <span className="cm-stat-value">{value}</span>
        <button
          type="button"
          className="cm-stat-btn"
          onClick={() => canIncrease && onChange(value + 1)}
          disabled={!canIncrease}
          aria-label={t('statRow.increaseAria', { name })}
        >
          +
        </button>
      </li>
      <DetailPopover
        title={name}
        icon={icon}
        flavorText={flavorText ?? ''}
        details={detailLines ?? []}
        visible={showTooltip}
        x={tooltipPos?.x}
        y={tooltipPos?.y}
      />
    </>
  );
}

/**
 * Строка только для чтения (производная характеристика).
 */
export function StatRowReadonly({
  icon,
  name,
  value,
  flavorText,
  detailLines,
}: {
  icon: string;
  name: string;
  value: string;
  flavorText?: string;
  detailLines?: string[];
}) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipPos(null);
  }, []);

  const showTooltip = Boolean(tooltipPos && (flavorText || (detailLines && detailLines.length > 0)));

  return (
    <>
      <li
        className="cm-stat-row cm-stat-row--readonly"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <span className="cm-stat-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="cm-stat-name">{name}</span>
        <span className="cm-stat-value">{value}</span>
      </li>
      <DetailPopover
        title={name}
        icon={icon}
        flavorText={flavorText ?? ''}
        details={detailLines ?? []}
        visible={showTooltip}
        x={tooltipPos?.x}
        y={tooltipPos?.y}
      />
    </>
  );
}
