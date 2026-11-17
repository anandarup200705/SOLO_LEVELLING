# Solo System 🗡️

A Solo Leveling-inspired real-life RPG fitness tracker. Complete daily workouts, earn XP, level up your character, and unlock dungeons — all styled after the System from the manhwa.

![Solo System UI](src/assets/hero.png)

---

## Features

- **System Acceptance Screen** — You must accept the System before you can begin (decline at your own risk).
- **Status Panel** — Track your Level, HP, MP, XP, Job, Title, and core attributes (STR, AGI, SEN, VIT, INT). Spend Ability Points earned from leveling up.
- **Daily Quests** — Every day a fresh set of exercise targets is generated based on your current level (push-ups, sit-ups, squats, running). Log reps to earn XP, with bonus XP and HP recovery for extra reps beyond the target.
- **Penalty Zone** — Miss a day's quests? The System assigns a 150-rep survival task the next day. No mercy.
- **Instanced Dungeons** — Unlock and raid dungeons as you level up, each awarding large XP rewards:
  - Hapjeong Station (Level 10)
  - C-Rank Spider Lair (Level 25)
  - Job Change Instance (Level 40)
  - Demon's Castle (Level 70)
  - Cartenon Temple (Level 100)
- **Milestone Titles & Job Changes** — Hit key levels (10, 20, 40, 70, 100) to unlock titles and job promotions straight from the story.
- **Shadow Army** — Unlocked at Level 40, the Shadow Monarch army panel reveals shadows as you progress.
- **Persistent Progress** — All data syncs to Firebase Firestore in real time, so your progress is saved across sessions and devices.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Backend / DB | Firebase (Firestore + Anonymous Auth) |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Anonymous Authentication enabled

### Installation

```bash
git clone https://github.com/your-username/solo-system.git
cd solo-system
npm install
```

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** and **Anonymous Authentication**
3. Copy `.env.example` to `.env` and fill in your Firebase project values:

```bash
cp .env.example .env
```

### Running Locally

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Build for Production

```bash
npm run build
```

Output goes to the `dist/` folder.

---

## Leveling & Quest Scaling

| Level Range | Reps (Push-ups, Sit-ups, Squats) | Running |
|---|---|---|
| 1 – 9 | 25 | 2.5 km |
| 10 – 24 | 37 | 3.7 km |
| 25 – 39 | 50 | 5.0 km |
| 41 – 69 | 67 | 6.7 km |
| 70 – 84 | 75 | 7.5 km |
| 85 – 99 | 100 | 10.0 km |

Each completed quest awards 25 XP. Extra reps beyond the target give 2 XP and 5 HP per rep (up to 15 extra per quest per day).

---

## License

MIT
