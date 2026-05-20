/**
 * Галерея выбора портрета: превью + сетка миниатюр.
 *
 * Используется в CharacterCreationScreen.
 */

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
  const selected = portraits.find((p) => p.id === selectedId) ?? portraits[0]!;

  return (
    <div className="cm-welcome-center">
      <div className="cm-welcome-preview">
        <div className="cm-welcome-preview-img-wrap">
          <img src={selected.img} alt="Предпросмотр" />
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
