/**
 * Система создания персонажа.
 *
 * Ответственность:
 * - Применение выбора игрока (класс, характеристики, снаряжение) к начальному PlayerEntity.
 *
 * Правила:
 * - Функции мутируют PlayerEntity напрямую.
 * - Вызывать ТОЛЬКО до создания GameSimulation, пока объект состояния ещё "свободен".
 * - Не содержит логики ходов, боя или отображения.
 */

import type {PlayerEntity} from './types';
import { recalculatePlayerBaseStats } from './systems/stats/recalculate.ts';

export type CharacterAttributes = {
  strength: number;
  agility: number;
  vitality: number;
  intelligence: number;
  luck: number;
};

export type CharacterConfig = {
  /** ID выбранного шаблона игрока */
  templateId: string;
  /** Распределение базовых очков характеристик */
  attributes: CharacterAttributes;
  /** ID шаблонов начального снаряжения (оружие, броня, амулет и т.д.) */
  startingEquipment: string[];
};

/**
 * Применяет конфигурацию персонажа к начальному PlayerEntity.
 *
 * Мутирует player напрямую — допустимо только на этапе инициализации,
 * до обёртывания состояния в GameSimulation.
 */
export function applyCharacterConfig(
  player: PlayerEntity,
  config: CharacterConfig,
): void {
  // Сброс к стартовому состоянию
  player.hp = player.maxHp;
  player.ap = player.maxAp;
  player.xp = 0;
  player.level = 1;
  player.statusEffects = [];
  player.inventory = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.equippedAmuletId = null;
  player.statModifiers = [];
  player.templateId = config.templateId;

  // Применение распределённых очков характеристик
  player.baseStats = {
    str: config.attributes.strength,
    dex: config.attributes.agility,
    vit: config.attributes.vitality,
    int: config.attributes.intelligence,
  };

  // Пересчёт базовых характеристик (без учёта стартовой экипировки — она применяется позже)
  recalculatePlayerBaseStats(player);

  // Восстанавливаем текущие ресурсы до новых максимумов после пересчёта
  player.hp = player.maxHp;

  // Начальные способности (пока пустой массив, будут заполняться из экипировки)
  player.abilities = [];
}
