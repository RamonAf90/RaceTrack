# 🏎️ RaceTrack — Beachside Racetrack 

**RaceTrack** is a real-time race management and timing application.
It provides dedicated interfaces for reception staff, race control, lap tracking, and live public displays.

---

## 🚀 Features

### 🧑‍💼 Front Desk (Receptionist)

* Create and manage upcoming race sessions
* Add, edit, and remove drivers before the race starts
* Sessions disappear from the interface when the race starts

### 🧑‍✈️ Race Control (Safety Official)

* Start races (automatically switches mode to **Safe**)
* Control race modes: **Safe**, **Hazard**, **Danger**, **Finish**
* End finished sessions to queue the next race
* Only one active “Start Race” button per session

### 🧑‍🔧 Lap Tracker (Observer)

* Log driver laps by pressing their car number buttons
* Automatically records lap counts and best lap times
* Locked while race is not running

### 🧑‍🤝‍🧑 Public Displays

* **Leader Board:** Live race standings and lap times
* **Next Race:** Upcoming drivers list (with paddock notice only after race end)
* **Countdown:** Large timer synchronized with race control
* **Flags Display:** Visual indicator of race mode

---

## 🧠 Race Flow Summary

| Phase       | Description                                  | Visible To                                |
| :---------- | :------------------------------------------- | :---------------------------------------- |
| **Pending** | Created at Front Desk; drivers editable      | Front Desk                                |
| **Running** | Started by Safety; mode = Safe               | Race Control, Lap Tracker, Leader Board   |
| **Finish**  | Race ended; mode = Finish                    | Public displays show checkered flag       |
| **Ended**   | Safety pressed End Session; next race queued | Race Control (next), Front Desk (pending) |

---

## 🏗️ Architecture

```
racetrack/
├── server
│   ├── index.js                # Express entry point & Socket.IO setup
│   ├── config.js               # Environment variables & validation
│   ├── db
│   │   ├── connect.js          # MongoDB connection helper
│   │   └── persist.js          # Save/load persistent race state
│   ├── sockets
│   │   └── sockets.js          # Real-time namespaces & events
│   ├── routes
│   │   └── routes.js           # API + HTML routing
│   ├── handlers
│   │   └── handlers.js         # Core business logic (races, modes, timers)
│   ├── models
│   │   └── models.js           # Mongoose schemas (sessions, drivers)
│   └── utils
│       └── utils.js            # Helper utilities (time, formatting)
│
├── client
│   ├── static
│   │   ├── bg.png
│   │   ├── favicon.png
│   │   ├── finishFlag.jpg
│   │   ├── global.css
│   │   ├── global.js
│   │   ├── logo.png
│   │   └── mobileBG.png
│   │
│   ├── pages
│   │   ├── Home/
│   │   │   ├── Home.html
│   │   │   ├── Home.css
│   │   │   └── Home.js
│   │   │
│   │   ├── Login/
│   │   │   ├── Login.html
│   │   │   ├── Login.css
│   │   │   └── Login.js
│   │   │
│   │   ├── FrontDesk/
│   │   │   ├── FrontDesk.html
│   │   │   ├── FrontDesk.css
│   │   │   └── FrontDesk.js
│   │   │
│   │   ├── RaceControl/
│   │   │   ├── RaceControl.html
│   │   │   ├── RaceControl.css
│   │   │   └── RaceControl.js
│   │   │
│   │   ├── LapTracker/
│   │   │   ├── LapTracker.html
│   │   │   ├── LapTracker.css
│   │   │   └── LapTracker.js
│   │   │
│   │   ├── LeaderBoardPage/
│   │   │   ├── LeaderBoardPage.html
│   │   │   ├── LeaderBoardPage.css
│   │   │   └── LeaderBoardPage.js
│   │   │
│   │   ├── NextRacePage/
│   │   │   ├── NextRacePage.html
│   │   │   ├── NextRacePage.css
│   │   │   └── NextRacePage.js
│   │   │
│   │   ├── CountdownPage/
│   │   │   ├── CountdownPage.html
│   │   │   ├── CountdownPage.css
│   │   │   └── CountdownPage.js
│   │   │
│   │   └── FlagsPage/
│   │       ├── FlagsPage.html
│   │       ├── FlagsPage.css
│   │       └── FlagsPage.js
│   │
│   ├── components
│   │   ├── RaceList/
│   │   │   └── RaceList.js
│   │   │
│   │   ├── LeaderBoard/
│   │   │   └── LeaderBoard.js
│   │   │
│   │   ├── Timer/
│   │   │   └── Timer.js
│   │   │
│   │   └── FlagDisplay/
│   │       └── FlagDisplay.js
│   │
│   ├── App.js
│   └── socket.js
│
├── package.json
├── package-lock.json
├── .env
├── .env.example
└── Readme.md
```

