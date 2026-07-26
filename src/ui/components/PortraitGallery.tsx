/**
 * Галерея выбора портрета: превью + сетка миниатюр.
 *
 * Используется в CharacterCreationScreen.
 */

import {useTranslation} from '@i18n/hooks';
import {GameSession} from '@presentation/gameSession';

export type PortraitItem = {
  id: string;
  name: string;
  desc: string;
  img: string;
};

interface Props {
  portraits: PortraitItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PortraitGallery({portraits, selectedId, onSelect}: Props) {
  const { t } = useTranslation('components');
  const selected = portraits.find((p) => p.id === selectedId) ?? portraits[0];

  if (!selected || portraits.length === 0) {
    return (
      <div className="cm-welcome-center">
        <div className="cm-welcome-preview">
          <div className="cm-welcome-preview-img-wrap">
            <img src={GameSession.getPlayerPortraitSrc('')} alt={t('portraitGallery.previewAlt')} />
          </div>
          <h3 className="cm-welcome-preview-name">—</h3>
          <p className="cm-welcome-preview-desc">—</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cm-welcome-center">
      <div className="cm-welcome-preview">
        <div className="cm-welcome-preview-img-wrap">
          <img src={selected.img} alt={t('portraitGallery.previewAlt')} />
        </div>
        <h3 className="cm-welcome-preview-name">{selected.name}</h3>
        <p className="cm-welcome-preview-desc">{selected.desc}</p>
      </div>

      <div className="cm-welcome-gallery-wrap cm-scroll-wood">
        <div className="cm-welcome-gallery">
          {portraits.map((p) => (
            <button
              key={p.id}
              className={`cm-welcome-gallery-item ${p.id === selectedId ? 'active' : ''}`}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-label={p.name}
              title={p.name}
            >
              <img src={p.img} alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
