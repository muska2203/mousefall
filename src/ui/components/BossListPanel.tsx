/**
 * Панель списка побежденных боссов.
 *
 * Используется в EndingScreen (правая колонка).
 */

import {Panel} from './Panel';

interface Props {
  title?: string;
  bosses: string[];
}

export function BossListPanel({title = 'Побежденные боссы', bosses}: Props) {
  return (
    <Panel title={title}>
      <ul className="cm-ending-loot">
        {bosses.map((name, i) => (
          <li key={i} className="cm-ending-loot__item">
            {name}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
