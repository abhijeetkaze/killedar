# CLAUDE.md — Killedar

Offline trek companion for Sahyadri forts near Pune. Built for the DEV Hacktoberfest 2026
"Touch Grass" challenge (repo started 2026-10-10).

- **web/** — installable PWA. Gemma runs on-device via WebLLM; works with no signal.
- **api/** — small Starlette service. Predicts climb time with TabPFN. Online-only, optional.

## Rules

1. **Hexagonal layout, dependencies point inward.**
   `domain` → nothing. `ports` → domain. `app` (use cases) → domain + ports.
   `adapters` → ports + domain. `ui` / `main` = composition root, the only place adapters are wired.
   Never import an adapter from `domain` or `app`.
2. **Domain is pure.** No `fetch`, DOM, `Date.now()`, randomness or I/O in `domain/`. Pass time in.
3. **Every domain function and use case has a test.** Use fakes for ports, never network.
4. **Offline first.** Anything needed on the fort (fort data, audio, model, app shell) must be
   cached by the service worker or WebLLM. Online-only features (prediction) must degrade to
   the local Naismith baseline, never block the UI.
5. **Zero runtime deps in web/.** WebLLM is loaded from CDN at runtime (`adapters/webllmModel.ts`).
   Dev deps: `typescript`, `@types/node` only. No bundler: `tsc` emits native ES modules.
6. **Erasable TypeScript only** (`erasableSyntaxOnly`): no enums, no parameter properties,
   no namespaces. Import relative files with the `.ts` extension (tsc rewrites to `.js`).
7. **Fort data is facts about real places.** Keep `verified: false` until checked on site or
   against a cited source. Never invent bus times; leave them user-editable.
8. Keep it small. Prefer a plain function over a class, a class over a framework.
9. **No company code or internal material** in this repo — personal project, public sources only.

## Commands

```bash
# web
cd web
npm install          # typescript + @types/node
npm run check        # typecheck + tests + build  ← run before every commit
npm test             # node --test (native TS stripping, Node ≥ 22.18)
npm run build        # → web/dist  (KILLEDAR_API_URL=https://… to enable predictions)
npm run serve        # http://localhost:5173 (serves dist)
npm run audio        # ElevenLabs narration → public/audio (needs ELEVENLABS_* env)

# api
cd api
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt          # includes tabpfn (torch; weights download on first fit)
python -m unittest discover -s tests -t .    # ← run before every commit (pytest also works)
python -m killedar_api.evaluation data/hikes.csv   # TabPFN vs Naismith, leave-one-out
uvicorn killedar_api.main:app --reload --port 8000
```

CI (`.github/workflows/ci.yml`) runs both suites on every push. Deploy: `render.yaml` blueprint.

## Layout

```
web/src/
  domain/    fort.ts (model + validation) · plan.ts (timing, Naismith) · prompt.ts · model.ts (Gemma pick) · chat.ts
  ports/     languageModel.ts · climbPredictor.ts · fortRepository.ts
  app/       askFort.ts · planTrek.ts
  adapters/  webllmModel.ts · httpClimbPredictor.ts · naismithPredictor.ts · fetchFortRepository.ts · http.ts
  ui/        views.ts (screens) · copy.ts (all user-facing wording) · dom.ts
  main.ts    composition root
web/public/  forts/*.json · audio/*.mp3 · styles.css · manifest · icon
web/scripts/ build.ts · precache.ts · sw.template.js · serve.ts · generate-audio.ts · narration.ts
web/tests/   *.test.ts (node:test)

api/killedar_api/
  domain.py            HikeFeatures, Hike, Prediction, naismith_minutes, sane_minutes
  ports.py             ClimbTimeModel, Regressor protocols
  adapters/            naismith_model.py · tabpfn_model.py · csv_hikes.py
  evaluation.py        leave-one-out TabPFN vs Naismith
  app.py               create_app(model) — routes only, no wiring
  main.py              composition root (TabPFN if installed + enough hikes, else Naismith)
api/data/hikes.sample.csv  SYNTHETIC (make_sample.py) — tests/CI
api/data/hikes.csv         SYNTHETIC placeholder (make_sample.py --trails) — replace with real hikes
api/tests/
```

## Conventions

- Times inside the domain are minutes since midnight (`number`), formatted only in the UI.
- Language codes: `"en" | "mr"`.
- Commit after each green `npm run check` / unittest run; small commits.
