---
title: "Killedar: a fort guide that works where the signal dies"
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

**Try it:** [killedar.onrender.com](https://killedar.onrender.com) · **Code:** [github.com/abhijeetkaze/killedar](https://github.com/abhijeetkaze/killedar)

Halfway up Rajgad the bars on your phone go one by one. By Padmavati Machi you're carrying a very expensive torch.

That's the problem with every AI trek assistant I could imagine building on a hosted API: it works in Pune and stops working at the trailhead, which is exactly where you need it.

**Killedar** (किल्लेदार, the keeper of a Maratha fort) is an offline trek companion for the Sahyadri forts around Pune: Sinhagad, Rajgad and Lohagad to start. It's a PWA with three screens, and all three work in airplane mode:

- **Plan**: pick a fort and a trail and enter the last bus back from the base village. Killedar predicts *your* climb time from your past hikes and works backwards from that bus, so it tells you when to leave Pune and not just how long the climb takes.
- **Ask**: "Is there water on Padmavati Machi?" "Is the Chor Darwaja route OK for beginners?" Answered by **Gemma running on the phone**, grounded only in that fort's notes, in English or Marathi.
- **Listen**: the fort's history read aloud in English or Marathi, so you can look at the walls instead of the screen.

On Wi-Fi at home you tap **Use offline** once. Killedar saves the app, the fort notes, your predicted climb times, the narration and the Gemma model, shows the progress, and turns green when it's ready. After that, airplane mode is fine.

**Who it's for:** the weekend crowd that leaves Pune before dawn to climb a fort, from first-timers on Sinhagad to regulars on Rajgad, and loses signal somewhere on the way up.

**How it gets you off the screen:** everything in Killedar is built to be put away quickly. Plan takes a minute the night before and gives you one time to remember: *Leave Pune by 10:48*. On the fort, a question gets an answer of about 80 words, and the history plays aloud while you look at the walls. The best session is a short one.

## Demo

{% embed https://youtu.be/hglUKJcHEcU %}

**Live app: [killedar.onrender.com](https://killedar.onrender.com)**. Open it on your phone, tap **Use offline**, then try it in airplane mode. Plan and Listen work in any modern browser. Ask needs WebGPU: Chrome on Android, or desktop Chrome with a supported GPU.

![Killedar on a phone: Plan, offline setup, Listen](https://raw.githubusercontent.com/abhijeetkaze/killedar/main/docs/screenshots/killedar-screens.png)
*Left: Plan for Rajgad, working back from a last bus of 18:30 (an example; the app never guesses bus times) with TabPFN's predicted climb time. Middle: the one-time offline setup, partway through downloading Gemma. Right: Listen, playing the ElevenLabs narration in Marathi.*

## Code

{% github abhijeetkaze/killedar %}

Repository: [github.com/abhijeetkaze/killedar](https://github.com/abhijeetkaze/killedar)

A static PWA, plus a little Python that runs on my laptop. **There is no backend.** Both halves are ports-and-adapters with a pure domain at the centre:

```
web/  PWA, zero runtime deps             api/  Python tooling, not a server
  domain   timing, prompt, model pick      domain     features, Naismith baseline
  ports    LanguageModel, Predictor        adapters   TabPFN, hikes CSV, fort trails
  app      planTrek, askFort, offline      evaluation leave-one-out vs Naismith
  adapters WebLLM (Gemma), table, data     precompute → web/public/predictions.json
```

95 web tests and 23 Python tests. CI runs both on every push, including the real TabPFN model.

## How I Built It

### Gemma, on the phone

The Ask screen runs Gemma through [WebLLM](https://github.com/mlc-ai/web-llm), which compiles models to WebGPU. WebLLM is imported from a CDN at runtime, so the web app has **no runtime dependencies**: TypeScript compiles straight to ES modules and there's no bundler.

Which Gemma? That depends on the phone, so the choice is a small pure function. It takes the newest supported generation that fits under ~2.6B parameters, uses q4f16 if the GPU supports `shader-f16` (half the memory of q4f32), and avoids WebLLM's `-1k` builds, because the fort notes plus the question don't fit in 1,024 tokens.

My first pick was **Gemma 3 1B**: the newest and smallest, a 600 MB download. It loaded, and then answered "What happened here in history?" with "- Sinhagad" fifty times. Gemma 3 mixes 512-token local-attention layers with global ones, and WebLLM 0.2 can give the whole model only one attention window. Switch it off and the local layers read the full ~2,000-token fort prompt they were never trained on. Switch it on and every layer forgets the fort notes after 512 tokens. So Killedar runs **Gemma 2 2B (q4f16, about 1.5 GB, downloaded once)**, whose local window equals its context. It's a bigger download, but its answers come from the notes.

Small models make things up, so the prompt is built to keep the answers short and true:

- The fort data is rendered as **compact prose notes**, not JSON. Small models follow prose better, and it saves context.
- The instruction says *answer only from the notes; if they don't cover it, say so*, and **never invent bus times, distances or phone numbers**. On a mountain, a confident wrong answer is worse than "I don't know".
- Answers are capped at about 80 words, because the reader is walking.

### TabPFN: a model of *you*, from a few dozen rows

Naismith's rule (an hour per 5 km plus an hour per 600 m of climb) is the classic estimate, and it was written for Scottish hills, not for a laterite staircase at 9 a.m. in October humidity. The useful question isn't "how long does Rajgad take" but "how long does Rajgad take **me**".

That's a regression problem with almost no data: one person's hike history, a few dozen rows at best. It's exactly the case [TabPFN](https://github.com/PriorLabs/TabPFN) is made for. TabPFN is a pre-trained tabular foundation model, so "fitting" it on a few dozen rows is in-context learning. There's no training loop and nothing to overfit with hyperparameters.

Features: distance, elevation gain, start hour, group size. Target: trailhead-to-summit minutes. The evaluation is leave-one-out, so each hike is predicted by a model that never saw it.

To be upfront: the hike history in the repo today is a **synthetic placeholder**, 25 climbs of the app's five real trails by a made-up hiker who is about 20% slower than Naismith and slows down in big groups and midday heat. My own hikes replace it next. On that placeholder data:

| | Mean absolute error (leave-one-out, 25 hikes) |
|---|---|
| Naismith's rule | **35.9 min** |
| TabPFN | **9.4 min** |

That only shows TabPFN can recover a personal pattern from 25 rows. The real test is my own hikes, and swapping them in is one CSV and two commands.

My first version served TabPFN from a small web API on Render. It worked, but it was the wrong shape twice over. It needed signal, which is the one thing this app can't assume. And PyTorch plus TabPFN sat right at the 512 MB limit of a free instance, so every prediction knocked the server over.

The fix was to notice how small the question space is. The app only ever asks about its own trails, at a start hour between 4 and 14 and a group of 1 to 30. That's about 1,650 questions. So TabPFN answers **all of them ahead of time**, on my laptop, in about 13 seconds:

```bash
python -m killedar_api.precompute data/hikes.csv   # → web/public/predictions.json (7 KB)
```

The app ships that file and the service worker caches it. The Plan screen looks up the predicted climb time in about 20 ms, online or on the summit, and anything outside the table falls back to Naismith. TabPFN still does the learning; the phone just reads its answers.

![Plan for Rajgad: leave-by time worked back from the last bus, with TabPFN's predicted climb time](https://raw.githubusercontent.com/abhijeetkaze/killedar/main/docs/screenshots/plan.png)

### Narration with ElevenLabs

The Listen screen plays each fort's history in English and in Marathi, narrated by ElevenLabs. The narration is generated **once, at build time**, by [`web/scripts/generate-audio.ts`](https://github.com/abhijeetkaze/killedar/blob/main/web/scripts/generate-audio.ts): it sends each history to the ElevenLabs text-to-speech API and writes the MP3s into the app. Six clips, 1.4 MB in all, saved for offline with everything else. On the fort they play with no signal and no API key.

Marathi was the catch. The usual `eleven_multilingual_v2` model rejects it outright (`does not support language_code 'mr'`), so the script uses **`eleven_v3`** and sends each clip's language code, which means the Marathi history is read as Marathi.

![Listen: ElevenLabs narration of Rajgad's history in Marathi, playable offline](https://raw.githubusercontent.com/abhijeetkaze/killedar/main/docs/screenshots/listen.png)

### Offline setup you can see

A **Use offline** button in the header opens a short checklist: the app files first (about 2 MB: shell, fort notes, climb-time table, narration), then the Gemma model (about 1.5 GB). Each step has its own progress bar, the button becomes a progress ring, and it turns into a green **Offline ready** check when everything is on the phone. If the phone runs out of storage, it says so plainly. If the browser has no WebGPU, Plan and Listen still go offline and the checklist says why Ask can't.

![Offline setup: app files saved, Gemma downloading with progress](https://raw.githubusercontent.com/abhijeetkaze/killedar/main/docs/screenshots/offline-setup.png)

### Facts about real places

Fort data is facts about real mountains, and wrong facts there have consequences. Every fort file cites its sources and stays `"verified": false` until it's been checked. Bus times are **left blank on purpose**: the app asks you for the last bus rather than guessing one, because rural ST timings change and a hallucinated 6:30 p.m. bus is how people end up walking down in the dark.

### Deploy

One [`render.yaml`](https://github.com/abhijeetkaze/killedar/blob/main/render.yaml) blueprint deploys the PWA to Render as a static site: the app, the fort notes, the TabPFN table and the narration. That's the whole deployment. Gemma runs on the phone, so there's no server to keep awake or pay for.

## Why Does Open Innovation Matter?

Because the top of a Sahyadri fort has no signal, and that settles the argument. With a closed API, Killedar's Ask screen would be a spinner at exactly the moment you need it. With open weights, it answers in airplane mode.

A closed model behind an API is a service. It's there when the network is, when the bill is paid, and when the provider still offers it. On Rajgad's Balekilla none of those hold. Open weights are an **artifact**: once they're on the phone, nobody can switch them off, rate-limit them or price them per question.

That's also why the one closed service in Killedar, ElevenLabs, runs only at build time. Its output is an MP3 that ships with the app, so nothing on the mountain depends on it.

Running on the device also keeps things private. A hiker's history (where they go, when, how slowly) goes into TabPFN on their own laptop, and only the predicted minutes ship with the app. Questions asked on the fort never leave the phone at all.

It also matters who gets to build. Everything in Killedar is open: Gemma's weights, WebLLM's compiler, TabPFN's model, the fort notes and their sources. So a trekking group in Nashik can fork it, add Harishchandragad, correct my Marathi, and ship their own version without asking anyone's permission or paying for anyone's API. Forts were built to stand on their own when cut off. The tool for climbing them should too.

## Prize Categories

- **Best Use of Gemma**: Gemma 2 2B runs entirely on the phone through WebLLM and answers questions about each fort in English or Marathi, offline, grounded only in that fort's cited notes.
- **Best Use of TabPFN**: TabPFN predicts a hiker's personal climb time from their hike history (a CSV), evaluated leave-one-out against Naismith's rule, and its predictions are precomputed into the app so Plan uses them offline on the fort.
- **Best Use of ElevenLabs**: ElevenLabs generates the narration for every fort's history, in English and Marathi (`eleven_v3`), at build time. The clips ship with the app and play on the summit with no signal.
- **Best Use of Render**: Render hosts the app's front end, the whole PWA deployed as a static site from one `render.yaml` blueprint.

*Built solo in Pune, October 2026. Fort data is unverified. Check locally before you climb, and send corrections.*
