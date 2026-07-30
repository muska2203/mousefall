import type {StatusTemplateInput} from '../../schemas';

export const silenced = {
  "id": "silenced",
  "ruleIds": [],
  "statusCategory": "mental",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": []
} satisfies StatusTemplateInput;
