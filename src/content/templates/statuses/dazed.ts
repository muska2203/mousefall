import type {StatusTemplateInput} from '../../schemas';

export const dazed = {
  "id": "dazed",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": [],
  "blockedBy": [
    "stunned"
  ]
} satisfies StatusTemplateInput;
