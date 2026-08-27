import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import type {DamageTileIntent, GameplayTag} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getEntitiesInRadius} from '@simulation/skills/targeting';
import {findAllEntitiesAt, isBlocked, isCombatEntity, isDamageable, isTerrainWalkable} from '@simulation/state';
import {isRooted} from '@simulation/systems/rooted-helper';
import {isBulwarked} from '@simulation/systems/bulwark-helper';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

/** Параметры исполнителя способности вида «налёт» (соответствуют полям шаблона kind 'swoop'). */
export interface SwoopSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Радиус выбора точки приземления относительно кастера. */
  jumpRadius: number;
  /** Радиус удара по земле вокруг точки приземления. */
  aoeRadius: number;
  /** Базовый урон от удара по земле. */
  baseDamage: number;
}

/**
 * Длительность ошеломления (dazed) кастера при «отскоке» Налёта
 * от непроходимой цели.
 */
const SWOOP_COLLISION_DAZE_DURATION = 1;

/**
 * Возвращает живого актора на клетке (x, y) или undefined.
 * Актор на клетке приземления «поглощает» удар Налёта (механика подставки).
 */
function findLivingActorAt(state: GameState, x: number, y: number): (Entity & { isAlive: boolean }) | undefined {
  return findAllEntitiesAt(state, x, y).find(
    (e): e is Entity & { isAlive: boolean } => isCombatEntity(e) && e.isAlive,
  );
}

/**
 * Проверяет, что клетка свободна для приземления/отброса:
 * в пределах карты, проходимый террейн, нет блокирующих сущностей.
 * Кастер не считается блокером (на момент резолва он ещё стоит на исходной клетке).
 */
function isCellFree(state: GameState, x: number, y: number, casterId: string): boolean {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return false;
  if (!isTerrainWalkable(state.map.tiles[y]?.[x])) return false;
  return !findAllEntitiesAt(state, x, y).some(e => e.blocksMovement && e.id !== casterId);
}

/**
 * Ищет клетку отброса при столкновении Налёта: ближайшую к началу каста
 * свободную клетку вокруг точки прицела (кольца Чебышёва 1..2).
 * Тай-брейки детерминированы: евклидова дистанция² до начала, затем y, затем x.
 * Fallback — исходная клетка кастера; если и она недоступна — null (отброса нет).
 *
 * Используется для «отскока» от непроходимой цели и как fallback подставки,
 * когда жертву некуда отпихнуть.
 */
function findRepelCell(state: GameState, target: Position, origin: Position, casterId: string): Position | null {
  for (let ring = 1; ring <= 2; ring++) {
    const candidates: Position[] = [];
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (isCellFree(state, x, y, casterId)) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const chebDiff =
          Math.max(Math.abs(a.x - origin.x), Math.abs(a.y - origin.y)) -
          Math.max(Math.abs(b.x - origin.x), Math.abs(b.y - origin.y));
        if (chebDiff !== 0) return chebDiff;
        const euclidDiff =
          ((a.x - origin.x) ** 2 + (a.y - origin.y) ** 2) -
          ((b.x - origin.x) ** 2 + (b.y - origin.y) ** 2);
        if (euclidDiff !== 0) return euclidDiff;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
      return candidates[0]!;
    }
  }

  // Отброс на исходную клетку кастера (он её освобождает прыжком).
  if (isCellFree(state, origin.x, origin.y, casterId)) return { x: origin.x, y: origin.y };
  return null;
}

/**
 * Ищет клетку, куда отпихнёт жертву подставки: ближайшую к жертве свободную
 * от непроходимых объектов клетку (PUSH сдвигает ровно на одну клетку,
 * поэтому кандидаты — 8 соседних). Жертву отпихивает прочь от кастера:
 * приоритет — по убыванию евклидовой дистанции² от начала каста,
 * тай-брейки детерминированы: затем y, затем x.
 * Кастер не считается блокером: он освобождает исходную клетку прыжком.
 * Возвращает null, если все соседние клетки заняты.
 */
