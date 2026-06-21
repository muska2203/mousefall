/**
 * Чистые функции для разрешения путей к игровым ассетам.
 *
 * Централизуют конвенции именования файлов и папок в public/assets/.
 * При изменении структуры ассетов править нужно только здесь.
 */

/**
 * Возвращает путь к рамке редкости предмета.
 */
export function resolveItemFrame(rarity: string): string {
  return `/assets/items/loot_frame_${rarity}.png`;
}

/**
 * Возвращает путь к иконке предмета по spriteId.
 */
export function resolveItemIcon(spriteId: string): string {
  return `/assets/items/${spriteId}.png`;
}

/**
 * Возвращает путь к спрайту врага по templateId.
 */
export function resolveEnemySprite(templateId: string): string {
  return `/assets/enemies/${templateId}.png`;
}

/**
 * Возвращает путь к спрайту лестницы по templateId.
 */
export function resolveStairsSprite(templateId: string): string {
  return `/assets/objects/${templateId}.png`;
}

/**
 * Возвращает путь к спрайту двери по templateId и состоянию.
 */
export function resolveDoorSprite(templateId: string, isOpen: boolean = false, openSpriteId?: string): string {
  if (isOpen) {
    const spriteId = openSpriteId ? openSpriteId : `${templateId}_open`;
    return `/assets/objects/doors/${spriteId}.png`;
  }
  return `/assets/objects/doors/${templateId}.png`;
}

/**
 * Возвращает путь к иконке способности по spriteId.
 */
export function resolveAbilityIcon(spriteId: string): string {
  return `/assets/skills/${spriteId}.png`;
}
