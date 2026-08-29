import type {PlayerTemplateInput} from '../../schemas';

export const witcher = {
  "id": "witcher",
  "maxAp": 3,
  "portraitImg": "/assets/portraits/witcher-ready.png",
  "isDefault": true,
  "baseStats": {
    "str": 4,
    "dex": 2,
    "int": 0,
    "vit": 4
  },
  "innateAbilities": ["search"]
} satisfies PlayerTemplateInput;
