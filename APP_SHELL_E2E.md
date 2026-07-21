# AppShell targeted browser E2E

Run the isolated accessibility browser flow against a production build:

```bash
npm run build
npm run e2e:app-shell
```

The test uses real Chromium keyboard events at a 390×844 viewport and verifies the skip link, drawer initial focus, Tab/Shift+Tab wrapping, Escape dismissal, and focus restoration.

Failure diagnostics are written to `app-shell-e2e-artifacts/` when run directly and to `critical-e2e-artifacts/app-shell/` when run through `npm run e2e:critical`.
