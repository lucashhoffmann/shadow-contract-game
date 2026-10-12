import {
  breakPropAt,
  breakPropsNear,
  dropLoot,
  hasLineOfSight,
  isSolidTile,
  isWall,
  tileAt,
} from '@/app/modules/level/utils/grid.util';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import { eventText } from '@/shared/i18n';
import {
  ADRENALINE_TIME,
  ATTACK_COOLDOWN,
  BULLET_RADIUS,
  BULLET_RANGE_MARGIN,
  DASH_MAX,
  ENEMY_LOOT_CHANCE,
  ENEMY_LOOT_OFFSET,
  ENEMY_RADIUS,
  FALLOFF_MIN,
  FALLOFF_START,
  ENEMY_KINDS,
  LAUNCH_TIME,
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
  PLAYER_BULLET_SPEED,
  PLAYER_RADIUS,
  PROP_BREAK_RADIUS,
  REVIVE_MAX,
  SHIELD_MAX,
  SEARCH_TIME,
  FLOATER_MISS_GAP,
  HEADSHOT_MAX,
  HEADSHOT_MULT,
  FLOATER_TIME,
  SHOT_TIME,
  SLASH_TIME,
  STREAK_MAX,
  STREAK_WINDOW,
  STEALTH_BACK_ANGLE,
  SWORD_CRIT_CHANCE,
  SWORD_CRIT_FOCUS,
  SWORD_CRIT_MULT,
  SWORD_DAMAGE,
  SWORD_RANGE,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  Projectile,
  Vec2,
  WeaponId,
  World,
} from '@/app/modules/world/types/world.types';
import { angleDiff, angleTo, distance } from '@/shared/utils/math.util';
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
  shooter?: number,
  headshot = false,
): Projectile {
  const projectile: Projectile = {
    id: world.nextId++,
    owner,
    weapon,
    ...(shooter !== undefined && { shooter }),
    pos: { ...from },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    damage,
    life: (range * BULLET_RANGE_MARGIN) / speed,
    range,
    travelled: 0,
    ...(headshot && { headshot }),
  };
  world.projectiles.push(projectile);
  return projectile;
}

// numero de dano sobre o alvo; `amount` 0 mostra "Errou!". Erros em rajada
// (chumbo da escopeta) viram um aviso so.
function addFloater(
  world: World,
  pos: Vec2,
  amount: number,
  onPlayer = false,
  // destaque escrito sobre o numero
  tag?: 'headshot' | 'overkill' | 'critical' | 'blocked',
): void {
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
    ...(onPlayer && { onPlayer }),
    ...(tag && { [tag]: true }),
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
  // quem esta em foco e quem matou (golpe proprio ou bala dele)
  world.player.kills++;
  // morte em seguida da anterior soma na sequencia; senao, recomeca
  const killer = world.player;
  killer.streak =
    world.run.seconds - killer.lastKillAt <= STREAK_WINDOW
      ? Math.min(STREAK_MAX, killer.streak + 1)
      : 1;
  killer.lastKillAt = world.run.seconds;
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) => t.events.enemyKilled(enemy.kind)),
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
  // alem do dinheiro, as vezes um item da tabela das caixas
  if (nextRandom(world) >= ENEMY_LOOT_CHANCE) return;
  // ao lado do corpo, para nao ficar em cima das moedas; se ali for parede
  // ou caixa, cai no proprio corpo
  const angle = nextRandom(world) * Math.PI * 2;
  const beside = {
    x: enemy.pos.x + Math.cos(angle) * ENEMY_LOOT_OFFSET,
    y: enemy.pos.y + Math.sin(angle) * ENEMY_LOOT_OFFSET,
  };
  const free = !isSolidTile(
    tileAt(world, Math.floor(beside.x), Math.floor(beside.y)),
  );
  dropLoot(world, {
    roomIndex: enemy.roomIndex,
    pos: free ? beside : { ...enemy.pos },
  });
}

