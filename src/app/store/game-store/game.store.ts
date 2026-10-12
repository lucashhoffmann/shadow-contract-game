import { COLORS } from '@/shared/colors';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  cycleWeapon as cycleWorldWeapon,
  selectWeapon as selectWorldWeapon,
} from '@/app/modules/player/systems/player.system';
import {
  createMultiWorld,
  type Seat,
  stepMultiWorld,
} from '@/app/modules/multiplayer/systems/multiplayer.system';
import {
  applySnapshot,
  cleanInput,
  clearPulses,
  encodeSnapshot,
  mergeInput,
  roomsKey,
  type Snapshot,
} from '@/app/modules/multiplayer/utils/snapshot.util';
import { setRoomSize } from '@/app/modules/world/constants/world.constants';
import {
  buyItem,
  closeShop as closeWorldShop,
  createMarket,
} from '@/app/modules/shop/systems/shop.system';
import {
  beginRun,
  createWorld,
  stepWorld,
  togglePause as toggleWorldPause,
} from '@/app/modules/world/systems/world.system';
import { eventText } from '@/shared/i18n';
import type {
  AttackVariance,
  EnemyIntelligence,
  InputState,
  ItemId,
  Market,
  Weapon,
  WeaponId,
  World,
  WorldStatus,
} from '@/app/modules/world/types/world.types';

// Contrato em docs/contracts.md (secao Store).

export type Screen =
  | 'menu'
  | 'character'
  | 'lobby'
  | 'intro'
  | 'playing'
  | 'paused'
  | 'shop'
  | 'gameover';

// Ligacao de uma partida multiplayer com a rede (session.store). O host
// simula e manda o estado; o convidado manda o proprio input.
export type MultiLink = {
  host: boolean;
  // posicao do jogador local em `world.players`
  you: number;
  sendState: (snapshot: Snapshot) => void;
  sendInput: (input: InputState) => void;
  // sair da sessao: chamado quando o jogador volta ao menu
  leave: () => void;
};

export type Hud = {
  hp: number;
  maxHp: number;
  shield: number;
  // saltos guardados, de 0 a DASH_MAX
  dashes: number;
  // fichas de revive guardadas, de 0 a REVIVE_MAX
  revives: number;
  money: number;
  room: number;
  kills: number;
  weaponId: WeaponId | null;
  ammo: number;
  // chance de headshot das balas, em porcentagem inteira
  headshot: number;
};

// linha do placar: um jogador da partida
export type Score = {
  id: number;
  name: string;
  color: string | null;
  kills: number;
  deaths: number;
  alive: boolean;
  // e o jogador deste navegador
  you: boolean;
};

// aparencia do player: so visual, nao entra no World
export type PlayerLook = {
  cloth: string; // cores em '#rrggbb'
  accent: string;
  skin: string;
  head: number; // escalas, 1 = padrao
  legs: number;
  hands: number;
  feet: number;
  // espada e armas de fogo na mao; faixa propria (WEAPON_SCALE)
  weapon: number;
};

export const LOOK_SCALE = { min: 0.7, max: 1.4 };
export const WEAPON_SCALE = { min: 0.4, max: 1.4 };

export const DEFAULT_LOOK: PlayerLook = {
  cloth: COLORS.ui.playerOrange,
  accent: COLORS.ui.charcoal,
  skin: COLORS.ui.skinDefault,
  // inimigos usam 1: o player comeca so um pouco maior, para se destacar
  head: 1.1,
  legs: 1,
  hands: 1,
  feet: 1,
  weapon: 1,
};

export const DEFAULT_BLOOD_COLOR = COLORS.ui.bloodDefault;

const COLOR = /^#[0-9a-f]{6}$/i;

function validIntelligence(saved: unknown): Record<number, EnemyIntelligence> {
  const levels: Record<number, EnemyIntelligence> = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved))
    return levels;
  for (const [key, value] of Object.entries(saved)) {
    const level = Number(key);
    if (!Number.isSafeInteger(level) || level < 1 || level > 1000) continue;
    if (!value || typeof value !== 'object') continue;
    const profile = value as Partial<EnemyIntelligence>;
    const hearingThreshold =
      profile.hearingThreshold === undefined ? 1 : profile.hearingThreshold;
    if (
      [profile.hearing, profile.pursuit, profile.dash].every(
        (number) => typeof number === 'number' && number >= 1 && number <= 3,
      ) &&
      typeof hearingThreshold === 'number' &&
      hearingThreshold >= 0.6 &&
      hearingThreshold <= 1
    ) {
      levels[level] = {
        hearing: profile.hearing!,
        hearingThreshold,
        pursuit: profile.pursuit!,
        dash: profile.dash!,
      };
    }
  }
  return levels;
}

