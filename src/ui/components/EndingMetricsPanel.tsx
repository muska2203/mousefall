/**
 * Панель итогов забега: статус (победа/поражение), подзаголовок, сетка метрик.
 *
 * Используется в EndingScreen (центральная колонка).
 */

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

export function EndingMetricsPanel({title = 'Итоги забега', status, subtitle, metrics}: Props) {
  const statusText = status === 'victory' ? 'Победа' : 'Поражение';
  const statusClass = status === 'victory' ? 'cm-ending-status--victory' : '';

  return (
    <Panel title={title} fill>
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
