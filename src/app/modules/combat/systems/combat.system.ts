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
  PICKUP_RADIUS,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_RADIUS,
  PROP_BREAK_RADIUS,
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

export function killEnemy(world: World, enemy: Enemy): void {
  enemy.state = 'dead';
  enemy.hp = 0;
  enemy.detection = 0;
  world.run.kills++;
  world.player.adrenaline = ADRENALINE_TIME;
  breakPropsNear(world, enemy.pos, PROP_BREAK_RADIUS);
  world.pickups.push({
    id: world.nextId++,
    roomIndex: enemy.roomIndex,
    pos: { ...enemy.pos },
    value: KILL_MONEY,
  });
}

// quem sobrevive ao tiro entra em alerta no proximo passo (detection cheia)
export function damageEnemy(world: World, enemy: Enemy, damage: number): void {
  enemy.hp -= damage;
  if (enemy.hp <= 0) killEnemy(world, enemy);
  else enemy.detection = 1;
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

// Ataque automatico. Encostado em alguem: golpe de espada, sem gastar
// municao (desavisado morre na hora, em alerta leva SWORD_DAMAGE).
// Senao, com arma de fogo: atira no mais proximo.
export function updateCombat(world: World, dt: number): void {
  const player = world.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.slash = Math.max(0, player.slash - dt);
  if (player.attackCooldown > 0) return;

  const close = enemiesInReach(world, MELEE_RANGE);
  const unaware = close.find((e) => e.state !== 'alert');
  const struck = unaware ?? close[0];
  if (struck) {
    player.facing = angleTo(player.pos, struck.pos);
    player.slash = SLASH_TIME;
    player.attackCooldown = ATTACK_COOLDOWN;
    if (unaware) killEnemy(world, unaware);
    else damageEnemy(world, struck, SWORD_DAMAGE);
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
      PLAYER_BULLET_DAMAGE,
      item.range,
      player.weapon.id,
    );
  }
  player.attackCooldown = ATTACK_COOLDOWN;
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
      return false;
    }
    // caixa segura a bala e quebra
    if (breakPropAt(world, bullet.pos.x, bullet.pos.y)) return false;
    if (bullet.owner === 'enemy') {
      if (distance(bullet.pos, player.pos) > PLAYER_RADIUS + BULLET_RADIUS) {
        return true;
      }
      player.hp -= bullet.damage;
      return false;
    }
    const hit = world.enemies.find(
      (e) =>
        e.state !== 'dead' &&
        distance(bullet.pos, e.pos) <= ENEMY_RADIUS + BULLET_RADIUS,
    );
    if (!hit) return true;
    damageEnemy(world, hit, bullet.damage);
    return false;
  });
}

export function collectPickups(world: World): void {
  world.pickups = world.pickups.filter((pickup) => {
    if (distance(world.player.pos, pickup.pos) > PICKUP_RADIUS) return true;
    world.run.money += pickup.value;
    world.run.earned += pickup.value;
    return false;
  });
}