function validAttackVariance(saved: unknown): AttackVariance | null {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const { min, max } = saved as Partial<AttackVariance>;
  return typeof min === 'number' &&
    min >= 1 &&
    min <= 1.1 &&
    typeof max === 'number' &&
    max >= 1.4 &&
    max <= 1.5
    ? { min, max }
    : null;
}

// descarta cor invalida e prende escala na faixa
function mergeLook(look: PlayerLook, patch: Partial<PlayerLook>): PlayerLook {
  const next = { ...look };
  for (const key of ['cloth', 'accent', 'skin'] as const) {
    const value = patch[key];
    if (value && COLOR.test(value)) next[key] = value;
  }
  for (const key of ['head', 'legs', 'hands', 'feet', 'weapon'] as const) {
    const value = patch[key];
    const range = key === 'weapon' ? WEAPON_SCALE : LOOK_SCALE;
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = Math.min(range.max, Math.max(range.min, value));
    }
  }
  return next;
}

type GameStore = {
  screen: Screen;
  hud: Hud;
  // armas de fogo da run, em ordem; copia do `World` para a UI
  arsenal: Weapon[];
  market: Market;
  best: number;
  look: PlayerLook;
  bloodColor: string;
  idleWarnings: number;
  // placar da partida, um por jogador
  scores: Score[];
  // placar aberto (Tab segurado ou icone)
  scoreboard: boolean;
  // partida em rede e papel deste navegador nela
  online: boolean;
  host: boolean;
  // menu da partida em rede aberto; o jogo continua por baixo
  menu: boolean;
  setScoreboard: (open: boolean) => void;
  // host: acaba a partida para todos e mostra o resultado
  endMatch: () => void;
  // host: depois da derrota, comeca outra partida com os mesmos jogadores
  restartMatch: () => void;
  // em rede: o jogador local esta escolhendo quem reviver no bau
  reviving: boolean;
  // escolhe quem reviver (`player.id`)
  revive: (id: number) => void;
  intelligence: Record<number, EnemyIntelligence>;
  attackVariance: AttackVariance | null;
  setLook: (patch: Partial<PlayerLook>) => void;
  setBloodColor: (color: string) => void;
  openCharacter: () => void;
  openLobby: () => void;
  // partida multiplayer: `seats[i]` vira `world.players[i]`
  startMulti: (seats: Seat[], link: MultiLink, seed?: number) => void;
  // host: chegou input do jogador `index`
  receiveInput: (index: number, payload: unknown) => void;
  // convidado: chegou o estado do mundo
  receiveState: (snapshot: Snapshot) => void;
  startRun: (seed?: number) => void;
  begin: () => void;
  togglePause: () => void;
  tick: (input: InputState, dt: number) => void;
  buy: (id: ItemId) => void;
  selectWeapon: (id: WeaponId | null) => void;
  cycleWeapon: () => void;
  closeShop: () => void;
  backToMenu: () => void;
};

const EMPTY_HUD: Hud = {
  hp: 0,
  maxHp: 0,
  shield: 0,
  dashes: 0,
  revives: 0,
  money: 0,
  room: 0,
  kills: 0,
  weaponId: null,
  ammo: 0,
  headshot: 0,
};

const SCREEN_BY_STATUS: Record<WorldStatus, Screen> = {
  intro: 'intro',
  playing: 'playing',
  paused: 'paused',
  shop: 'shop',
  dead: 'gameover',
};

// World e input do joystick ficam fora do estado reativo: mudam a 60 Hz e so
// a engine precisa deles a cada frame
let world: World | null = null;

// partida multiplayer em andamento; null no solo
let multi:
  | (MultiLink & {
      // host: ultimo input de cada jogador, pela posicao em `players`
      inputs: (InputState | undefined)[];
      ticks: number;
      // chave das salas ja enviadas (snapshot.util)
      sentRooms: string;
      // convidado: ultimo input enviado, para nao repetir
      sentInput: string;
      // lugares da partida, para o host recomecar com os mesmos
      seats: Seat[];
      // acoes do jogador local a mandar no proximo passo (loja, revive, arma)
      actions: Partial<InputState>;
    })
  | null = null;
// o host manda o estado a cada tantos passos: 60 / 3 = 20 vezes por segundo
const SNAPSHOT_EVERY = 3;

export const joystickInput: InputState = { moveX: 0, moveY: 0, dash: false };

export function getWorld(): World | null {
  return world;
}

export function setJoystickInput(moveX: number, moveY: number): void {
  joystickInput.moveX = moveX;
  joystickInput.moveY = moveY;
}

// botao de salto na tela de toque: vale como segurar o Espaco
export function setJoystickDash(pressed: boolean): void {
  joystickInput.dash = pressed;
}

