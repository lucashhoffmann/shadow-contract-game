import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const pt = {
  common: {
    menu: 'Menu',
    back: 'Voltar',
    continue: 'Continuar',
    start: 'Comecar',
    room: 'Sala',
    sword: 'Espada',
    bullets: 'balas',
    noBullets: '(sem balas)',
    weapons: 'Armas',
    health: 'Vida',
    shield: 'Escudo',
    pause: 'Pausar',
    crouch: 'Agachar',
    dash: 'Saltar',
    joystick: 'Joystick',
    close: 'Fechar',
  },
  home: {
    record: (best: number) => `Recorde: sala ${best}`,
    play: 'Play',
    character: 'Configurar personagem',
    multiplayer: 'Multiplayer',
    settings: 'Configurações',
    settingsDescription: 'Preferências visuais do jogo.',
    bloodColor: 'Cor do sangue',
    language: 'Idioma',
    instructions:
      'WASD ou setas para andar. Chegue por tras para eliminar. Fique fora do cone de visao.',
    credit: 'Desenvolvido por',
    install: 'Instalar app',
    iosInstall:
      'Para instalar o app: toque em Compartilhar e depois em "Adicionar a Tela de Inicio".',
  },
  character: {
    title: 'Personagem',
    preview: 'Preview do personagem',
    drag: 'Arraste para girar',
    cloth: 'Roupa',
    accent: 'Faixa',
    skin: 'Pele',
    head: 'Cabeca',
    legs: 'Pernas',
    hands: 'Maos',
    feet: 'Pes',
    weapon: 'Arma',
    reset: 'Restaurar padrao',
    weaponPreview: 'Arma no preview',
    weaponNote: 'So para ver como fica. Na run, a arma vem da loja.',
  },
  lobby: {
    yourName: 'Seu nome',
    connecting: 'Conectando...',
    enter: 'Entrar',
    createSession: 'Criar sessao',
    public: 'Publica',
    private: 'Privada',
    joinCode: 'Entrar com codigo',
    publicSessions: 'Sessoes publicas',
    noSessions: 'Nenhuma sessao aberta agora. Crie a sua.',
    joinHost: (name: string) => `Entrar na sessao de ${name}`,
    sessionType: (isPublic: boolean): string =>
      isPublic ? 'Sessao publica' : 'Sessao privada',
    inviteCode: 'Codigo de convite',
    players: 'Jogadores',
    you: ' (voce)',
    playerCount: (count: number, max: number) => `${count}/${max} jogadores.`,
    hostHint: 'Comece quando todos entrarem.',
    guestHint: 'Esperando o host comecar.',
    leave: 'Sair',
    host: 'Host',
    connectionError: 'Nao foi possivel conectar ao servidor de salas.',
    closedError: 'O host saiu: a sessao acabou.',
    errors: {
      name: 'Escreva seu nome.',
      alreadyInSession: 'Voce ja esta em uma sessao.',
      missingSession: 'Sessao nao encontrada.',
      alreadyStarted: 'A partida ja comecou.',
      full: 'Sessao cheia.',
      notInSession: 'Voce nao esta em uma sessao.',
      onlyHost: 'So o host comeca a partida.',
    },
  },
  game: {
    contract: (number: number) => `Contrato ${number}`,
    contractRoom: (room: number, total: number) =>
      `Sala ${room} de ${total} do contrato`,
    dashes: (count: number, max: number) => `Saltos: ${count} de ${max}`,
    bullets: (count: number, max: number) => `Balas: ${count} de ${max}`,
    revives: (count: number) => `Fichas de revive: ${count}`,
    room: (number: number) => `Sala ${number}`,
    paused: 'Pausado',
    howToPlay: 'Como jogar',
    you: 'Voce',
    died: 'morreu!',
    gameOver: (room: number, kills: number, best: number) =>
      `Sala ${room}, ${kills} eliminados. Recorde: sala ${best}.`,
    restart: 'Jogar de novo',
    analysis: 'Ver análise do jogo',
    analysisTitle: 'Análise do jogo',
    analysisDescription: 'Resumo e registro da partida encerrada.',
    time: 'Tempo',
    kills: 'Eliminações',
    attackStrength: 'Força do ataque',
    damageDealt: 'Dano causado',
    stabs: 'Facadas',
    hits: 'Acertos',
    misses: 'Erros',
    projectiles: 'Projéteis',
    shotHits: 'Acertos de tiro',
    shotMisses: 'Erros de tiro',
    healthRecovered: 'Vida recuperada',
    damageTaken: 'Dano sofrido',
    damageBlocked: 'Dano bloqueado',
    moneyCollected: 'Dinheiro coletado',
    shopsVisited: 'Lojas visitadas',
    insights: 'Insights',
    log: 'Registro da partida',
    missedStabs: (count: number) =>
      `${count} facada${count > 1 ? 's' : ''} errada${count > 1 ? 's' : ''} alertaram os alvos.`,
    allStabsHit: 'Todas as facadas acertaram.',
    noStabs: 'Nenhuma facada nesta partida.',
    recovered: (count: number) =>
      `${count} pontos de vida recuperados durante a partida.`,
    noRecovery: 'Nenhuma vida recuperada durante a partida.',
    miss: 'Errou!',
    headshot: 'HEADSHOT',
    overkill: 'OVERKILL',
  },
  shop: {
    title: 'Escolha o equipamento',
    summary: (money: number, inflation: number) =>
      `Vale so para a run atual. Voce tem $ ${money}. Inflacao: +${inflation}%.`,
    bonusHealth: (count: number) => `+${count} de vida`,
    shots: (shots: number, pellets: number) =>
      `${shots} tiros${pellets > 1 ? `, ${pellets} balas` : ''}`,
    refill: (count: number) => `Recarga: +${count} balas`,
    fullAmmo: 'Municao cheia',
    owned: 'voce ja tem',
    items: {
      pistol: 'Pistola',
      silenced: 'Pistola silenciada',
      shotgun: 'Escopeta',
      armor: 'Colete',
    },
  },
  share: {
    generating: 'Gerando...',
    button: 'Compartilhar recorde',
    myRecord: 'MEU RECORDE',
    room: (best: number) => `SALA ${best}`,
    run: (room: number, kills: number) =>
      `Nesta partida: sala ${room}, ${kills} eliminado${kills === 1 ? '' : 's'}`,
    challenge: 'Consegue passar?',
    message: (best: number) => `Cheguei na sala ${best} no Shadow Contract!`,
  },
  events: {
    contractStarted: 'Contrato iniciado.',
    attackVariance: (min: number, max: number) =>
      `Variação de ataque: ${min}% a ${max}% do dano base.`,
    idleEnemies: 'Inatividade: inimigos enviados.',
    reviveUsed: (remaining: number) =>
      `Ficha de revive usada: restam ${remaining}.`,
    contractEnded: (room: number) => `Contrato encerrado na sala ${room}.`,
    roomReached: (room: number) => `Sala ${room} alcancada.`,
    enemyKilled: (ninja: boolean) =>
      `${ninja ? 'Ninja' : 'Inimigo armado'} eliminado.`,
    damageTaken: (lost: number, blocked: number) =>
      lost
        ? `Sofreu ${lost} de dano${blocked ? ` (${blocked} bloqueado pelo escudo)` : ''}.`
        : `Escudo bloqueou ${blocked} de dano.`,
    overkill: (damage: number) =>
      `Overkill: execução agachado pelas costas, ${damage} de dano.`,
    execution: (damage: number) => `Execução furtiva: ${damage} de dano.`,
    hit: (source: string, damage: number) =>
      `${source} acertou: ${damage} de dano.`,
    missChance: (chance: number, peak: boolean) =>
      `Chance de erro: ${chance}%${peak ? ' (pico)' : ''}.`,
    stabMissed: 'Facada errou.',
    shot: (item: string) => `Disparou ${item}.`,
    money: (amount: number) => `Coletou $${amount}.`,
    reviveCollected: (count: number, max: number) =>
      `Ficha de revive: ${count} de ${max}.`,
    aim: (chance: number) => `Mira melhorada: headshot em ${chance}%.`,
    ammo: (item: string, amount: number) =>
      `Coletou municao de ${item}: +${amount}.`,
    recoveredHealth: 'Recuperou vida',
    collectedShield: 'Coletou escudo',
    recoveredDashes: 'Recuperou saltos',
    collected: (item: string, amount: number) => `${item}: +${amount}.`,
    bought: (owned: boolean, item: string, price: number) =>
      `${owned ? 'Recarregou' : 'Comprou'} ${item} por $${price}.`,
    shopVisited: (number: number) => `Loja ${number} visitada.`,
    source: {
      stab: 'Facada',
      shot: 'Tiro',
      headshot: 'Headshot',
      execution: 'Execução',
      overkill: 'Overkill',
    },
  },
  legend: {
    subtitle: 'Atravesse as salas sem ser visto.',
    home: 'Inicio',
    fullscreen: 'Tela cheia',
    restart: 'Reiniciar',
    sections: [
      {
        title: 'Controles',
        entries: [
          ['WASD / setas / joystick', 'mover'],
          [
            'Espaco',
            'salto de esquiva. Livre na sala inicial; depois gasta 1 dos 6',
          ],
          ['C / Ctrl', 'agachar: mais lento, inimigos ouvem menos'],
          [
            'F',
            'quebrar a caixa ao alcance; com arma, facada no inimigo ao lado',
          ],
          ['B', 'abrir e fechar o bau da loja, no fim do contrato'],
          ['Q', 'trocar entre espada e armas (ou clique na arma, no topo)'],
          [
            'Toque',
            'no celular: icone de mao sobre o alvo; botao de setas para saltar',
          ],
          ['P', 'pausar e ver esta legenda'],
        ],
      },
      {
        title: 'Furtividade',
        entries: [
          ['Cone branco', 'patrulha. Amarelo: suspeito. Vermelho: alerta'],
          [
            'Orelha',
            'ele esta te ouvindo. Branca: notou algo. Amarela: vem investigar',
          ],
          ['Barulho', 'parado pouco, andando mais, salto e tiro muito mais'],
          [
            'Agachado',
            'ele nota e investiga, mas nao entra em alerta pelo som',
          ],
          ['De perto', 'colado nele, ele te percebe mesmo de costas'],
          ['Silenciador', 'tiro sem ele chama todo inimigo por perto'],
          ['Parede', 'bloqueia visao e bala, mas nao o som'],
        ],
      },
      {
        title: 'Combate',
        entries: [
          [
            'Espada',
            'por tras elimina na hora; inimigo em alerta leva 30 a 45 de dano',
          ],
          [
            'Com arma',
            'atira sozinho de longe; colado no inimigo, so ataca no F (faca)',
          ],
          ['Tiro', 'perde forca com a distancia; escopeta so resolve de perto'],
          [
            'Headshot',
            'chance de a bala dar dano dobrado; a mira das caixas aumenta',
          ],
          [
            'Numeros',
            '+ e o dano que voce causou; - vermelho e o que ele te deu',
          ],
          ['Adrenalina', 'cada eliminacao acelera voce por um instante'],
        ],
      },
      {
        title: 'Inimigos e cenario',
        entries: [
          [
            'Terno',
            'atira de longe, aguenta 2 tiros. Desvie das balas vermelhas',
          ],
          ['Ninja', 'corre e golpeia de perto, aguenta 2 golpes'],
          [
            'Caixa',
            'cobre de bala e quebra com tiro ou briga; pode soltar vida ou escudo',
          ],
          ['Coracao', 'recupera vida. Escudo: absorve dano antes da vida'],
          [
            'Cruz',
            'ficha de revive: ao morrer, voce volta na entrada da sala. Guarda 3',
          ],
        ],
      },
    ],
  },
  match: {
    title: 'Partida',
    resume: 'Continuar',
    end: 'Encerrar partida',
    endNote: 'Encerra para todos e mostra o resultado.',
    leave: 'Sair da partida',
    scoreboard: 'Placar',
    showScoreboard: 'Ver placar',
    player: 'Jogador',
    kills: 'Kills',
    deaths: 'Mortes',
    you: '(voce)',
    dead: 'morto',
    ended: 'O host encerrou a partida.',
  },
};

