import { PATTERNS, PHASES, PROGRESSIONS, WARMUPS, chordsUpTo } from './curriculum';
import { dueChords, weakestChords } from './scheduler';
import type { Progress } from './storage';

export type BlockKind = 'tune' | 'warmup' | 'technique' | 'changes' | 'apply' | 'review';

export interface Block {
  kind: BlockKind;
  title: string;
  minutes: number;
  instruction: string;
  chordIds?: string[];
  pair?: [string, string];
  bpm?: number;
  bpmKey?: string;
  patternId?: string;
  isSong?: boolean;
}

function applyBlock(p: Progress, n: number, known: string[], pair: [string, string] | undefined): Block {
  if (p.phase >= 5) {
    const options = PROGRESSIONS.filter((pr) => pr.chordIds.every((c) => known.includes(c)));
    const pr = options[n % options.length];
    const key = `song:${pr.id}`;
    return {
      kind: 'apply',
      title: `Música: ${pr.name}`,
      minutes: 5,
      chordIds: pr.chordIds,
      patternId: pr.patternId,
      bpm: p.bpm[key] ?? pr.bpm,
      bpmKey: key,
      isSong: true,
      instruction: `Toque ${pr.chordIds.join(' – ')} com a batida indicada, um acorde por compasso. Errou? Não pare.`,
    };
  }

  let patternId = 'down4';
  let chordIds: string[] = pair ? [...pair] : [];
  if (p.phase === 4) {
    patternId = ['pop', 'sertanejo', 'rock'][n % 3];
    chordIds = known.slice(0, 4);
  }
  const pat = PATTERNS[patternId];
  const key = `strum:${patternId}`;
  return {
    kind: 'apply',
    title: `Batida: ${pat.name}`,
    minutes: known.length < 2 ? 9 : 5,
    chordIds,
    patternId,
    bpm: p.bpm[key] ?? pat.bpm,
    bpmKey: key,
    instruction: chordIds.length
      ? `Siga o metrônomo e a batida, trocando entre ${chordIds.join(', ')} a cada compasso.`
      : 'Siga o metrônomo com a mão direita batendo nas cordas soltas, sem pressa.',
  };
}

/** Monta a sessão diária (15-20 min). Não altera o progresso. */
export function buildSession(p: Progress, today: string): Block[] {
  const phase = PHASES[p.phase - 1];
  const n = p.sessionsInPhase;
  const known = chordsUpTo(p.phase);
  const tip = phase.tips[n % phase.tips.length];

  const blocks: Block[] = [
    { kind: 'tune', title: 'Afinação', minutes: 2, instruction: 'Afine as 6 cordas, da mais grave para a mais aguda.' },
    { kind: 'warmup', title: 'Aquecimento', minutes: 2, instruction: WARMUPS[n % WARMUPS.length] },
    { kind: 'technique', title: tip.title, minutes: 5, instruction: tip.text },
  ];

  let pair: [string, string] | undefined;
  if (known.length >= 2) {
    const weak = weakestChords(p, 2);
    pair = [weak[0], weak[1]];
    blocks.push({
      kind: 'changes',
      title: 'Troca de acordes',
      minutes: 4,
      pair,
      chordIds: [...pair],
      instruction: `Alterne ${pair[0]} e ${pair[1]} por 1 minuto. Conte só as trocas limpas.`,
    });
  }

  blocks.push(applyBlock(p, n, known, pair));

  const review = dueChords(p, today, pair ?? []).slice(0, 3);
  if (review.length > 0) {
    blocks.push({ kind: 'review', title: 'Revisão', minutes: 2, chordIds: review, instruction: 'Toque cada acorde uma vez, devagar.' });
  }
  return blocks;
}
