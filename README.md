<p align="center">
  <img src="public/icon-192.png" alt="Ícone do Shadow Contract" width="128" />
</p>

# Shadow Contract

Jogo de ação furtiva com visão de cima, feito para navegador e celular. Atravesse salas, evite os cones de visão e o barulho que chama os inimigos, elimine os alvos e chegue às lojas para escolher equipamento antes do próximo contrato.

## O jogo

- **Furtividade:** inimigos patrulham, investigam sons e perseguem o personagem quando entram em alerta. Ficar parado por muito tempo também atrai perseguidores.
- **Combate:** aproxime-se por trás para um golpe furtivo, use espada ou armas de fogo e desvie dos ataques com o salto de esquiva.
- **Progressão:** as salas trazem dinheiro, caixas destrutíveis e itens de cura, escudo ou salto. A cada contrato há uma loja com preços variáveis.
- **Personalização:** ajuste a aparência do personagem e a cor do sangue na tela inicial.
- **Análise da partida:** ao morrer, consulte acertos, erros, dano, vida recuperada e o registro de eventos. O recorde e algumas preferências ficam salvos no navegador.
- **Instalação:** o jogo pode ser instalado como PWA em dispositivos compatíveis e mantém os arquivos necessários em cache para jogar offline depois do primeiro carregamento.

## Controles

| Ação                                   | Teclado         |
| -------------------------------------- | --------------- |
| Mover                                  | `WASD` ou setas |
| Salto de esquiva                       | `Espaço`        |
| Agachar                                | `C` ou `Ctrl`   |
| Interagir com caixa ou atacar de perto | `F`             |
| Abrir ou fechar o baú da loja          | `B`             |
| Trocar de arma                         | `Q`             |
| Pausar                                 | `P`             |
| Iniciar a partida                      | `Enter`         |

No celular, arraste o joystick na parte inferior para mover. Os botões à direita servem para saltar e agachar. Toque no ícone de interação sobre o alvo para quebrar caixas, atacar de perto ou abrir o baú; as armas também podem ser escolhidas pelo HUD.

## Tecnologias

| Tecnologia               | Uso no projeto                                  |
| ------------------------ | ----------------------------------------------- |
| React e TypeScript       | Interface e código tipado                       |
| Three.js                 | Cenário, personagens e efeitos em 3D            |
| Vite                     | Servidor de desenvolvimento e build             |
| Tailwind CSS             | Estilos da interface                            |
| Zustand                  | Estado do jogo e preferências no `localStorage` |
| Radix UI e Lucide        | Componentes de interface e ícones               |
| Vite PWA e Workbox       | Instalação e cache offline                      |
| Vitest e Testing Library | Testes da simulação e da interface              |

## Executar localmente

É necessário ter Node.js e pnpm instalados. Na raiz do projeto:

```bash
pnpm install
pnpm dev
```

Abra no navegador o endereço exibido pelo Vite. Para conferir o projeto:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm preview` serve a versão gerada pelo build.

## Estrutura

- `src/app/modules`: regras de mundo, salas, inimigos, combate e loja.
- `src/app/engine`: loop do jogo e renderização com Three.js.
- `src/resources`: telas React, controles e interface.
- `src/shared`: estilos e utilitários compartilhados.
- `docs`: contratos entre módulos, organização e estratégia de testes.
