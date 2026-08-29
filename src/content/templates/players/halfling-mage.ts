import type {PlayerTemplateInput} from '../../schemas';

export const halflingMage = {
  "id": "halfling-mage",
  "maxAp": 2,
  "portraitImg": "/assets/portraits/halfling-mage-ready.png",
  "innateAbilities": ["search"]
} satisfies PlayerTemplateInput;
