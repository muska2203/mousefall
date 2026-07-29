import {describe, expect, it} from 'vitest';
import {FACTION_STICKER_COLORS, STICKER_HP_MAGIC_COLOR} from '../../../src/utils/constants';

describe('faction sticker colors', () => {
  it('defines primary/secondary colors for all factions', () => {
    expect(FACTION_STICKER_COLORS.player).toEqual({primary: 0xd3af37, secondary: 0x504316});
    expect(FACTION_STICKER_COLORS.allies).toEqual({primary: 0x27d54e, secondary: 0x154c21});
    expect(FACTION_STICKER_COLORS.enemies).toEqual({primary: 0xd33937, secondary: 0x4a1413});
    expect(FACTION_STICKER_COLORS.neutrals).toEqual({primary: 0xb8c5ba, secondary: 0x414541});
  });

  it('uses #00FF00 as magic HP color', () => {
    expect(STICKER_HP_MAGIC_COLOR).toBe(0x00ff00);
  });
});
