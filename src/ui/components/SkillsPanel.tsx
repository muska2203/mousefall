/**
 * Панель скиллов (список с иконками и маной).
 *
 * Используется в GameScreen (правая колонка).
 */

import {Panel} from './Panel';
import {SkillRow} from './SkillRow';

export type SkillItem = {
  icon: string;
  name: string;
  mana?: number | null;
};

interface Props {
  title?: string;
  skills?: SkillItem[];
  emptyMessage?: string;
  fill?: boolean;
}

export function SkillsPanel({
  title = 'Скиллы',
  skills,
  emptyMessage = 'Нет скиллов',
  fill = true,
}: Props) {
  return (
    <Panel title={title} className="cm-panel--skills" fill={fill}>
      <div className="cm-panel__body--flex-grow">
        <div className="cm-skills-viewport cm-scroll-wood">
          <ul className="cm-skills">
            {skills && skills.length > 0 ? (
              skills.map((s, i) => <SkillRow key={i} {...s} />)
            ) : (
              <SkillRow icon="—" name={emptyMessage} />
            )}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
