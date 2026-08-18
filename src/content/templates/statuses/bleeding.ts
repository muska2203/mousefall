import type {StatusTemplateInput} from '../../schemas';

// Кровотечение: тик физического урона в начале хода носителя
// (концепт этажа 1, §4.1). Числа черновые — балансный проход roadMap 1.4.
// Категория 'wound' отдельная, чтобы одновременное наложение с другими
// статусами (например, rooted от мышеловки) не терялось в resolveStatusBatch.
export const bleeding = {
  id: 'bleeding',
  ruleIds: ['status_bleeding_tick_damage'],
  statusCategory: 'wound',
  categoryPriority: 0,
  mutuallyExclusiveWith: [],
  blockedBy: [],
} satisfies StatusTemplateInput;