function findVictimPushCell(state: GameState, target: Position, origin: Position, casterId: string): Position | null {
  const candidates: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = target.x + dx;
      const y = target.y + dy;
      if (isCellFree(state, x, y, casterId)) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const euclidDiff =
      ((b.x - origin.x) ** 2 + (b.y - origin.y) ** 2) -
      ((a.x - origin.x) ** 2 + (a.y - origin.y) ** 2);
    if (euclidDiff !== 0) return euclidDiff;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return candidates[0]!;
}

/**
 * Фабрика исполнителя способности вида «налёт»:
 * прыжок в клетку в радиусе jumpRadius с тремя исходами по содержимому цели.
 * Удар по земле (плоский урон baseDamage и радиальное отталкивание по квадрату
 * aoeRadius БЕЗ центральной клетки) проходит и при свободном приземлении, и при
 * подставке — в т.ч. когда жертву некуда отпихнуть. Кастер себя не задевает
 * (excludeEntityId у DAMAGE_TILE, пропуск PUSH).
 *
 * - Свободная клетка: прыжок в точку и удар по земле. Центр зоны исключён —
 *   после прыжка там стоит кастер.
 * - Клетка с живым актором («подставка»): актор получает удвоенный baseDamage
 *   (вместо AoE по своей клетке — центр зоны из неё исключён), затем
 *   его отпихивает (PUSH) на ближайшую свободную от непроходимых объектов
 *   клетку прочь от кастера, а кастер приземляется на освободившуюся клетку.
 *   Если жертва недвижима (под «Глухой обороной» или все соседние клетки
 *   заняты), её не отпихивает: вместо отталкивания цели кастер сам
 *   отбрасывается на ближайшую к началу каста свободную клетку (fallback) —
 *   точечный урон жертве и удар по земле при этом проходят.
 * - Непроходимая клетка (стена, блокирующий объект, вне карты — возможно
 *   только при устаревшем подготовленном прицеле): «отскок» — урона нет,
 *   кастер отбрасывается к началу каста и получает dazed.
 *
 * Параметры механики приходят из шаблона способности (kind 'swoop'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createSwoopSkill(params: SwoopSkillParams): SkillExecutor {
  /**
   * Возвращает клетки, в которые кастер может нацелить прыжок:
   * в пределах радиуса, проходимый террейн; занятость живым актором
   * допустима (подставка), прочие блокеры — нет.
   */
  function getJumpTargets(state: GameState, caster: Entity): Position[] {
    // Обездвиженный кастер не может прыгать: точек приземления для выбора нет.
    if (isRooted(caster)) return [];

    const positions: Position[] = [];

    for (let dy = -params.jumpRadius; dy <= params.jumpRadius; dy++) {
      for (let dx = -params.jumpRadius; dx <= params.jumpRadius; dx++) {
        if (dx === 0 && dy === 0) continue;

        const x = caster.x + dx;
        const y = caster.y + dy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;
        if (!isTerrainWalkable(state.map.tiles[y]?.[x])) continue;
        // Занятая актором клетка — валидная цель (подставка), объекты и стены — нет.
        if (isBlocked(state, x, y) && !findLivingActorAt(state, x, y)) continue;

        positions.push({ x, y });
      }
    }

    return positions;
  }

  /** Интент отброса кастера к началу каста или null, если отбрасывать некуда. */
  function buildRepelJumpIntent(state: GameState, caster: Entity, target: Position): Intent | null {
    const repel = findRepelCell(state, target, { x: caster.x, y: caster.y }, caster.id);
    if (!repel) return null;
    return {
      type: 'JUMP',
      entityId: caster.id,
      dx: repel.x - caster.x,
      dy: repel.y - caster.y,
    };
  }

  /**
   * AoE-интенты удара по земле: плоский урон baseDamage по клеткам квадрата
   * aoeRadius вокруг точки приземления БЕЗ центральной клетки и радиальное
   * отталкивание всех damageable-сущностей в радиусе прочь от центра.
   * Центр исключён: при свободном приземлении там оказывается кастер, при
   * подставке — жертва, получающая удвоенный урон попадания вместо AoE.
   * Кастер себя не задевает (excludeEntityId у DAMAGE_TILE, пропуск PUSH).
   * excludeFromPushId — жертва подставки: её отброс разрешается отдельно.
   */
  function buildAoeIntents(
    state: GameState,
    caster: Entity,
    target: Position,
    damageTags: GameplayTag[],
    excludeFromPushId?: string,
  ): Intent[] {
    const intents: Intent[] = [];

    for (let dy = -params.aoeRadius; dy <= params.aoeRadius; dy++) {
      for (let dx = -params.aoeRadius; dx <= params.aoeRadius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = target.x + dx;
        const y = target.y + dy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;

        intents.push({
          type: 'DAMAGE_TILE',
          position: { x, y },
          sourceEntityId: caster.id,
          damage: params.baseDamage,
          tags: damageTags,
          excludeEntityId: caster.id,
        });
      }
    }

    // Радиальное отталкивание всех живых объектов с hp в радиусе.
    const affectedEntities = getEntitiesInRadius(state, target, params.aoeRadius);
    for (const entity of affectedEntities) {
      if (entity.id === caster.id) continue;
      if (entity.id === excludeFromPushId) continue;
      if (!isDamageable(entity)) continue;

      const pushDx = Math.sign(entity.x - target.x);
      const pushDy = Math.sign(entity.y - target.y);

      if (pushDx !== 0 || pushDy !== 0) {
        intents.push({
          type: 'PUSH',
          entityId: entity.id,
          dx: pushDx,
          dy: pushDy,
          sourceEntityId: caster.id,
        });
      }
    }

    return intents;
  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveSwoopIntents(state: GameState, caster: Entity, targets: Position[], skillId: string): Intent[] {
    if (!isCombatEntity(caster)) return [];
    // Обездвиженный кастер не может прыгать (в т.ч. подготовленной AI-способностью).
    if (isRooted(caster)) return [];

    const target = targets[0];
    if (!target) return [];

    const jumpDx = target.x - caster.x;
    const jumpDy = target.y - caster.y;
    // Своя клетка и цель вне радиуса прыжка не разрешаются ни в каком исходе.
    if (jumpDx === 0 && jumpDy === 0) return [];
    if (Math.abs(jumpDx) > params.jumpRadius || Math.abs(jumpDy) > params.jumpRadius) return [];

    const ability = tryGetAbility(skillId);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(skillId);
    const damageTags = damageTag
      ? mergeDamageIntentTags([damageTag], abilityTags)
      : abilityTags;

    const inBounds =
      target.x >= 0 && target.x < state.map.width &&
      target.y >= 0 && target.y < state.map.height;
    const walkable = inBounds && isTerrainWalkable(state.map.tiles[target.y]?.[target.x]);
    const victim = walkable ? findLivingActorAt(state, target.x, target.y) : undefined;

    // Подставка: актор в точке приземления получает удвоенный урон попадания
    // (без ошеломления). Затем жертву отпихивает (PUSH) на ближайшую свободную
    // клетку прочь от кастера, а кастер приземляется на её место.
    if (victim) {
      const intents: Intent[] = [];
      intents.push({
        type: 'DAMAGE_TILE',
        position: { x: target.x, y: target.y },
        sourceEntityId: caster.id,
        damage: params.baseDamage * 2,
        tags: damageTags,
        excludeEntityId: caster.id,
      });

      // Жертву под «Глухой обороной» толчок не сдвигает (PUSH гасится) —
      // толкать некуда, как и при полностью занятом окружении.
      const pushCell = isBulwarked(victim)
        ? null
        : findVictimPushCell(state, target, { x: caster.x, y: caster.y }, caster.id);
      if (pushCell) {
        // Отброс жертвы идёт до прыжка кастера, но её перемещение исполняется
        // волной реакций позже — прыжок явно игнорирует её блокировку клетки.
        intents.push({
          type: 'PUSH',
          entityId: victim.id,
          dx: pushCell.x - target.x,
          dy: pushCell.y - target.y,
          sourceEntityId: caster.id,
        });
        intents.push({
          type: 'JUMP',
          entityId: caster.id,
          dx: jumpDx,
          dy: jumpDy,
          ignoreBlockedByEntityId: victim.id,
        });
      } else {
        // Fallback: жертва недвижима (bulwark или все соседние клетки заняты) —
        // вместо её отталкивания кастер сам отбрасывается к началу каста
        // (приземлиться в занятую клетку нельзя).
        const repelJump = buildRepelJumpIntent(state, caster, target);
        if (repelJump) intents.push(repelJump);
      }

      // Удар по земле проходит при любом исходе подставки, включая fallback:
      // центр зоны (клетка жертвы) из AoE исключён — там уже удвоенный урон,
      // а сама жертва убрана из радиального отталкивания (её отброс выше).
      intents.push(...buildAoeIntents(state, caster, target, damageTags, victim.id));
      return intents;
    }

    // Отскок: цель ушла в непроходимое (стена, объект, вне карты) — удара нет,
    // кастер отбрасывается к началу каста с ошеломлением.
    if (!walkable || isBlocked(state, target.x, target.y)) {
      const intents: Intent[] = [];
      const repelJump = buildRepelJumpIntent(state, caster, target);
      if (repelJump) intents.push(repelJump);
      intents.push({
        type: 'APPLY_STATUS',
        entityId: caster.id,
        sourceEntityId: caster.id,
        status: { type: 'dazed', duration: SWOOP_COLLISION_DAZE_DURATION, value: 0, statModifiers: null },
      });
      return intents;
    }

    // Свободная клетка: прыжок, площадной удар и отталкивание.
    const intents: Intent[] = [];

    // Прыжок в выбранную точку.
    intents.push({
      type: 'JUMP',
      entityId: caster.id,
      dx: jumpDx,
      dy: jumpDy,
    });

    // Удар по земле: центр зоны исключён — после прыжка там стоит кастер.
    intents.push(...buildAoeIntents(state, caster, target, damageTags));

    return intents;
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'single', range: params.jumpRadius };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      return getJumpTargets(state, caster);
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return resolveSwoopIntents(state, caster, [hoveredTarget], this.id);
    },

    getAffectedPositions(state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
      if (!hoveredTarget) return [];

      // Зона удара по земле — полный квадрат aoeRadius вокруг точки приземления;
      // при подставке центр зоны получает удвоенный урон вместо AoE.
      const positions: Position[] = [];
      for (let dy = -params.aoeRadius; dy <= params.aoeRadius; dy++) {
        for (let dx = -params.aoeRadius; dx <= params.aoeRadius; dx++) {
          positions.push({ x: hoveredTarget.x + dx, y: hoveredTarget.y + dy });
        }
      }
      return positions;
    },

    /**
     * Затронутые клетки — ровно те, что получают DAMAGE_TILE при резолве
     * (при свободном приземлении — квадрат удара без центральной клетки,
     * обрезанный границами карты; при подставке — клетка жертвы с удвоенным
     * уроном плюс кольцо AoE вокруг неё; при отскоке — пусто).
     * Деривируется из интентов, чтобы зона касания не расходилась с механикой;
     * для невалидной цели/обездвиженного кастера интентов нет — клеток нет.
     */
    getTouchedPositions(state: GameState, caster: Entity, targets: Position[]): Position[] {
      return resolveSwoopIntents(state, caster, targets, this.id)
        .filter((intent): intent is DamageTileIntent => intent.type === 'DAMAGE_TILE')
        .map((intent) => intent.position);
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      return resolveSwoopIntents(state, caster, targets, this.id);
    },
  };
}
