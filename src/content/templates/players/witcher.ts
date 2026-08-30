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
    "weapon_sword_splinter_blade",
    "weapon_staff_school_wand",
    "armor_heavy_tin_plate",
    "armor_light_patch_cloak",
    "amulet_talisman_knotted_fang",
    "amulet_bead_glass"
  ],
  "innateAbilities": ["search"]
} satisfies PlayerTemplateInput;
