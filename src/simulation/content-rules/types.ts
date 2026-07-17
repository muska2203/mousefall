/**
 * Базовые типы декларативных контентных правил.
 *
 * Правила хранятся как статические TypeScript-объекты в `rules.ts`.
 * Шаблоны предметов, способностей и статусов ссылаются на них по `ruleIds`.
 */

import type {
  EntityId,
  GameplayTag,
  Position,
  StatusEffectType,
} from '@simulation/core-types.ts';

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
 * В MVP поддерживаются только константа и ссылка на поле контекста.
 */
export type ParametrizedValue =
  | { type: 'literal'; value: number }
  | {
      // TODO(4.4): заменить eventMaxHp на общий stat-based resolver (targetStat/selfStat), см. Концепт боевой системы.md
      type: 'context';
      field: 'eventDamage' | 'eventAmount' | 'eventDuration' | 'eventStacks' | 'eventMaxHp';
      multiply?: number;
      min?: number;
      round?: boolean;
    };

/**
 * Условие срабатывания правила.
 * В фазе 2 поддерживаются базовые операторы; остальные добавляются позже.
 */
export type RuleCondition =
  | { type: 'chance'; probability: number | ParametrizedValue }
  | { type: 'hasStatus'; statusType: StatusEffectType; subject: 'self' | 'target' | 'candidate' }
  | { type: 'hasTag'; tag: GameplayTag }
  | { type: 'eventRole'; role: 'source' | 'target' }
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
  | { type: 'allInRadius'; radius: number; center: 'eventPosition' | 'self'; faction?: 'enemy' | 'ally'; excludeSelf?: boolean }
  | { type: 'nearestEnemy'; radius: number; center: 'eventPosition' | 'self' };

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
};

/**
 * Активное правило в кэше актора.
 * Отличается от ContentRule заполненным контекстом владельца.
 */
export type ActiveRule = ContentRule & {
  ownerContext: OwnerContext;
};

/**
 * Правило из слоя `world`.
 * Используется для глобальных мировых правил и тайловых эффектов.
 */
export type WorldContentRule = ContentRule & {
  ownerContext: Extract<OwnerContext, { type: 'world' } | { type: 'tileEffect' }>;
  /** Подтип слоя world для сортировки. */
  worldLayer: 'global' | 'tileEffect' | 'tileIntrinsic';
};
