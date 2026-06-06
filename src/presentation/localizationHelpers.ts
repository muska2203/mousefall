/**
 * Общие хелперы локализации для Presentation Layer.
 *
 * Правила:
 * - Не содержат игровой логики.
 * - Используют t() из @i18n/t для резолва строк.
 */

import type { DamageType } from '@simulation/core-types';
import { t } from '@i18n/t';

export function damageTypeLabel(dt: DamageType): string {
  switch (dt) {
    case 'piercing': return t('system.itemMapper.damagePiercing');
    case 'slashing': return t('system.itemMapper.damageSlashing');
    case 'blunt': return t('system.itemMapper.damageBlunt');
    case 'fire': return t('system.itemMapper.damageFire');
    case 'electric': return t('system.itemMapper.damageElectric');
    case 'poison': return t('system.itemMapper.damagePoison');
    case 'frost': return t('system.itemMapper.damageFrost');
    default: return dt;
  }
}
