import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '@i18n/config';
import { RichDescription } from '../../../../src/ui/components/RichDescription';

describe('RichDescription', () => {
  it('рендерит обычный текст без изменений, если ссылок нет', () => {
    const text = 'Простое описание без ссылок.';
    const html = renderToString(<RichDescription text={text} />);
    expect(html).toContain('Простое описание без ссылок.');
    expect(html).not.toContain('cm-tag-link');
  });

  it('заменяет одну ссылку [метка](tag:tagId) на элемент с классом cm-tag-link', () => {
    const text = '[Ближний бой](tag:attack.melee)';
    const html = renderToString(<RichDescription text={text} />);
    expect(html).toContain('cm-tag-link');
    expect(html).toContain('Ближний бой');
  });

  it('корректно обрабатывает несколько ссылок в одном тексте', () => {
    const text = '[Удар оружием](tag:delivery.weapon) рядом с героем: [ближний бой](tag:attack.melee), [по области](tag:target.aoe).';
    const html = renderToString(<RichDescription text={text} />);
    expect(html).toContain('cm-tag-link--delivery');
    expect(html).toContain('cm-tag-link--attack');
    expect(html).toContain('cm-tag-link--target');
  });

  it('сохраняет текст до и после ссылки', () => {
    const text = 'До ссылки [Ближний бой](tag:attack.melee) после ссылки';
    const html = renderToString(<RichDescription text={text} />);
    expect(html).toContain('До ссылки');
    expect(html).toContain('после ссылки');
    expect(html).toContain('Ближний бой');
  });

  it('при неизвестной категории применяет модификатор --other', () => {
    const text = '[Неизвестно](tag:some.unknown.tag)';
    const html = renderToString(<RichDescription text={text} />);
    expect(html).toContain('cm-tag-link--other');
  });
});
