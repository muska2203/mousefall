/**
 * Кнопка отображения текущей фазы хода и пропуска хода игрока.
 *
 * Используется в GameField.
 */

import {useTranslation} from '@i18n/hooks';
import type {TurnSide} from '@presentation/types';

interface PhaseButtonProps {
  side: TurnSide;
  onEndTurn: () => void;
}

/** Локализованная метка для текущей фазы хода. */
function getPhaseLabel(side: TurnSide, t: (key: string) => string): string {
  switch (side) {
    case 'player':
      return t('gameField.playerPhaseLabel');
    case 'enemies':
      return t('gameField.enemiesPhaseLabel');
    case 'allies':
      return t('gameField.alliesPhaseLabel');
    case 'neutrals':
      return t('gameField.neutralsPhaseLabel');
    case 'status_tick':
      return t('gameField.statusTickPhaseLabel');
    case 'round_recovery':
      return t('gameField.roundRecoveryPhaseLabel');
    case 'environment':
      return t('gameField.environmentPhaseLabel');
    default:
      return t('gameField.statusTickPhaseLabel');
  }
}

/** Плашка текущей фазы хода. Во время анимаций отображает сторону
 *  проигрываемой анимационной фазы; в idle — активную сторону из состояния. */
export function PhaseButton({ side, onEndTurn }: PhaseButtonProps) {
  const { t } = useTranslation('components');

  const isPlayerTurn = side === 'player';
  const label = getPhaseLabel(side, t);

  return (
    <button
      type="button"
      className="cm-phase cm-phase--field cm-phase--skip-turn"
      onClick={onEndTurn}
      disabled={!isPlayerTurn}
      aria-label={label}
    >
      <span className="cm-phase__default">{label}</span>
      {isPlayerTurn && (
        <span className="cm-phase__hover" aria-hidden="true">
          {t('gameField.skipTurnHoverLabel')}
        </span>
      )}
    </button>
  );
}
