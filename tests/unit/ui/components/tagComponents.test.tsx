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
    expect(html).toContain('Точный');
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
      isTemplate: false,
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
      isTemplate: false,
      tags: [],
    };
    const html = renderToString(<ItemDetailCard item={item} />);
    expect(html).not.toContain('cm-tag-list');
  });

  it('renders item properties section', () => {
    const item: ItemDetailViewModel = {
      name: 'Амулет',
      description: '',
      rarity: 'common',
      rarityLabel: 'Обычный',
      typeLabel: 'Амулет',
      type: 'amulet',
      icon: '/icons/amulet.png',
      frameUrl: '/frames/common.png',
      sections: [],
      isTemplate: false,
      properties: [
        { ruleId: 'amulet_fire_damage_multiplier', name: 'Угольная искра', description: 'Весь огненный урон увеличивается на 15%.' },
      ],
      tags: [],
    };
    const html = renderToString(<ItemDetailCard item={item} />);
    expect(html).toContain('Свойства');
    expect(html).toContain('Угольная искра');
    expect(html).toContain('Весь огненный урон увеличивается на 15%.');
  });

  it('renders possible skills only for template view', () => {
    const poolItem: ItemDetailViewModel = {
      name: 'Амулет',
      description: '',
      rarity: 'common',
      rarityLabel: 'Обычный',
      typeLabel: 'Амулет',
      type: 'amulet',
      icon: '/icons/amulet.png',
      frameUrl: '/frames/common.png',
      sections: [],
      isTemplate: false,
      abilityPool: [
        { abilityId: 'fireball', name: 'Огненный шар', description: '', icon: null, weight: 1 },
      ],
      tags: [],
    };
    const templateItem: ItemDetailViewModel = {
      ...poolItem,
      isTemplate: true,
    };

    const instanceHtml = renderToString(<ItemDetailCard item={poolItem} />);
    const templateHtml = renderToString(<ItemDetailCard item={templateItem} />);

    expect(instanceHtml).not.toContain('Возможные скиллы');
    expect(templateHtml).toContain('Возможные скиллы');
    expect(templateHtml).toContain('Огненный шар');
  });
});
