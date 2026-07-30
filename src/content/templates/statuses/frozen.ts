import type {StatusTemplateInput} from '../../schemas';

export const frozen = {
  "id": "frozen",
  "ruleIds": [],
  "statusCategory": "elemental",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": [
    "burning"
  ],
  "blockedBy": []
} satisfies StatusTemplateInput;
