# Violão App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app (PT-BR) que ensina violão de aço (pop/rock/sertanejo) em sessões diárias de 15-20 min, com afinador, metrônomo, feedback por microfone e repetição espaçada.

**Architecture:** App estático (Vite + TypeScript, sem framework, sem backend). Lógica pura (teoria, detecção de pitch/acorde, agendador, currículo, sessão, storage) em `src/` com testes Vitest. UI em `src/ui/` com um módulo por tela e roteador por hash. Progresso em `localStorage`.

**Tech Stack:** Vite, TypeScript (strict), Vitest, Playwright, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-10-17-violao-app-design.md`

**Nota ao executor:** o `CLAUDE.md` global do usuário manda prefixar comandos com `rtk` (ex.: `rtk git commit`). Os comandos abaixo estão sem o prefixo por clareza; aplique-o ao executar.

## Decisões de escopo (desvios deliberados do spec — comunicar ao usuário)

1. **Batida/música (bloco "apply") é autoavaliada** (Consegui / Quase / Não consegui). Detectar acorde enquanto o metrônomo toca polui o microfone. Troca de acordes e revisão usam o microfone de verdade.
2. **Desafinação no meio da sessão:** botão "Reafinar" em toda a sessão em vez de detecção automática (YIN não é confiável com acordes). Detecção automática fica para depois.
3. **Lembrete de prática:** banner na tela inicial quando ainda não praticou hoje. Notificação push exige service worker; fora de escopo.
4. **Hook de teste:** `?timescale=0.02` na URL encurta cronômetros (usado no E2E).

## Estrutura de arquivos

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
src/main.ts                 roteador por hash + bootstrap
src/style.css               estilos mobile-first
src/config.ts               TIME_SCALE
src/theory.ts               notas, frequências, cents
src/tuner.ts                corda mais próxima, estado de afinação
src/chords.ts               definições de acordes, classes de altura
src/curriculum.ts           fases, dicas, batidas, progressões, aquecimentos
src/storage.ts              Progress, load/save/import, datas, streak
src/scheduler.ts            Leitner, regra de BPM, metas de fase
src/session.ts              monta os blocos da sessão
src/placement.ts            nivelamento
src/app.ts                  App (estado compartilhado, microfone), tipos Screen/SessionResult
src/audio/level.ts          rms
src/audio/pitch.ts          YIN
src/audio/chord.ts          cromagrama (Goertzel) + veredito
src/audio/changeCounter.ts  contador de trocas limpas
src/audio/mic.ts            captura do microfone
src/audio/listen.ts         loop de escuta + calibração de ruído
src/audio/metronome.ts      metrônomo com lookahead
src/ui/dom.ts               h(), countdown(), chordCard(), selfButtons()
src/ui/chordDiagram.ts      SVG do acorde
src/ui/tunerView.ts         mountTuner (reusado no afinador e na sessão)
src/ui/{home,placement,tuner,session,result,progress,library,settings,debug}Screen.ts
tests/*.test.ts, tests/helpers/synth.ts
e2e/flow.spec.ts
docs/calibracao.md
```

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/style.css`

- [ ] **Step 1: Inicializar git e dependências**

```bash
git init
npm init -y
npm install -D vite typescript vitest @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Escrever `package.json`** (sobrescreva o gerado, mantendo as versões instaladas nas devDependencies)

```json
{
  "name": "violao",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

Depois rode `npm install -D vite typescript vitest @playwright/test` de novo para o npm regravar as `devDependencies`.

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 4: `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: `index.html`, `.gitignore`, `src/main.ts`, `src/style.css`**

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Violão</title>
  </head>
  <body>
    <nav id="nav"></nav>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
test-results
playwright-report
```

`src/main.ts` (provisório, substituído na Task 13):
```ts
import './style.css';

document.getElementById('app')!.textContent = 'Violão';
```

`src/style.css`: arquivo vazio por ora (preenchido na Task 13).

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: termina com `built in ...` e sem erro de tipos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TS + Vitest + Playwright"
```

---

### Task 2: Teoria musical e afinador (lógica)

**Files:**
- Create: `src/theory.ts`, `src/tuner.ts`
- Test: `tests/theory.test.ts`, `tests/tuner.test.ts`

- [ ] **Step 1: Testes que falham**

`tests/theory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { freqToMidi, midiToFreq, noteName, pitchClass, centsOff } from '../src/theory';

describe('theory', () => {
  it('A4 = 440 Hz = MIDI 69', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6);
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });
  it('nomeia notas', () => {
    expect(noteName(60)).toBe('C');
    expect(noteName(64)).toBe('E');
    expect(pitchClass(40)).toBe(4);
  });
  it('cents', () => {
    expect(centsOff(440 * 2 ** (10 / 1200), 440)).toBeCloseTo(10, 6);
  });
});
```

`tests/tuner.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nearestString, tuneState } from '../src/tuner';

describe('tuner', () => {
  it('110 Hz é a corda A, afinada', () => {
    const m = nearestString(110);
    expect(m.index).toBe(1);
    expect(m.label).toBe('A');
    expect(m.cents).toBeCloseTo(0, 3);
  });
  it('82.41 Hz é a corda E grave', () => {
    expect(nearestString(82.41).index).toBe(0);
  });
  it('329.63 Hz é a corda e aguda', () => {
    expect(nearestString(329.63).index).toBe(5);
  });
  it('estado de afinação', () => {
    expect(tuneState(-12)).toBe('flat');
    expect(tuneState(3)).toBe('ok');
    expect(tuneState(20)).toBe('sharp');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/theory.test.ts tests/tuner.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

`src/theory.ts`:
```ts
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Cordas soltas do violão, da mais grave para a mais aguda: E2 A2 D3 G3 B3 E4. */
export const OPEN_STRINGS_MIDI = [40, 45, 50, 55, 59, 64];

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function noteName(midi: number): string {
  return NOTE_NAMES[pitchClass(midi)];
}

export function centsOff(freq: number, targetFreq: number): number {
  return 1200 * Math.log2(freq / targetFreq);
}
```

`src/tuner.ts`:
```ts
import { OPEN_STRINGS_MIDI, centsOff, midiToFreq } from './theory';

export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export interface StringMatch {
  index: number;
  label: string;
  targetFreq: number;
  cents: number;
}

export function nearestString(freq: number): StringMatch {
  let best = 0;
  let bestAbs = Infinity;
  OPEN_STRINGS_MIDI.forEach((midi, i) => {
    const c = Math.abs(centsOff(freq, midiToFreq(midi)));
    if (c < bestAbs) {
      bestAbs = c;
      best = i;
    }
  });
  const targetFreq = midiToFreq(OPEN_STRINGS_MIDI[best]);
  return { index: best, label: STRING_LABELS[best], targetFreq, cents: centsOff(freq, targetFreq) };
}

export type TuneState = 'flat' | 'sharp' | 'ok';

export function tuneState(cents: number, tolerance = 5): TuneState {
  if (Math.abs(cents) <= tolerance) return 'ok';
  return cents < 0 ? 'flat' : 'sharp';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/theory.test.ts tests/tuner.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/theory.ts src/tuner.ts tests/theory.test.ts tests/tuner.test.ts
git commit -m "feat: teoria musical e lógica do afinador"
```

---

### Task 3: Detecção de pitch (YIN)

**Files:**
- Create: `src/audio/level.ts`, `src/audio/pitch.ts`, `tests/helpers/synth.ts`
- Test: `tests/pitch.test.ts`

- [ ] **Step 1: Helper de síntese e teste que falha**

`tests/helpers/synth.ts`:
```ts
/** Soma senoides. `harmonics` são multiplicadores de frequência; a amplitude do harmônico h é 1/h. */
export function synth(freqs: number[], sampleRate = 44100, n = 4096, harmonics = [1]): Float32Array {
  const out = new Float32Array(n);
  for (const f of freqs) {
    for (const h of harmonics) {
      const amp = 1 / h;
      for (let i = 0; i < n; i++) out[i] += amp * Math.sin((2 * Math.PI * f * h * i) / sampleRate);
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.5;
  return out;
}

/** Ruído branco determinístico. */
export function noise(n = 4096, seed = 1): Float32Array {
  let s = seed;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s / 0xffffffff - 0.5) * 0.6;
  }
  return out;
}
```

`tests/pitch.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectPitch } from '../src/audio/pitch';
import { centsOff } from '../src/theory';
import { synth, noise } from './helpers/synth';

const SR = 44100;

