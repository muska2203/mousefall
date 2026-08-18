import type {StatusTemplateInput} from '../../schemas';

// Обездвиженность: движковая семантика (isRooted), контентных правил нет.
// Блокирует только самостоятельное перемещение (MOVE, рывок, прыжок, телепорт);
// атаки и способности разрешены, внешние перемещения (PUSH) не блокируются
// (концепт этажа 1, §2 и §4.1).
// Категория 'control' отдельная, чтобы одновременное наложение с другими
// статусами (например, bleeding от мышеловки) не терялось в resolveStatusBatch.
export const rooted = {
  id: 'rooted',
  ruleIds: [],
  statusCategory: 'control',
  categoryPriority: 0,
  mutuallyExclusiveWith: [],
  blockedBy: [],
} satisfies StatusTemplateInput;
