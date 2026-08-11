import type {StatusTemplateInput} from '../../schemas';

/**
 * Статус «Глухая оборона» первого босса.
 *
 * Семантика реализована движком, а не контентными правилами:
 * - иммунитет к любому урону (обнуление в `applyDamageToEntity`, событие с damage 0 эмитится);
 * - иммунитет к толчкам (PUSH гасится в push-исполнителе);
 * - полный запрет действий носителя, кроме END_TURN (без сброса подготовленного скилла).
 */
export const bulwark = {
  id: 'bulwark',
  ruleIds: [],
  statusCategory: 'physical',
  categoryPriority: 0,
  mutuallyExclusiveWith: [],
  blockedBy: [],
} satisfies StatusTemplateInput;
