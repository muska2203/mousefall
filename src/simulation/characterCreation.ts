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
import {recalculateActorStats} from './systems/stats/recalculate.ts';
import {tryGetPlayerTemplate} from '@content/registry';
import {addActiveRulesForAbility} from './systems/rules/active-rule-lifecycle.ts';

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
  /** ID стартовой реликвии, выбранной из starterRelicPool шаблона (если пул непуст) */
  starterRelicId?: string;
};

/** Базовый бюджет очков характеристик, доступных при создании персонажа. */
export const CHARACTER_CREATION_ATTRIBUTE_POINTS_BUDGET = 10;

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
  player.statusEffects = [];
  player.inventory = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.equippedAmuletId = null;
  player.statModifiers = [];
  player.activeRules = [];
  player.relics = [];
  player.templateId = config.templateId;

  // Применение распределённых очков характеристик
  player.baseStats = {
    str: config.attributes.strength,
    dex: config.attributes.agility,
    vit: config.attributes.vitality,
    int: config.attributes.intelligence,
  };

  // Пересчёт базовых характеристик (без учёта стартовой экипировки — она применяется позже)
  recalculateActorStats(player);

  // Восстанавливаем текущие ресурсы до новых максимумов после пересчёта
  player.hp = player.maxHp;

  // Начальные способности: врождённые — из шаблона игрока (innateAbilities),
  // остальные будут добавлены из экипировки при выдаче стартового снаряжения.
  player.abilities = [];
  const playerTemplate = tryGetPlayerTemplate(config.templateId);
  for (const abilityId of playerTemplate?.innateAbilities ?? []) {
    const ability = {
      templateId: abilityId,
      source: 'innate' as const,
      level: 1,
      currentCooldown: 0,
    };
    player.abilities.push(ability);
    // Правила врождённой способности (ruleIds) попадают в activeRules,
    // как у способностей от экипировки через GRANT_ABILITY.
    addActiveRulesForAbility(player, ability);
  }
}
