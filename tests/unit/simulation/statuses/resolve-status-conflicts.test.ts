import { describe, expect, it } from 'vitest';
import { resolveStatusConflicts } from '../../../../src/simulation/systems/statuses/resolve-status-conflicts';

describe('resolveStatusConflicts', () => {
  it('возвращает пустой результат, если конфликтов нет', () => {
    const existingStatuses = [{ type: 'frozen' }];
    const template = { blockedBy: [] as const, mutuallyExclusiveWith: [] as const };

    const result = resolveStatusConflicts(existingStatuses, template);

    expect(result).toEqual({ blockedBy: null, removedTypes: [] });
  });

  it('возвращает блокирующий статус, если он присутствует', () => {
    const existingStatuses = [{ type: 'wet' }, { type: 'frozen' }];
    const template = { blockedBy: ['wet'] as const, mutuallyExclusiveWith: [] as const };

    const result = resolveStatusConflicts(existingStatuses, template);

    expect(result).toEqual({ blockedBy: 'wet', removedTypes: [] });
  });

  it('возвращает взаимоисключающий тип для удаления', () => {
    const existingStatuses = [{ type: 'frozen' }];
    const template = { blockedBy: [] as const, mutuallyExclusiveWith: ['frozen'] as const };

    const result = resolveStatusConflicts(existingStatuses, template);

    expect(result).toEqual({ blockedBy: null, removedTypes: ['frozen'] });
  });

  it('возвращает несколько взаимоисключающих типов', () => {
    const existingStatuses = [{ type: 'frozen' }, { type: 'poisoned' }];
    const template = {
      blockedBy: [] as const,
      mutuallyExclusiveWith: ['frozen', 'burning', 'poisoned'] as const,
    };

    const result = resolveStatusConflicts(existingStatuses, template);

    expect(result).toEqual({ blockedBy: null, removedTypes: ['frozen', 'poisoned'] });
  });

  it('блокировка имеет приоритет над взаимоисключением', () => {
    const existingStatuses = [{ type: 'wet' }, { type: 'frozen' }];
    const template = {
      blockedBy: ['wet'] as const,
      mutuallyExclusiveWith: ['frozen'] as const,
    };

    const result = resolveStatusConflicts(existingStatuses, template);

    expect(result).toEqual({ blockedBy: 'wet', removedTypes: [] });
  });
});