// botao de agachar na tela de toque: liga/desliga, vale como segurar o C
export function setJoystickCrouch(on: boolean): void {
  joystickInput.crouch = on;
}

function readHud(w: World): Hud {
  return {
    hp: Math.max(0, w.player.hp),
    maxHp: w.player.maxHp,
    shield: w.player.shield,
    dashes: w.player.dashes,
    revives: w.run.revives,
    money: w.player.money,
    room: w.run.roomIndex,
    kills: w.run.kills,
    weaponId: w.player.weapon?.id ?? null,
    ammo: w.player.weapon?.ammo ?? 0,
    headshot: Math.round(w.player.headshot * 100),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      // so chama set quando algo visivel mudou, para a UI nao renderizar a 60 Hz
      // assinatura do arsenal ja publicado: so copia de novo quando muda
      let arsenalKey = '';
      // assinatura do placar ja publicado
      let sentScores = '';
      const sync = () => {
        if (!world) return;
        const hud = readHud(world);
        const key = world.player.arsenal
          .map((weapon) => `${weapon.id}:${weapon.ammo}`)
          .join();
        // em rede a loja e de cada um: abre so para quem esta nela
        const screen =
          world.status === 'playing' && world.player.shopping
            ? 'shop'
            : SCREEN_BY_STATUS[world.status];
        const scoreKey = world.players
          .map((p) => `${p.kills}/${p.deaths}/${p.hp > 0}`)
          .join();
        const prev = get();
        const changed =
          screen !== prev.screen ||
          key !== arsenalKey ||
          world.market !== prev.market ||
          world.intelligence !== prev.intelligence ||
          world.run.attackVariance !== prev.attackVariance ||
          world.run.idleWarnings !== prev.idleWarnings ||
          scoreKey !== sentScores ||
          world.player.reviving !== prev.reviving ||
          (Object.keys(hud) as (keyof Hud)[]).some(
            (key) => hud[key] !== prev.hud[key],
          );
        if (!changed) return;
        if (scoreKey !== sentScores) {
          sentScores = scoreKey;
          const you = world.player;
          set({
            scores: world.players.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              kills: p.kills,
              deaths: p.deaths,
              alive: p.hp > 0,
              you: p === you,
            })),
          });
        }
        if (key !== arsenalKey) {
          arsenalKey = key;
          set({
            arsenal: world.player.arsenal.map((weapon) => ({ ...weapon })),
          });
        }
        set({
          hud,
          screen,
          market: world.market,
          intelligence: world.intelligence,
          attackVariance: world.run.attackVariance,
          idleWarnings: world.run.idleWarnings,
          // fim de partida fecha o menu
          menu: screen === 'playing' && prev.menu,
          reviving: world.player.reviving,
          // recorde e do solo: sala de multiplayer nao conta
          best: multi ? prev.best : Math.max(prev.best, hud.room),
        });
      };
      // host: manda o mundo para os convidados
      const publish = () => {
        if (!world || !multi) return;
        multi.sendState(encodeSnapshot(world, multi.sentRooms));
        multi.sentRooms = roomsKey(world);
      };

      return {
        screen: 'menu',
        hud: EMPTY_HUD,
        arsenal: [],
        market: createMarket(),
        best: 0,
        look: DEFAULT_LOOK,
        bloodColor: DEFAULT_BLOOD_COLOR,
        idleWarnings: 0,
        scores: [],
        scoreboard: false,
        online: false,
        host: false,
        menu: false,
        setScoreboard: (open) => {
          if (open !== get().scoreboard) set({ scoreboard: open });
        },
        reviving: false,
        revive: (id) => {
          if (multi) multi.actions.revive = id;
        },
        restartMatch: () => {
          if (!multi?.host || world?.status !== 'dead') return;
          world = createMultiWorld(Date.now(), multi.seats);
          multi.inputs = [];
          multi.sentRooms = '';
          sentScores = '';
          publish();
          sync();
        },
        endMatch: () => {
          if (!world || !multi?.host || world.status !== 'playing') return;
          world.status = 'dead';
          world.run.events.push({
            at: world.run.seconds,
            ...eventText((t) => t.match.ended),
          });
          publish();
          sync();
        },
        intelligence: {},
        attackVariance: null,
        // so antes da run: a engine le `look` uma vez, ao criar o renderer
        setLook: (patch) => {
          if (world) return;
          set({ look: mergeLook(get().look, patch) });
        },
        setBloodColor: (color) => {
          if (COLOR.test(color)) set({ bloodColor: color });
        },
        openCharacter: () => {
          if (!world) set({ screen: 'character' });
        },
        openLobby: () => {
          if (!world) set({ screen: 'lobby' });
        },
        // sem legenda nem pausa: comeca valendo para todos ao mesmo tempo
        startMulti: (seats, link, seed = Date.now()) => {
          multi = {
            ...link,
            inputs: [],
            ticks: 0,
            sentRooms: '',
            sentInput: '',
            seats,
            actions: {},
          };
          sentScores = '';
          set({ online: true, host: link.host, menu: false, scores: [] });
          setJoystickInput(0, 0);
          if (link.host) {
            world = createMultiWorld(seed, seats);
            publish();
            sync();
          } else {
            // o mundo chega no primeiro estado do host
            setRoomSize('multi');
            world = null;
            set({ screen: 'playing', hud: EMPTY_HUD, arsenal: [] });
          }
        },
        receiveInput: (index, payload) => {
          const input = cleanInput(payload);
          if (!multi?.host || !input || index <= 0) return;
          multi.inputs[index] = mergeInput(multi.inputs[index], input);
        },
        receiveState: (snapshot) => {
          if (!multi || multi.host) return;
          world = applySnapshot(world, snapshot, multi.you);
          sync();
        },
        // toda run abre na legenda; `begin` solta a simulacao
        startRun: (seed = Date.now()) => {
          multi?.leave();
          multi = null;
          sentScores = '';
          set({ online: false, host: false, menu: false });
          world = createWorld(seed, get().intelligence, get().attackVariance);
          world.status = 'intro';
          setJoystickInput(0, 0);
          sync();
        },
        begin: () => {
          if (!world) return;
          beginRun(world);
          sync();
        },
        togglePause: () => {
          // multiplayer nao pausa, o jogo e de todos: abre o menu por cima
          if (multi) {
            if (get().screen === 'playing') set({ menu: !get().menu });
            return;
          }
          if (!world) return;
          toggleWorldPause(world);
          sync();
        },
        tick: (raw, dt) => {
          // em rede, as acoes de loja, revive e arma viajam junto do input
          const input = multi ? { ...raw, ...multi.actions } : raw;
          if (multi) multi.actions = {};
          if (multi && !multi.host) {
            // convidado nao simula: manda o input quando muda
            const next = JSON.stringify(input);
            if (next !== multi.sentInput) {
              multi.sentInput = next;
              multi.sendInput(input);
            }
            return;
          }
          if (!world || world.status !== 'playing') return;
          if (!multi) {
            stepWorld(world, input, dt);
            sync();
            return;
          }
          multi.inputs[0] = input;
          stepMultiWorld(world, multi.inputs, dt);
          for (let i = 1; i < multi.inputs.length; i++) {
            clearPulses(multi.inputs[i]);
          }
          // o fim da partida vai na hora, sem esperar a vez
          const over = (world.status as WorldStatus) === 'dead';
          if (++multi.ticks % SNAPSHOT_EVERY === 0 || over) publish();
          sync();
        },
        // Em rede quem aplica e o host, no passo: aqui so fica anotado
        // (`multi.actions`) para ir no proximo input.
        buy: (id) => {
          if (multi) multi.actions.buy = id;
          else if (world && buyItem(world, id)) sync();
        },
        selectWeapon: (id) => {
          if (multi) multi.actions.select = id ?? 'sword';
          if (multi || !world) return;
          selectWorldWeapon(world, id);
          sync();
        },
        cycleWeapon: () => {
          if (multi) multi.actions.select = 'next';
          if (multi || !world || world.status !== 'playing') return;
          cycleWorldWeapon(world);
          sync();
        },
        // fecha a loja; em rede, tambem a escolha do bau de revive
        closeShop: () => {
          if (multi) multi.actions.leaveShop = true;
          if (multi || !world) return;
          closeWorldShop(world);
          sync();
        },
        backToMenu: () => {
          multi?.leave();
          multi = null;
          world = null;
          sentScores = '';
          set({ online: false, host: false, menu: false, scoreboard: false });
          set({ screen: 'menu' });
        },
      };
    },
    {
      name: 'shadow-contract',
      partialize: (state) => ({
        best: state.best,
        look: state.look,
        bloodColor: state.bloodColor,
        intelligence: state.intelligence,
        attackVariance: state.attackVariance,
      }),
      // valor salvo passa pela mesma validacao de `setLook`
      merge: (saved, current) => {
        const { best, look, bloodColor, intelligence, attackVariance } =
          (saved ?? {}) as Partial<GameStore>;
        return {
          ...current,
          best: best ?? current.best,
          look: mergeLook(current.look, look ?? {}),
          bloodColor:
            typeof bloodColor === 'string' && COLOR.test(bloodColor)
              ? bloodColor
              : current.bloodColor,
          intelligence: validIntelligence(intelligence),
          attackVariance: validAttackVariance(attackVariance),
        };
      },
    },
  ),
);
