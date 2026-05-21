/**
 * Реестр спрайтов: маппинг templateId / типов на URL ассетов.
 *
 * TODO: в будущем перейти на content-driven подход — читать spriteId из JSON-шаблонов.
 */

import type {TileType} from '@presentation/types';

/** Путь к спрайту тайла. */
export function getTileSprite(tile: TileType): string {
  switch (tile) {
    case 'floor':
      return '/assets/tiles/floor1.png';
    case 'wall':
      return '/assets/tiles/wall.png';
  }
}

/** Путь к спрайту врага по templateId. */
export function getEnemySprite(templateId: string): string {
  return `/assets/enemies/${templateId}.png`;
}

/** Путь к спрайту игрока по portraitId. */
export function getPlayerSprite(portraitId: string | null): string {
  const id = portraitId ?? 'witcher';
  return `/assets/actors/player_${id}.png`;
}

/** Путь к спрайту лестницы. */
export function getStairsSprite(direction: 'down' | 'up'): string {
  return `/assets/objects/stairs_${direction}.png`;
}
