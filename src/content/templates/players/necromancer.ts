import type {PlayerTemplateInput} from '../../schemas';

export const necromancer = {
  "id": "necromancer",
  "maxAp": 2,
  "portraitImg": "/assets/portraits/necromancer-ready.png",
  "starterEquipment": [
    "common_splinter_blade",
    "common_school_wand",
    "common_tin_plate",
    "common_patch_cloak",
    "common_knotted_fang",
    "common_glass_bead"
  ]
} satisfies PlayerTemplateInput;
