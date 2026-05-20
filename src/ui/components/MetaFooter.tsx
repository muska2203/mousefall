/**
 * Футер с брендом и версией (единый для всех экранов).
 */

export function MetaFooter() {
  return (
    <footer className="cm-meta-footer">
      <div className="cm-meta-footer__brand">Mousefall</div>
      <div className="cm-meta-footer__meta">
        <div className="cm-meta-footer__line">
          <span className="cm-meta-footer__value">v. 0.1.0-alpha Разработчик: NameCode</span>
        </div>
        <p className="cm-meta-footer__note">Данные по забегам собираются для анализа в сервисе аналитики.</p>
      </div>
    </footer>
  );
}
