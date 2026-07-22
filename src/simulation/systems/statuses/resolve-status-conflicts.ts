/**
 * Разрешает конфликты статусов по правилам blockedBy / mutuallyExclusiveWith.
 *
 * Возвращает:
 * - blockedBy: тип статуса, который блокирует наложение, или null;
 * - removedTypes: массив типов статусов, которые должны быть сняты.
 */
export interface StatusConflictResult {
  blockedBy: string | null;
  removedTypes: string[];
}

export function resolveStatusConflicts(
  existingStatuses: Array<{ type: string }>,
  newStatusTemplate: { blockedBy: readonly string[]; mutuallyExclusiveWith: readonly string[] },
): StatusConflictResult {
  for (const blockerType of newStatusTemplate.blockedBy) {
    if (existingStatuses.some((status) => status.type === blockerType)) {
      return { blockedBy: blockerType, removedTypes: [] };
    }
  }

  const removedTypes: string[] = [];
  for (const exclusiveType of newStatusTemplate.mutuallyExclusiveWith) {
    if (existingStatuses.some((status) => status.type === exclusiveType)) {
      removedTypes.push(exclusiveType);
    }
  }

  return { blockedBy: null, removedTypes };
}
