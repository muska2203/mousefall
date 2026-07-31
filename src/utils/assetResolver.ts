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
 * Возвращает путь к спрайту пропа по templateId.
 */
export function resolvePropSprite(templateId: string): string {
  return `/assets/objects/props/${templateId}.png`;
}

/**
 * Возвращает путь к спрайту точки интереса по templateId.
 */
export function resolvePoiSprite(templateId: string): string {
  return `/assets/objects/pois/${templateId}.png`;
}

/**
 * Возвращает путь к спрайту ловушки по templateId.
 */
export function resolveTrapSprite(templateId: string): string {
  return `/assets/objects/traps/${templateId}.png`;
}

/** Категория объекта окружения для разрешения путей к спрайтам. */
export type ObjectSpriteCategory = 'doors' | 'props' | 'pois' | 'traps' | 'stairs';

/** Папки ассетов по категориям объектов. */
const OBJECT_SPRITE_FOLDERS: Record<ObjectSpriteCategory, string> = {
  doors: '/assets/objects/doors',
  props: '/assets/objects/props',
  pois: '/assets/objects/pois',
  traps: '/assets/objects/traps',
  stairs: '/assets/objects',
};

/**
 * Возвращает путь к спрайту объекта по категории, templateId и визуальному стейту.
 *
 * Конвенция имён файлов: '<id>.png' для стейта 'default', '<id>_<state>.png' для остальных.
 * Явный spriteId (например, из spriteVariants шаблона или openSpriteId двери) имеет приоритет
 * над конвенцией.
 */
export function resolveObjectSprite(
  category: ObjectSpriteCategory,
  templateId: string,
  state: string = 'default',
  spriteIdOverride?: string,
): string {
  const spriteId = spriteIdOverride ?? (state === 'default' ? templateId : `${templateId}_${state}`);
  return `${OBJECT_SPRITE_FOLDERS[category]}/${spriteId}.png`;
}

/**
 * Возвращает путь к frame-ассету для sticker-HP по пути основного спрайта.
 * Если путь не заканчивается на .png, возвращает null.
 */
export function resolveEntityFrameSprite(baseSpritePath: string): string | null {
  if (!baseSpritePath.endsWith('.png')) return null;
  return `${baseSpritePath.slice(0, -'.png'.length)}-frame.png`;
}

/**
 * Возвращает путь к иконке способности по spriteId.
 */
export function resolveAbilityIcon(spriteId: string): string {
  return `/assets/skills/${spriteId}.png`;
}

/**
 * Возвращает путь к иконке статус-эффекта по типу.
 */
export function resolveStatusIcon(statusType: string): string {
  return `/assets/statuses/${statusType}.png`;
}
