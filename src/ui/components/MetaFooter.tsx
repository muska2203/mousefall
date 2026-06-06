/**
 * Футер с брендом и версией (единый для всех экранов).
 */

import { useTranslation } from '@i18n/hooks';

export function MetaFooter() {
  const { t } = useTranslation('components');
  return (
    <footer className="cm-meta-footer">
      <div className="cm-meta-footer__brand">Mousefall</div>
      <div className="cm-meta-footer__meta">
        <div className="cm-meta-footer__line">
          <span className="cm-meta-footer__value">{t('metaFooter.versionLine')}</span>
        </div>
        <p className="cm-meta-footer__note">{t('metaFooter.analyticsNote')}</p>
      </div>
    </footer>
  );
}
