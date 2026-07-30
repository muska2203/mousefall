import type {PlayerTemplateInput} from '../../schemas';

export const witcher = {
  "id": "witcher",
  "maxAp": 3,
  "portraitImg": "/assets/portraits/witcher-ready.png",
  "renderScale": 1,
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
  ]
} satisfies PlayerTemplateInput;
