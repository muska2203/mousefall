import type {StatusTemplateInput} from '../../schemas';

export const stunned = {
  "id": "stunned",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 2,
  "mutuallyExclusiveWith": [
    "dazed"
  ],
  "blockedBy": []
} satisfies StatusTemplateInput;
