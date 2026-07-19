/**
 * Панель итогов забега: статус (победа/поражение), подзаголовок, сетка метрик.
 *
 * Используется в EndingScreen (центральная колонка).
 */

import {useTranslation} from '@i18n/hooks';
import {Panel} from './Panel';

export type MetricItem = {
  label: string;
  value: string;
};

interface Props {
  title?: string;
  status: 'victory' | 'defeat';
  subtitle: string;
  metrics: MetricItem[];
}

export function EndingMetricsPanel({title, status, subtitle, metrics}: Props) {
  const { t } = useTranslation('components');
  const statusText = status === 'victory' ? t('endingMetrics.resultVictory') : t('endingMetrics.resultDefeat');
  const statusClass = status === 'victory' ? 'cm-ending-status--victory' : '';

  return (
    <Panel title={title ?? t('endingMetrics.title')} fill>
      <div className="cm-ending-summary">
        <div className={`cm-ending-status ${statusClass}`}>{statusText}</div>
        <p className="cm-ending-subtitle">{subtitle}</p>
        <div className="cm-ending-metrics">
          {metrics.map((m, i) => (
            <div key={`${m.label}-${i}`} className="cm-ending-metric">
              <span className="cm-ending-metric__label">{m.label}</span>
              <span className="cm-ending-metric__value">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