// escudo absorve primeiro; o que sobra vai na vida
// `from`: onde esta quem bateu; o numero do dano sobe ali
export function damagePlayer(
  world: World,
  damage: number,
  from: Vec2,
  // golpe critico do inimigo: so muda o aviso
  critical = false,
): void {
  const player = world.player;
  // invencivel: o golpe nao entra nem gasta escudo; so sobe o aviso
  if (player.invincible > 0) {
    addFloater(world, from, 0, true, 'blocked');
    return;
  }
  const absorbed = Math.min(player.shield, damage);
  player.shield -= absorbed;
  const lost = Math.min(Math.max(0, player.hp), damage - absorbed);
  const alive = player.hp > 0;
  player.hp -= damage - absorbed;
  if (alive && player.hp <= 0) player.deaths++;
  world.run.stats.damageBlocked += absorbed;
  world.run.stats.damageTaken += lost;
  // mostra o golpe inteiro, mesmo a parte que o escudo segurou
  addFloater(world, from, damage, true, critical ? 'critical' : undefined);
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) => t.events.damageTaken(lost, absorbed)),
  });
}

// quem sobrevive ao tiro entra em alerta no proximo passo (detection cheia)
export function damageEnemy(
  world: World,
  enemy: Enemy,
  damage: number,
  source: 'stab' | 'critical' | 'shot' | 'headshot' | 'execution' | 'overkill',
): void {
  const dealt = Math.min(damage, enemy.hp);
  // um golpe so, de vida cheia a zero
  const oneHit = enemy.hp === ENEMY_KINDS[enemy.kind].hp && damage >= enemy.hp;
  addFloater(
    world,
    enemy.pos,
    dealt,
    false,
    // critico da espada mostra o proprio destaque, mesmo matando de uma vez.
    // overkill: execucao furtiva, ou qualquer golpe que leva a vida cheia a
    // zero de uma vez (vale mais que o destaque de headshot)
    source === 'critical'
      ? 'critical'
      : source === 'overkill' || oneHit
        ? 'overkill'
        : source === 'headshot'
          ? 'headshot'
          : undefined,
  );
  world.run.stats.damageDealt += dealt;
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) =>
      source === 'overkill'
        ? t.events.overkill(dealt)
        : source === 'execution'
          ? t.events.execution(dealt)
          : t.events.hit(t.events.source[source], dealt),
    ),
  });
  enemy.hp -= damage;
  if (enemy.hp > 0) {
    enemy.detection = 1;
    return;
  }
  killEnemy(world, enemy);
  if (!oneHit) return;
  // voa para longe do player e cai de frente nessa direcao (enemy.system)
  enemy.launch = LAUNCH_TIME;
  enemy.facing = angleTo(world.player.pos, enemy.pos);
}

// fracao do dano que sobra depois da distancia percorrida pela bala
function rangeFalloff(bullet: Projectile): number {
  const far =
    (bullet.travelled / bullet.range - FALLOFF_START) / (1 - FALLOFF_START);
  return 1 - Math.min(1, Math.max(0, far)) * (1 - FALLOFF_MIN);
}

// sorteio proprio de cada ataque, feito quando ele comeca: no golpe de espada
// e no disparo de cada bala (nao no impacto)
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

// quem o golpe pegaria agora: o desavisado mais perto ao alcance, senao o
// mais perto. Espada alcanca SWORD_RANGE; a facada de quem esta com arma de
// fogo, MELEE_RANGE
export function meleeTarget(world: World): Enemy | undefined {
  const close = enemiesInReach(
    world,
    world.player.weapon ? MELEE_RANGE : SWORD_RANGE,
  );
  return close.find((e) => e.state !== 'alert') ?? close[0];
}

