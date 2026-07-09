import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import '@i18n/config';
import { TagBadge } from '../../../../src/ui/components/TagBadge';
import { TagList } from '../../../../src/ui/components/TagList';
import { SkillDetailPopover } from '../../../../src/ui/components/SkillDetailPopover';
import { ItemDetailCard } from '../../../../src/ui/components/ItemDetailCard';
import type { HotbarSkillTooltip } from '../../../../src/presentation/types';
import type { ItemDetailViewModel } from '../../../../src/presentation/types';

vi.mock('react-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-dom')>();
  return {
    ...mod,
    createPortal: (children: React.ReactNode) => children as React.ReactPortal,
  };
});

describe('TagBadge', () => {
  it('renders localized label', () => {
    const html = renderToString(<TagBadge tag="attack.melee" label="Ближний бой" />);
    expect(html).toContain('Ближний бой');
  });

  it('applies category modifier class', () => {
    const html = renderToString(<TagBadge tag="attack.melee" label="Ближний бой" />);
    expect(html).toContain('cm-tag-badge--attack');
  });

  it('falls back to "other" modifier for unknown category', () => {
    const html = renderToString(<TagBadge tag="custom.foo" label="Custom" />);
    expect(html).toContain('cm-tag-badge--other');
  });
});

describe('TagList', () => {
  it('renders a badge for each tag', () => {
    const html = renderToString(
      <TagList tags={['attack.melee', 'target.single']} locale="ru" />,
    );
    expect(html).toContain('Ближний бой');
    expect(html).toContain('Одиночная цель');
  });

  it('returns null for empty tags', () => {
    const html = renderToString(<TagList tags={[]} />);
    expect(html).toBe('');
  });
});

describe('SkillDetailPopover', () => {
  const originalDocument = globalThis.document;
  beforeAll(() => {
    // createPortal замокан, но компонент передаёт document.body вторым аргументом.
    (globalThis as any).document = { body: {} };
  });
  afterAll(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders skill tags', () => {
    const skill: HotbarSkillTooltip = {
      kind: 'skill',
      name: 'Огненный шар',
      description: 'Удар огнём',
      icon: null,
      cooldown: 0,
      maxCooldown: 2,
      apCost: 2,
      tags: ['delivery.spell', 'target.aoe', 'effect.burn'],
    };
    const html = renderToString(<SkillDetailPopover skill={skill} visible x={0} y={0} />);
    expect(html).toContain('Заклинание');
    expect(html).toContain('По области');
    expect(html).toContain('Поджог');
  });

  it('does not render tag section when tags are empty', () => {
    const skill: HotbarSkillTooltip = {
      kind: 'skill',
      name: 'Удар',
      description: '',
      icon: null,
      cooldown: 0,
      maxCooldown: 0,
      apCost: 1,
      tags: [],
    };
    const html = renderToString(<SkillDetailPopover skill={skill} visible x={0} y={0} />);
    expect(html).not.toContain('cm-tag-list');
  });
});

describe('ItemDetailCard', () => {
  it('renders item tags', () => {
    const item: ItemDetailViewModel = {
      name: 'Меч',
      description: 'Острый меч',
      rarity: 'common',
      rarityLabel: 'Обычный',
      typeLabel: 'Оружие',
      type: 'weapon',
      icon: '/icons/sword.png',
      frameUrl: '/frames/common.png',
      stackCount: 1,
      sections: [],
      grantedAbilities: [],
      abilityPool: [],
      tags: ['attack.melee', 'delivery.weapon'],
    };
    const html = renderToString(<ItemDetailCard item={item} />);
    expect(html).toContain('Ближний бой');
    expect(html).toContain('Оружие');
  });

  it('does not render tag section when tags are empty', () => {
    const item: ItemDetailViewModel = {
      name: 'Зелье',
      description: '',
      rarity: 'common',
      rarityLabel: 'Обычный',
      typeLabel: 'Расходуемое',
      type: 'consumable',
      icon: '/icons/potion.png',
      frameUrl: '/frames/common.png',
      sections: [],
      tags: [],
    };
    const html = renderToString(<ItemDetailCard item={item} />);
    expect(html).not.toContain('cm-tag-list');
  });
});
