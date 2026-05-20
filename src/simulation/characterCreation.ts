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

export type CharacterAttributes = {
  strength: number;
  agility: number;
  vitality: number;
  intelligence: number;
  luck: number;
};

export type CharacterConfig = {
  /** Идентификатор класса/предустановки (для будущей интеграции с ContentRegistry) */
  classId: string;
  /** Распределение базовых очков характеристик */
  attributes: CharacterAttributes;
  /** ID шаблонов начального снаряжения (оружие, броня, амулет и т.д.) */
  startingEquipment: string[];
  /** ID выбранного портрета/внешности */
  portraitId: string;
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
  // TODO: добавить equippedAmuletId в PlayerEntity, когда появится система амулетов
  // player.equippedAmuletId = null;

  // Применение распределённых очков характеристик.
  // TODO: при наличии системы атрибутов (сила → урон, живучесть → HP)
  // здесь будет пересчёт maxHp, damage и прочего.
  void config.attributes;

  // Экипировка начального снаряжения.
  // В будущем: создавать InventoryItem через nextEntityId(state) и класть в inventory,
  // затем экипировать. Пока сохраняем только ссылки на шаблоны.
  for (const templateId of config.startingEquipment) {
    const lower = templateId.toLowerCase();

    if (lower.includes('sword') || lower.includes('weapon') || lower.includes('dagger') || lower.includes('axe') || lower.includes('wand') || lower.includes('blade')) {
      player.equippedWeaponId = templateId;
    } else if (lower.includes('armor') || lower.includes('vest') || lower.includes('mail') || lower.includes('plate') || lower.includes('cloak')) {
      player.equippedArmorId = templateId;
    } else if (lower.includes('amulet') || lower.includes('fang') || lower.includes('bead') || lower.includes('tooth')) {
      // TODO: добавить equippedAmuletId в PlayerEntity, когда появится система амулетов
      // player.equippedAmuletId = templateId;
    }
  }

  // TODO: читать базовые статы класса из ContentRegistry по config.classId
  void config.classId;
}
