# SLA Insights Rewrite

This folder is a Vite + TypeScript rewrite of the original single-file `index.html` app.

The UI and CSV workflows are preserved, but the source is no longer exposed as one readable page through browser `Ctrl+U`. Production builds are minified and Vite source maps are disabled by default.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Open or deploy the generated `dist/` folder.

Important: any fully browser-side app can still be inspected in developer tools after build. To genuinely hide business logic from users, move the calculation engine behind a backend API.
