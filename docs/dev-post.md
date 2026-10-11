---
title: "Killedar: a fort guide that works where the signal dies"
published: false
tags: devchallenge, hf26challenge, opensource, ai
cover_image: <!-- TODO: trek photo URL (upload to DEV first) -->
---

*This is a submission for the [DEV Hacktoberfest 2026 Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

<!-- TODO: trek photo — you on/near the fort, ideally with the phone visible -->
![On top of <FORT>, no bars](PHOTO_URL)

## What I Built

Halfway up Rajgad the bars on your phone go one by one. By Padmavati Machi you're carrying a
very expensive torch.

<!-- TODO (2–3 sentences, your own): the moment this happened to you — which fort, what you wanted to
know and couldn't look up, or the last bus you nearly missed. Specifics beat adjectives. -->

That's the problem with every AI trek assistant I could imagine building on a hosted API: it works
in Pune and stops working at the trailhead, which is exactly where you need it.

**Killedar** (किल्लेदार, the keeper of a Maratha fort) is an offline trek companion for the
Sahyadri forts around Pune: Sinhagad, Rajgad and Lohagad to start. It's a PWA with three
screens:

- **Plan**, at home, online: pick a fort and a trail and enter the last bus back from the base village.
  Killedar predicts *your* climb time from your own past hikes and works backwards from that bus,
  so it tells you when to leave Pune and not just how long the climb takes.
- **Ask**, on the fort, offline: "Is there water on Padmavati Machi?" "Which way is the Chor
  Darwaja route?" Answered by **Gemma running on the phone**, grounded only in that fort's notes,
  in English or Marathi.
- **Listen**, offline: the fort's history read aloud, so you can look at the walls instead of the screen.

You download the trail guide once on Wi-Fi. After that, airplane mode is fine.

## Demo

<!-- TODO: demo video. Suggested 60–90 s shot list:
  1. Plan screen on Wi-Fi: pick Rajgad → enter last bus → "Leave Pune by 06:10" (10 s)
  2. Tap "Download trail guide", progress bar (cut; 5 s)
  3. Swipe down → airplane mode ON, clearly visible (5 s)
  4. Ask: "Is there water at the top?" → answer streams in (15 s)
  5. Switch to मराठी, ask the same → Marathi answer (15 s)
  6. Listen: history narration playing, camera pans to the actual fort if you have the footage (15 s)
-->
{% embed VIDEO_URL %}

**Try it:** [killedar.onrender.com](https://killedar.onrender.com).
Use Chrome on Android or desktop; Ask needs WebGPU.

## Code

{% github abhijeetkaze/killedar %}

A static PWA and a bit of Python I run on my laptop. **There is no backend.** Both halves are
ports-and-adapters with a pure domain at the centre:

```
web/  PWA, zero runtime deps             api/  Python tooling, not a server
  domain   timing, prompt, model pick      domain     features, Naismith baseline
  ports    LanguageModel, Predictor        adapters   TabPFN, hikes CSV, fort trails
  app      planTrek, askFort               evaluation leave-one-out vs Naismith
  adapters WebLLM (Gemma), table, data     precompute → web/public/predictions.json
```

<!-- TODO: update counts if they change --> 75 web tests and 23 Python tests. CI runs both on every
push, including the real TabPFN model.

## How I Built It

### Gemma, on the phone

The Ask screen runs Gemma through [WebLLM](https://github.com/mlc-ai/web-llm), which compiles
models to WebGPU. WebLLM is imported from a CDN at runtime, so the web app has **no runtime
dependencies**: TypeScript compiles straight to ES modules and there's no bundler.

Which Gemma? That depends on the phone, so the choice is a small pure function. It takes the newest
generation that fits under ~2.6B parameters, uses q4f16 if the GPU supports `shader-f16` (half
the memory of q4f32), and avoids WebLLM's `-1k` builds, because the fort notes plus the question
don't fit in 1,024 tokens. On a phone with f16 support that lands on **Gemma 3 1B (q4f16), about
700 MB of VRAM**. Without f16 it falls back to Gemma 2 2B in q4f32. I tested the picker against the
real model list WebLLM ships, not a hand-written one.

Small models make things up, so the prompt is built to keep the answers short and true:

- The fort data is rendered as **compact prose notes**, not JSON. Small models follow prose better,
  and it saves context.
- The instruction says *answer only from the notes; if they don't cover it, say so*, and **never
  invent bus times, distances or phone numbers**. On a mountain, a confident wrong answer is worse
  than "I don't know".
- Answers are capped at about 80 words, because the reader is walking.
- Gemma's chat template has no system role, so instruction, notes and question go in one user turn.

A service worker precaches the app shell, the fort JSON and the narration audio, and keeps the
WebLLM module after the first visit. WebLLM stores the weights in Cache Storage itself. Together
they make the Ask screen work in airplane mode.

### TabPFN: a model of *me*, from 20 rows

Naismith's rule (an hour per 5 km plus an hour per 600 m of climb) is the classic estimate, and it
was written for Scottish hills, not for a laterite staircase at 9 a.m. in October humidity. The useful
question isn't "how long does Rajgad take" but "how long does Rajgad take **me**".

That's a regression problem with almost no data: my own hike history, a few dozen rows at best.
It's exactly the case [TabPFN](https://github.com/PriorLabs/TabPFN) is made for. TabPFN is a
pre-trained tabular foundation model, so "fitting" it on 20 rows is in-context learning. There's no
training loop and nothing to overfit with hyperparameters.

Features: distance, elevation gain, start hour, group size. Target: trailhead-to-summit minutes.
The evaluation is leave-one-out, so each hike is predicted by a model that never saw it:

<!-- TODO: paste output of `python -m killedar_api.evaluation data/hikes.csv` on your real hikes -->
| | Mean absolute error (leave-one-out, N hikes) |
|---|---|
| Naismith's rule | **XX min** |
| TabPFN on my hikes | **XX min** |

<!-- TODO: one honest sentence interpreting it, e.g. "Naismith thinks I'm faster than I am on steep
ground; TabPFN noticed." If TabPFN didn't win, say so; that's a result too. -->

My first version served TabPFN from a small web API. It worked, but it was the wrong shape twice
over. It needed signal, which is the one thing this app can't assume. And PyTorch plus TabPFN sat
right at the 512 MB limit of a free instance, so every prediction knocked the server over.

The fix was to notice how small the question space is. The app only ever asks about its own
trails, at a start hour between 4 and 14 and a group of 1 to 30. That's about 1,650 questions.
So TabPFN answers **all of them ahead of time**, on my laptop, in about 13 seconds:

```bash
python -m killedar_api.precompute data/hikes.csv   # → web/public/predictions.json (7 KB)
```

The service worker caches that file with the app shell. The Plan screen looks up *my* climb time in
about 20 ms, online or on the summit, and anything outside the table falls back to Naismith.
TabPFN still does the learning; the phone just reads its answers.

### Facts about real places

Fort data is facts about real mountains, and wrong facts there have consequences. Every fort file
cites its sources and stays `"verified": false` until it's been checked. Bus times are **left blank
on purpose**: the app asks you for the last bus rather than guessing one, because rural ST timings
change and a hallucinated 6:30 p.m. bus is how people end up walking down in the dark.

### Narration

The Listen screen plays ElevenLabs narration bundled into the app at build time (`npm run audio`),
so it costs nothing on the fort and needs no signal. Without the audio files it falls back to the
phone's own speech synthesis.
<!-- TODO: delete the ElevenLabs sentence (and prize line below) if you didn't generate audio -->

### Deploy

One `render.yaml` blueprint deploys the PWA to Render as a static site. That's the whole
deployment: Gemma runs on the phone, and TabPFN's answers ship in a 7 KB file.

## Why Does Open Innovation Matter?

Because the top of a Sahyadri fort has no signal, and that settles the argument.

A closed model behind an API is a service. It's there when the network is, when the bill is paid,
and when the provider still offers it. On Rajgad's Balekilla none of those hold. Open weights are
an **artifact**: once they're on the phone, nobody can switch them off, rate-limit them or price them
per question.

Running on the device also keeps things private. My hike history (where I go, when, how slowly)
goes into TabPFN on my own laptop, and only the predicted minutes ship with the app. Questions asked on the fort never leave the
phone at all.

It also matters who gets to build. Everything in Killedar is open: Gemma's weights, WebLLM's
compiler, TabPFN's model, the fort notes and their sources. So a trekking group in Nashik can fork
it, add Harishchandragad, correct my Marathi, and ship their own version without asking anyone's
permission or paying for anyone's API. Forts were built to stand on their own when cut off. The tool
for climbing them should too.

## Prize Categories

- **Best Use of Gemma**: Gemma 3 1B / Gemma 2 2B runs entirely on the phone via WebLLM and
  answers questions offline in English and Marathi, grounded in cited fort notes.
- **Best Use of TabPFN**: a personal climb-time model fitted in-context on a few dozen of my own
  hikes, evaluated leave-one-out against Naismith's rule (numbers above), and precomputed so its
  predictions work offline on the fort.
- **Best Use of Render**: Render hosts the app's front end, a static site deployed from one
  `render.yaml` blueprint. All the AI runs on the phone.
- **Best Use of ElevenLabs**: fort histories narrated at build time and bundled offline, so they
  play on the summit with no signal. <!-- TODO: remove if no audio -->

---

*Built solo in Pune, October 2026. Fort data is unverified. Check locally before you climb, and
send corrections.* <!-- TODO: team/credits line if anyone helped -->
