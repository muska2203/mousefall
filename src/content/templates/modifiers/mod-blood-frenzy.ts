import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Берсерк»: положительный rule-аффикс амулетов кровавой ветки, добавляет
 * правило amulet_blood_frenzy (урон оружием увеличен, пока владелец сам
 * кровоточит). Величина бонуса роллится по уровню предмета (scaling: perLevel,
 * правило читает её через ownerParam). Уровень 1 — черновое значение +2
 * (балансный проход — roadMap 1.4); уровни выше длины ranges клампятся
 * к последнему рейнжу.
 */
export const modBloodFrenzy = {
  "id": "mod_blood_frenzy",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "amulet_blood_frenzy"
  },
  "scaling": {
    "kind": "perLevel",
    "ranges": [
      { "min": 1, "max": 1 }
    ]
  },
  "applicableSubtypes": ["talisman"],
  "weight": 1
} satisfies ModifierTemplateInput;
