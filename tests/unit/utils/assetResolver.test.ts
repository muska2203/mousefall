import { describe, expect, it } from 'vitest';
import {
  resolveItemFrame,
  resolveItemIcon,
  resolveEnemySprite,
  resolveStairsSprite,
  resolveDoorSprite,
  resolveAbilityIcon,
  resolveStatusIcon,
  resolveEntityFrameSprite,
} from '../../../src/utils/assetResolver';

describe('assetResolver', () => {
  it('resolveStatusIcon возвращает путь к иконке статуса', () => {
    expect(resolveStatusIcon('silenced')).toBe('/assets/statuses/silenced.png');
    expect(resolveStatusIcon('burning')).toBe('/assets/statuses/burning.png');
  });

  it('другие резолверы сохраняют соглашения о путях', () => {
    expect(resolveItemFrame('rare')).toBe('/assets/items/loot_frame_rare.png');
    expect(resolveItemIcon('health_potion')).toBe('/assets/items/health_potion.png');
    expect(resolveEnemySprite('cat_big')).toBe('/assets/enemies/cat_big.png');
    expect(resolveStairsSprite('stairs_down')).toBe('/assets/objects/stairs_down.png');
    expect(resolveDoorSprite('wooden_door')).toBe('/assets/objects/doors/wooden_door.png');
    expect(resolveDoorSprite('wooden_door', true)).toBe('/assets/objects/doors/wooden_door_open.png');
    expect(resolveAbilityIcon('cleave')).toBe('/assets/skills/cleave.png');
  });

  it('resolveEntityFrameSprite возвращает путь к frame-ассету или null', () => {
    expect(resolveEntityFrameSprite('/assets/enemies/cat_big.png')).toBe('/assets/enemies/cat_big-frame.png');
    expect(resolveEntityFrameSprite('/assets/actors/player_witcher.png')).toBe('/assets/actors/player_witcher-frame.png');
    expect(resolveEntityFrameSprite('/assets/items/loot_frame_rare.png')).toBe('/assets/items/loot_frame_rare-frame.png');
    expect(resolveEntityFrameSprite('/assets/no-extension')).toBeNull();
  });
});
