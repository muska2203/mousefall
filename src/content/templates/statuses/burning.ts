import type {StatusTemplateInput} from '../../schemas';

export const burning = {
  "id": "burning",
  "ruleIds": [],
  "statusCategory": "elemental",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": [
    "frozen"
  ],
  "blockedBy": []
} satisfies StatusTemplateInput;
