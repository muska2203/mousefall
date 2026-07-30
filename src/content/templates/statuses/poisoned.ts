import type {StatusTemplateInput} from '../../schemas';

export const poisoned = {
  "id": "poisoned",
  "ruleIds": [
    "status_poison_tick_damage"
  ],
  "statusCategory": "poison",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": []
} satisfies StatusTemplateInput;
