import {
  breakPropAt,
  breakPropsNear,
  hasLineOfSight,
  isWall,
} from '@/app/modules/level/utils/grid.util';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  ADRENALINE_TIME,
  ATTACK_COOLDOWN,
  BULLET_RADIUS,
  BULLET_RANGE_MARGIN,
  ENEMY_RADIUS,
  KILL_MONEY,
  MELEE_RANGE,
  MELEE_MISS_BASE,
  MELEE_MISS_BASE_SWING,
  MELEE_MISS_INTERVAL,
  MELEE_MISS_PEAK_BASE,
  MELEE_MISS_PEAK_RATE,
  MELEE_MISS_PEAK_SWING,
  NOISE_SHOT,
  PICKUP_RADIUS,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_RADIUS,
  PROP_BREAK_RADIUS,
  SHIELD_MAX,
  SEARCH_TIME,
  FLOATER_MISS_GAP,
  FLOATER_TIME,
  SHOT_TIME,
  SLASH_TIME,
  SWORD_DAMAGE,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  Projectile,
  Vec2,
  WeaponId,
  World,
} from '@/app/modules/world/types/world.types';
import { angleTo, distance } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

export function spawnProjectile(
  world: World,
  owner: Projectile['owner'],
  from: Vec2,
  angle: number,
  speed: number,
  damage: number,
  range: number,
  weapon: WeaponId = 'pistol',
): void {
  world.projectiles.push({
    id: world.nextId++,
    owner,
    weapon,
    pos: { ...from },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    damage,
    life: (range * BULLET_RANGE_MARGIN) / speed,
  });
}

// numero de dano sobre o alvo; `amount` 0 mostra "Errou!". Erros em rajada
// (chumbo da escopeta) viram um aviso so.
function addFloater(world: World, pos: Vec2, amount: number): void {
  if (
    amount === 0 &&
    world.floaters.some((f) => f.amount === 0 && f.age < FLOATER_MISS_GAP)
  ) {
    return;
  }
  world.floaters.push({
    id: world.nextId++,
    pos: { ...pos },
    amount,
    age: 0,
  });
}

export function updateFloaters(world: World, dt: number): void {
  world.floaters = world.floaters.filter((floater) => {
    floater.age += dt;
    return floater.age < FLOATER_TIME;
  });
}

export function killEnemy(world: World, enemy: Enemy): void {
  enemy.state = 'dead';
  enemy.hp = 0;
  enemy.detection = 0;
  world.run.kills++;
  world.run.events.push({
    at: world.run.seconds,
    text: `${enemy.kind === 'ninja' ? 'Ninja' : 'Inimigo armado'} eliminado.`,
  });
  world.player.adrenaline = ADRENALINE_TIME;
  breakPropsNear(world, enemy.pos, PROP_BREAK_RADIUS);
  world.pickups.push({
    id: world.nextId++,
    kind: 'money',
    roomIndex: enemy.roomIndex,
    pos: { ...enemy.pos },
    value: KILL_MONEY,
  });
}

// escudo absorve primeiro; o que sobra vai na vida
export function damagePlayer(world: World, damage: number): void {
  const player = world.player;
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const lost = Math.min(Math.max(0, player.hp), damage - absorbed);
  player.hp -= damage - absorbed;
  world.run.stats.damageBlocked += absorbed;
  world.run.stats.damageTaken += lost;
  world.run.events.push({
    at: world.run.seconds,
    text: lost
      ? `Sofreu ${lost} de dano${absorbed ? ` (${absorbed} bloqueado pelo escudo)` : ''}.`
      : `Escudo bloqueou ${absorbed} de dano.`,
  });
}

// quem sobrevive ao tiro entra em alerta no proximo passo (detection cheia)
export function damageEnemy(
  world: World,
  enemy: Enemy,
  damage: number,
  source: 'Facada' | 'Tiro' | 'Execução',
): void {
  const dealt = Math.min(damage, enemy.hp);
  addFloater(world, enemy.pos, dealt);
  world.run.stats.damageDealt += dealt;
  world.run.events.push({
    at: world.run.seconds,
    text:
      source === 'Execução'
        ? `Execução furtiva: ${dealt} de dano.`
        : `${source} acertou: ${dealt} de dano.`,
  });
  enemy.hp -= damage;
  if (enemy.hp <= 0) killEnemy(world, enemy);
  else enemy.detection = 1;
}

function attackDamage(world: World, base: number): number {
  const { min, max } = world.run.attackVariance;
  return Math.max(
    1,
    Math.round(base * (min + nextRandom(world) * (max - min))),
  );
}

function enemiesInReach(world: World, range: number): Enemy[] {
  const from = world.player.pos;
  return world.enemies
    .filter(
      (e) =>
        e.state !== 'dead' &&
        distance(from, e.pos) <= range &&
        hasLineOfSight(world, from, e.pos),
    )
    .sort((a, b) => distance(from, a.pos) - distance(from, b.pos));
}

// Tiro sem silenciador: todo inimigo no raio ouve na hora e vai ate o lugar
// do disparo (mesma investigacao de `listen`, em enemy.system). Parede nao
// abafa.
function gunshot(world: World): void {
  const at = world.player.pos;
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead' || enemy.state === 'alert') continue;
    if (distance(at, enemy.pos) > NOISE_SHOT * enemy.intelligence.hearing)
      continue;
    enemy.hearing = 0;
    enemy.heard = { ...at };
    enemy.searchTimer = SEARCH_TIME * enemy.intelligence.hearing;
    enemy.route = [];
    enemy.repathTimer = 0;
  }
}

