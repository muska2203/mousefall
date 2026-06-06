/**
 * Главное меню.
 *
 * Ответственность:
 * - Отображение заголовка и кнопок навигации.
 * - Не содержит логики создания игры.
 */

import { useTranslation } from '@i18n/hooks';
import { useSettingsStore } from '@ui/store/settings';

interface Props {
  onNewGame: () => void;
}

export function MainMenuScreen({onNewGame}: Props) {
  const { t } = useTranslation('screens');
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  return (
    <div className="cm-main-menu">
      <h1 className="cm-main-menu__title">Mousefall</h1>
      <button className="cm-btn cm-btn--primary cm-main-menu__cta" type="button" onClick={onNewGame}>
        {t('mainMenu.newGame')}
      </button>
      <div className="cm-main-menu__locale">
        <select value={locale} onChange={(e) => setLocale(e.target.value as 'ru' | 'en')} aria-label={t('mainMenu.languageSelect')}>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
}
