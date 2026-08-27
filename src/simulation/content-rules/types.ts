/**
 * Базовые типы декларативных контентных правил.
 *
 * Правила хранятся как статические TypeScript-объекты в `rules.ts`.
 * Шаблоны предметов, способностей и статусов ссылаются на них по `ruleIds`.
 */

import type {EntityId, GameplayTag, Position, StatusEffectType,} from '@simulation/core-types.ts';

/**
 * Контекст владельца правила в рантайме.
 * Определяет, от чьего имени сработает правило, и позволяет корректно удалить правило
 * при снятии предмета, статуса или таланта.
 */
export type OwnerContext =
  | {
      type: 'entity';
      /** ID экземпляра предмета / статуса / таланта. */
      entityId: EntityId;
      /** Только для статусов: стабильный ID наложенного статуса. */
      statusInstanceId?: EntityId;
    }
  | {
      type: 'tileEffect';
      position: Position;
      tileEffectType: string;
    }
  | {
      type: 'tileEffectStatus';
      position: Position;
      tileEffectType: string;
      statusType: string;
    }
  | {
      type: 'object';
      position: Position;
      /** ID сущности-объекта (точка интереса, в будущем — ловушка и т.п.). */
      entityId: EntityId;
    }
  | {
      type: 'world';
    };

/**
 * Триггер правила: событие или интент, на который правило реагирует,
 * плюс обязательные теги.
 */
export type RuleTrigger = {
  /** Тип события (`GameEvent['type']`) или интента (`Intent['type']`). */
  event: string;
  /** Обязательные теги. Правило срабатывает, если событие содержит все указанные теги. */
  tags?: GameplayTag[];
};

/**
 * Параметризованное числовое значение.
 * Поддерживаются константа, ссылка на поле контекста и ссылка на
 * ролленное значение владельца-аффикса (ownerParam).
 */
export type ParametrizedValue =
  | { type: 'literal'; value: number }
  | {
      // TODO(4.4): заменить eventMaxHp на общий stat-based resolver (targetStat/selfStat)
      // sourceCritMultiplier — шаг в ту же сторону: stat-значение источника события
      // читается из контекста, пока без общего stat-based resolver.
      type: 'context';
      field: 'eventDamage' | 'eventAmount' | 'eventDuration' | 'eventStacks' | 'eventMaxHp' | 'sourceCritMultiplier';
      multiply?: number;
      min?: number;
      round?: boolean;
    }
  | {
      /** Значение из paramValue активного правила (ролленное значение rule-аффикса). Fallback — 0. */
      type: 'ownerParam';
      multiply?: number;
      min?: number;
      round?: boolean;
    };

/**
 * Условие срабатывания правила.
 * В фазе 2 поддерживаются базовые операторы; остальные добавляются позже.
 *
 * Внимание: `chance` — опциональная «рандомная» механика по выбору игрока,
 * а не основной инструмент. Основные механики проектируются детерминированными
 * (решение 2026-08-04, `roadMap.md` «Вопросы по механикам», вопрос 1).
 * Использовать `chance` в новом контенте — только по явному указанию пользователя.
 */
export type RuleCondition =
  | { type: 'chance'; probability: number | ParametrizedValue }
  | { type: 'hasStatus'; statusType: StatusEffectType; subject: 'self' | 'target' | 'candidate' }
  | { type: 'hasTag'; tag: GameplayTag }
  | { type: 'inTileEffect'; effectType: string }
  | { type: 'tileEffectHasStatus'; effectType: string; statusType: string }
  | { type: 'eventFieldEquals'; field: string; value: unknown }
  | { type: 'eventRole'; role: 'source' | 'target' }
  /** Событие не является самоуроном: источник и цель — разные сущности (или источника нет). */
  | { type: 'notSelfHit' }
  | { type: 'entityHasTag'; tag: GameplayTag; subject: 'self' | 'target' | 'source' | 'candidate' }
  | { type: 'and'; conditions: RuleCondition[] }
  | { type: 'or'; conditions: RuleCondition[] }
  | { type: 'not'; condition: RuleCondition };

/**
 * Селектор целей эффекта правила.
 */
export type TargetSelector =
  | { type: 'eventTarget' }
  | { type: 'eventSource' }
  | { type: 'self' }
  | { type: 'collisionTarget' }
  | { type: 'eventTileEffect'; effectType: string }
  | { type: 'allInRadius'; radius: number; center: 'eventPosition' | 'self'; faction?: 'enemy' | 'ally'; excludeSelf?: boolean }
  | { type: 'nearestEnemy'; radius: number; center: 'eventPosition' | 'self' }
  | { type: 'tilesInRadius'; radius: number; center: 'eventPosition' | 'self'; effectType: string }
  | { type: 'positionsInRadius'; radius: number; center: 'eventPosition' | 'self'; includeCenter?: boolean };

/**
 * Эффект правила.
 * В фазе 2 — минимальный набор, достаточный для пилота и базовых тестов.
 */
export type RuleEffect =
  | {
      type: 'applyStatus';
      statusType: StatusEffectType;
      duration: number | ParametrizedValue;
      value?: number;
    }
  | {
      type: 'dealDamage';
      amount: number | ParametrizedValue;
      tags?: GameplayTag[];
    }
  | {
      type: 'heal';
      amount: number | ParametrizedValue;
    }
  | {
      type: 'restoreAp';
    }
  | {
      type: 'consumeAp';
      amount: number | ParametrizedValue;
    }
  | {
      type: 'modifyDamage';
      op: 'multiply' | 'add';
      value: number | ParametrizedValue;
      addTags?: GameplayTag[];
    }
  | {
      type: 'counterAttack';
    }
  | {
      type: 'applyTileEffectStatus';
      statusType: string;
      duration: number | ParametrizedValue;
    }
  | {
      type: 'spawnTileEffect';
      effectType: string;
      duration?: number | ParametrizedValue;
      /** Опциональный статус, который сразу накладывается на созданный тайловый эффект. */
      statusType?: string;
      /** Длительность начального статуса; если не указана — берётся из шаблона статуса. */
      statusDuration?: number | ParametrizedValue;
    };

/**
 * Статическое декларативное правило.
 * Хранится в реестре правил и может переиспользоваться несколькими шаблонами контента.
 */
export type ContentRule = {
  id: string;
  trigger: RuleTrigger;
  conditions?: RuleCondition[];
  targetConditions?: RuleCondition[];
  effect: RuleEffect;
  target: TargetSelector;
  priority: number;
  /**
   * Полярность эффекта правила для UI (позитивный/негативный для владельца).
   * Используется для цветового выделения (например, эффектов реликвий).
   * Если не указана — считается 'positive'.
   */
  polarity?: 'positive' | 'negative';
};

/**
 * Активное правило в кэше актора.
 * Отличается от ContentRule заполненным контекстом владельца.
 */
export type ActiveRule = ContentRule & {
  ownerContext: OwnerContext;
  /** Ролленное значение rule-аффикса экземпляра предмета (для ParametrizedValue ownerParam). */
  paramValue?: number;
};

/**
 * Правило из слоя `world`.
 * Используется для глобальных мировых правил и тайловых эффектов.
 */
export type WorldContentRule = ContentRule & {
  ownerContext: Extract<OwnerContext, { type: 'world' } | { type: 'tileEffect' } | { type: 'tileEffectStatus' } | { type: 'object' }>;
  /** Подтип слоя world для сортировки. */
  worldLayer: 'global' | 'tileEffect' | 'tileEffectStatus' | 'object' | 'tileIntrinsic';
};
