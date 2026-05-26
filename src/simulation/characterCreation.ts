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
import { getItem } from './content/registry.ts';
import { recalculatePlayerBaseStats } from './systems/stats/recalculate.ts';
import { addModifier } from './systems/stats/modifier-engine.ts';

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
  player.equippedAmuletId = null;
  player.statModifiers = [];
  player.templateId = config.portraitId;

  // Применение распределённых очков характеристик
  player.baseStats = {
    str: config.attributes.strength,
    dex: config.attributes.agility,
    vit: config.attributes.vitality,
    int: config.attributes.intelligence,
  };

  // Экипировка начального снаряжения и применение equipModifiers
  for (const templateId of config.startingEquipment) {
    const lower = templateId.toLowerCase();

    if (lower.includes('sword') || lower.includes('weapon') || lower.includes('dagger') || lower.includes('axe') || lower.includes('wand') || lower.includes('blade') || lower.includes('club') || lower.includes('staff')) {
      player.equippedWeaponId = templateId;
    } else if (lower.includes('armor') || lower.includes('vest') || lower.includes('mail') || lower.includes('plate') || lower.includes('cloak')) {
      player.equippedArmorId = templateId;
    } else if (lower.includes('amulet') || lower.includes('fang') || lower.includes('bead') || lower.includes('tooth') || lower.includes('ring') || lower.includes('necklace')) {
      player.equippedAmuletId = templateId;
    }

    // Применяем equipModifiers от предмета
    const item = getItem(templateId);
    for (const mod of item.equipModifiers ?? []) {
      addModifier(player, { ...mod, source: `item_${templateId}` });
    }
  }

  // Пересчёт итоговых характеристик (maxHp, maxMp, damage, armor)
  recalculatePlayerBaseStats(player);

  // Восстанавливаем текущие ресурсы до новых максимумов после пересчёта
  player.hp = player.maxHp;
  player.mp = player.maxMp;

  // Начальные способности (временно: все классы получают fireball и magic_slap)
  player.abilities = [
    { templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 },
    { templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 },
  ];

  // TODO: читать базовые статы класса из ContentRegistry по config.classId
  void config.classId;
}
