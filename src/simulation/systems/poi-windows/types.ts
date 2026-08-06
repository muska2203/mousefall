/**
 * Каркас окон poi.
 *
 * Окно — интерактивный выбор, открываемый активацией poi с дескриптором
 * `window` в шаблоне (`PoiTemplateSchema`). Вид окна (`kind`) определяет
 * механику через реестр `POI_WINDOW_MECHANICS`:
 * - `onActivate` вызывается исполнителем ACTIVATE_POI и готовит предложение
 *   (записывает id опций в `poi.offer`);
 * - `resolve` вызывается исполнителем RESOLVE_POI_CHOICE и применяет выбор.
 *
 * Состояние предложения живёт на сущности (`poi.offer`) — снапшот этажа
 * и детерминизм сохраняются без дополнительной работы.
 */

import type {GameState, PointOfInterestEntity} from '@simulation/types';
import type {PoiTemplate} from '@content/schemas';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types';

/** Механика одного вида окна poi. */
export interface PoiWindowMechanic {
  /**
   * Вызывается при активации poi (интент ACTIVATE_POI).
   * Генерирует предложение при первой активации или переиспользует
   * существующее (`poi.offer`). Возвращает true, если окно открыто
   * (предложение доступно); false — активация не состоялась.
   */
  onActivate(state: GameState, poi: PointOfInterestEntity, template: PoiTemplate): boolean;

  /**
   * Применяет выбранную опцию окна (интент RESOLVE_POI_CHOICE).
   * Возвращает узел порождённого события или null при отказе
   * (невалидная опция, нет зарядов, эффект не применился).
   */
  resolve(
    state: GameState,
    poi: PointOfInterestEntity,
    optionId: string,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
  ): ExecutionNode | null;

  /**
   * Немутирующая проверка «окно может быть открыто» для validate действий
   * (не тратить AP на активацию, которая заведомо не откроет окно).
   * Если не реализована — окно считается доступным.
   */
  canOpen?(state: GameState, poi: PointOfInterestEntity, template: PoiTemplate): boolean;
}
