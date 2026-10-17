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
