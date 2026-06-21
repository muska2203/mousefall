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

/** Путь к спрайту игрока по templateId. */
export function getPlayerSprite(templateId: string): string {
  return `/assets/actors/player_${templateId}.png`;
}

/** Путь к спрайту лестницы по templateId. */
export function getStairsSprite(templateId: string): string {
  return `/assets/objects/${templateId}.png`;
}

/** Путь к спрайту предмета на полу по templateId. */
export function getItemSprite(templateId: string): string {
  return `/assets/items/${templateId}.png`;
}

/** Путь к спрайту двери по templateId. */
export function getDoorSprite(templateId: string): string {
  return `/assets/objects/doors/${templateId}.png`;
}
