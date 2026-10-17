# Violão — App web para aprender violão (design)

Data: 2026-10-17

## Objetivo

App web que ensina violão de aço (pop, rock, sertanejo) para um usuário que já tocou e esqueceu. Sessões diárias de 15-20 min, com feedback do microfone, baseadas em técnicas comprovadas de aprendizado de instrumento.

## Decisões

- Plataforma: web no navegador, mobile-first, sem backend.
- Instrumento: violão acústico de aço.
- Estilos: pop, rock, sertanejo.
- Abordagem: curso guiado linear (trilha de fases com meta para avançar), com música real a partir da fase 5.
- Tempo de prática: 15-20 min por dia.
- Feedback: microfone detecta nota, afinação e acorde (aproximado); modo autoavaliação como fallback.
- Ponto de partida: "já toquei, esqueci"; nivelamento no primeiro dia.
- Inclui afinador por microfone.
- Fora de escopo: letras e cifras de músicas comerciais (direitos autorais); contas de usuário; backend; app nativo.

## Técnicas de aprendizado embutidas

- Prática deliberada: um foco por exercício, meta clara.
- Repetição espaçada: acordes errados voltam mais cedo.
- Metrônomo lento, depois acelera: BPM sobe 5 quando acerto ≥90% em 3 tentativas.
- Troca de acordes em 1 minuto como métrica de progresso.
- Sessões curtas diárias, streak, dia de descanso sem quebrar streak.
- Aviso de pausa por dor nos dedos nas 2 primeiras semanas.

## Arquitetura

Web app estático (HTML + TypeScript, build com Vite). Progresso em `localStorage`/IndexedDB.

| Módulo | Função | Depende de |
|---|---|---|
| `audio/pitch` | Capta microfone, detecta nota e frequência (YIN/autocorrelação) | Web Audio API |
| `audio/chord` | Confere acorde via cromagrama com tolerância; resposta graduada (certo / quase lá + dica / errado) | `audio/pitch` |
| `audio/metronome` | Clique preciso, BPM variável | Web Audio API |
| `tuner` | Afinação das 6 cordas (E A D G B e) | `audio/pitch` |
| `curriculum` | Lições em JSON: fases, acordes, metas | nada |
| `scheduler` | Repetição espaçada e regra de subida de BPM | `storage` |
| `session` | Monta a sessão diária em blocos | `curriculum`, `scheduler` |
| `ui/chord-diagram` | Diagramas de acorde e braço em SVG | nada |
| `storage` | Progresso, streak, estatísticas, export/import JSON | localStorage |

Limite conhecido: acorde completo por microfone é aproximado. Nota isolada e afinação são confiáveis.

## Currículo

Nivelamento no dia 1 (5 min): afina, toca A, D, E, G, C, Em, Am. Marca o que acertou, pula o que sabe.

| Fase | Foco | Meta para avançar |
|---|---|---|
| 1. Base | Postura, cordas, afinação, calos, ritmo básico | Afina sozinho; ritmo ↓↓↓↓ a 60 BPM |
| 2. Acordes abertos | Em, Am, E, A, D | 30 trocas limpas/min entre pares |
| 3. Mais acordes | G, C, Dm, F fácil (4 cordas) | Mesma meta, 8 acordes |
| 4. Batidas | Pop, sertanejo, rock | Mantém batida a 80 BPM trocando acorde |
| 5. Músicas | Progressões de 3-4 acordes (ex.: I-V-vi-IV) com material próprio | Toca música inteira sem parar |
| 6. Evolução | Pestana (F completo, Bm), power chords, palhetada alternada, dedilhado simples | Pestana limpa; power chords em rock |

Fases liberam por meta cumprida, não por data.

## Sessão diária (15-20 min)

1. Afinação (1-2 min)
2. Aquecimento de dedos (2 min)
3. Técnica nova da fase (5 min)
4. Troca de acordes cronometrada, 1 min por par (4 min)
5. Música ou batida aplicada (5 min)
6. Revisão espaçada de acordes antigos (2 min)

## Telas

Mobile-first, uso com violão no colo.

- Início: "Começar sessão de hoje", streak, fase atual, próxima meta.
- Nivelamento: só no dia 1.
- Afinador: agulha grande, nota alvo por corda, verde quando afinada.
- Sessão: uma etapa por vez, diagrama SVG, metrônomo, barra de acerto ao vivo, cronômetro do bloco.
- Resultado: trocas/min, acerto %, BPM que subiu, o que volta amanhã.
- Progresso: mapa das 6 fases, acordes dominados, gráfico de trocas/min.
- Biblioteca: dicionário de acordes e batidas.
- Ajustes: microfone, sensibilidade, lembrete, apagar dados, exportar/importar backup.

Fluxo: Início → (dia 1: Nivelamento) → Afinador → Sessão (6 blocos) → Resultado → Início.

## Erros e casos de borda

- Microfone negado ou ausente: modo autoavaliação (consegui / quase / não); todas as lições funcionam.
- Ruído alto: aviso, sensibilidade ajustável, calibração de 3 s no início.
- Acorde duvidoso: "quase lá" com dica específica, nunca só certo/errado.
- Violão desafinado no meio da sessão: pausa e envia ao afinador.
- Navegador sem Web Audio: mensagem clara e recomendação de navegador atual.
- Dados locais corrompidos: backup JSON e reset seguro.
- Dor nos dedos: botão "Pausa"; sessão encurtada sem perder streak.

## Testes

- Unit: `audio/pitch`, `audio/chord`, `scheduler`, regra de BPM, usando áudios gravados.
- Unit: validação do currículo (todo acorde tem diagrama; toda fase tem meta).
- Manual com violão real para calibrar tolerâncias do detector.
- E2E (Playwright) com microfone simulado: sessão completa, persistência, modo sem microfone.

## Direitos autorais

Sem letras ou cifras comerciais. Exercícios e progressões próprios no estilo de cada gênero; usuário pode tocar junto com suas músicas favoritas por conta própria.
