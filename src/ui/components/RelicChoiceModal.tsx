/**
 * Модальное окно выбора реликвии (окно poi вида `relic_choice`).
 *
 * Рендерится через portal в document.body поверх игрового экрана
 * (образец — DetailPopover). Пока окно открыто, ввод в игру заблокирован
 * на уровне GameScreen (`GameSession.isWindowOpen()`).
 *
 * Карточки показывают только спрайт и имя реликвии; описание (эффекты и
 * атмосферный текст) всплывает по наведению через RelicDetailPopover —
 * так же, как в панели коллекции реликвий.
 *
 * Выбор опции → `onChoose(optionId)` (dispatch RESOLVE_POI_CHOICE),
 * кнопка отказа → `onDecline()` (без dispatch, предложение сохраняется).
 */

import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {PendingWindowViewModel, RelicChoiceOptionViewModel, RelicViewModel} from '@presentation/types';
import {Panel} from './Panel';
import {RelicDetailPopover} from './RelicDetailPopover';

export interface RelicChoiceModalProps {
  window: PendingWindowViewModel;
  onChoose: (optionId: string) => void;
  onDecline: () => void;
}

/** Собирает ViewModel поповера из опции выбора (опция — реликвия из предложения poi). */
function toPopoverRelic(option: RelicChoiceOptionViewModel): RelicViewModel {
  return {
    templateId: option.id,
    count: 1,
    name: option.name,
    effects: option.effects,
    flavorText: option.flavorText,
    icon: option.icon,
    fallback: option.fallback,
    rarity: option.rarity,
    frameUrl: option.frameUrl,
  };
}

export function RelicChoiceModal({window, onChoose, onDecline}: RelicChoiceModalProps) {
  const {t} = useTranslation('components');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{x: number; y: number}>({x: 0, y: 0});

  const hoveredOption = hoveredIndex !== null ? window.options[hoveredIndex] : null;

  return createPortal(
    <div className="cm-modal-backdrop is-open" role="dialog" aria-modal="true" aria-label={window.title}>
      <Panel title={window.title} className="cm-modal">
        <div className="cm-choice">
          <div
            className={`cm-choice__grid ${window.options.length === 1 ? 'is-single' : ''}`}
            role="group"
            aria-label={t('relicChoice.optionsAriaLabel')}
          >
            {window.options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                className="cm-choice-card"
                onClick={() => onChoose(option.id)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={(e) => setMousePos({x: e.clientX, y: e.clientY})}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span className={`cm-inv-cell item-rarity-${option.rarity}`} aria-hidden="true">
                  <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
                    <img
                      className="cm-sprite-stack__frame"
                      src={option.frameUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    {option.icon && (
                      <img
                        className="cm-sprite-stack__body"
                        src={option.icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="cm-sprite-fallback">
                      {option.fallback ?? '—'}
                    </span>
                  </span>
                </span>
                <h4>{option.name}</h4>
              </button>
            ))}
          </div>
          <div className="cm-modal__actions">
            <button type="button" className="cm-btn cm-btn--secondary" onClick={onDecline}>
              {t('relicChoice.declineLabel')}
            </button>
          </div>
        </div>
        {hoveredOption && (
          <RelicDetailPopover
            relic={toPopoverRelic(hoveredOption)}
            visible={true}
            x={mousePos.x + 16}
            y={mousePos.y + 16}
          />
        )}
      </Panel>
    </div>,
    document.body,
  );
}
