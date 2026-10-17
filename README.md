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

## Android

App nativo via Capacitor (`com.violao.app`). Requer Node, JDK 21 (`JAVA_HOME`) e Android SDK (`ANDROID_HOME`).

```bash
npm run android:apk       # build web + sync + gradle assembleDebug
npm run android:install   # adb install -r (celular com depuração USB)
```

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. O microfone é pedido na primeira vez que o afinador/sessão o usa.
