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