// Sem arma de fogo, encostado em alguem: golpe de espada automatico
// (desavisado morre na hora, em alerta leva SWORD_DAMAGE).
// Com arma de fogo: atira sozinho no mais proximo, menos em quem esta ao
// alcance da espada. Ali nada e automatico: espera `knife` (pulso do F) e
// golpeia, sem gastar municao.
export function updateCombat(world: World, dt: number, knife = false): void {
  if (world.run.seconds >= world.run.nextMeleeChanceAt) {
    const peak = nextRandom(world) < MELEE_MISS_PEAK_RATE;
    world.run.meleeMissChance = peak
      ? MELEE_MISS_PEAK_BASE + nextRandom(world) * MELEE_MISS_PEAK_SWING
      : MELEE_MISS_BASE + nextRandom(world) * MELEE_MISS_BASE_SWING;
    world.run.nextMeleeChanceAt = world.run.seconds + MELEE_MISS_INTERVAL;
    world.run.events.push({
      at: world.run.seconds,
      ...eventText((t) =>
        t.events.missChance(Math.round(world.run.meleeMissChance * 100), peak),
      ),
    });
  }
  const player = world.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.slash = Math.max(0, player.slash - dt);
  player.focus = Math.max(0, player.focus - dt);
  player.clash = Math.max(0, player.clash - dt);
  player.shot = Math.max(0, player.shot - dt);
  if (player.attackCooldown > 0) return;

  const struck = meleeTarget(world);
  const unaware = struck?.state !== 'alert' ? struck : undefined;
  // armado e sem F: nem esfaqueia nem atira a queima-roupa
  if (struck && player.weapon && !knife) return;
  if (struck) {
    player.facing = angleTo(player.pos, struck.pos);
    player.slash = SLASH_TIME;
    player.attackCooldown = ATTACK_COOLDOWN;
    world.run.stats.meleeAttempts++;
    if (nextRandom(world) < world.run.meleeMissChance) {
      struck.detection = 1;
      addFloater(world, struck.pos, 0);
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) => t.events.stabMissed),
      });
      return;
    }
    world.run.stats.meleeHits++;
    // execucao tira toda a vida que restava
    if (unaware) {
      // overkill: a execucao veio agachado e pelas costas do inimigo
      const behind =
        Math.abs(angleDiff(unaware.facing, angleTo(unaware.pos, player.pos))) >
        STEALTH_BACK_ANGLE;
      damageEnemy(
        world,
        unaware,
        unaware.hp,
        player.crouching && behind ? 'overkill' : 'execution',
      );
    } else {
      // critico: mais provavel com o foco do F, que este golpe gasta
      const damage = attackDamage(world, SWORD_DAMAGE);
      const critical =
        nextRandom(world) <
        (player.focus > 0 ? SWORD_CRIT_FOCUS : SWORD_CRIT_CHANCE);
      player.focus = 0;
      damageEnemy(
        world,
        struck,
        critical ? damage * SWORD_CRIT_MULT : damage,
        critical ? 'critical' : 'stab',
      );
    }
    return;
  }

  // sem bala a arma fica na mao, mas nao atira
  if (!player.weapon || player.weapon.ammo <= 0) return;
  const item = ITEMS[player.weapon.id];
  const target = enemiesInReach(world, item.range)[0];
  if (!target) return;

  const aim = angleTo(player.pos, target.pos);
  player.facing = aim;
  for (let i = 0; i < item.pellets; i++) {
    const offset =
      item.pellets === 1 ? 0 : (i / (item.pellets - 1) - 0.5) * item.spread;
    // cada bala sorteia o proprio headshot no disparo
    const headshot = nextRandom(world) < player.headshot;
    spawnProjectile(
      world,
      'player',
      player.pos,
      aim + offset,
      PLAYER_BULLET_SPEED,
      attackDamage(world, item.damage) * (headshot ? HEADSHOT_MULT : 1),
      item.range,
      player.weapon.id,
      undefined,
      headshot,
    ).by = player.id;
  }
  world.run.stats.projectilesFired += item.pellets;
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) => t.events.shot(t.shop.items[item.id])),
  });
  player.attackCooldown = ATTACK_COOLDOWN;
  player.shot = SHOT_TIME;
  if (player.weapon.id !== 'silenced') gunshot(world);
  player.weapon.ammo--;
}

// onde esta o inimigo que disparou; sem ele (sumiu com a sala), a bala
function shooterPos(world: World, bullet: Projectile): Vec2 {
  return world.enemies.find((e) => e.id === bullet.shooter)?.pos ?? bullet.pos;
}

