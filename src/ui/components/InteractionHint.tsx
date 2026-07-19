/**
 * Подсказка доступного взаимодействия (F / Tab) рядом с объектом на поле.
 *
 * Рендерится через React/DOM поверх игрового поля, а не через PixiJS,
 * чтобы текст и рамка всегда оставались единым цельным блоком.
 */

import {useTranslation} from '@i18n/hooks';

interface Props {
  screenX: number;
  screenY: number;
  label: string;
  hasMultiple: boolean;
}

export function InteractionHint({ screenX, screenY, label, hasMultiple }: Props) {
  const { t } = useTranslation('components');

  return (
    <div
      className="cm-interaction-hint"
      style={{
        left: screenX,
        top: screenY,
      }}
    >
      <div className="cm-interaction-hint__main">
        <span className="cm-interaction-hint__key">{t('interactionHint.keyF')}</span>
        <span className="cm-interaction-hint__label">{label}</span>
      </div>
      {hasMultiple && (
        <div className="cm-interaction-hint__tab">
          <span className="cm-interaction-hint__tab-key">{t('interactionHint.keyTab')}</span>
        </div>
      )}
    </div>
  );
}
