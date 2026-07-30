import type {StatusTemplateInput} from '../../schemas';

export const counterattack = {
  "id": "counterattack",
  "ruleIds": [
    "counterattack_trigger",
    "counterattack_damage"
  ],
  "statusCategory": "generic",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": []
} satisfies StatusTemplateInput;
