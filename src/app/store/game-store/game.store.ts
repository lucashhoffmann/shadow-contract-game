import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  buyItem,
  closeShop as closeWorldShop,
} from '@/app/modules/shop/systems/shop.system';
import {
  createWorld,
  stepWorld,
} from '@/app/modules/world/systems/world.system';
import type {
  InputState,
  ItemId,
  WeaponId,
  World,
  WorldStatus,
} from '@/app/modules/world/types/world.types';

// Contrato em docs/contracts.md (secao Store).

export type Screen = 'menu' | 'playing' | 'shop' | 'gameover';

export type Hud = {
  hp: number;
  maxHp: number;
  money: number;
  room: number;
  kills: number;
  weaponId: WeaponId | null;
  ammo: number;
};

type GameStore = {
  screen: Screen;
  hud: Hud;
  best: number;
  startRun: (seed?: number) => void;
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
  playing: 'playing',
  shop: 'shop',
  dead: 'gameover',
};

// World e input do joystick ficam fora do estado reativo: mudam a 60 Hz e so
// a engine precisa deles a cada frame
let world: World | null = null;

export const joystickInput: InputState = { moveX: 0, moveY: 0 };

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
          (Object.keys(hud) as (keyof Hud)[]).some(
            (key) => hud[key] !== prev.hud[key],
          );
        if (changed) set({ hud, screen, best: Math.max(prev.best, hud.room) });
      };

      return {
        screen: 'menu',
        hud: EMPTY_HUD,
        best: 0,
        startRun: (seed = Date.now()) => {
          world = createWorld(seed);
          setJoystickInput(0, 0);
          set({ screen: 'playing', hud: readHud(world) });
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
    { name: 'shadow-contract', partialize: (state) => ({ best: state.best }) },
  ),
);
