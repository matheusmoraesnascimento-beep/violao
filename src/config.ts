/** `?timescale=0.02` encurta cronômetros (usado nos testes E2E). */
export const TIME_SCALE: number = Number(new URLSearchParams(location.search).get('timescale')) || 1;
