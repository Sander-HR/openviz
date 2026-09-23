# Self-hosted Inter

Place the following files in this directory to fully self-host Inter:

- `Inter-Variable.woff2` (normal, weight 100-900)
- `Inter-Italic-Variable.woff2` (italic, weight 100-900)

The app is already configured to load these files via `@font-face` in `src/index.css`.
If these files are not present, the app falls back to local/system sans fonts.
