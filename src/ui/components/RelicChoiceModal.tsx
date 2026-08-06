/**
 * Модальное окно выбора реликвии (окно poi вида `relic_choice`).
 *
 * Рендерится через portal в document.body поверх игрового экрана
 * (образец — DetailPopover). Пока окно открыто, ввод в игру заблокирован
 * на уровне GameScreen (`GameSession.isWindowOpen()`).
 *
 * Выбор опции → `onChoose(optionId)` (dispatch RESOLVE_POI_CHOICE),
 * кнопка отказа → `onDecline()` (без dispatch, предложение сохраняется).
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {PendingWindowViewModel} from '@presentation/types';
import {Panel} from './Panel';
import {RichDescription} from './RichDescription';

export interface RelicChoiceModalProps {
  window: PendingWindowViewModel;
  onChoose: (optionId: string) => void;
  onDecline: () => void;
}

export function RelicChoiceModal({window, onChoose, onDecline}: RelicChoiceModalProps) {
  const {t} = useTranslation('components');

  return createPortal(
    <div className="cm-modal-backdrop is-open" role="dialog" aria-modal="true" aria-label={window.title}>
      <Panel title={window.title} className="cm-modal">
        <div className="cm-choice">
          <div
            className={`cm-choice__grid ${window.options.length === 1 ? 'is-single' : ''}`}
            role="group"
            aria-label={t('relicChoice.optionsAriaLabel')}
          >
            {window.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="cm-choice-card"
                onClick={() => onChoose(option.id)}
              >
                <div className="cm-choice-card__head">
                  <div className="cm-choice-card__head-main">
                    <span className="cm-choice-card__icon" aria-hidden="true">
                      {option.icon
                        ? <img src={option.icon} alt="" />
                        : (option.fallback ?? '❔')}
                    </span>
                    <h4>{option.name}</h4>
                  </div>
                </div>
                {option.effects.length > 0 && (
                  <ul className="cm-choice-card__effects">
                    {option.effects.map((effect) => (
                      <li key={effect.key} className="cm-choice-card__effect">
                        <span className="cm-choice-card__effect-name">{effect.name}</span>
                        <span className="cm-choice-card__effect-desc">
                          <RichDescription text={effect.description} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {option.flavorText && (
                  <p className="cm-choice-card__flavor">{option.flavorText}</p>
                )}
              </button>
            ))}
          </div>
          <div className="cm-modal__actions">
            <button type="button" className="cm-btn cm-btn--secondary" onClick={onDecline}>
              {t('relicChoice.declineLabel')}
            </button>
          </div>
        </div>
      </Panel>
    </div>,
    document.body,
  );
}
