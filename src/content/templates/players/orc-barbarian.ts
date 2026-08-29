import type {PlayerTemplateInput} from '../../schemas';

export const orcBarbarian = {
  "id": "orc-barbarian",
  "maxAp": 2,
  "portraitImg": "/assets/portraits/orc-barbarian-ready.png",
  "innateAbilities": ["search"]
} satisfies PlayerTemplateInput;
