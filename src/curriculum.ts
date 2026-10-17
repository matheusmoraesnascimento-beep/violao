export interface Tip {
  title: string;
  text: string;
}

export interface PhaseGoal {
  description: string;
  tunedTimes?: number;
  strumBpm?: number;
  changesPerMinute?: number;
  songsCompleted?: number;
  chordsMastered?: boolean;
}

export interface Phase {
  id: number;
  title: string;
  summary: string;
  /** Acordes introduzidos nesta fase (cumulativos via chordsUpTo). */
  chordIds: string[];
  tips: Tip[];
  goal: PhaseGoal;
}

export type Stroke = 'D' | 'U' | null;

export interface StrumPattern {
  id: string;
  name: string;
  /** 8 colcheias por compasso 4/4. Posições pares (0,2,4,6) caem nos tempos 1-4. */
  slots: Stroke[];
  bpm: number;
}

export interface Progression {
  id: string;
  name: string;
  genre: 'pop' | 'rock' | 'sertanejo';
  chordIds: string[];
  bpm: number;
  patternId: string;
}

export const WARMUPS: string[] = [
  'Aranha: com os dedos 1-2-3-4 nas casas 1-2-3-4 da corda mais grave, suba e desça devagar, uma nota por vez. Depois passe para a próxima corda.',
  'Abre e fecha a mão: sem violão, abra os dedos bem afastados por 3 segundos e relaxe. Repita 10 vezes com cada mão.',
  'Dedo por casa: na corda B, toque as casas 1, 2, 3 e 4 com um dedo por casa, mantendo os dedos arqueados e perto do traste.',
];

export const PHASES: Phase[] = [
  {
    id: 1,
    title: 'Base',
    summary: 'Postura, afinação e ritmo básico.',
    chordIds: [],
    goal: { description: 'Afinar sozinho 3 vezes e manter a batida ↓↓↓↓ a 60 BPM.', tunedTimes: 3, strumBpm: 60 },
    tips: [
      { title: 'Postura', text: 'Sente com as costas retas, o violão apoiado na perna e o braço do violão levemente inclinado para cima. Ombros soltos.' },
      { title: 'Mão esquerda', text: 'Polegar atrás do braço, no meio. Dedos arqueados, pressionando com a ponta, perto do traste (não em cima dele).' },
      { title: 'Dor e calos', text: 'Dor nas pontas dos dedos é normal nas 2 primeiras semanas. Pare se a dor for forte. Sessões curtas e diárias formam calos mais rápido que sessões longas.' },
    ],
  },
  {
    id: 2,
    title: 'Acordes abertos',
    summary: 'Os cinco primeiros acordes: Em, Am, E, A, D.',
    chordIds: ['Em', 'Am', 'E', 'A', 'D'],
    goal: { description: '30 trocas limpas por minuto entre dois acordes e todos os 5 acordes dominados.', changesPerMinute: 30, chordsMastered: true },
    tips: [
      { title: 'Antecipe a troca', text: 'Enquanto toca o acorde atual, olhe e prepare o próximo. Mova todos os dedos juntos, como um bloco.' },
      { title: 'Dedo-guia', text: 'Quando um dedo fica na mesma corda nos dois acordes, deixe-o deslizar em vez de soltar. Isso acelera a troca.' },
      { title: 'Limpeza do som', text: 'Toque as cordas uma a uma. Se alguma abafa, ajuste o dedo: mais perto do traste e mais arqueado.' },
    ],
  },
  {
    id: 3,
    title: 'Mais acordes',
    summary: 'G, C, Dm e F fácil (4 cordas).',
    chordIds: ['G', 'C', 'Dm', 'F4'],
    goal: { description: '30 trocas limpas por minuto e os 9 acordes dominados.', changesPerMinute: 30, chordsMastered: true },
    tips: [
      { title: 'Acorde G', text: 'Use a forma com os dedos 2, 1 e 3 (mínimo, anelar e mindinho dão estabilidade). Pratique a troca G ↔ C com calma.' },
      { title: 'F fácil', text: 'Pressione as duas cordas mais agudas na casa 1 com o dedo 1 deitado. É a ponte para a pestana completa da fase 6.' },
      { title: 'Pares difíceis', text: 'Os pares que mais travam são os que mais rendem. O app repete os seus pares mais fracos.' },
    ],
  },
  {
    id: 4,
    title: 'Batidas',
    summary: 'Batidas de pop, sertanejo e rock trocando acordes.',
    chordIds: [],
    goal: { description: 'Manter a batida a 80 BPM trocando de acorde.', strumBpm: 80 },
    tips: [
      { title: 'Mão direita sempre se move', text: 'Mantenha o balanço do braço mesmo nos tempos em que a palheta não toca as cordas. O movimento é contínuo.' },
      { title: 'Conte em voz alta', text: '"1 e 2 e 3 e 4 e": setas para baixo nos números, para cima no "e".' },
      { title: 'Troque no tempo 1', text: 'Na troca, mantenha o ritmo mesmo que o acorde saia incompleto. Ritmo vale mais que nota perfeita.' },
    ],
  },
  {
    id: 5,
    title: 'Músicas',
    summary: 'Progressões completas de 3 a 4 acordes.',
    chordIds: [],
    goal: { description: 'Tocar 3 progressões inteiras sem parar.', songsCompleted: 3 },
    tips: [
      { title: 'Não pare', text: 'Errou? Siga em frente no ritmo. Parar para corrigir treina a pausa, não a música.' },
      { title: 'Cante junto', text: 'Cantar ou cantarolar a melodia ajuda a sentir onde cada acorde troca.' },
      { title: 'Suas músicas', text: 'Quando dominar uma progressão, procure no seu cifrário uma música que use os mesmos acordes e toque por cima.' },
    ],
  },
  {
    id: 6,
    title: 'Evolução',
    summary: 'Pestana, power chords e palhetada alternada.',
    chordIds: ['Bm', 'F', 'E5', 'A5', 'D5', 'G5'],
    goal: { description: 'Pestana limpa (F e Bm) e power chords dominados.', changesPerMinute: 20, chordsMastered: true },
    tips: [
      { title: 'Pestana', text: 'Use o lado do dedo 1, não a barriga. Cotovelo levemente para dentro e pressão perto do traste. Se doer, faça pausas.' },
      { title: 'Power chords', text: 'Duas ou três cordas apenas. Abafe as outras com a palma da mão direita ou com a ponta do dedo 1.' },
      { title: 'Palhetada alternada', text: 'Baixo-cima-baixo-cima em colcheias constantes, mesmo em corda solta. Velocidade vem depois de precisão.' },
    ],
  },
];

