/**
 * Панель скиллов (список с иконками и маной).
 *
 * Используется в GameScreen (правая колонка).
 * Максимальная высота — 3 строки, далее скролл (аналогично журналу).
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
}

export function SkillsPanel({
  title = 'Скиллы',
  skills,
  emptyMessage = 'Нет скиллов',
}: Props) {
  const titleNode = (
    <>
      {title}
    </>
  );

  return (
    <Panel title={titleNode} className="cm-panel--skills">
      <div className="cm-skills-viewport cm-scroll-wood">
        <ul className="cm-skills">
          {skills && skills.length > 0 ? (
            skills.map((s, i) => <SkillRow key={i} {...s} />)
          ) : (
            <SkillRow icon="—" name={emptyMessage} />
          )}
        </ul>
      </div>
    </Panel>
  );
}
