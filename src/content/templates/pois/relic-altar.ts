import type {PoiTemplateInput} from '../../schemas';

export const relicAltar = {
  "id": "relic_altar",
  "interactionKind": "poi",
  "ruleIds": [],
  "charges": 1,
  "chargeSpentOn": "resolution",
  "window": { "kind": "relic_choice", "offerSize": 3 },
  "tags": [
    "relic_altar"
  ]
} satisfies PoiTemplateInput;