---

## ⚙️ Setup & Installation

### 1️⃣ Prerequisites

* [Node.js](https://nodejs.org/) ≥ 18
* [MongoDB](https://www.mongodb.com/) running locally (no Atlas required)
* [Ngrok](https://ngrok.com/) API gateway for online visiting

### 2️⃣ Clone & Install

```bash
git clone https://gitea.kood.tech/valtterivaliahde/racetrack
cd racetrack
npm install
```

### 3️⃣ Environment Configuration

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/racetrack
RECEPTIONIST_KEY=1234
OBSERVER_KEY=5678
SAFETY_KEY=9999
```

### 4️⃣ Run the Server

```bash
npm start
```

Server runs at [http://localhost:5000](http://localhost:5000).

If you want to access from another device (e.g. mobile or tablet), please use Ngrok in another terminal in the project root:
```bash
npm run tunnel
```

---

## 🧭 Access Points

| Role          | URL                                                         | Key    | Description                    |
| :------------ | :---------------------------------------------------------- | :----- | :----------------------------- |
| Front Desk    | [/front-desk](http://localhost:5000/front-desk)             | `1234` | Manage race sessions & drivers |
| Race Control  | [/race-control](http://localhost:5000/race-control)         | `9999` | Start, finish, end races       |
| Lap Tracker   | [/lap-line-tracker](http://localhost:5000/lap-line-tracker) | `5678` | Record laps                    |
| Leader Board  | [/leader-board](http://localhost:5000/leader-board)         | Public | Live standings                 |
| Next Race     | [/next-race](http://localhost:5000/next-race)               | Public | Upcoming drivers list          |
| Countdown     | [/race-countdown](http://localhost:5000/race-countdown)     | Public | Large timer display            |
| Flags Display | [/race-flags](http://localhost:5000/race-flags)             | Public | Shows race mode flag           |

---

## 💾 Persistence

* State (sessions, drivers, race progress) is stored in **MongoDB** collection `rt_state`.
* If MongoDB is unavailable, RaceTrack runs in **in-memory mode** (non-persistent).
* On restart, state is automatically restored if previously persisted.

---

## 🧩 Tech Stack

* **Node.js + Express** — backend and static serving
* **Socket.IO** — real-time synchronization between all roles
* **MongoDB + Mongoose** — persistence
* **Plain HTML/CSS/JS** — clean, minimal client interfaces

---

## 🧪 Key Behaviors (Validation)

✔️ Front Desk sessions disappear once race starts
✔️ Drivers cannot be edited after start
✔️ Race Control shows one “Start Race” button
✔️ Leader Board switches on race start
✔️ Next Race shows paddock message only after End Session
✔️ State persists across restarts

---

## 👨‍💻 Contributors

| Role                           | Name / Handle                  |
| ------------------------------ | ------------------------------ |
| Backend Developer              | Valtteri Väliahde              |
| Front-End Developer            | Rahman Amanifard                    |


