import type {StatusTemplateInput} from '../../schemas';

export const wet = {
  "id": "wet",
  "ruleIds": [],
  "statusCategory": "elemental",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [
    "burning",
    "oiled"
  ],
  "blockedBy": []
} satisfies StatusTemplateInput;
