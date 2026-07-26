/**
 * Интерфейс стратегий отрисовки статусов тайловых эффектов.
 *
 * Каждая стратегия отвечает за визуализацию конкретного статуса
 * (например, burning — кластером язычков пламени).
 */

import type {Sprite} from 'pixi.js';
import type {TileEffectOverlay} from '@presentation/displayState/types';

export type SpriteMeta = {
  /** Базовая X-координата спрайта (до качания). */
  baseX: number;
  /** Фаза качания. */
  swayPhase: number;
  /** Скорость качания. */
  swaySpeed: number;
};

export interface TileEffectStatusStrategy {
  /** Тип статуса, который обрабатывает стратегия. */
  readonly statusType: string;

  /** Отрисовать статус для тайла. Каждый созданный/видимый спрайт
   *  должен быть добавлен в visibleKeys через свой уникальный ключ. */
  render(
    x: number,
    y: number,
    overlay: TileEffectOverlay,
    visibleKeys: Set<string>,
  ): void;

  /** Обновить анимации спрайтов стратегии. */
  updateAnimations(now: number): void;

  /** Уничтожить все спрайты стратегии. */
  clear(): void;

  /** Все ключи спрайтов, которыми владеет стратегия. */
  getSpriteKeys(): Iterable<string>;

  /** Получить спрайт по ключу (для внешнего удаления невидимых). */
  getSprite(key: string): Sprite | undefined;

  /** Удалить запись о спрайте из внутреннего хранилища стратегии.
   *  Сам спрайт уже должен быть уничтожен вызывающей стороной. */
  removeSprite(key: string): void;
}