const en: typeof pt = {
  common: {
    menu: 'Menu',
    back: 'Back',
    continue: 'Continue',
    start: 'Start',
    room: 'Room',
    sword: 'Sword',
    bullets: 'bullets',
    noBullets: '(out of ammo)',
    weapons: 'Weapons',
    health: 'Health',
    shield: 'Shield',
    pause: 'Pause',
    crouch: 'Crouch',
    dash: 'Dash',
    joystick: 'Joystick',
    close: 'Close',
  },
  home: {
    record: (best) => `Best: room ${best}`,
    play: 'Play',
    character: 'Customize character',
    multiplayer: 'Multiplayer',
    settings: 'Settings',
    settingsDescription: 'Game display preferences.',
    bloodColor: 'Blood color',
    language: 'Language',
    instructions:
      'Move with WASD or arrow keys. Approach from behind to eliminate enemies. Stay out of their sight.',
    credit: 'Developed by',
    install: 'Install app',
    iosInstall: 'To install the app, tap Share and then "Add to Home Screen".',
  },
  character: {
    title: 'Character',
    preview: 'Character preview',
    drag: 'Drag to rotate',
    cloth: 'Clothes',
    accent: 'Band',
    skin: 'Skin',
    head: 'Head',
    legs: 'Legs',
    hands: 'Hands',
    feet: 'Feet',
    weapon: 'Weapon',
    reset: 'Reset to default',
    weaponPreview: 'Weapon preview',
    weaponNote: 'Preview only. Get weapons from the shop during a run.',
  },
  lobby: {
    yourName: 'Your name',
    connecting: 'Connecting...',
    enter: 'Enter',
    createSession: 'Create session',
    public: 'Public',
    private: 'Private',
    joinCode: 'Join with code',
    publicSessions: 'Public sessions',
    noSessions: 'No open sessions right now. Create one.',
    joinHost: (name) => `Join ${name}'s session`,
    sessionType: (isPublic) =>
      isPublic ? 'Public session' : 'Private session',
    inviteCode: 'Invite code',
    players: 'Players',
    you: ' (you)',
    playerCount: (count, max) => `${count}/${max} players.`,
    hostHint: 'Start when everyone has joined.',
    guestHint: 'Waiting for the host to start.',
    leave: 'Leave',
    host: 'Host',
    connectionError: 'Could not connect to the session server.',
    closedError: 'The host left: the session has ended.',
    errors: {
      name: 'Enter your name.',
      alreadyInSession: 'You are already in a session.',
      missingSession: 'Session not found.',
      alreadyStarted: 'The game has already started.',
      full: 'Session is full.',
      notInSession: 'You are not in a session.',
      onlyHost: 'Only the host can start the game.',
    },
  },
  game: {
    contract: (number) => `Contract ${number}`,
    contractRoom: (room, total) => `Room ${room} of ${total} in this contract`,
    dashes: (count, max) => `Dashes: ${count} of ${max}`,
    bullets: (count, max) => `Bullets: ${count} of ${max}`,
    revives: (count) => `Revive tokens: ${count}`,
    room: (number) => `Room ${number}`,
    paused: 'Paused',
    howToPlay: 'How to play',
    you: 'You',
    died: 'died!',
    gameOver: (room, kills, best) =>
      `Room ${room}, ${kills} eliminated. Best: room ${best}.`,
    restart: 'Play again',
    analysis: 'View game analysis',
    analysisTitle: 'Game analysis',
    analysisDescription: 'Summary and log of your finished run.',
    time: 'Time',
    kills: 'Eliminations',
    attackStrength: 'Attack strength',
    damageDealt: 'Damage dealt',
    stabs: 'Stabs',
    hits: 'Hits',
    misses: 'Misses',
    projectiles: 'Projectiles',
    shotHits: 'Shots hit',
    shotMisses: 'Shots missed',
    healthRecovered: 'Health restored',
    damageTaken: 'Damage taken',
    damageBlocked: 'Damage blocked',
    moneyCollected: 'Money collected',
    shopsVisited: 'Shops visited',
    insights: 'Insights',
    log: 'Run log',
    missedStabs: (count) =>
      `${count} missed stab${count === 1 ? '' : 's'} alerted targets.`,
    allStabsHit: 'Every stab hit.',
    noStabs: 'No stabs this run.',
    recovered: (count) => `${count} health restored during this run.`,
    noRecovery: 'No health restored during this run.',
    miss: 'Miss!',
    headshot: 'HEADSHOT',
    overkill: 'OVERKILL',
  },
  shop: {
    title: 'Choose your equipment',
    summary: (money, inflation) =>
      `Only for this run. You have $ ${money}. Inflation: +${inflation}%.`,
    bonusHealth: (count) => `+${count} health`,
    shots: (shots, pellets) =>
      `${shots} shots${pellets > 1 ? `, ${pellets} pellets` : ''}`,
    refill: (count) => `Reload: +${count} bullets`,
    fullAmmo: 'Ammo full',
    owned: 'already owned',
    items: {
      pistol: 'Pistol',
      silenced: 'Silenced pistol',
      shotgun: 'Shotgun',
      armor: 'Armor',
    },
  },
  share: {
    generating: 'Generating...',
    button: 'Share record',
    myRecord: 'MY RECORD',
    room: (best) => `ROOM ${best}`,
    run: (room, kills) => `This run: room ${room}, ${kills} eliminated`,
    challenge: 'Can you beat it?',
    message: (best) => `I reached room ${best} in Shadow Contract!`,
  },
  events: {
    contractStarted: 'Contract started.',
    attackVariance: (min, max) =>
      `Attack variation: ${min}% to ${max}% of base damage.`,
    idleEnemies: 'Idle warning: enemies sent.',
    reviveUsed: (remaining) => `Revive token used: ${remaining} left.`,
    contractEnded: (room) => `Contract ended in room ${room}.`,
    roomReached: (room) => `Reached room ${room}.`,
    enemyKilled: (ninja) => `${ninja ? 'Ninja' : 'Armed enemy'} eliminated.`,
    damageTaken: (lost, blocked) =>
      lost
        ? `Took ${lost} damage${blocked ? ` (${blocked} blocked by shield)` : ''}.`
        : `Shield blocked ${blocked} damage.`,
    overkill: (damage) =>
      `Overkill: crouching execution from behind, ${damage} damage.`,
    execution: (damage) => `Stealth execution: ${damage} damage.`,
    hit: (source, damage) => `${source} hit: ${damage} damage.`,
    missChance: (chance, peak) =>
      `Miss chance: ${chance}%${peak ? ' (peak)' : ''}.`,
    stabMissed: 'Stab missed.',
    shot: (item) => `Fired ${item}.`,
    money: (amount) => `Collected $${amount}.`,
    reviveCollected: (count, max) => `Revive tokens: ${count} of ${max}.`,
    aim: (chance) => `Aim improved: headshot chance ${chance}%.`,
    ammo: (item, amount) => `Collected ${item} ammo: +${amount}.`,
    recoveredHealth: 'Restored health',
    collectedShield: 'Collected shield',
    recoveredDashes: 'Restored dashes',
    collected: (item, amount) => `${item}: +${amount}.`,
    bought: (owned, item, price) =>
      `${owned ? 'Reloaded' : 'Bought'} ${item} for $${price}.`,
    shopVisited: (number) => `Visited shop ${number}.`,
    source: {
      stab: 'Stab',
      shot: 'Shot',
      headshot: 'Headshot',
      execution: 'Execution',
      overkill: 'Overkill',
    },
  },
  legend: {
    subtitle: 'Cross the rooms without being seen.',
    home: 'Home',
    fullscreen: 'Fullscreen',
    restart: 'Restart',
    sections: [
      {
        title: 'Controls',
        entries: [
          ['WASD / arrows / joystick', 'move'],
          ['Space', 'dodge dash. Free in the starting room; then uses 1 of 6'],
          ['C / Ctrl', 'crouch: slower and quieter'],
          ['F', 'break a nearby crate; with a gun, stab an adjacent enemy'],
          ['B', 'open or close the shop chest at the end of a contract'],
          ['Q', 'switch between sword and guns (or click a weapon above)'],
          [
            'Touch',
            'on mobile: tap the hand icon over a target; tap arrows to dash',
          ],
          ['P', 'pause and view this guide'],
        ],
      },
      {
        title: 'Stealth',
        entries: [
          ['White cone', 'patrolling. Yellow: suspicious. Red: alert'],
          [
            'Ear',
            'an enemy hears you. White: noticed something. Yellow: investigating',
          ],
          [
            'Noise',
            'little while still, more when walking, lots when dashing or shooting',
          ],
          ['Crouching', 'enemies investigate sound but do not go on alert'],
          ['Up close', 'an enemy notices you even from behind'],
          ['Silencer', 'shots without one attract nearby enemies'],
          ['Wall', 'blocks sight and bullets, but not sound'],
        ],
      },
      {
        title: 'Combat',
        entries: [
          ['Sword', 'kills from behind; alerted enemies take 30 to 45 damage'],
          [
            'With a gun',
            'shoots automatically at range; press F to stab up close',
          ],
          ['Shot', 'weakens with distance; shotgun works best up close'],
          [
            'Headshot',
            'chance to deal double damage; improve aim with crate loot',
          ],
          ['Numbers', '+ is damage you dealt; red - is damage you took'],
          ['Adrenaline', 'each kill speeds you up briefly'],
        ],
      },
      {
        title: 'Enemies and scenery',
        entries: [
          ['Suit', 'shoots from afar, survives 2 shots. Dodge red bullets'],
          ['Ninja', 'runs and strikes up close, survives 2 hits'],
          ['Crate', 'blocks bullets and breaks; may drop health or shield'],
          ['Heart', 'restores health. Shield absorbs damage first'],
          ['Cross', 'revive token: respawn at the room entrance. Hold up to 3'],
        ],
      },
    ],
  },
  match: {
    title: 'Match',
    resume: 'Resume',
    end: 'End match',
    endNote: 'Ends it for everyone and shows the result.',
    leave: 'Leave match',
    scoreboard: 'Scoreboard',
    showScoreboard: 'Show scoreboard',
    player: 'Player',
    kills: 'Kills',
    deaths: 'Deaths',
    you: '(you)',
    dead: 'dead',
    ended: 'The host ended the match.',
  },
};

type Language = 'pt-BR' | 'en';
const texts = { 'pt-BR': pt, en };

export const useLanguage = create<{
  language: Language;
  setLanguage: (language: Language) => void;
}>()(
  persist(
    (set) => ({
      language: 'pt-BR',
      setLanguage: (language) => {
        document.documentElement.lang = language;
        set({ language });
      },
    }),
    {
      name: 'shadow-contract-language',
      merge: (saved, current) => ({
        ...current,
        language:
          (saved as { language?: unknown })?.language === 'en' ? 'en' : 'pt-BR',
      }),
    },
  ),
);

export const getTexts = () => texts[useLanguage.getState().language];
export const useTexts = () => texts[useLanguage((state) => state.language)];

export function eventText(format: (words: typeof pt) => string) {
  return { text: format(pt), en: format(en) };
}

export function translateSessionError(error: string): string {
  // shortcut: unknown server errors stay in their original language; add a protocol code with the next new error.
  const key = (
    Object.keys(pt.lobby.errors) as (keyof typeof pt.lobby.errors)[]
  ).find((candidate) => pt.lobby.errors[candidate] === error);
  return key ? getTexts().lobby.errors[key] : error;
}
