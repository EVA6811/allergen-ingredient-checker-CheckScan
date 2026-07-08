# CheckScan

CheckScan is a React + TypeScript + Vite demo app that scans food ingredient labels and compares them with a user's allergy or dietary restriction profile.

## Quick Start For Grading

1. Install Node.js 20 or later.
2. Double-click `demo-run.bat`.
3. When prompted, enter a Gemini API key.
4. The script installs dependencies if needed, starts the Vite dev server, and opens:

```text
http://127.0.0.1:5173
```

The `.env` file is intentionally not included in submissions because it contains a private API key. `demo-run.bat` creates it locally.

## Manual Run

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Install and run:

```bash
npm install
npm run dev
```

## Demo Account

```text
ID: admin
PW: admin123
```

New accounts cannot include `admin` in the username.

## Notes

- Submit the project files without `.env`, `node_modules`, `dist`, and `local-uploads`.
- The local image save API is implemented as a Vite dev server plugin, so run the project with `npm run dev` for grading.
- Uploaded food images may be saved under `local-uploads` during local demo runs.
- Allergy profile images used for automatic allergy input are analyzed only and are not saved to upload history or scan history.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
