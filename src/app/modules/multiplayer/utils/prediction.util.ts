import { movePlayer } from '@/app/modules/player/systems/player.system';
import type {
  InputState,
  Vec2,
  World,
} from '@/app/modules/world/types/world.types';

// O convidado recebe o mundo do host algumas vezes por segundo e com atraso.
// Desenhar so isso da a sensacao de travar: o proprio boneco responde tarde e
// tudo anda aos soquinhos. Aqui o convidado adianta o que da para adiantar
// entre um estado e outro:
// - o proprio jogador anda na hora, pelo input local (previsao), e a cada
//   estado do host e corrigido e os ultimos inputs sao reaplicados;
// - os outros jogadores, inimigos e balas seguem em linha reta na velocidade
//   em que vinham (extrapolacao), por pouco tempo.
// E so visual e so no convidado: quem decide o jogo continua sendo o host.

// quanto tempo de inputs locais fica guardado para reaplicar
const HISTORY_MAX = 0.6;
// sem estado novo por mais que isso, para de adiantar os outros (rede caiu)
const EXTRAPOLATE_MAX = 0.15;
// salto maior que isso entre dois estados e teleporte, nao velocidade
const TELEPORT_SPEED = 20;

export type Prediction = {
  // inputs locais recentes, do mais antigo ao mais novo
  history: { input: InputState; dt: number }[];
  // posicao de cada um no ultimo estado do host, por chave
  last: Map<string, Vec2>;
  velocity: Map<string, Vec2>;
  // segundos desde o ultimo estado do host
  sinceState: number;
};

export function createPrediction(): Prediction {
  return { history: [], last: new Map(), velocity: new Map(), sinceState: 0 };
}

// jogadores (menos o local) e inimigos vivos, com a chave de cada um
function others(world: World): [key: string, pos: Vec2][] {
  return [
    ...world.players
      .filter((player) => player !== world.player && player.hp > 0)
      .map((player): [string, Vec2] => [`p${player.id}`, player.pos]),
    ...world.enemies
      .filter((enemy) => enemy.state !== 'dead' || enemy.launch > 0)
      .map((enemy): [string, Vec2] => [`e${enemy.id}`, enemy.pos]),
  ];
}

// quem esta livre para andar: vivo e fora da loja e do bau de revive
function canMove(world: World): boolean {
  const { player } = world;
  return (
    world.status === 'playing' &&
    player.hp > 0 &&
    !player.shopping &&
    !player.reviving
  );
}

// Passo local do convidado: adianta o proprio jogador e os outros.
export function predictStep(
  world: World,
  input: InputState,
  dt: number,
  prediction: Prediction,
): void {
  prediction.history.push({ input: { ...input }, dt });
  let kept = 0;
  for (let i = prediction.history.length - 1; i >= 0; i--) {
    kept += prediction.history[i].dt;
    if (kept > HISTORY_MAX) {
      prediction.history.splice(0, i);
      break;
    }
  }
  if (canMove(world)) movePlayer(world, input, dt);

  prediction.sinceState += dt;
  for (const bullet of world.projectiles) {
    bullet.pos.x += bullet.vel.x * dt;
    bullet.pos.y += bullet.vel.y * dt;
  }
  if (prediction.sinceState > EXTRAPOLATE_MAX) return;
  for (const [key, pos] of others(world)) {
    const velocity = prediction.velocity.get(key);
    if (!velocity) continue;
    pos.x += velocity.x * dt;
    pos.y += velocity.y * dt;
  }
}

// Chegou estado do host (`world` ja e o mundo novo). Mede a velocidade dos
// outros pelo quanto andaram desde o estado anterior e refaz a previsao do
// proprio jogador: o host esta `rtt` segundos atras do que o convidado ja
// apertou, entao os inputs locais desse intervalo sao reaplicados em cima da
// posicao que ele mandou.
export function reconcile(
  world: World,
  prediction: Prediction,
  rtt: number,
): void {
  const elapsed = Math.max(prediction.sinceState, 1 / 60);
  const last = new Map<string, Vec2>();
  prediction.velocity.clear();
  for (const [key, pos] of others(world)) {
    last.set(key, { ...pos });
    const before = prediction.last.get(key);
    if (!before) continue;
    const velocity = {
      x: (pos.x - before.x) / elapsed,
      y: (pos.y - before.y) / elapsed,
    };
    if (Math.hypot(velocity.x, velocity.y) < TELEPORT_SPEED) {
      prediction.velocity.set(key, velocity);
    }
  }
  prediction.last = last;
  prediction.sinceState = 0;

  if (!canMove(world)) return;
  // do mais novo para tras ate cobrir `rtt`; reaplica na ordem em que foram
  let covered = 0;
  let from = prediction.history.length;
  // (meio passo de folga: soma de passos em ponto flutuante nao fecha exato)
  while (from > 0 && covered + prediction.history[from - 1].dt / 2 < rtt) {
    covered += prediction.history[--from].dt;
  }
  for (const { input, dt } of prediction.history.slice(from)) {
    movePlayer(world, input, dt);
  }
}
