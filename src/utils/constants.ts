/**
 * Глобальные игровые константы.
 * В остальном коде не должно быть магических чисел — используйте только эти.
 */

// ─────────────────────────────────────────────
// Рендеринг
// ─────────────────────────────────────────────

/** Пикселей на одну клетку сетки. */
export const TILE_SIZE = 32;

/** Коэффициент вертикального сжатия плоскости пола (псевдо-3D, эксперимент). */
export const FLOOR_Y_RATIO = 0.9;

/** Высота клетки пола на экране с учётом вертикального сжатия. */
export const TILE_HEIGHT = TILE_SIZE * FLOOR_Y_RATIO;

/** Доля высоты сжатой клетки, на которой располагается низ «стоячих» объектов
 *  (акторы, двери, пропы, предметы, aboveGround-эффекты).
 *  1 — низ клетки; меньше — выше над полом. */
export const STANDING_Y_FACTOR = 0.6;

/** Альфа затемнения explored клеток тумана войны. */
export const FOG_EXPLORED_ALPHA = 0.55;

/** Альфа спрайтов на explored клетках, чтобы визуально совпадало с затемнением тумана. */
export const FOG_EXPLORED_SPRITE_ALPHA = 1 - FOG_EXPLORED_ALPHA;

/** Масштаб спрайта статуса тайлового эффекта относительно размера клетки. */
export const TILE_EFFECT_STATUS_SPRITE_SCALE = 0.7;

/** Смещение "низа" спрайта статуса тайлового эффекта от верха клетки (0 — верх, 1 — низ). */
export const TILE_EFFECT_STATUS_OFFSET_Y_FACTOR = 0.5;

/** Клеток, видимых по горизонтали во вьюпорте. */
export const VIEWPORT_TILES_X = 25;

/** Клеток, видимых по вертикали во вьюпорте. */
export const VIEWPORT_TILES_Y = 20;

// ─────────────────────────────────────────────
// Геймплей
// ─────────────────────────────────────────────

/** Базовый радиус обзора игрока в клетках. */
export const PLAYER_SIGHT_RANGE = 8;

/** Радиус, в котором игрок может взаимодействовать с объектами (Chebyshev distance). */
export const INTERACTION_RADIUS = 1;

/** Максимальное количество предметов в инвентаре игрока. */
export const MAX_INVENTORY_SIZE = 20;

/** Максимальное количество реликвий в коллекции игрока (технический лимит). */
export const MAX_RELICS = 100;

/** Количество этажей подземелья. */
export const MAX_FLOOR = 10;

/** Базовое максимальное HP игрока (до модификаторов vit). */
export const PLAYER_BASE_MAX_HP = 50;

/** Базовый множитель критического урона. */
export const BASE_CRIT_MULTIPLIER = 1.5;

/** Максимальное количество AP, которое может потребовать способность со стоимостью "all". */
export const MAX_ABILITY_ALL_AP_COST = 3;

// ─────────────────────────────────────────────
// Генерация карты
// ─────────────────────────────────────────────

export const MAP_MIN_WIDTH = 30;
export const MAP_MAX_WIDTH = 80;
export const MAP_MIN_HEIGHT = 30;
export const MAP_MAX_HEIGHT = 80;

export const ROOM_MIN_SIZE = 4;
export const ROOM_MAX_SIZE = 12;

export const ROOMS_MIN = 5;
export const ROOMS_MAX = 15;

// ─────────────────────────────────────────────
// Система сохранений
// ─────────────────────────────────────────────

/** Количество ручных слотов сохранения (слот 0 зарезервирован для автосохранения). */
export const SAVE_SLOTS = 3;

/** Индекс слота, зарезервированного для автосохранения. */
export const AUTOSAVE_SLOT = 0;

/** Текущая версия формата файла сохранения. Увеличивать при изменении формы GameState. */
export const SAVE_VERSION = 1;

/** Префикс ключей localStorage для слотов сохранения. */
export const SAVE_KEY_PREFIX = 'mousefall:save:';

// ─────────────────────────────────────────────
// Идентификаторы сущностей (зарезервированные)
// ─────────────────────────────────────────────

/** Идентификатор игрока всегда равен этому значению. */
export const PLAYER_ID = 'player';

// ─────────────────────────────────────────────
// Sticker-HP: цвета фракций
// ─────────────────────────────────────────────

/** «Магический» цвет зоны HP на frame-ассете. Заменяется на цвета фракции. */
export const STICKER_HP_MAGIC_COLOR = 0x00ff00;

/** Цвета sticker-HP рамки по фракциям.
 *  primary — нижняя часть (текущее HP), secondary — верхняя часть (потерянное HP). */
export const FACTION_STICKER_COLORS: Record<string, { primary: number; secondary: number }> = {
  player: { primary: 0xd3af37, secondary: 0x504316 },
  allies: { primary: 0x27d54e, secondary: 0x154c21 },
  enemies: { primary: 0xd33937, secondary: 0x4a1413 },
  neutrals: { primary: 0xb8c5ba, secondary: 0x414541 },
};
