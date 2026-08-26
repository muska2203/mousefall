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
  "starterEquipment": [
    "common_splinter_blade",
    "common_school_wand",
    "common_tin_plate",
    "common_patch_cloak",
    "common_knotted_fang",
    "common_glass_bead"
  ],
  "innateAbilities": ["search"],
  "starterRelicPool": ["relic_blood_pact"]
} satisfies PlayerTemplateInput;
