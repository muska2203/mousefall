import type {PoiTemplateInput} from '../../schemas';

export const altar = {
  "id": "altar",
  "interactionKind": "poi",
  "ruleIds": [
    "altar_heals_player"
  ],
  "charges": 1,
  "renderScale": 1,
  "tags": []
} satisfies PoiTemplateInput;