// Ataque automatico. Encostado em alguem: golpe de espada, sem gastar
// municao (desavisado morre na hora, em alerta leva SWORD_DAMAGE).
// Senao, com arma de fogo: atira no mais proximo.
export function updateCombat(world: World, dt: number): void {
  if (world.run.seconds >= world.run.nextMeleeChanceAt) {
    const peak = nextRandom(world) < MELEE_MISS_PEAK_RATE;
    world.run.meleeMissChance = peak
      ? MELEE_MISS_PEAK_BASE + nextRandom(world) * MELEE_MISS_PEAK_SWING
      : MELEE_MISS_BASE + nextRandom(world) * MELEE_MISS_BASE_SWING;
    world.run.nextMeleeChanceAt = world.run.seconds + MELEE_MISS_INTERVAL;
    world.run.events.push({
      at: world.run.seconds,
      text: `Chance de erro: ${Math.round(world.run.meleeMissChance * 100)}%${peak ? ' (pico)' : ''}.`,
    });
  }
  const player = world.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.slash = Math.max(0, player.slash - dt);
  player.shot = Math.max(0, player.shot - dt);
  if (player.attackCooldown > 0) return;

  const close = enemiesInReach(world, MELEE_RANGE);
  const unaware = close.find((e) => e.state !== 'alert');
  const struck = unaware ?? close[0];
  if (struck) {
    player.facing = angleTo(player.pos, struck.pos);
    player.slash = SLASH_TIME;
    player.attackCooldown = ATTACK_COOLDOWN;
    world.run.stats.meleeAttempts++;
    if (nextRandom(world) < world.run.meleeMissChance) {
      struck.detection = 1;
      addFloater(world, struck.pos, 0);
      world.run.events.push({ at: world.run.seconds, text: 'Facada errou.' });
      return;
    }
    world.run.stats.meleeHits++;
    // execucao tira toda a vida que restava
    if (unaware) damageEnemy(world, unaware, unaware.hp, 'Execução');
    else
      damageEnemy(world, struck, attackDamage(world, SWORD_DAMAGE), 'Facada');
    return;
  }

  if (!player.weapon) return;
  const item = ITEMS[player.weapon.id];
  const target = enemiesInReach(world, item.range)[0];
  if (!target) return;

  const aim = angleTo(player.pos, target.pos);
  player.facing = aim;
  for (let i = 0; i < item.pellets; i++) {
    const offset =
      item.pellets === 1 ? 0 : (i / (item.pellets - 1) - 0.5) * item.spread;
    spawnProjectile(
      world,
      'player',
      player.pos,
      aim + offset,
      PLAYER_BULLET_SPEED,
      attackDamage(world, PLAYER_BULLET_DAMAGE),
      item.range,
      player.weapon.id,
    );
  }
  world.run.stats.projectilesFired += item.pellets;
  world.run.events.push({
    at: world.run.seconds,
    text: `Disparou ${item.name}.`,
  });
  player.attackCooldown = ATTACK_COOLDOWN;
  player.shot = SHOT_TIME;
  if (player.weapon.id !== 'silenced') gunshot(world);
  if (--player.weapon.ammo <= 0) player.weapon = null;
}

// anda as balas e resolve contato: parede some, personagem leva dano
export function updateProjectiles(world: World, dt: number): void {
  const player = world.player;
  world.projectiles = world.projectiles.filter((bullet) => {
    bullet.pos.x += bullet.vel.x * dt;
    bullet.pos.y += bullet.vel.y * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || isWall(world, bullet.pos.x, bullet.pos.y)) {
      // bala do player que acabou sem acertar ninguem
      if (bullet.owner === 'player') addFloater(world, bullet.pos, 0);
      return false;
    }
    // caixa segura a bala e quebra
    if (breakPropAt(world, bullet.pos.x, bullet.pos.y)) return false;
    if (bullet.owner === 'enemy') {
      if (distance(bullet.pos, player.pos) > PLAYER_RADIUS + BULLET_RADIUS) {
        return true;
      }
      damagePlayer(world, bullet.damage);
      return false;
    }
    const hit = world.enemies.find(
      (e) =>
        e.state !== 'dead' &&
        distance(bullet.pos, e.pos) <= ENEMY_RADIUS + BULLET_RADIUS,
    );
    if (!hit) return true;
    world.run.stats.projectilesHit++;
    damageEnemy(world, hit, bullet.damage, 'Tiro');
    return false;
  });
}

export function collectPickups(world: World): void {
  const player = world.player;
  world.pickups = world.pickups.filter((pickup) => {
    if (distance(player.pos, pickup.pos) > PICKUP_RADIUS) return true;
    if (pickup.kind === 'money') {
      world.run.money += pickup.value;
      world.run.earned += pickup.value;
      world.run.events.push({
        at: world.run.seconds,
        text: `Coletou $${pickup.value}.`,
      });
      return false;
    }
    // coracao e escudo ficam no chao enquanto nao servem para nada
    const stat = pickup.kind === 'heart' ? 'hp' : 'shield';
    const cap =
      pickup.kind === 'heart'
        ? player.maxHp
        : Math.round(player.maxHp * SHIELD_MAX);
    if (player[stat] >= cap) return true;
    const gained = Math.min(cap - player[stat], pickup.value);
    player[stat] += gained;
    if (pickup.kind === 'heart') world.run.stats.healthRecovered += gained;
    world.run.events.push({
      at: world.run.seconds,
      text: `${pickup.kind === 'heart' ? 'Recuperou vida' : 'Coletou escudo'}: +${gained}.`,
    });
    return false;
  });
}