describe('detectPitch (YIN)', () => {
  for (const f of [82.41, 110, 196, 329.63]) {
    it(`detecta senoide de ${f} Hz`, () => {
      const r = detectPitch(synth([f], SR), SR);
      expect(r).not.toBeNull();
      expect(Math.abs(centsOff(r!.freq, f))).toBeLessThan(10);
    });
  }
  it('detecta fundamental com harmônicos (196 Hz)', () => {
    const r = detectPitch(synth([196], SR, 4096, [1, 2, 3]), SR);
    expect(r).not.toBeNull();
    expect(Math.abs(centsOff(r!.freq, 196))).toBeLessThan(10);
  });
  it('silêncio retorna null', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull();
  });
  it('ruído branco retorna null', () => {
    expect(detectPitch(noise(4096), SR)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/pitch.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/audio/level.ts`:
```ts
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
```

`src/audio/pitch.ts`:
```ts
import { rms } from './level';

export interface PitchResult {
  freq: number;
  /** 0..1, quanto maior mais periódico. */
  clarity: number;
}

/**
 * Algoritmo YIN. Retorna null para silêncio ou sinal sem periodicidade clara.
 * `buf` deve ter pelo menos 4096 amostras a 44.1 kHz para alcançar 70 Hz.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  threshold = 0.15,
  minFreq = 70,
  maxFreq = 1000,
): PitchResult | null {
  if (rms(buf) < 0.005) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const window = buf.length - maxTau;

  const diff = new Float32Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(maxTau);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    running += diff[tau];
    cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
  }

  let tau = minTau;
  while (tau < maxTau) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }
  if (tau >= maxTau) return null;

  let better = tau;
  if (tau > 1 && tau + 1 < maxTau) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = s0 - 2 * s1 + s2;
    if (denom !== 0) better = tau + (s0 - s2) / (2 * denom);
  }

  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/pitch.test.ts`
Expected: PASS (6 testes). Se a precisão de 10 cents falhar em alguma frequência, não afrouxe o teste: confira a interpolação parabólica.

- [ ] **Step 5: Commit**

```bash
git add src/audio/level.ts src/audio/pitch.ts tests/helpers/synth.ts tests/pitch.test.ts
git commit -m "feat: detecção de pitch YIN"
```

---

### Task 4: Detecção de acorde (cromagrama via Goertzel)

**Files:**
- Create: `src/audio/chord.ts`
- Test: `tests/chord.test.ts`

- [ ] **Step 1: Teste que falha**

`tests/chord.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { checkChord } from '../src/audio/chord';
import { synth } from './helpers/synth';

const SR = 44100;
const N = 8192;
const H = [1, 2, 3];

// Frequências (Hz)
const C3 = 130.81, E3 = 164.81, G3 = 196.0, C4 = 261.63, E4 = 329.63;
const A2 = 110.0, A3 = 220.0;

const C_MAJOR = [0, 4, 7];

describe('checkChord', () => {
  it('C maior completo → ok', () => {
    const r = checkChord(synth([C3, E3, G3, C4, E4], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('ok');
    expect(r.missing).toEqual([]);
  });
  it('falta uma nota (C) → close e lista a nota faltante', () => {
    const r = checkChord(synth([E3, G3], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('close');
    expect(r.missing).toEqual([0]);
  });
  it('nota única → miss', () => {
    const r = checkChord(synth([E3], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
  });
  it('Am tocado quando se pede C → miss (G falta e A sobra)', () => {
    const r = checkChord(synth([A2, E3, A3, C4, E4], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
    expect(r.extra).toContain(9);
  });
  it('silêncio → miss com tudo faltando', () => {
    const r = checkChord(new Float32Array(N), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
    expect(r.missing).toEqual(C_MAJOR);
    expect(r.score).toBe(0);
  });
  it('power chord (2 notas) ok quando as duas soam', () => {
    // E5 = E + B
    const r = checkChord(synth([82.41, 123.47, 164.81], SR, N, H), SR, [4, 11]);
    expect(r.verdict).toBe('ok');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/chord.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/audio/chord.ts`:
```ts
import { midiToFreq } from '../theory';
import { rms } from './level';

export type Verdict = 'ok' | 'close' | 'miss';

export interface ChordResult {
  verdict: Verdict;
  /** 0..1 */
  score: number;
  /** Classes de altura esperadas que não soaram. */
  missing: number[];
  /** Classes de altura que soaram e não pertencem ao acorde. */
  extra: number[];
}

/** Abaixo disso (relativo à classe mais forte) a nota conta como ausente. */
export const MISSING_BELOW = 0.2;
/** Acima disso, nota fora do acorde conta como sobrando. */
export const EXTRA_ABOVE = 0.7;

const LOW_MIDI = 40; // E2
const HIGH_MIDI = 76; // E5

export function goertzelPower(buf: Float32Array, sampleRate: number, freq: number): number {
  const coeff = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const s0 = buf[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Força relativa (0..1) de cada uma das 12 classes de altura. */
export function chromaStrengths(buf: Float32Array, sampleRate: number): number[] {
  const n = buf.length;
  const windowed = new Float32Array(n);
  for (let i = 0; i < n; i++) windowed[i] = buf[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

  const chroma = new Array<number>(12).fill(0);
  for (let m = LOW_MIDI; m <= HIGH_MIDI; m++) {
    chroma[m % 12] += Math.sqrt(goertzelPower(windowed, sampleRate, midiToFreq(m)));
  }
  const max = Math.max(...chroma);
  return max <= 0 ? chroma : chroma.map((v) => v / max);
}

function nearExpected(pc: number, expected: number[]): boolean {
  return expected.some((e) => {
    const d = (pc - e + 12) % 12;
    return d === 1 || d === 11;
  });
}

export function checkChord(
  buf: Float32Array,
  sampleRate: number,
  expected: number[],
  minRms = 0.005,
): ChordResult {
  if (rms(buf) < minRms) return { verdict: 'miss', score: 0, missing: [...expected], extra: [] };

  const strength = chromaStrengths(buf, sampleRate);
  const missing = expected.filter((pc) => strength[pc] < MISSING_BELOW);

  // Semitons vizinhos de notas esperadas são ignorados: o vazamento espectral
  // das cordas graves cai neles.
  const extra: number[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if (!expected.includes(pc) && !nearExpected(pc, expected) && strength[pc] > EXTRA_ABOVE) extra.push(pc);
  }

  const score = Math.max(0, Math.min(1, 1 - missing.length / expected.length - 0.25 * extra.length));

  let verdict: Verdict = 'miss';
  if (missing.length === 0 && extra.length === 0) verdict = 'ok';
  else if (missing.length <= 1 && extra.length === 0 && expected.length >= 3) verdict = 'close';
  else if (missing.length === 0 && extra.length <= 1) verdict = 'close';

  return { verdict, score, missing, extra };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/chord.test.ts`
Expected: PASS (6 testes). Se o teste do power chord falhar por vazamento, ajuste `MISSING_BELOW` (nunca o teste) e registre o motivo em um comentário.

- [ ] **Step 5: Commit**

```bash
git add src/audio/chord.ts tests/chord.test.ts
git commit -m "feat: detecção de acorde por cromagrama (Goertzel)"
```

---

### Task 5: Biblioteca de acordes e diagrama SVG

**Files:**
- Create: `src/chords.ts`, `src/ui/chordDiagram.ts`
- Test: `tests/chords.test.ts`, `tests/chordDiagram.test.ts`

- [ ] **Step 1: Testes que falham**

`tests/chords.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CHORDS, getChord, chordPcs } from '../src/chords';

describe('chords', () => {
  it('classes de altura derivadas do dedilhado', () => {
    expect(chordPcs(getChord('Em'))).toEqual([4, 7, 11]);
    expect(chordPcs(getChord('Am'))).toEqual([0, 4, 9]);
    expect(chordPcs(getChord('C'))).toEqual([0, 4, 7]);
    expect(chordPcs(getChord('E5'))).toEqual([4, 11]);
  });
  it('todo acorde tem 6 cordas em frets e fingers', () => {
    for (const c of Object.values(CHORDS)) {
      expect(c.frets).toHaveLength(6);
      expect(c.fingers).toHaveLength(6);
    }
  });
  it('acorde inexistente lança erro', () => {
    expect(() => getChord('XYZ')).toThrow();
  });
});
```

`tests/chordDiagram.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chordDiagramSvg } from '../src/ui/chordDiagram';
import { getChord } from '../src/chords';

const dots = (svg: string) => (svg.match(/data-dot/g) ?? []).length;

describe('chordDiagramSvg', () => {
  it('Em tem 2 casas pressionadas', () => {
    expect(dots(chordDiagramSvg(getChord('Em')))).toBe(2);
  });
  it('Am tem 3 casas pressionadas', () => {
    expect(dots(chordDiagramSvg(getChord('Am')))).toBe(3);
  });
  it('F com pestana desenha a pestana', () => {
    expect(chordDiagramSvg(getChord('F'))).toContain('data-barre');
  });
  it('tem rótulo de acessibilidade com o nome', () => {
    expect(chordDiagramSvg(getChord('G'))).toContain('aria-label="Acorde G"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/chords.test.ts tests/chordDiagram.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/chords.ts`:
```ts
import { OPEN_STRINGS_MIDI, pitchClass } from './theory';

export interface ChordDef {
  id: string;
  name: string;
  /** Casa por corda, da E grave para a e aguda. null = abafada, 0 = solta. */
  frets: (number | null)[];
  /** Dedo (1-4) por corda; null onde não há dedo. */
  fingers: (number | null)[];
  /** Pestana: casa e cordas (índices 0-5, inclusivos). */
  barre?: { fret: number; from: number; to: number };
}

const n = null;

export const CHORDS: Record<string, ChordDef> = {
  Em: { id: 'Em', name: 'Mi menor (Em)', frets: [0, 2, 2, 0, 0, 0], fingers: [n, 2, 3, n, n, n] },
  Am: { id: 'Am', name: 'Lá menor (Am)', frets: [n, 0, 2, 2, 1, 0], fingers: [n, n, 2, 3, 1, n] },
  E: { id: 'E', name: 'Mi maior (E)', frets: [0, 2, 2, 1, 0, 0], fingers: [n, 2, 3, 1, n, n] },
  A: { id: 'A', name: 'Lá maior (A)', frets: [n, 0, 2, 2, 2, 0], fingers: [n, n, 1, 2, 3, n] },
  D: { id: 'D', name: 'Ré maior (D)', frets: [n, n, 0, 2, 3, 2], fingers: [n, n, n, 1, 3, 2] },
  G: { id: 'G', name: 'Sol maior (G)', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, n, n, n, 3] },
  C: { id: 'C', name: 'Dó maior (C)', frets: [n, 3, 2, 0, 1, 0], fingers: [n, 3, 2, n, 1, n] },
  Dm: { id: 'Dm', name: 'Ré menor (Dm)', frets: [n, n, 0, 2, 3, 1], fingers: [n, n, n, 2, 3, 1] },
  F4: {
    id: 'F4',
    name: 'Fá maior fácil (F, 4 cordas)',
    frets: [n, n, 3, 2, 1, 1],
    fingers: [n, n, 4, 3, 1, 1],
    barre: { fret: 1, from: 4, to: 5 },
  },
  Bm: {
    id: 'Bm',
    name: 'Si menor (Bm, pestana)',
    frets: [n, 2, 4, 4, 3, 2],
    fingers: [n, 1, 3, 4, 2, 1],
    barre: { fret: 2, from: 1, to: 5 },
  },
  F: {
    id: 'F',
    name: 'Fá maior (F, pestana)',
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barre: { fret: 1, from: 0, to: 5 },
  },
  E5: { id: 'E5', name: 'Power chord E5', frets: [0, 2, 2, n, n, n], fingers: [n, 1, 2, n, n, n] },
  A5: { id: 'A5', name: 'Power chord A5', frets: [n, 0, 2, 2, n, n], fingers: [n, n, 1, 2, n, n] },
  D5: { id: 'D5', name: 'Power chord D5', frets: [n, n, 0, 2, 3, n], fingers: [n, n, n, 1, 2, n] },
  G5: { id: 'G5', name: 'Power chord G5', frets: [3, 5, 5, n, n, n], fingers: [1, 3, 4, n, n, n] },
};

export function getChord(id: string): ChordDef {
  const c = CHORDS[id];
  if (!c) throw new Error(`Acorde desconhecido: ${id}`);
  return c;
}

/** Classes de altura (0-11), únicas e ordenadas, que o dedilhado produz. */
export function chordPcs(def: ChordDef): number[] {
  const set = new Set<number>();
  def.frets.forEach((fret, i) => {
    if (fret !== null) set.add(pitchClass(OPEN_STRINGS_MIDI[i] + fret));
  });
  return [...set].sort((a, b) => a - b);
}
```

`src/ui/chordDiagram.ts`:
```ts
import type { ChordDef } from '../chords';

const W = 120;
const H = 150;
const LEFT = 20;
const TOP = 34;
const GAP = 16;
const FRET_H = 20;
const FRETS = 5;

const x = (stringIdx: number) => LEFT + stringIdx * GAP;
const y = (fret: number) => TOP + (fret - 0.5) * FRET_H;

/** SVG do diagrama de acorde. Todos os acordes da biblioteca cabem nas casas 1-5. */
export function chordDiagramSvg(def: ChordDef): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    p.push(`<line x1="${x(i)}" y1="${TOP}" x2="${x(i)}" y2="${TOP + FRETS * FRET_H}" stroke="currentColor" stroke-width="1"/>`);
  }
  for (let f = 0; f <= FRETS; f++) {
    const w = f === 0 ? 4 : 1;
    p.push(`<line x1="${x(0)}" y1="${TOP + f * FRET_H}" x2="${x(5)}" y2="${TOP + f * FRET_H}" stroke="currentColor" stroke-width="${w}"/>`);
  }

  def.frets.forEach((fret, i) => {
    if (fret === null) {
      p.push(`<text x="${x(i)}" y="${TOP - 10}" text-anchor="middle" font-size="12" fill="currentColor">x</text>`);
    } else if (fret === 0) {
      p.push(`<circle cx="${x(i)}" cy="${TOP - 14}" r="4" fill="none" stroke="currentColor"/>`);
    }
  });

  if (def.barre) {
    const { fret, from, to } = def.barre;
    p.push(
      `<rect data-barre x="${x(from) - 6}" y="${y(fret) - 6}" width="${x(to) - x(from) + 12}" height="12" rx="6" fill="currentColor" opacity="0.85"/>`,
    );
  }

  def.frets.forEach((fret, i) => {
    if (fret === null || fret === 0) return;
    p.push(`<circle data-dot cx="${x(i)}" cy="${y(fret)}" r="7" fill="currentColor"/>`);
    const finger = def.fingers[i];
    if (finger !== null) {
      p.push(`<text x="${x(i)}" y="${y(fret) + 4}" text-anchor="middle" font-size="10" fill="var(--bg, #fff)">${finger}</text>`);
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Acorde ${def.id}">${p.join('')}</svg>`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/chords.test.ts tests/chordDiagram.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/chords.ts src/ui/chordDiagram.ts tests/chords.test.ts tests/chordDiagram.test.ts
git commit -m "feat: biblioteca de acordes e diagrama SVG"
```

---

### Task 6: Currículo (dados + validação)

**Files:**
- Create: `src/curriculum.ts`
- Test: `tests/curriculum.test.ts`

- [ ] **Step 1: Teste que falha**

`tests/curriculum.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PHASES, PATTERNS, PROGRESSIONS, WARMUPS, chordsUpTo } from '../src/curriculum';
import { CHORDS } from '../src/chords';

describe('curriculum', () => {
  it('tem 6 fases sequenciais com meta e dicas', () => {
    expect(PHASES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const p of PHASES) {
      expect(p.goal.description.length).toBeGreaterThan(0);
      expect(p.tips.length).toBeGreaterThanOrEqual(3);
    }
  });
  it('todo acorde referenciado existe na biblioteca', () => {
    for (const p of PHASES) for (const id of p.chordIds) expect(CHORDS[id], id).toBeDefined();
    for (const pr of PROGRESSIONS) for (const id of pr.chordIds) expect(CHORDS[id], id).toBeDefined();
  });
  it('progressões só usam acordes liberados até a fase 5', () => {
    const known = chordsUpTo(5);
    for (const pr of PROGRESSIONS) for (const id of pr.chordIds) expect(known, pr.id).toContain(id);
  });
  it('toda progressão aponta para uma batida existente', () => {
    for (const pr of PROGRESSIONS) expect(PATTERNS[pr.patternId], pr.id).toBeDefined();
  });
  it('batidas têm 8 posições', () => {
    for (const pat of Object.values(PATTERNS)) expect(pat.slots).toHaveLength(8);
  });
  it('chordsUpTo é cumulativo', () => {
    expect(chordsUpTo(1)).toEqual([]);
    expect(chordsUpTo(2)).toEqual(['Em', 'Am', 'E', 'A', 'D']);
    expect(chordsUpTo(3)).toHaveLength(9);
    expect(chordsUpTo(6)).toHaveLength(15);
  });
  it('há aquecimentos', () => {
    expect(WARMUPS.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/curriculum.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/curriculum.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/curriculum.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/curriculum.ts tests/curriculum.test.ts
git commit -m "feat: currículo de 6 fases, batidas e progressões"
```

---

### Task 7: Storage (progresso, datas, streak, backup)

**Files:**
- Create: `src/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Teste que falha**

`tests/storage.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  addDays, daysBetween, defaultProgress, loadProgress, parseProgress, saveProgress, updateStreak, type KV,
} from '../src/storage';

function fakeStore(initial: Record<string, string> = {}): KV & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('datas', () => {
  it('addDays cruza mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-17', 0)).toBe('2026-10-17');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-10-17', '2026-10-19')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('streak', () => {
  it('primeiro dia = 1', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    expect(p.streak).toBe(1);
  });
  it('dias seguidos incrementam', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-18');
    expect(p.streak).toBe(2);
  });
  it('um dia de descanso não quebra', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-19');
    expect(p.streak).toBe(2);
  });
  it('dois dias sem praticar quebram', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-20');
    expect(p.streak).toBe(1);
  });
  it('mesmo dia não incrementa', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-17');
    expect(p.streak).toBe(1);
  });
});

describe('persistência', () => {
  it('salva e carrega', () => {
    const store = fakeStore();
    const p = defaultProgress();
    p.phase = 3;
    p.tunedCount = 4;
    expect(saveProgress(p, store)).toBe(true);
    const loaded = loadProgress(store);
    expect(loaded.phase).toBe(3);
    expect(loaded.tunedCount).toBe(4);
  });
  it('sem dados devolve o padrão', () => {
    expect(loadProgress(fakeStore()).phase).toBe(1);
  });
  it('dados corrompidos viram padrão e o original é guardado', () => {
    const store = fakeStore({ 'violao.progress.v1': '{quebrado' });
    const p = loadProgress(store);
    expect(p.phase).toBe(1);
    expect(store.data.get('violao.progress.v1.corrupt')).toBe('{quebrado');
  });
  it('storage que lança erro não derruba', () => {
    const store: KV = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => {},
    };
    expect(loadProgress(store).phase).toBe(1);
    expect(saveProgress(defaultProgress(), store)).toBe(false);
  });
  it('parseProgress rejeita arquivo inválido', () => {
    expect(() => parseProgress('{"version":2}')).toThrow();
    expect(() => parseProgress('{"version":1,"phase":9,"cards":{}}')).toThrow();
    expect(() => parseProgress('lixo')).toThrow();
  });
  it('parseProgress completa campos faltantes', () => {
    const p = parseProgress('{"version":1,"phase":2,"cards":{}}');
    expect(p.phase).toBe(2);
    expect(p.settings.micEnabled).toBe(true);
    expect(p.history).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/storage.ts`:
```ts
export interface CardState {
  /** Caixa de Leitner, 0-5. */
  box: number;
  /** Dia (YYYY-MM-DD) da próxima revisão. */
  due: string;
}

export interface Settings {
  micEnabled: boolean;
  /** 0.5-2; multiplica a sensibilidade do microfone. */
  sensitivity: number;
}

export interface SessionRecord {
  date: string;
  changesPerMinute: number | null;
  minutes: number;
  partial: boolean;
}

export interface Progress {
  version: 1;
  phase: number;
  placementDone: boolean;
  cards: Record<string, CardState>;
  /** BPM atual por exercício (chave `strum:<id>` ou `song:<id>`). */
  bpm: Record<string, number>;
  /** Últimas 3 notas de acerto (0-1) por exercício. */
  attempts: Record<string, number[]>;
  bestChangesPerMinute: number;
  bestStrumBpm: number;
  tunedCount: number;
  songsCompleted: number;
  sessionsInPhase: number;
  streak: number;
  lastPracticeDay: string | null;
  history: SessionRecord[];
  settings: Settings;
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'violao.progress.v1';

export function defaultProgress(): Progress {
  return {
    version: 1,
    phase: 1,
    placementDone: false,
    cards: {},
    bpm: {},
    attempts: {},
    bestChangesPerMinute: 0,
    bestStrumBpm: 0,
    tunedCount: 0,
    songsCompleted: 0,
    sessionsInPhase: 0,
    streak: 0,
    lastPracticeDay: null,
    history: [],
    settings: { micEnabled: true, sensitivity: 1 },
  };
}

export function parseProgress(json: string): Progress {
  const o = JSON.parse(json) as Partial<Progress> | null;
  const ok =
    o !== null &&
    typeof o === 'object' &&
    o.version === 1 &&
    Number.isInteger(o.phase) &&
    o.phase! >= 1 &&
    o.phase! <= 6 &&
    typeof o.cards === 'object' &&
    o.cards !== null;
  if (!ok) throw new Error('Arquivo de progresso inválido.');
  const base = defaultProgress();
  return { ...base, ...o, settings: { ...base.settings, ...o.settings } } as Progress;
}

export function loadProgress(store: KV = localStorage): Progress {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return defaultProgress();
    try {
      return parseProgress(raw);
    } catch {
      store.setItem(KEY + '.corrupt', raw);
      return defaultProgress();
    }
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress, store: KV = localStorage): boolean {
  try {
    store.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/** Dia local no formato YYYY-MM-DD. */
export function todayStr(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const dt = new Date(parseDay(day) + n * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
}

/** Permite um dia de descanso entre práticas sem quebrar a sequência. */
export function updateStreak(p: Progress, today: string): void {
  if (p.lastPracticeDay === today) return;
  const continues = p.lastPracticeDay !== null && daysBetween(p.lastPracticeDay, today) <= 2;
  p.streak = continues ? p.streak + 1 : 1;
  p.lastPracticeDay = today;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: storage de progresso, streak com dia de descanso e backup"
```

---

### Task 8: Agendador (repetição espaçada, regra de BPM, metas de fase)

**Files:**
- Create: `src/scheduler.ts`
- Test: `tests/scheduler.test.ts`

- [ ] **Step 1: Teste que falha**

`tests/scheduler.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  advancePhase, dueChords, ensureCards, phaseComplete, recordApply, recordAttempt, reviewCard, weakestChords,
} from '../src/scheduler';
import { defaultProgress } from '../src/storage';

const TODAY = '2026-10-17';

describe('reviewCard (Leitner)', () => {
  it('acertos sobem de caixa e espaçam a revisão', () => {
    const p = defaultProgress();
    reviewCard(p, 'Em', 'ok', TODAY);
    expect(p.cards.Em).toEqual({ box: 1, due: '2026-10-18' });
    reviewCard(p, 'Em', 'ok', '2026-10-18');
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-20' });
    reviewCard(p, 'Em', 'ok', '2026-10-20');
    expect(p.cards.Em).toEqual({ box: 3, due: '2026-10-24' });
  });
  it('erro volta para a caixa 0 e revisa hoje', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 3, due: TODAY };
    reviewCard(p, 'Em', 'miss', TODAY);
    expect(p.cards.Em).toEqual({ box: 0, due: TODAY });
  });
  it('quase mantém a caixa e revisa amanhã', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 2, due: TODAY };
    reviewCard(p, 'Em', 'close', TODAY);
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-18' });
  });
  it('caixa máxima é 5', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 5, due: TODAY };
    reviewCard(p, 'Em', 'ok', TODAY);
    expect(p.cards.Em.box).toBe(5);
  });
});

describe('seleção de acordes', () => {
  it('dueChords ordena pelos mais fracos e respeita exclusões', () => {
    const p = defaultProgress();
    p.cards = {
      Em: { box: 2, due: TODAY },
      Am: { box: 0, due: TODAY },
      E: { box: 1, due: '2026-10-20' },
      A: { box: 1, due: TODAY },
    };
    expect(dueChords(p, TODAY)).toEqual(['Am', 'A', 'Em']);
    expect(dueChords(p, TODAY, ['Am'])).toEqual(['A', 'Em']);
  });
  it('weakestChords usa os acordes liberados na fase', () => {
    const p = defaultProgress();
    p.phase = 2;
    p.cards = { Em: { box: 3, due: TODAY }, Am: { box: 0, due: TODAY }, E: { box: 1, due: TODAY } };
    expect(weakestChords(p, 2)).toEqual(['Am', 'A']);
  });
  it('ensureCards cria cartas dos acordes da fase', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    expect(Object.keys(p.cards).sort()).toEqual(['A', 'Am', 'D', 'E', 'Em']);
    expect(p.cards.Em).toEqual({ box: 0, due: TODAY });
  });
});

describe('regra de BPM', () => {
  it('3 acertos ≥90% sobem 5 BPM e zeram as tentativas', () => {
    const p = defaultProgress();
    expect(recordAttempt(p, 'strum:pop', 0.95, 70).raised).toBe(false);
    expect(recordAttempt(p, 'strum:pop', 0.95, 70).raised).toBe(false);
    const r = recordAttempt(p, 'strum:pop', 0.95, 70);
    expect(r).toEqual({ raised: true, bpm: 75 });
    expect(p.bpm['strum:pop']).toBe(75);
    expect(p.attempts['strum:pop']).toEqual([]);
  });
  it('uma tentativa abaixo de 90% impede a subida', () => {
    const p = defaultProgress();
    recordAttempt(p, 'k', 0.95, 60);
    recordAttempt(p, 'k', 0.75, 60);
    expect(recordAttempt(p, 'k', 0.95, 60).raised).toBe(false);
  });
  it('limite de 160 BPM', () => {
    const p = defaultProgress();
    p.bpm.k = 160;
    recordAttempt(p, 'k', 1, 160);
    recordAttempt(p, 'k', 1, 160);
    expect(recordAttempt(p, 'k', 1, 160)).toEqual({ raised: false, bpm: 160 });
  });
  it('recordApply atualiza melhor BPM e músicas concluídas', () => {
    const p = defaultProgress();
    recordApply(p, 'song:pop-g', 70, 'ok', true);
    expect(p.bestStrumBpm).toBe(70);
    expect(p.songsCompleted).toBe(1);
    recordApply(p, 'song:pop-g', 90, 'close', true);
    expect(p.bestStrumBpm).toBe(70);
    expect(p.songsCompleted).toBe(1);
  });
});

describe('metas de fase', () => {
  it('fase 1 exige afinar 3 vezes e batida a 60 BPM', () => {
    const p = defaultProgress();
    expect(phaseComplete(p)).toBe(false);
    p.tunedCount = 3;
    expect(phaseComplete(p)).toBe(false);
    p.bestStrumBpm = 60;
    expect(phaseComplete(p)).toBe(true);
  });
  it('advancePhase cria as cartas da nova fase e zera o contador de trocas', () => {
    const p = defaultProgress();
    p.tunedCount = 3;
    p.bestStrumBpm = 60;
    p.sessionsInPhase = 5;
    expect(advancePhase(p, TODAY)).toBe(true);
    expect(p.phase).toBe(2);
    expect(p.sessionsInPhase).toBe(0);
    expect(Object.keys(p.cards)).toHaveLength(5);
  });
  it('advancePhase não avança sem cumprir a meta', () => {
    const p = defaultProgress();
    expect(advancePhase(p, TODAY)).toBe(false);
    expect(p.phase).toBe(1);
  });
  it('fase 2 exige trocas/min e acordes dominados (caixa ≥3)', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    p.bestChangesPerMinute = 30;
    expect(phaseComplete(p)).toBe(false);
    for (const c of Object.values(p.cards)) c.box = 3;
    expect(phaseComplete(p)).toBe(true);
  });
  it('a última fase não avança', () => {
    const p = defaultProgress();
    p.phase = 6;
    ensureCards(p, TODAY);
    p.bestChangesPerMinute = 99;
    for (const c of Object.values(p.cards)) c.box = 5;
    expect(advancePhase(p, TODAY)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/scheduler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/scheduler.ts`:
```ts
import type { Verdict } from './audio/chord';
import { PHASES, chordsUpTo } from './curriculum';
import { addDays, type Progress } from './storage';

/** Dias até a próxima revisão por caixa de Leitner (0-5). */
export const INTERVALS = [0, 1, 2, 4, 8, 16];
export const MASTERED_BOX = 3;
export const BPM_STEP = 5;
export const BPM_MAX = 160;
export const ACCURACY_TARGET = 0.9;
export const ATTEMPTS_NEEDED = 3;

export const VERDICT_ACCURACY: Record<Verdict, number> = { ok: 0.95, close: 0.75, miss: 0.4 };

export function reviewCard(p: Progress, chordId: string, verdict: Verdict, today: string): void {
  const card = p.cards[chordId] ?? { box: 0, due: today };
  if (verdict === 'ok') card.box = Math.min(5, card.box + 1);
  else if (verdict === 'miss') card.box = 0;
  card.due = addDays(today, verdict === 'close' ? 1 : INTERVALS[card.box]);
  p.cards[chordId] = card;
}

export function ensureCards(p: Progress, today: string): void {
  for (const id of chordsUpTo(p.phase)) {
    if (!p.cards[id]) p.cards[id] = { box: 0, due: today };
  }
}

/** Acordes com revisão vencida, mais fracos primeiro. */
export function dueChords(p: Progress, today: string, exclude: string[] = []): string[] {
  return Object.entries(p.cards)
    .filter(([id, c]) => c.due <= today && !exclude.includes(id))
    .sort((a, b) => a[1].box - b[1].box || (a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}

/** Os `n` acordes liberados com menor caixa (empates seguem a ordem do currículo). */
export function weakestChords(p: Progress, n: number): string[] {
  return chordsUpTo(p.phase)
    .map((id, order) => ({ id, order, box: p.cards[id]?.box ?? 0 }))
    .sort((a, b) => a.box - b.box || a.order - b.order)
    .slice(0, n)
    .map((x) => x.id);
}

export function shouldRaiseBpm(attempts: number[]): boolean {
  return attempts.length >= ATTEMPTS_NEEDED && attempts.slice(-ATTEMPTS_NEEDED).every((a) => a >= ACCURACY_TARGET);
}

export function recordAttempt(
  p: Progress,
  key: string,
  accuracy: number,
  startBpm: number,
): { raised: boolean; bpm: number } {
  const current = p.bpm[key] ?? startBpm;
  const list = [...(p.attempts[key] ?? []), accuracy].slice(-ATTEMPTS_NEEDED);
  if (shouldRaiseBpm(list)) {
    const next = Math.min(BPM_MAX, current + BPM_STEP);
    p.bpm[key] = next;
    p.attempts[key] = [];
    return { raised: next > current, bpm: next };
  }
  p.bpm[key] = current;
  p.attempts[key] = list;
  return { raised: false, bpm: current };
}

export function recordApply(
  p: Progress,
  key: string,
  bpmUsed: number,
  verdict: Verdict,
  isSong: boolean,
): { raised: boolean; bpm: number } {
  const accuracy = VERDICT_ACCURACY[verdict];
  if (accuracy >= ACCURACY_TARGET) {
    p.bestStrumBpm = Math.max(p.bestStrumBpm, bpmUsed);
    if (isSong) p.songsCompleted++;
  }
  return recordAttempt(p, key, accuracy, bpmUsed);
}

export function phaseComplete(p: Progress): boolean {
  const g = PHASES[p.phase - 1].goal;
  if (g.tunedTimes !== undefined && p.tunedCount < g.tunedTimes) return false;
  if (g.strumBpm !== undefined && p.bestStrumBpm < g.strumBpm) return false;
  if (g.changesPerMinute !== undefined && p.bestChangesPerMinute < g.changesPerMinute) return false;
  if (g.songsCompleted !== undefined && p.songsCompleted < g.songsCompleted) return false;
  if (g.chordsMastered && !chordsUpTo(p.phase).every((id) => (p.cards[id]?.box ?? 0) >= MASTERED_BOX)) return false;
  return true;
}

export function advancePhase(p: Progress, today: string): boolean {
  if (p.phase >= PHASES.length || !phaseComplete(p)) return false;
  p.phase++;
  p.bestChangesPerMinute = 0;
  p.sessionsInPhase = 0;
  ensureCards(p, today);
  return true;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/scheduler.test.ts`
Expected: PASS (16 testes).

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.ts tests/scheduler.test.ts
git commit -m "feat: repetição espaçada, regra de BPM e metas de fase"
```

---

### Task 9: Montagem da sessão e nivelamento

**Files:**
- Create: `src/session.ts`, `src/placement.ts`
- Test: `tests/session.test.ts`, `tests/placement.test.ts`

- [ ] **Step 1: Testes que falham**

`tests/session.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSession } from '../src/session';
import { ensureCards } from '../src/scheduler';
import { defaultProgress } from '../src/storage';

const TODAY = '2026-10-17';

describe('buildSession', () => {
  it('fase 1: afinação, aquecimento, técnica e ritmo (sem troca de acordes)', () => {
    const blocks = buildSession(defaultProgress(), TODAY);
    expect(blocks.map((b) => b.kind)).toEqual(['tune', 'warmup', 'technique', 'apply']);
    const apply = blocks[3];
    expect(apply.patternId).toBe('down4');
    expect(apply.bpm).toBe(60);
    expect(apply.bpmKey).toBe('strum:down4');
  });
  it('fase 2: troca de acordes com os 2 mais fracos e revisão dos demais vencidos', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    const blocks = buildSession(p, TODAY);
    expect(blocks.map((b) => b.kind)).toEqual(['tune', 'warmup', 'technique', 'changes', 'apply', 'review']);
    const changes = blocks.find((b) => b.kind === 'changes')!;
    expect(changes.pair).toEqual(['Em', 'Am']);
    const review = blocks.find((b) => b.kind === 'review')!;
    expect(review.chordIds).toEqual(['E', 'A', 'D']);
  });
  it('a dica de técnica gira com sessionsInPhase', () => {
    const p = defaultProgress();
    const a = buildSession(p, TODAY)[2].title;
    p.sessionsInPhase = 1;
    const b = buildSession(p, TODAY)[2].title;
    expect(a).not.toBe(b);
  });
  it('fase 4 alterna batidas e usa 4 acordes', () => {
    const p = defaultProgress();
    p.phase = 4;
    ensureCards(p, TODAY);
    const a = buildSession(p, TODAY).find((b) => b.kind === 'apply')!;
    expect(a.patternId).toBe('pop');
    expect(a.chordIds).toHaveLength(4);
    p.sessionsInPhase = 1;
    expect(buildSession(p, TODAY).find((b) => b.kind === 'apply')!.patternId).toBe('sertanejo');
  });
  it('fase 5 toca progressões como música', () => {
    const p = defaultProgress();
    p.phase = 5;
    ensureCards(p, TODAY);
    const a = buildSession(p, TODAY).find((b) => b.kind === 'apply')!;
    expect(a.isSong).toBe(true);
    expect(a.bpmKey).toMatch(/^song:/);
  });
  it('usa o BPM guardado quando existe', () => {
    const p = defaultProgress();
    p.bpm['strum:down4'] = 75;
    expect(buildSession(p, TODAY).find((b) => b.kind === 'apply')!.bpm).toBe(75);
  });
});
```

`tests/placement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PLACEMENT_CHORDS, applyPlacement } from '../src/placement';
import { defaultProgress } from '../src/storage';
import type { Verdict } from '../src/audio/chord';

const TODAY = '2026-10-17';
const all = (v: Verdict) => Object.fromEntries(PLACEMENT_CHORDS.map((id) => [id, v])) as Record<string, Verdict>;

describe('applyPlacement', () => {
  it('nenhum acorde → fase 1', () => {
    const p = defaultProgress();
    applyPlacement(p, all('miss'), TODAY);
    expect(p.phase).toBe(1);
    expect(p.placementDone).toBe(true);
  });
  it('só alguns acordes → fase 2, conhecidos na caixa 2', () => {
    const p = defaultProgress();
    applyPlacement(p, { ...all('miss'), Em: 'ok' }, TODAY);
    expect(p.phase).toBe(2);
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-19' });
    expect(p.cards.A).toEqual({ box: 0, due: TODAY });
  });
  it('todos os acordes da fase 2 → fase 3', () => {
    const p = defaultProgress();
    applyPlacement(p, all('ok'), TODAY);
    expect(p.phase).toBe(3);
    expect(p.cards.G.box).toBe(2);
    expect(p.cards.Dm).toEqual({ box: 0, due: TODAY });
  });
  it('"quase" não conta como conhecido', () => {
    const p = defaultProgress();
    applyPlacement(p, all('close'), TODAY);
    expect(p.phase).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/session.test.ts tests/placement.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/session.ts`:
```ts
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
```

`src/placement.ts`:
```ts
import type { Verdict } from './audio/chord';
import { PHASES, chordsUpTo } from './curriculum';
import { ensureCards } from './scheduler';
import { addDays, type Progress } from './storage';

export const PLACEMENT_CHORDS = ['A', 'D', 'E', 'G', 'C', 'Em', 'Am'];

/** Define a fase inicial e as caixas de Leitner a partir do teste de nivelamento. */
export function applyPlacement(p: Progress, results: Record<string, Verdict>, today: string): void {
  const ok = (id: string) => results[id] === 'ok';
  const known = PLACEMENT_CHORDS.filter(ok);

  p.phase = known.length === 0 ? 1 : PHASES[1].chordIds.every(ok) ? 3 : 2;
  p.placementDone = true;
  p.sessionsInPhase = 0;

  ensureCards(p, today);
  for (const id of chordsUpTo(p.phase)) {
    if (ok(id)) p.cards[id] = { box: 2, due: addDays(today, 2) };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/session.test.ts tests/placement.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/session.ts src/placement.ts tests/session.test.ts tests/placement.test.ts
git commit -m "feat: montagem da sessão diária e nivelamento"
```

---

### Task 10: Contador de trocas limpas

**Files:**
- Create: `src/audio/changeCounter.ts`
- Test: `tests/changeCounter.test.ts`

- [ ] **Step 1: Teste que falha**

`tests/changeCounter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ChangeCounter } from '../src/audio/changeCounter';

describe('ChangeCounter', () => {
  it('2 leituras ok seguidas contam 1 troca e alternam o alvo', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    expect(c.target).toBe('Em');
    expect(c.feed('ok')).toBe(false);
    expect(c.feed('ok')).toBe(true);
    expect(c.count).toBe(1);
    expect(c.target).toBe('Am');
  });
  it('leitura ruim no meio zera a sequência', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    c.feed('ok');
    c.feed('miss');
    c.feed('ok');
    expect(c.count).toBe(0);
  });
  it('conta várias trocas', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    for (const v of ['ok', 'ok', 'miss', 'ok', 'ok', 'close', 'ok', 'ok'] as const) c.feed(v);
    expect(c.count).toBe(3);
    expect(c.target).toBe('Am');
  });
  it('contagem manual alterna o alvo', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    c.manual();
    expect(c.count).toBe(1);
    expect(c.target).toBe('Am');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/changeCounter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/audio/changeCounter.ts`:
```ts
import type { Verdict } from './chord';

/** Conta trocas limpas entre dois acordes: 2 leituras `ok` seguidas no alvo atual. */
export class ChangeCounter {
  count = 0;
  private idx = 0;
  private streak = 0;

  constructor(private readonly ids: [string, string]) {}

  get target(): string {
    return this.ids[this.idx];
  }

  /** Retorna true quando uma troca foi contada. */
  feed(verdict: Verdict): boolean {
    if (verdict !== 'ok') {
      this.streak = 0;
      return false;
    }
    this.streak++;
    if (this.streak < 2) return false;
    this.manual();
    return true;
  }

  /** Contagem manual (modo sem microfone). */
  manual(): void {
    this.count++;
    this.idx = 1 - this.idx;
    this.streak = 0;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/changeCounter.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/audio/changeCounter.ts tests/changeCounter.test.ts
git commit -m "feat: contador de trocas limpas de acorde"
```

---

### Task 11: Microfone, escuta, metrônomo, config e App

**Files:**
- Create: `src/config.ts`, `src/audio/mic.ts`, `src/audio/listen.ts`, `src/audio/metronome.ts`, `src/app.ts`
- Test: `tests/metronome.test.ts`

- [ ] **Step 1: Teste que falha (parte pura do metrônomo)**

`tests/metronome.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { beatIntervalSec } from '../src/audio/metronome';

describe('beatIntervalSec', () => {
  it('60 BPM = 1 s, 120 BPM = 0.5 s', () => {
    expect(beatIntervalSec(60)).toBe(1);
    expect(beatIntervalSec(120)).toBe(0.5);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/metronome.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/config.ts`:
```ts
/** `?timescale=0.02` encurta cronômetros (usado nos testes E2E). */
export const TIME_SCALE: number = Number(new URLSearchParams(location.search).get('timescale')) || 1;
```

`src/audio/mic.ts`:
```ts
export type MicError = 'denied' | 'unsupported' | 'notfound';

export class Mic {
  private readonly buf: Float32Array;

  constructor(
    private readonly ctx: AudioContext,
    private readonly stream: MediaStream,
    private readonly analyser: AnalyserNode,
  ) {
    this.buf = new Float32Array(analyser.fftSize);
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  /** Últimas `fftSize` amostras (8192). O mesmo buffer é reaproveitado a cada leitura. */
  read(): Float32Array {
    this.analyser.getFloatTimeDomainData(this.buf);
    return this.buf;
  }

  stop(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
  }
}

export async function startMic(): Promise<{ mic: Mic } | { error: MicError }> {
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!navigator.mediaDevices?.getUserMedia || !AC) return { error: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return { mic: new Mic(ctx, stream, analyser) };
  } catch (e) {
    const name = (e as DOMException).name;
    return { error: name === 'NotFoundError' || name === 'OverconstrainedError' ? 'notfound' : 'denied' };
  }
}
```

`src/audio/listen.ts`:
```ts
import { checkChord, type ChordResult } from './chord';
import { rms } from './level';
import type { Mic } from './mic';

/** Confere o acorde esperado ~8x por segundo. Retorna a função que para a escuta. */
export function listenChord(
  mic: Mic,
  getPcs: () => number[],
  minRms: number,
  onResult: (r: ChordResult) => void,
  intervalMs = 125,
): () => void {
  const id = window.setInterval(() => {
    onResult(checkChord(mic.read(), mic.sampleRate, getPcs(), minRms));
  }, intervalMs);
  return () => window.clearInterval(id);
}

/** Mede o ruído de fundo (RMS médio) por `ms` milissegundos. */
export function calibrate(mic: Mic, ms: number): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    const id = window.setInterval(() => samples.push(rms(mic.read())), 100);
    window.setTimeout(() => {
      window.clearInterval(id);
      resolve(samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0);
    }, ms);
  });
}
```

`src/audio/metronome.ts`:
```ts
export function beatIntervalSec(bpm: number): number {
  return 60 / bpm;
}

/** Metrônomo com agendamento antecipado (lookahead) para não oscilar com o timer do JS. */
export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private nextTime = 0;
  private beat = 0;
  private bpm = 60;

  /** `beat` começa em 0 e cresce sem parar; use `beat % 4` para o tempo do compasso. */
  constructor(private readonly onBeat: (beat: number) => void) {}

  get running(): boolean {
    return this.timer !== undefined;
  }

  async start(bpm: number): Promise<void> {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx ??= new AC();
    await this.ctx.resume();
    this.bpm = bpm;
    this.beat = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.1) {
      const n = this.beat;
      this.click(this.nextTime, n % 4 === 0);
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.running) this.onBeat(n);
      }, delay);
      this.nextTime += beatIntervalSec(this.bpm);
      this.beat++;
    }
  }

  private click(t: number, accent: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}
```

`src/app.ts`:
```ts
import { calibrate } from './audio/listen';
import { startMic, type Mic, type MicError } from './audio/mic';
import type { Verdict } from './audio/chord';
import { TIME_SCALE } from './config';
import { loadProgress, saveProgress, type Progress } from './storage';

export interface SessionResult {
  date: string;
  changesPerMinute: number | null;
  reviewed: Record<string, Verdict>;
  bpmRaised: string[];
  partial: boolean;
  minutes: number;
  advancedPhase: boolean;
}

export interface App {
  progress: Progress;
  mic: Mic | null;
  micError: MicError | null;
  /** RMS médio do ambiente, medido na calibração. */
  noiseFloor: number;
  lastResult: SessionResult | null;
  save(): void;
  go(route: string): void;
  /** Liga e calibra o microfone na primeira chamada. Retorna null se indisponível. */
  ensureMic(): Promise<Mic | null>;
  /** Volume mínimo (RMS) para considerar que há som. */
  minRms(): number;
}

export type Screen = (root: HTMLElement, app: App) => void | (() => void);

const MIC_TIMEOUT_MS = 8000;

export function createApp(): App {
  let pending: Promise<Mic | null> | undefined;

  async function init(): Promise<Mic | null> {
    const timeout = new Promise<{ error: MicError }>((res) =>
      window.setTimeout(() => res({ error: 'denied' }), MIC_TIMEOUT_MS),
    );
    const r = await Promise.race([startMic(), timeout]);
    if ('error' in r) {
      app.micError = r.error;
      return null;
    }
    app.mic = r.mic;
    app.noiseFloor = await calibrate(r.mic, 3000 * TIME_SCALE);
    return r.mic;
  }

  const app: App = {
    progress: loadProgress(),
    mic: null,
    micError: null,
    noiseFloor: 0,
    lastResult: null,
    save() {
      saveProgress(app.progress);
    },
    go(route) {
      location.hash = '#/' + route;
    },
    ensureMic() {
      if (!app.progress.settings.micEnabled) return Promise.resolve(null);
      if (app.mic) return Promise.resolve(app.mic);
      if (app.micError) return Promise.resolve(null);
      pending ??= init();
      return pending;
    },
    minRms() {
      return Math.max(0.008, app.noiseFloor * 3) / app.progress.settings.sensitivity;
    },
  };
  return app;
}

export function micMessage(app: App): string {
  if (!app.progress.settings.micEnabled) return 'Microfone desligado nos ajustes. Use os botões manuais.';
  switch (app.micError) {
    case 'denied':
      return 'Microfone bloqueado. Libere nas permissões do navegador e recarregue, ou use os botões manuais.';
    case 'notfound':
      return 'Nenhum microfone encontrado. Use os botões manuais.';
    case 'unsupported':
      return 'Seu navegador não suporta áudio avançado. Use Chrome, Edge ou Safari atualizado.';
    default:
      return 'Microfone indisponível. Use os botões manuais.';
  }
}
```

- [ ] **Step 4: Rodar testes e checar tipos**

Run: `npx vitest run tests/metronome.test.ts && npx tsc --noEmit`
Expected: teste PASS e `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/audio/mic.ts src/audio/listen.ts src/audio/metronome.ts src/app.ts tests/metronome.test.ts
git commit -m "feat: microfone, escuta, calibração, metrônomo e estado do app"
```

---

### Task 12: Helpers de DOM, afinador (view) e telas Início / Afinador

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/tunerView.ts`, `src/ui/homeScreen.ts`, `src/ui/tunerScreen.ts`

- [ ] **Step 1: `src/ui/dom.ts`**

```ts
import type { Verdict } from '../audio/chord';
import { getChord } from '../chords';
import { TIME_SCALE } from '../config';
import { chordDiagramSvg } from './chordDiagram';

type Kid = Node | string | number | null | undefined | false;

/** Cria um elemento. Atributos `onxxx` viram listeners; `html` define innerHTML (só use com SVG nosso). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, String(v));
  }
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Cronômetro regressivo. A duração respeita TIME_SCALE. */
export function countdown(seconds: number, onEnd?: () => void): { el: HTMLElement; stop: () => void } {
  const total = Math.max(1, Math.round(seconds * TIME_SCALE));
  const end = Date.now() + total * 1000;
  const el = h('div', { class: 'timer', 'data-testid': 'timer' }, fmt(total));
  const id = window.setInterval(() => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = fmt(left);
    if (left === 0) {
      window.clearInterval(id);
      onEnd?.();
    }
  }, 200);
  return { el, stop: () => window.clearInterval(id) };
}

export function chordCard(id: string): HTMLElement {
  const def = getChord(id);
  return h('figure', { class: 'chord' }, h('div', { html: chordDiagramSvg(def) }), h('figcaption', {}, def.name));
}

/** Botões de autoavaliação (usados sem microfone ou como alternativa a ele). */
export function selfButtons(onPick: (v: Verdict) => void, labels: [string, string, string] = ['Consegui', 'Quase', 'Não consegui']): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('button', { 'data-testid': 'self-ok', onclick: () => onPick('ok') }, labels[0]),
    h('button', { 'data-testid': 'self-close', class: 'secondary', onclick: () => onPick('close') }, labels[1]),
    h('button', { 'data-testid': 'self-miss', class: 'secondary', onclick: () => onPick('miss') }, labels[2]),
  );
}
```

- [ ] **Step 2: `src/ui/tunerView.ts`**

```ts
import { rms } from '../audio/level';
import { detectPitch } from '../audio/pitch';
import { micMessage, type App } from '../app';
import { freqToMidi, noteName } from '../theory';
import { STRING_LABELS, nearestString, tuneState } from '../tuner';
import { h } from './dom';

const MESSAGES = {
  flat: 'Grave demais: gire a tarraxa para apertar a corda.',
  sharp: 'Aguda demais: afrouxe a corda.',
  ok: 'Afinada!',
} as const;

/** Monta o afinador em `box`. `onAllTuned` dispara uma vez quando as 6 cordas ficam afinadas. Retorna o cleanup. */
export function mountTuner(box: HTMLElement, app: App, onAllTuned?: () => void): () => void {
  const note = h('div', { class: 'tuner-note' }, '–');
  const needle = h('div', { class: 'needle' });
  const status = h('p', { class: 'status', 'data-testid': 'tuner-status' }, 'Preparando microfone… fique em silêncio por 3 s.');
  const strings = STRING_LABELS.map((l) => h('span', { class: 'str' }, l));
  box.append(note, h('div', { class: 'meter' }, needle), status, h('div', { class: 'strings' }, ...strings));

  const tuned = new Set<number>();
  let okRun = 0;
  let fired = false;
  let stopped = false;
  let timer: number | undefined;

  void app.ensureMic().then((mic) => {
    if (stopped) return;
    if (!mic) {
      status.textContent = micMessage(app) + ' Afine com outro afinador e continue.';
      return;
    }
    status.textContent = 'Toque uma corda.';
    timer = window.setInterval(() => {
      const buf = mic.read();
      if (rms(buf) < app.minRms()) return;
      const r = detectPitch(buf.subarray(0, 4096), mic.sampleRate);
      if (!r || r.clarity < 0.8) return;
      const m = nearestString(r.freq);
      if (Math.abs(m.cents) > 150) return;

      note.textContent = noteName(freqToMidi(r.freq));
      needle.style.left = `${50 + Math.max(-50, Math.min(50, m.cents))}%`;
      const state = tuneState(m.cents);
      status.textContent = `${m.label}: ${MESSAGES[state]}`;

      okRun = state === 'ok' ? okRun + 1 : 0;
      if (okRun >= 3) {
        tuned.add(m.index);
        strings[m.index].classList.add('done');
      }
      if (tuned.size === 6 && !fired) {
        fired = true;
        onAllTuned?.();
      }
    }, 100);
  });

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
  };
}
```

- [ ] **Step 3: `src/ui/homeScreen.ts`**

```ts
import type { Screen } from '../app';
import { PHASES } from '../curriculum';
import { todayStr } from '../storage';
import { h } from './dom';

export const homeScreen: Screen = (root, app) => {
  const p = app.progress;
  const phase = PHASES[p.phase - 1];
  const practicedToday = p.lastPracticeDay === todayStr();
  const hasAudio = !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

  root.append(
    h('h1', {}, 'Violão'),
    !hasAudio && h('p', { class: 'warn' }, 'Seu navegador não suporta áudio avançado. Use Chrome, Edge ou Safari atualizado.'),
    h('p', { 'data-testid': 'streak' }, `Sequência: ${p.streak} dia(s)`),
    p.placementDone && !practicedToday && h('p', { class: 'hint' }, 'Você ainda não praticou hoje.'),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, `Fase ${phase.id}: ${phase.title}`),
      h('p', {}, phase.summary),
      h('p', {}, `Meta: ${phase.goal.description}`),
    ),
    p.placementDone
      ? h('button', { class: 'big', 'data-testid': 'start', onclick: () => app.go('session') }, practicedToday ? 'Praticar de novo' : 'Começar sessão de hoje')
      : h('button', { class: 'big', 'data-testid': 'placement', onclick: () => app.go('placement') }, 'Fazer nivelamento (5 min)'),
  );
};
```

- [ ] **Step 4: `src/ui/tunerScreen.ts`**

```ts
import type { Screen } from '../app';
import { h } from './dom';
import { mountTuner } from './tunerView';

export const tunerScreen: Screen = (root, app) => {
  const box = h('div', { class: 'tuner' });
  root.append(h('h1', {}, 'Afinador'), box);
  return mountTuner(box, app, () => {
    app.progress.tunedCount++;
    app.save();
  });
};
```

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/dom.ts src/ui/tunerView.ts src/ui/homeScreen.ts src/ui/tunerScreen.ts
git commit -m "feat: helpers de DOM, afinador e tela inicial"
```

---

### Task 13: Roteador, estilos e tela de nivelamento

**Files:**
- Create: `src/ui/placementScreen.ts`, `src/ui/sessionScreen.ts` (stub), `src/ui/resultScreen.ts` (stub), `src/ui/progressScreen.ts` (stub), `src/ui/libraryScreen.ts` (stub), `src/ui/settingsScreen.ts` (stub), `src/ui/debugScreen.ts` (stub)
- Modify: `src/main.ts`, `src/style.css`

Os stubs são substituídos nas Tasks 14-16. Eles existem agora só para o roteador compilar.

- [ ] **Step 1: Stubs** — crie cada arquivo abaixo com o mesmo conteúdo, trocando o nome exportado e o título:

`src/ui/sessionScreen.ts`:
```ts
import type { Screen } from '../app';
import { h } from './dom';

export const sessionScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Sessão'));
};
```
Repita para `resultScreen.ts` (`resultScreen`, 'Resultado'), `progressScreen.ts` (`progressScreen`, 'Progresso'), `libraryScreen.ts` (`libraryScreen`, 'Biblioteca'), `settingsScreen.ts` (`settingsScreen`, 'Ajustes'), `debugScreen.ts` (`debugScreen`, 'Debug').

- [ ] **Step 2: `src/ui/placementScreen.ts`**

```ts
import type { Screen } from '../app';
import { micMessage } from '../app';
import type { Verdict } from '../audio/chord';
import { listenChord } from '../audio/listen';
import { chordPcs, getChord } from '../chords';
import { PLACEMENT_CHORDS, applyPlacement } from '../placement';
import { todayStr } from '../storage';
import { chordCard, h, selfButtons } from './dom';

export const placementScreen: Screen = (root, app) => {
  const results: Record<string, Verdict> = {};
  let i = 0;
  let stopListen = () => {};
  let disposed = false;
  const stage = h('div');
  root.append(h('h1', {}, 'Nivelamento'), h('p', {}, 'Toque cada acorde. Se não lembrar, toque em "Não consegui".'), stage);

  function show(): void {
    stopListen();
    stopListen = () => {};
    if (i >= PLACEMENT_CHORDS.length) {
      applyPlacement(app.progress, results, todayStr());
      app.save();
      app.go('home');
      return;
    }
    const my = i;
    const id = PLACEMENT_CHORDS[my];
    const live = h('p', { class: 'live' }, '');
    const rate = (v: Verdict) => {
      if (i !== my) return;
      results[id] = v;
      i++;
      show();
    };
    stage.replaceChildren(
      h('p', {}, `Acorde ${my + 1} de ${PLACEMENT_CHORDS.length}`),
      chordCard(id),
      live,
      selfButtons(rate),
    );

    void app.ensureMic().then((mic) => {
      if (disposed || i !== my) return;
      if (!mic) {
        live.textContent = micMessage(app);
        return;
      }
      live.textContent = 'Ouvindo… toque o acorde.';
      let okRun = 0;
      stopListen = listenChord(mic, () => chordPcs(getChord(id)), app.minRms(), (r) => {
        okRun = r.verdict === 'ok' ? okRun + 1 : 0;
        if (okRun >= 2) rate('ok');
      });
    });
  }

  show();
  return () => {
    disposed = true;
    stopListen();
  };
};
```

- [ ] **Step 3: `src/main.ts`**

```ts
import './style.css';
import { createApp, type Screen } from './app';
import { debugScreen } from './ui/debugScreen';
import { h } from './ui/dom';
import { homeScreen } from './ui/homeScreen';
import { libraryScreen } from './ui/libraryScreen';
import { placementScreen } from './ui/placementScreen';
import { progressScreen } from './ui/progressScreen';
import { resultScreen } from './ui/resultScreen';
import { sessionScreen } from './ui/sessionScreen';
import { settingsScreen } from './ui/settingsScreen';
import { tunerScreen } from './ui/tunerScreen';

const app = createApp();
const root = document.getElementById('app')!;
const nav = document.getElementById('nav')!;

const routes: Record<string, Screen> = {
  home: homeScreen,
  placement: placementScreen,
  tuner: tunerScreen,
  session: sessionScreen,
  result: resultScreen,
  progress: progressScreen,
  library: libraryScreen,
  settings: settingsScreen,
  debug: debugScreen,
};

const links: [string, string][] = [
  ['home', 'Início'],
  ['tuner', 'Afinador'],
  ['progress', 'Progresso'],
  ['library', 'Biblioteca'],
  ['settings', 'Ajustes'],
];

let cleanup: void | (() => void);

function render(): void {
  if (typeof cleanup === 'function') cleanup();
  const name = location.hash.replace(/^#\//, '') || 'home';
  nav.replaceChildren(...links.map(([r, label]) => h('a', { href: '#/' + r, class: r === name ? 'active' : '' }, label)));
  root.replaceChildren();
  cleanup = (routes[name] ?? homeScreen)(root, app);
}

window.addEventListener('hashchange', render);
render();
```

- [ ] **Step 4: `src/style.css`**

```css
:root {
  --bg: #14161a;
  --fg: #eceff4;
  --muted: #9aa3b2;
  --card: #1f232a;
  --accent: #4ade80;
  --warn: #fbbf24;
  --bad: #f87171;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root { --bg: #fafaf7; --fg: #1b1d21; --muted: #5b6472; --card: #ffffff; --accent: #15803d; --warn: #b45309; --bad: #b91c1c; color-scheme: light; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 640px; margin: 0 auto; padding: 16px; }
nav { display: flex; gap: 4px; padding: 8px 12px; overflow-x: auto; border-bottom: 1px solid var(--card); }
nav a { color: var(--muted); text-decoration: none; padding: 6px 10px; border-radius: 8px; white-space: nowrap; }
nav a.active { color: var(--fg); background: var(--card); }
h1 { font-size: 1.6rem; margin: 8px 0 12px; }
.card { background: var(--card); border-radius: 12px; padding: 12px 16px; margin: 12px 0; }
button { font: inherit; padding: 12px 16px; border-radius: 10px; border: 0; background: var(--accent); color: #06260f; font-weight: 600; cursor: pointer; }
button.secondary, button.ghost { background: var(--card); color: var(--fg); border: 1px solid var(--muted); }
button.big { width: 100%; padding: 18px; font-size: 1.15rem; }
button:disabled { opacity: 0.5; cursor: default; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.warn { color: var(--warn); }
.hint, .live { color: var(--muted); }
.chord { margin: 0; text-align: center; color: var(--fg); --bg: var(--card); }
.diagrams, .chords-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.timer { font-size: 2rem; font-variant-numeric: tabular-nums; text-align: center; }
.count { font-size: 3rem; text-align: center; font-weight: 700; }
.instr { font-size: 1.1rem; }
.tuner-note { font-size: 5rem; text-align: center; font-weight: 700; }
.meter { position: relative; height: 16px; background: var(--card); border-radius: 8px; margin: 12px 0; }
.meter::after { content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; background: var(--accent); }
.needle { position: absolute; top: -4px; bottom: -4px; width: 6px; margin-left: -3px; background: var(--fg); border-radius: 3px; left: 50%; transition: left 0.1s; }
.strings { display: flex; gap: 8px; justify-content: center; }
.str { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: var(--card); }
.str.done { background: var(--accent); color: #06260f; }
.grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin: 12px 0; }
.slot { text-align: center; padding: 10px 0; background: var(--card); border-radius: 6px; font-size: 1.2rem; }
.slot.on { background: var(--accent); color: #06260f; }
.chip { padding: 6px 12px; border-radius: 999px; background: var(--card); }
.chip.on { background: var(--accent); color: #06260f; }
.bar { height: 14px; background: var(--accent); border-radius: 4px; margin: 4px 0; }
.retune { margin: 8px 0; }
table { width: 100%; border-collapse: collapse; }
td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--card); }
```

- [ ] **Step 5: Build e verificação manual**

Run: `npm run build`
Expected: sucesso, sem erro de tipos.

Run: `npm run dev` e abra a URL mostrada. Verifique: barra de navegação aparece; Início mostra "Fazer nivelamento"; o nivelamento mostra um diagrama por acorde e os 3 botões; clicar nos botões avança 7 acordes e volta ao Início já com "Começar sessão de hoje". Pare o servidor (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/style.css src/ui
git commit -m "feat: roteador, estilos e tela de nivelamento"
```

---

### Task 14: Tela de sessão e resultado

**Files:**
- Modify (substituir stub): `src/ui/sessionScreen.ts`, `src/ui/resultScreen.ts`

- [ ] **Step 1: `src/ui/sessionScreen.ts`**

```ts
import type { App, Screen, SessionResult } from '../app';
import { micMessage } from '../app';
import { ChangeCounter } from '../audio/changeCounter';
import type { Verdict } from '../audio/chord';
import { listenChord } from '../audio/listen';
import { Metronome } from '../audio/metronome';
import { chordPcs, getChord } from '../chords';
import { PATTERNS } from '../curriculum';
import { advancePhase, recordApply, reviewCard } from '../scheduler';
import { buildSession, type Block } from '../session';
import { todayStr, updateStreak } from '../storage';
import { NOTE_NAMES } from '../theory';
import { chordCard, countdown, h, selfButtons } from './dom';
import { mountTuner } from './tunerView';

type Renderer = (box: HTMLElement, app: App, b: Block, next: () => void, result: SessionResult) => () => void;

const VERDICT_TEXT: Record<Verdict, string> = { ok: 'Certo!', close: 'Quase lá', miss: 'Ainda não' };

function liveText(v: Verdict, missing: number[]): string {
  const hint = missing.length ? ` — falta soar: ${missing.map((pc) => NOTE_NAMES[pc]).join(', ')}` : '';
  return VERDICT_TEXT[v] + hint;
}

const tuneBlock: Renderer = (box, app, _b, next) => {
  let all = false;
  const stop = mountTuner(box, app, () => {
    all = true;
  });
  box.append(
    h(
      'button',
      {
        'data-testid': 'next',
        onclick: () => {
          if (all || !app.mic) app.progress.tunedCount++;
          next();
        },
      },
      'Afinado, continuar',
    ),
  );
  return stop;
};

const textBlock: Renderer = (box, _app, b, next) => {
  const t = countdown(b.minutes * 60);
  box.append(h('p', { class: 'instr' }, b.instruction), t.el, h('button', { 'data-testid': 'next', onclick: next }, 'Pronto'));
  return t.stop;
};

const changesBlock: Renderer = (box, app, b, next, result) => {
  const [a, c] = b.pair!;
  const counter = new ChangeCounter([a, c]);
  const countEl = h('div', { class: 'count', 'data-testid': 'count' }, '0');
  const targetEl = h('p', { class: 'instr' }, '');
  const liveEl = h('p', { class: 'live' }, '');
  const timerBox = h('div');
  const actions = h('div', { class: 'row' });
  let stopListen = () => {};
  let timer: { stop: () => void } | null = null;
  let disposed = false;

  const refresh = () => {
    countEl.textContent = String(counter.count);
    targetEl.textContent = `Toque agora: ${counter.target}`;
  };

  const finishTimer = () => {
    stopListen();
    result.changesPerMinute = counter.count;
    app.progress.bestChangesPerMinute = Math.max(app.progress.bestChangesPerMinute, counter.count);
    actions.replaceChildren(
      h('p', {}, `${counter.count} trocas limpas em 1 minuto.`),
      h('button', { 'data-testid': 'next', onclick: next }, 'Continuar'),
    );
  };

  const start = async () => {
    actions.replaceChildren(h('p', { class: 'live' }, 'Preparando microfone…'));
    const mic = await app.ensureMic();
    if (disposed) return;
    refresh();
    const t = countdown(60, finishTimer);
    timer = t;
    timerBox.replaceChildren(t.el);
    actions.replaceChildren(
      h('button', { 'data-testid': 'count-change', onclick: () => { counter.manual(); refresh(); } }, '+1 troca limpa (manual)'),
      h('button', { class: 'ghost', 'data-testid': 'skip', onclick: next }, 'Pular'),
    );
    if (!mic) {
      liveEl.textContent = micMessage(app) + ' Conte cada troca bem feita no botão.';
      return;
    }
    stopListen = listenChord(mic, () => chordPcs(getChord(counter.target)), app.minRms(), (r) => {
      liveEl.textContent = liveText(r.verdict, r.missing);
      if (counter.feed(r.verdict)) refresh();
    });
  };

  box.append(
    h('p', { class: 'instr' }, b.instruction),
    h('div', { class: 'diagrams' }, chordCard(a), chordCard(c)),
    timerBox,
    countEl,
    targetEl,
    liveEl,
    actions,
  );
  actions.append(h('button', { 'data-testid': 'start-timer', onclick: () => void start() }, 'Começar 1 minuto'));

  return () => {
    disposed = true;
    timer?.stop();
    stopListen();
  };
};

const applyBlock: Renderer = (box, app, b, next, result) => {
  const pat = PATTERNS[b.patternId!];
  const chords = b.chordIds ?? [];
  const slots = pat.slots.map((s) => h('span', { class: 'slot' }, s === 'D' ? '↓' : s === 'U' ? '↑' : '·'));
  const chips = chords.map((id) => h('span', { class: 'chip' }, id));
  const metro = new Metronome((beat) => {
    slots.forEach((s) => s.classList.remove('on'));
    slots[(beat % 4) * 2].classList.add('on');
    chips.forEach((c) => c.classList.remove('on'));
    if (chips.length) chips[Math.floor(beat / 4) % chips.length].classList.add('on');
  });
  const metroBtn = h('button', {
    'data-testid': 'metro',
    onclick: () => {
      if (metro.running) {
        metro.stop();
        metroBtn.textContent = 'Ligar metrônomo';
      } else {
        void metro.start(b.bpm!);
        metroBtn.textContent = 'Parar metrônomo';
      }
    },
  }, 'Ligar metrônomo');
  const t = countdown(b.minutes * 60);

  const rate = (v: Verdict) => {
    metro.stop();
    const r = recordApply(app.progress, b.bpmKey!, b.bpm!, v, !!b.isSong);
    if (r.raised) result.bpmRaised.push(`${b.title}: ${r.bpm} BPM`);
    next();
  };

  box.append(
    h('p', { class: 'instr' }, b.instruction),
    h('p', {}, h('strong', {}, String(b.bpm)), ' BPM'),
    h('div', { class: 'chords-row' }, ...chords.map(chordCard)),
    h('div', { class: 'row' }, ...chips),
    h('div', { class: 'grid' }, ...slots),
    metroBtn,
    t.el,
    h('p', {}, 'Como foi? (3 acertos seguidos com "Consegui" sobem o BPM)'),
    selfButtons(rate),
  );
  return () => {
    metro.stop();
    t.stop();
  };
};

const reviewBlock: Renderer = (box, app, b, next, result) => {
  const ids = b.chordIds!;
  const today = todayStr();
  const stage = h('div');
  let i = 0;
  let stopListen = () => {};
  let disposed = false;
  box.append(stage);

  const show = () => {
    stopListen();
    stopListen = () => {};
    if (i >= ids.length) {
      next();
      return;
    }
    const my = i;
    const id = ids[my];
    const live = h('p', { class: 'live' }, '');
    const rate = (v: Verdict) => {
      if (i !== my) return;
      reviewCard(app.progress, id, v, today);
      result.reviewed[id] = v;
      i++;
      show();
    };
    stage.replaceChildren(h('p', { class: 'instr' }, `Toque ${getChord(id).name} uma vez, devagar.`), chordCard(id), live, selfButtons(rate));

    void app.ensureMic().then((mic) => {
      if (disposed || i !== my) return;
      if (!mic) {
        live.textContent = micMessage(app);
        return;
      }
      let okRun = 0;
      stopListen = listenChord(mic, () => chordPcs(getChord(id)), app.minRms(), (r) => {
        live.textContent = liveText(r.verdict, r.missing);
        okRun = r.verdict === 'ok' ? okRun + 1 : 0;
        if (okRun >= 2) rate('ok');
      });
    });
  };
  show();
  return () => {
    disposed = true;
    stopListen();
  };
};

const RENDERERS: Record<Block['kind'], Renderer> = {
  tune: tuneBlock,
  warmup: textBlock,
  technique: textBlock,
  changes: changesBlock,
  apply: applyBlock,
  review: reviewBlock,
};

export const sessionScreen: Screen = (root, app) => {
  const today = todayStr();
  const blocks = buildSession(app.progress, today);
  const result: SessionResult = {
    date: today,
    changesPerMinute: null,
    reviewed: {},
    bpmRaised: [],
    partial: false,
    minutes: 0,
    advancedPhase: false,
  };
  const startedAt = Date.now();
  let idx = 0;
  let stopBlock = () => {};
  let ended = false;
  let stopRetune: (() => void) | null = null;

  const title = h('h1', {}, '');
  const stage = h('div', { class: 'stage' });
  const tunerBox = h('div');
  const retune = h('details', { class: 'retune' }, h('summary', {}, 'Reafinar'), tunerBox);
  retune.addEventListener('toggle', () => {
    if (retune.open) {
      stopRetune = mountTuner(tunerBox, app);
    } else {
      stopRetune?.();
      stopRetune = null;
      tunerBox.replaceChildren();
    }
  });

  root.append(
    title,
    app.progress.history.length < 14 && h('p', { class: 'hint' }, 'Dedos doendo é normal nas 2 primeiras semanas. Pare se a dor for forte.'),
    stage,
    retune,
    h('button', { class: 'ghost', 'data-testid': 'end-early', onclick: () => finish(true) }, 'Dedos doendo? Encerrar agora'),
  );

  function show(): void {
    stopBlock();
    stage.replaceChildren();
    if (idx >= blocks.length) {
      finish(false);
      return;
    }
    const b = blocks[idx];
    title.textContent = `${idx + 1}/${blocks.length} · ${b.title} (${b.minutes} min)`;
    stopBlock = RENDERERS[b.kind](stage, app, b, () => {
      idx++;
      show();
    }, result);
  }

  function finish(partial: boolean): void {
    if (ended) return;
    ended = true;
    stopBlock();
    stopRetune?.();
    const p = app.progress;
    updateStreak(p, today);
    p.sessionsInPhase++;
    result.partial = partial;
    result.minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    p.history.push({ date: today, changesPerMinute: result.changesPerMinute, minutes: result.minutes, partial });
    p.history = p.history.slice(-60);
    result.advancedPhase = advancePhase(p, today);
    app.lastResult = result;
    app.save();
    app.go('result');
  }

  show();
  return () => {
    stopBlock();
    stopRetune?.();
  };
};
```

- [ ] **Step 2: `src/ui/resultScreen.ts`**

```ts
import type { Screen } from '../app';
import { PHASES } from '../curriculum';
import { h } from './dom';

const VERDICT_TEXT = { ok: 'Certo', close: 'Quase', miss: 'Ainda não' } as const;

export const resultScreen: Screen = (root, app) => {
  const r = app.lastResult;
  if (!r) {
    app.go('home');
    return;
  }
  const p = app.progress;
  const phase = PHASES[p.phase - 1];
  const reviewed = Object.entries(r.reviewed);

  root.append(
    h(
      'div',
      { 'data-testid': 'result' },
      h('h1', {}, r.partial ? 'Sessão encerrada' : 'Sessão concluída!'),
      h('p', { 'data-testid': 'result-streak' }, `Sequência: ${p.streak} dia(s)`),
      r.changesPerMinute !== null && h('p', {}, `Trocas limpas em 1 minuto: ${r.changesPerMinute}`),
      reviewed.length > 0 &&
        h(
          'section',
          { class: 'card' },
          h('h2', {}, 'Revisão'),
          h('table', {}, ...reviewed.map(([id, v]) => h('tr', {}, h('td', {}, id), h('td', {}, VERDICT_TEXT[v])))),
          h('p', { class: 'hint' }, 'Acordes com "Ainda não" voltam na próxima sessão.'),
        ),
      r.bpmRaised.length > 0 && h('section', { class: 'card' }, h('h2', {}, 'BPM subiu'), ...r.bpmRaised.map((t) => h('p', {}, t))),
      r.advancedPhase
        ? h('section', { class: 'card' }, h('h2', {}, `Fase concluída! Agora: ${phase.title}`), h('p', {}, `Meta: ${phase.goal.description}`))
        : h('p', { class: 'hint' }, `Próxima meta (fase ${phase.id}): ${phase.goal.description}`),
      h('button', { class: 'big', 'data-testid': 'back-home', onclick: () => app.go('home') }, 'Voltar ao início'),
    ),
  );
};
```

- [ ] **Step 3: Checar tipos e build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 4: Verificação manual da sessão**

Run: `npm run dev`. Abra `http://localhost:5173/?timescale=0.05#/home`. Faça o nivelamento com "Não consegui" (fase 1) e inicie a sessão. Verifique: bloco 1 afinador (mensagem de microfone), blocos de texto com cronômetro e "Pronto", bloco de ritmo com metrônomo audível, grade de batida pulsando, botões de autoavaliação, depois tela de resultado. Repita o nivelamento limpando `localStorage` e respondendo "Consegui" em tudo para ver o bloco "Troca de acordes" (fase 3): "Começar 1 minuto" → "+1 troca limpa" → aguardar fim → "Continuar".

- [ ] **Step 5: Commit**

```bash
git add src/ui/sessionScreen.ts src/ui/resultScreen.ts
git commit -m "feat: tela de sessão (6 blocos) e tela de resultado"
```

---

### Task 15: Progresso, Biblioteca, Ajustes e Debug

**Files:**
- Modify (substituir stub): `src/ui/progressScreen.ts`, `src/ui/libraryScreen.ts`, `src/ui/settingsScreen.ts`, `src/ui/debugScreen.ts`

- [ ] **Step 1: `src/ui/progressScreen.ts`**

```ts
import type { Screen } from '../app';
import { PHASES, chordsUpTo } from '../curriculum';
import { MASTERED_BOX } from '../scheduler';
import { h } from './dom';

export const progressScreen: Screen = (root, app) => {
  const p = app.progress;
  const chords = chordsUpTo(p.phase);
  const withCpm = p.history.filter((s) => s.changesPerMinute !== null).slice(-14);
  const maxCpm = Math.max(40, ...withCpm.map((s) => s.changesPerMinute!));

  root.append(
    h('h1', {}, 'Progresso'),
    h('p', {}, `Sequência: ${p.streak} dia(s) · Sessões: ${p.history.length}`),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Fases'),
      ...PHASES.map((ph) =>
        h(
          'p',
          {},
          ph.id < p.phase ? '✓ ' : ph.id === p.phase ? '▶ ' : '○ ',
          h('strong', {}, `${ph.id}. ${ph.title}`),
          ` — ${ph.goal.description}`,
        ),
      ),
    ),
    chords.length > 0 &&
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Acordes'),
        h(
          'div',
          { class: 'row' },
          ...chords.map((id) => {
            const box = p.cards[id]?.box ?? 0;
            return h('span', { class: box >= MASTERED_BOX ? 'chip on' : 'chip' }, `${id}${box >= MASTERED_BOX ? ' ✓' : ''}`);
          }),
        ),
        h('p', { class: 'hint' }, 'Marcado com ✓ = dominado (3 acertos espaçados).'),
      ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Trocas limpas por minuto'),
      withCpm.length === 0
        ? h('p', { class: 'hint' }, 'Ainda sem dados. Aparecem a partir da fase 2.')
        : h(
            'div',
            {},
            ...withCpm.map((s) =>
              h('div', {}, h('small', {}, `${s.date}: ${s.changesPerMinute}`), h('div', { class: 'bar', style: `width:${Math.round((s.changesPerMinute! / maxCpm) * 100)}%` })),
            ),
          ),
    ),
  );
};
```

- [ ] **Step 2: `src/ui/libraryScreen.ts`**

```ts
import type { Screen } from '../app';
import { CHORDS } from '../chords';
import { PATTERNS } from '../curriculum';
import { chordCard, h } from './dom';

export const libraryScreen: Screen = (root) => {
  root.append(
    h('h1', {}, 'Biblioteca'),
    h('h2', {}, 'Acordes'),
    h('div', { class: 'diagrams' }, ...Object.keys(CHORDS).map(chordCard)),
    h('h2', {}, 'Batidas'),
    ...Object.values(PATTERNS).map((pat) =>
      h(
        'section',
        { class: 'card' },
        h('strong', {}, `${pat.name} (${pat.bpm} BPM)`),
        h('div', { class: 'grid' }, ...pat.slots.map((s) => h('span', { class: 'slot' }, s === 'D' ? '↓' : s === 'U' ? '↑' : '·'))),
        h('small', {}, '↓ = para baixo · ↑ = para cima · · = só o balanço da mão'),
      ),
    ),
  );
};
```

- [ ] **Step 3: `src/ui/settingsScreen.ts`**

```ts
import type { Screen } from '../app';
import { defaultProgress, parseProgress } from '../storage';
import { h } from './dom';

export const settingsScreen: Screen = (root, app) => {
  const s = app.progress.settings;

  const micToggle = h('input', { type: 'checkbox', ...(s.micEnabled ? { checked: 'checked' } : {}) });
  micToggle.checked = s.micEnabled;
  micToggle.addEventListener('change', () => {
    s.micEnabled = micToggle.checked;
    app.save();
  });

  const sens = h('input', { type: 'range', min: '0.5', max: '2', step: '0.1', value: String(s.sensitivity) });
  sens.addEventListener('change', () => {
    s.sensitivity = Number(sens.value);
    app.save();
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      Object.assign(app.progress, parseProgress(await file.text()));
      app.save();
      alert('Progresso importado.');
      app.go('home');
    } catch {
      alert('Arquivo inválido. O progresso atual foi mantido.');
    }
  });

  root.append(
    h('h1', {}, 'Ajustes'),
    h('label', { class: 'card' }, micToggle, ' Usar o microfone para ouvir o violão'),
    h('label', { class: 'card' }, 'Sensibilidade do microfone: ', sens, h('small', { class: 'hint' }, ' Aumente se o app não ouve; diminua se há muito ruído.')),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Backup'),
      h(
        'button',
        {
          onclick: () => {
            const blob = new Blob([JSON.stringify(app.progress, null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'violao-progresso.json' });
            a.click();
            URL.revokeObjectURL(a.href);
          },
        },
        'Exportar progresso',
      ),
      h('p', {}, 'Importar: ', fileInput),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Apagar dados'),
      h(
        'button',
        {
          class: 'secondary',
          onclick: () => {
            if (!confirm('Apagar todo o progresso? Isso não pode ser desfeito.')) return;
            Object.assign(app.progress, defaultProgress());
            app.save();
            app.go('home');
          },
        },
        'Apagar progresso',
      ),
    ),
  );
};
```

- [ ] **Step 4: `src/ui/debugScreen.ts`** (ferramenta de calibração do detector com violão real)

```ts
import type { Screen } from '../app';
import { checkChord, chromaStrengths, EXTRA_ABOVE, MISSING_BELOW } from '../audio/chord';
import { CHORDS, chordPcs, getChord } from '../chords';
import { NOTE_NAMES } from '../theory';
import { h } from './dom';

export const debugScreen: Screen = (root, app) => {
  const select = h('select', {}, ...Object.keys(CHORDS).map((id) => h('option', { value: id }, id)));
  const verdict = h('p', {}, '–');
  const bars = h('div');
  root.append(
    h('h1', {}, 'Debug do detector'),
    h('p', { class: 'hint' }, `Limites atuais: ausente < ${MISSING_BELOW}, sobrando > ${EXTRA_ABOVE}. Veja docs/calibracao.md.`),
    select,
    verdict,
    bars,
  );

  let timer: number | undefined;
  let stopped = false;
  void app.ensureMic().then((mic) => {
    if (stopped || !mic) {
      if (!mic) verdict.textContent = 'Sem microfone.';
      return;
    }
    timer = window.setInterval(() => {
      const buf = mic.read();
      const pcs = chordPcs(getChord(select.value));
      const r = checkChord(buf, mic.sampleRate, pcs, app.minRms());
      verdict.textContent = `${r.verdict} · score ${r.score.toFixed(2)} · falta [${r.missing.map((pc) => NOTE_NAMES[pc])}] · sobra [${r.extra.map((pc) => NOTE_NAMES[pc])}]`;
      const s = chromaStrengths(buf, mic.sampleRate);
      bars.replaceChildren(
        ...s.map((v, pc) =>
          h('div', {}, h('small', {}, `${NOTE_NAMES[pc]}${pcs.includes(pc) ? ' *' : ''} ${v.toFixed(2)}`), h('div', { class: 'bar', style: `width:${Math.round(v * 100)}%` })),
        ),
      );
    }, 150);
  });

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
  };
};
```

- [ ] **Step 5: Build e verificação manual**

Run: `npm run build`
Expected: sucesso.

Run: `npm run dev`. Confira: Progresso lista as 6 fases; Biblioteca mostra os 15 diagramas e 4 batidas; Ajustes exporta um `.json` que reimporta sem erro (e um arquivo qualquer não-JSON mostra "Arquivo inválido"); `#/debug` mostra barras ao tocar.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: telas de progresso, biblioteca, ajustes e debug do detector"
```

---

### Task 16: Testes E2E (Playwright)

**Files:**
- Create: `playwright.config.ts`, `e2e/flow.spec.ts`

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173' },
});
```

- [ ] **Step 2: `e2e/flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('fluxo completo sem microfone: nivelamento, sessão, resultado e persistência', async ({ page }) => {
  await page.goto('/?timescale=0.02#/home');

  await expect(page.getByTestId('streak')).toHaveText('Sequência: 0 dia(s)');
  await page.getByTestId('placement').click();
  for (let i = 0; i < 7; i++) {
    await page.getByTestId('self-ok').click();
  }

  await expect(page.getByTestId('start')).toBeVisible();
  await page.getByTestId('start').click();

  const result = page.getByTestId('result');
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    if (await result.isVisible()) break;

    const startTimer = page.getByTestId('start-timer');
    if (await startTimer.isVisible()) {
      await startTimer.click();
      await page.getByTestId('count-change').click();
      await page.getByTestId('count-change').click();
      await expect(page.getByTestId('next')).toBeVisible({ timeout: 5000 });
    }
    await page.locator('[data-testid="next"], [data-testid="self-ok"]').first().click();
  }

  await expect(result).toBeVisible();
  await expect(page.getByTestId('result-streak')).toHaveText('Sequência: 1 dia(s)');

  await page.getByTestId('back-home').click();
  await page.reload();
  await expect(page.getByTestId('streak')).toHaveText('Sequência: 1 dia(s)');
});

test('encerrar cedo (dedos doendo) mantém a sequência', async ({ page }) => {
  await page.goto('/?timescale=0.02#/home');
  await page.getByTestId('placement').click();
  for (let i = 0; i < 7; i++) await page.getByTestId('self-miss').click();
  await page.getByTestId('start').click();
  await page.getByTestId('end-early').click();
  await expect(page.getByTestId('result')).toBeVisible();
  await expect(page.getByTestId('result-streak')).toHaveText('Sequência: 1 dia(s)');
});

test.describe('com microfone falso do Chromium', () => {
  test.use({
    permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  });

  test('o afinador liga o microfone e sai do estado de preparação', async ({ page }) => {
    await page.goto('/?timescale=0.05#/tuner');
    await expect(page.getByTestId('tuner-status')).toHaveText(/^(Toque uma corda\.|[EADGBe]:)/, { timeout: 8000 });
  });
});
```

- [ ] **Step 3: Rodar**

Run: `npm run test:e2e`
Expected: 3 testes PASS. Se o fluxo completo travar num bloco, rode com `npx playwright test --headed --debug` e ajuste o seletor do bloco travado.

- [ ] **Step 4: Rodar a suíte unitária completa**

Run: `npm test`
Expected: todos os arquivos de `tests/` PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: E2E do fluxo completo, encerramento antecipado e microfone falso"
```

---

### Task 17: Calibração com violão real e README

**Files:**
- Create: `docs/calibracao.md`, `README.md`

Esta tarefa é manual: o detector de acordes só pode ser validado com um violão de verdade.

- [ ] **Step 1: `docs/calibracao.md`**

```markdown
# Calibração do detector de acordes

Precisa de um violão afinado e do app rodando (`npm run dev`).

1. Abra `http://localhost:5173/#/debug` no mesmo dispositivo em que você vai praticar.
2. Fique em silêncio por 3 segundos na abertura (calibração do ruído).
3. Para cada acorde da biblioteca, escolha-o no seletor e toque limpo por 3 segundos, 3 vezes.
4. Anote o veredito:
   - Esperado ao tocar certo: `ok` na maior parte do tempo.
   - Se vier `close` ou `miss` com acorde limpo, olhe as barras: as notas do acorde estão marcadas com `*`.
5. Ajuste em `src/audio/chord.ts`:
   - Notas esperadas aparecem com força < `MISSING_BELOW` (0.2) → baixe o valor (ex.: 0.15).
   - Notas fora do acorde aparecem com força > `EXTRA_ABOVE` (0.7) em acorde limpo → suba o valor (ex.: 0.8).
6. Toque acordes errados de propósito (um dedo fora). Devem dar `close` ou `miss`, nunca `ok`.
7. Rode `npm test` (os testes sintéticos precisam continuar passando) e registre abaixo os valores finais e o violão/microfone usados.

## Registro

| Data | Dispositivo/microfone | MISSING_BELOW | EXTRA_ABOVE | Observações |
|---|---|---|---|---|
| (preencher na calibração) | | | | |
```

- [ ] **Step 2: `README.md`**

```markdown
# Violão

App web para aprender violão de aço (pop, rock, sertanejo) em sessões diárias de 15-20 min.

## Rodar

    npm install
    npm run dev        # desenvolvimento
    npm run build      # produção (pasta dist/)
    npm test           # testes unitários
    npm run test:e2e   # testes E2E (Playwright)

Use no Chrome, Edge ou Safari atuais. O microfone só funciona em `localhost` ou HTTPS.

## Estrutura

Veja `docs/superpowers/specs/2026-10-17-violao-app-design.md` (design) e
`docs/superpowers/plans/2026-10-17-violao-app.md` (plano). Calibração do detector: `docs/calibracao.md`.
```

- [ ] **Step 3: Calibrar com violão real** (usuário) e preencher a tabela de registro.

- [ ] **Step 4: Commit**

```bash
git add docs/calibracao.md README.md src/audio/chord.ts
git commit -m "docs: README e procedimento de calibração do detector"
```

---

## Self-review (cobertura do spec)

| Requisito do spec | Onde |
|---|---|
| Web estático, sem backend, localStorage | Tasks 1, 7 |
| `audio/pitch`, `audio/chord`, `audio/metronome`, `tuner` | Tasks 3, 4, 11, 2 |
| `curriculum`, `scheduler`, `session`, `storage`, `ui/chord-diagram` | Tasks 6, 8, 9, 7, 5 |
| 6 fases com metas e liberação por meta | Tasks 6, 8 |
| Nivelamento no dia 1 | Tasks 9, 13 |
| Sessão de 6 blocos | Tasks 9, 14 |
| BPM sobe com ≥90% em 3 tentativas | Task 8 (`recordAttempt`) |
| Repetição espaçada | Task 8 (Leitner) |
| Troca de acordes em 1 min | Tasks 10, 14 |
| Streak + dia de descanso | Task 7 |
| Aviso de dor nos dedos / pausa | Task 14 (banner + "Encerrar agora") |
| Resposta "quase lá" com dica | Tasks 4, 14 (`liveText`) |
| Microfone negado/ausente → modo manual | Tasks 11, 12, 14 |
| Ruído alto: calibração e sensibilidade | Tasks 11, 15 |
| Navegador sem Web Audio | Tasks 11, 12 |
| Dados corrompidos / export / import / reset | Tasks 7, 15 |
| Telas: Início, Nivelamento, Afinador, Sessão, Resultado, Progresso, Biblioteca, Ajustes | Tasks 12-15 |
| Testes unit, currículo, E2E, calibração manual | Tasks 2-10, 16, 17 |
| Sem letras/cifras comerciais | Task 6 (progressões próprias) |

**Lacunas assumidas (ver "Decisões de escopo" no topo):** apply autoavaliado, reafinar manual, lembrete por banner.

**Consistência de tipos:** `Verdict` definido em `audio/chord.ts` e importado por `scheduler`, `placement`, `app`, `changeCounter` e UI. `recordApply(p, key, bpmUsed, verdict, isSong)` tem a mesma assinatura na Task 8 e no uso da Task 14. `Block.bpmKey/bpm/patternId/isSong` definidos na Task 9 e usados na Task 14. `App.minRms()/ensureMic()/lastResult` definidos na Task 11 e usados nas Tasks 12-15.
