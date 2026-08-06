/**
 * Тесты панели коллекции реликвий (roadmap 0.3).
 *
 * Проверяет: рендер заголовка при пустой коллекции, бейдж стака при count > 1,
 * класс редкости ячейки. Поповер по hover здесь не покрывается (рендерится в portal).
 */

import {renderToString} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import '@i18n/config';
import {RelicsPanel} from '../../../../src/ui/components/RelicsPanel';
import type {RelicViewModel} from '../../../../src/presentation/types';

function makeRelic(overrides: Partial<RelicViewModel> = {}): RelicViewModel {
  return {
    templateId: 'relic_test',
    count: 1,
    name: 'Тестовая реликвия',
    effects: [],
    icon: '/assets/relics/relic_test.png',
    fallback: '🧿',
    rarity: 'rare',
    frameUrl: '/assets/items/loot_frame_rare.png',
    ...overrides,
  };
}

describe('RelicsPanel', () => {
  it('рендерит заголовок панели при пустой коллекции', () => {
    const html = renderToString(<RelicsPanel relics={[]} />);
    expect(html).toContain('Реликвии');
    expect(html).toContain('cm-relics-row');
  });

  it('показывает бейдж стака при count > 1', () => {
    const html = renderToString(<RelicsPanel relics={[makeRelic({count: 3})]} />);
    expect(html).toContain('cm-inv-cell__qty');
    expect(html).toContain('>3<');
  });

  it('не показывает бейдж при count = 1', () => {
    const html = renderToString(<RelicsPanel relics={[makeRelic()]} />);
    expect(html).not.toContain('cm-inv-cell__qty');
  });

  it('применяет класс редкости ячейке', () => {
    const html = renderToString(<RelicsPanel relics={[makeRelic({rarity: 'unique'})]} />);
    expect(html).toContain('item-rarity-unique');
  });
});
