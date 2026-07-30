import type {StatusTemplateInput} from '../../schemas';

export const oiled = {
  "id": "oiled",
  "ruleIds": [],
  "statusCategory": "elemental",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [
    "wet"
  ],
  "blockedBy": []
} satisfies StatusTemplateInput;
