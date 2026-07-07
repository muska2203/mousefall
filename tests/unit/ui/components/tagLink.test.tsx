import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '@i18n/config';
import { TagLink } from '../../../../src/ui/components/TagLink';

describe('TagLink', () => {
  it('рендерит переданную метку', () => {
    const html = renderToString(<TagLink tag="attack.melee" label="Ближний бой" />);
    expect(html).toContain('Ближний бой');
  });

  it('для attack.melee применяет класс cm-tag-link--attack', () => {
    const html = renderToString(<TagLink tag="attack.melee" label="Ближний бой" />);
    expect(html).toContain('cm-tag-link--attack');
  });

  it('для target.aoe применяет класс cm-tag-link--target', () => {
    const html = renderToString(<TagLink tag="target.aoe" label="По области" />);
    expect(html).toContain('cm-tag-link--target');
  });

  it('для неизвестной категории применяет класс cm-tag-link--other', () => {
    const html = renderToString(<TagLink tag="some.unknown.tag" label="Неизвестно" />);
    expect(html).toContain('cm-tag-link--other');
  });
});
