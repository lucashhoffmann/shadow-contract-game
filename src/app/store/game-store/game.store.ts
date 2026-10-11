import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
import type {
  InputState,
  ItemId,
  Market,
  WeaponId,
  World,
  WorldStatus,
} from '@/app/modules/world/types/world.types';

// Contrato em docs/contracts.md (secao Store).

export type Screen =
  'menu' | 'character' | 'intro' | 'playing' | 'paused' | 'shop' | 'gameover';

export type Hud = {
  hp: number;
  maxHp: number;
  money: number;
  room: number;
  kills: number;
  weaponId: WeaponId | null;
  ammo: number;
};

// aparencia do player: so visual, nao entra no World
export type PlayerLook = {
  cloth: string; // cores em '#rrggbb'
  accent: string;
  skin: string;
  head: number; // escalas, 1 = padrao
  legs: number;
  hands: number;
};

export const LOOK_SCALE = { min: 0.7, max: 1.4 };

export const DEFAULT_LOOK: PlayerLook = {
  cloth: '#ff8a3c',
  accent: '#1c1c28',
  skin: '#e8b796',
  head: 1,
  legs: 1,
  hands: 1,
};

export const DEFAULT_BLOOD_COLOR = '#a61020';

const COLOR = /^#[0-9a-f]{6}$/i;

// descarta cor invalida e prende escala na faixa
function mergeLook(look: PlayerLook, patch: Partial<PlayerLook>): PlayerLook {
  const next = { ...look };
  for (const key of ['cloth', 'accent', 'skin'] as const) {
    const value = patch[key];
    if (value && COLOR.test(value)) next[key] = value;
  }
  for (const key of ['head', 'legs', 'hands'] as const) {
    const value = patch[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = Math.min(LOOK_SCALE.max, Math.max(LOOK_SCALE.min, value));
    }
  }
  return next;
}

type GameStore = {
  screen: Screen;
  hud: Hud;
  market: Market;
  best: number;
  look: PlayerLook;
  bloodColor: string;
  setLook: (patch: Partial<PlayerLook>) => void;
  setBloodColor: (color: string) => void;
  openCharacter: () => void;
  startRun: (seed?: number) => void;
  begin: () => void;
  togglePause: () => void;
  tick: (input: InputState, dt: number) => void;
  buy: (id: ItemId) => void;
  closeShop: () => void;
  backToMenu: () => void;
};

const EMPTY_HUD: Hud = {
  hp: 0,
  maxHp: 0,
  money: 0,
  room: 0,
  kills: 0,
  weaponId: null,
  ammo: 0,
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

export const joystickInput: InputState = { moveX: 0, moveY: 0, dash: false };

export function getWorld(): World | null {
  return world;
}

export function setJoystickInput(moveX: number, moveY: number): void {
  joystickInput.moveX = moveX;
  joystickInput.moveY = moveY;
}

function readHud(w: World): Hud {
  return {
    hp: Math.max(0, w.player.hp),
    maxHp: w.player.maxHp,
    money: w.run.money,
    room: w.run.roomIndex,
    kills: w.run.kills,
    weaponId: w.player.weapon?.id ?? null,
    ammo: w.player.weapon?.ammo ?? 0,
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      // so chama set quando algo visivel mudou, para a UI nao renderizar a 60 Hz
      const sync = () => {
        if (!world) return;
        const hud = readHud(world);
        const screen = SCREEN_BY_STATUS[world.status];
        const prev = get();
        const changed =
          screen !== prev.screen ||
          world.market !== prev.market ||
          (Object.keys(hud) as (keyof Hud)[]).some(
            (key) => hud[key] !== prev.hud[key],
          );
        if (!changed) return;
        set({
          hud,
          screen,
          market: world.market,
          best: Math.max(prev.best, hud.room),
        });
      };

      return {
        screen: 'menu',
        hud: EMPTY_HUD,
        market: createMarket(),
        best: 0,
        look: DEFAULT_LOOK,
        bloodColor: DEFAULT_BLOOD_COLOR,
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
        // toda run abre na legenda; `begin` solta a simulacao
        startRun: (seed = Date.now()) => {
          world = createWorld(seed);
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
          if (!world) return;
          toggleWorldPause(world);
          sync();
        },
        tick: (input, dt) => {
          if (!world || world.status !== 'playing') return;
          stepWorld(world, input, dt);
          sync();
        },
        buy: (id) => {
          if (world && buyItem(world, id)) sync();
        },
        closeShop: () => {
          if (!world) return;
          closeWorldShop(world);
          sync();
        },
        backToMenu: () => {
          world = null;
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
      }),
      // valor salvo passa pela mesma validacao de `setLook`
      merge: (saved, current) => {
        const { best, look, bloodColor } = (saved ?? {}) as Partial<GameStore>;
        return {
          ...current,
          best: best ?? current.best,
          look: mergeLook(current.look, look ?? {}),
          bloodColor:
            typeof bloodColor === 'string' && COLOR.test(bloodColor)
              ? bloodColor
              : current.bloodColor,
        };
      },
    },
  ),
);