// anda as balas e resolve contato: parede some, personagem leva dano
export function updateProjectiles(world: World, dt: number): void {
  const focus = world.player;
  world.projectiles = world.projectiles.filter((bullet) => {
    // quem leva ou causa o dano fica em foco ate o fim da bala
    world.player = focus;
    bullet.pos.x += bullet.vel.x * dt;
    bullet.pos.y += bullet.vel.y * dt;
    bullet.life -= dt;
    bullet.travelled += Math.hypot(bullet.vel.x, bullet.vel.y) * dt;
    if (bullet.life <= 0 || isWall(world, bullet.pos.x, bullet.pos.y)) {
      // bala que acabou sem acertar ninguem. A do inimigo avisa sobre quem
      // atirou
      if (bullet.owner === 'player') addFloater(world, bullet.pos, 0);
      else addFloater(world, shooterPos(world, bullet), 0, true);
      return false;
    }
    // caixa segura a bala e quebra
    if (breakPropAt(world, bullet.pos.x, bullet.pos.y)) return false;
    if (bullet.owner === 'enemy') {
      const struck = world.players.find(
        (player) =>
          player.hp > 0 &&
          distance(bullet.pos, player.pos) <= PLAYER_RADIUS + BULLET_RADIUS,
      );
      if (!struck) return true;
      world.player = struck;
      damagePlayer(
        world,
        bullet.damage,
        shooterPos(world, bullet),
        bullet.critical,
      );
      return false;
    }
    const hit = world.enemies.find(
      (e) =>
        e.state !== 'dead' &&
        distance(bullet.pos, e.pos) <= ENEMY_RADIUS + BULLET_RADIUS,
    );
    if (!hit) return true;
    // a morte (adrenalina, direcao do lancamento) conta para quem atirou
    world.player = world.players[bullet.by ?? focus.id] ?? focus;
    world.run.stats.projectilesHit++;
    damageEnemy(
      world,
      hit,
      Math.max(1, Math.round(bullet.damage * rangeFalloff(bullet))),
      bullet.headshot ? 'headshot' : 'shot',
    );
    return false;
  });
  world.player = focus;
}

export function collectPickups(world: World): void {
  const player = world.player;
  world.pickups = world.pickups.filter((pickup) => {
    if (distance(player.pos, pickup.pos) > PICKUP_RADIUS) return true;
    if (pickup.kind === 'money') {
      player.money += pickup.value;
      world.run.earned += pickup.value;
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) => t.events.money(pickup.value)),
      });
      return false;
    }
    // ficha de revive: guarda ate REVIVE_MAX; no teto, fica no chao
    if (pickup.kind === 'revive') {
      if (world.run.revives >= REVIVE_MAX) return true;
      world.run.revives += pickup.value;
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) =>
          t.events.reviveCollected(world.run.revives, REVIVE_MAX),
        ),
      });
      return false;
    }
    // mira: soma pontos percentuais no headshot; no teto, fica no chao
    if (pickup.kind === 'headshot') {
      if (player.headshot >= HEADSHOT_MAX) return true;
      player.headshot = Math.min(
        HEADSHOT_MAX,
        Math.round(player.headshot * 100 + pickup.value) / 100,
      );
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) => t.events.aim(Math.round(player.headshot * 100))),
      });
      return false;
    }
    // invisibilidade e invencibilidade: renova o tempo, nunca encurta o que
    // ja tem
    if (pickup.kind === 'invisibility' || pickup.kind === 'invincibility') {
      const stat = pickup.kind === 'invisibility' ? 'invisible' : 'invincible';
      if (pickup.value > player[stat]) {
        player[stat] = pickup.value;
        player[`${stat}Total`] = pickup.value;
      }
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) => t.events[stat](Math.round(pickup.value))),
      });
      return false;
    }
    // municao: completa a arma na mao; se ela esta cheia (ou a mao esta com a
    // espada), a primeira do arsenal com espaco. Sem nenhuma, fica no chao
    if (pickup.kind === 'ammo') {
      const weapon = [player.weapon, ...player.arsenal].find(
        (owned) => owned && owned.ammo < ITEMS[owned.id].ammo,
      );
      if (!weapon) return true;
      const gained = Math.min(
        ITEMS[weapon.id].ammo - weapon.ammo,
        pickup.value,
      );
      weapon.ammo += gained;
      world.run.events.push({
        at: world.run.seconds,
        ...eventText((t) => t.events.ammo(t.shop.items[weapon.id], gained)),
      });
      return false;
    }
    // coracao, escudo e salto ficam no chao enquanto nao servem para nada
    const { stat, cap, label } = (
      {
        heart: {
          stat: 'hp',
          cap: player.maxHp,
          label: 'recoveredHealth',
        },
        shield: {
          stat: 'shield',
          cap: Math.round(player.maxHp * SHIELD_MAX),
          label: 'collectedShield',
        },
        dash: {
          stat: 'dashes',
          cap: DASH_MAX,
          label: 'recoveredDashes',
        },
      } as const
    )[pickup.kind];
    if (player[stat] >= cap) return true;
    const gained = Math.min(cap - player[stat], pickup.value);
    player[stat] += gained;
    if (pickup.kind === 'heart') world.run.stats.healthRecovered += gained;
    world.run.events.push({
      at: world.run.seconds,
      ...eventText((t) => t.events.collected(t.events[label], gained)),
    });
    return false;
  });
}