export const PATTERNS: Record<string, StrumPattern> = {
  down4: { id: 'down4', name: '↓ nos 4 tempos', slots: ['D', null, 'D', null, 'D', null, 'D', null], bpm: 60 },
  pop: { id: 'pop', name: 'Pop', slots: ['D', null, 'D', 'U', null, 'U', 'D', 'U'], bpm: 70 },
  sertanejo: { id: 'sertanejo', name: 'Sertanejo (exercício)', slots: ['D', null, 'D', 'U', 'D', 'U', 'D', 'U'], bpm: 70 },
  rock: { id: 'rock', name: 'Rock (colcheias para baixo)', slots: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'], bpm: 80 },
};

export const PROGRESSIONS: Progression[] = [
  { id: 'pop-g', name: 'Pop em Sol (G D Em C)', genre: 'pop', chordIds: ['G', 'D', 'Em', 'C'], bpm: 70, patternId: 'pop' },
  { id: 'pop-c', name: 'Pop em Dó (C G Am F)', genre: 'pop', chordIds: ['C', 'G', 'Am', 'F4'], bpm: 70, patternId: 'pop' },
  { id: 'sert-g', name: 'Sertanejo em Sol (G C D G)', genre: 'sertanejo', chordIds: ['G', 'C', 'D', 'G'], bpm: 75, patternId: 'sertanejo' },
  { id: 'sert-c', name: 'Sertanejo em Dó (C Am F G)', genre: 'sertanejo', chordIds: ['C', 'Am', 'F4', 'G'], bpm: 75, patternId: 'sertanejo' },
  { id: 'rock-a', name: 'Rock em Lá (A D E A)', genre: 'rock', chordIds: ['A', 'D', 'E', 'A'], bpm: 80, patternId: 'rock' },
  { id: 'rock-em', name: 'Rock em Mi menor (Em C G D)', genre: 'rock', chordIds: ['Em', 'C', 'G', 'D'], bpm: 85, patternId: 'rock' },
];

/** Todos os acordes liberados até a fase `phaseId` (inclusive), na ordem do currículo. */
export function chordsUpTo(phaseId: number): string[] {
  return PHASES.filter((p) => p.id <= phaseId).flatMap((p) => p.chordIds);
}
