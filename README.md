# 🍿 Geddi's Rec — Friends' Movie Recommendations & Social Streaming Platform

> **Live Production App:** [https://cinematch-friends.netlify.app](https://cinematch-friends.netlify.app)  
> **Netlify Site ID:** `aee7ff78-0002-48f6-951c-f95eb8c84174`  
> **Repository Ready:** Full-stack serverless deployment package with Netlify Blobs & local development server.

---

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Streaming Provider Integration (Movy.sx)](#-streaming-provider-integration-movysx)
- [Real-Time Sync & Netlify Blobs Database](#-real-time-sync--netlify-blobs-database)
- [Optimistic UI & Anti-Flicker State Lock](#-optimistic-ui--anti-flicker-state-lock)
- [API Specification](#-api-specification)
- [Theme System (Light & Dark Mode)](#-theme-system-light--dark-mode)
- [Local Development & Wi-Fi Sharing](#-local-development--wi-fi-sharing)
- [Production Deployment (Netlify)](#-production-deployment-netlify)
- [Developer & LLM Handover Guide](#-developer--llm-handover-guide)

---

## 🌟 Project Overview

**Geddi's Rec** (originally CineMatch) is a mobile-first, zero-friction social movie curation platform built for friend groups. Rather than generic algorithm recommendations, users share direct movie recommendations with personal reviews, vote across emotional reaction tiers, engage in dedicated comment threads, and launch one-click streaming via **Movy.sx** using verified TMDB IDs.

All recommendations, reactions, and comments sync live across users via Netlify Serverless Functions backed by **Netlify Blobs** cloud storage.

---

## ✨ Key Features

1. **User Identity & Color Coding**:
   - First-time visitors enter their name (persisted in `localStorage`).
   - Every user is assigned a deterministic, high-contrast color avatar and username accent dynamically derived from a hash of their name.
2. **Central "Stream it NOW!" Watch Button**:
   - Every recommendation card features a prominent, centered **"▶ Stream it NOW!"** CTA button.
   - Automatically links to `https://www.movy.sx/movie/<tmdbId>?play=true` using TMDB metadata resolved upon adding the movie.
   - Compact list view features an inline **"Stream NOW!"** button.
   - YouTube trailer modal includes an integrated direct stream button in the footer.
3. **Sentiment Reactions with Friend Attribution**:
   - **🙏 I beg you to watch this** (High-priority fire banner)
   - **🔥 Hyped to watch**
   - **❤️ Loved it**
   - **👍 Liked**
   - **👎 Didn't like**
   - **🤮 Hate it**
   - User names are displayed inside colored chips on each reaction. Votes are mutually exclusive per user.
   - Scoring algorithm: `totalLoved = begCount + lovedCount`.
4. **Per-Movie Comment Threads**:
   - Comment counter badge on every card.
   - Expandable drawer/accordion to read and post comments with real-time sync.
5. **Author-Only Deletion Protection**:
   - Only the friend who originally recommended a movie has the permission to delete it. Other users cannot see or trigger the delete action.
6. **Dual Layout Views**:
   - **🎴 Cards View**: Full cards with high-res posters, IMDb rating badges, expandable plot synopsis, reaction breakdown, and streaming CTA.
   - **📋 Compact List View**: Minimalist list for quick scanning with title, recommender, and stream action.
7. **Curated Starter Library**:
   - Pre-loaded with 31 acclaimed movies (`curated-movies.js`) with pre-mapped TMDB IDs for instant streaming.
8. **Dark / Light Mode**:
   - Header toggle switch with persistent theme state in `localStorage`.
   - Tuned contrast tokens ensuring notes, badges, and banners are crisp in both modes.

---

## 🏗️ Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                         │
│  index.html · app.js · styles.css · curated-movies.js       │
│  - Vanilla ES6+ (No bundler required)                       │
│  - Optimistic UI Lock (6s cooldown against poll overrides)  │
│  - Live Polling (10s interval)                              │
│  - CSS Custom Properties for Light/Dark themes              │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Streaming & Metadata       │ │    Netlify Serverless      │
│  - Movy.sx (TMDB-based)      │ │    netlify/functions/      │
│  - Cinemeta / TMDB API       │ │    api.js, reactions.js    │
│  - YouTube Embeds            │ │    recommendations.js      │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │
                                               ▼
                                 ┌────────────────────────────┐
                                 │   Netlify Blobs Store      │
                                 │   "geddis_recommendations" │
                                 │   Key: recommendations_data│
                                 └────────────────────────────┘
```

- **Frontend**: Plain HTML5, CSS3, Modern JavaScript (ES6+ Modules). Zero Webpack/Vite complexity for instant debugging.
- **Backend**: Netlify Serverless Functions (Node.js 18+) accessing `@netlify/blobs`.
- **Local Fallback**: Python 3 HTTP server (`server.py`) with built-in REST API and Wi-Fi QR/IP announcer writing to `recommendations.json`.
- **Routing & CDN**: `netlify.toml` with wildcard proxy rewrite (`/api/*` → `/.netlify/functions/api`) and strict cache-busting headers (`Cache-Control: private, no-store`).

---

## 🎬 Streaming Provider Integration (Movy.sx)

To provide one-click streaming without external searching:
- **Base URL Pattern**: `https://www.movy.sx/movie/{tmdbId}?play=true`
- **Resolution Strategy** (`app.js`):
  1. If `item.tmdbId` is already stored, directly generate the link.
  2. For curated classics, `curated-movies.js` holds verified TMDB IDs.
  3. When a user adds a new movie, `resolveTmdbId(title, year)` queries Cinemeta/TMDB API to capture the exact integer `id` before persisting to Netlify Blobs.
  4. Fallback: If no TMDB ID is resolved, links to `https://www.movy.sx/search?q={title}`.

---

## 🗄️ Real-Time Sync & Netlify Blobs Database

- **Store Name**: `geddis_recommendations`
- **Key**: `recommendations_data`
- **Data Model**:
  ```json
  [
    {
      "id": "rec-1727771234567",
      "movieId": "tt0816692",
      "tmdbId": 157336,
      "title": "Interstellar",
      "year": "2014",
      "imdbRating": "8.7",
      "poster": "https://m.media-amazon.com/...",
      "genres": ["Adventure", "Drama", "Sci-Fi"],
      "director": "Christopher Nolan",
      "synopsis": "When Earth becomes uninhabitable...",
      "trailerId": "zSWdZVtXT7E",
      "recommendedBy": "Geddi",
      "note": "Mind-bending visual masterpiece. Must watch in 4K!",
      "timestamp": "Oct 1, 2026",
      "reactions": {
        "beg": ["Geddi"],
        "hyped": ["Sarah"],
        "loved": ["Alex"],
        "liked": [],
        "disliked": [],
        "hated": []
      },
      "comments": [
        {
          "id": "c-1727771299999",
          "author": "Sarah",
          "text": "The docking scene soundtrack gave me chills!",
          "timestamp": "Oct 1, 2026"
        }
      ]
    }
  ]
  ```

---

## ⚡ Optimistic UI & Anti-Flicker State Lock

### The Concurrency Problem
With background polling every 10 seconds, clicking a reaction button or posting a comment could trigger an annoying UI flicker: the count increases by 1 locally, but an in-flight GET request returning older server state flashes the count back to 0 before the POST completes.

### The Solution (`app.js`)
```javascript
let isMutating = false;
let lastMutationTime = 0;

// When user votes or comments:
isMutating = true;
lastMutationTime = Date.now();
// 1. Immediately mutate local data model & re-render DOM
// 2. Dispatch async POST to /api/reactions or /api/comments
// 3. In the 10-second polling loop:
function pollFeed() {
  if (isMutating || (Date.now() - lastMutationTime < 6000)) {
    return; // Skip poll override during cooldown
  }
  fetchFeed();
}
```
This guarantees snappy, native-app feel with zero flicker.

---

## 📡 API Specification

All endpoints are hosted at `/api/*` and redirected to `netlify/functions/api.js`.

### 1. `GET /api/recommendations`
Returns JSON array of all saved recommendations, sorted newest first.

### 2. `POST /api/recommendations`
Adds a new recommendation.
- **Payload**:
  ```json
  {
    "id": "rec-123456",
    "title": "Inception",
    "year": "2010",
    "imdbRating": "8.8",
    "tmdbId": 27205,
    "poster": "https://...",
    "director": "Christopher Nolan",
    "synopsis": "A thief who steals corporate secrets...",
    "recommendedBy": "Geddi",
    "note": "Amazing concept!",
    "initialVerdict": "loved"
  }
  ```

### 3. `POST /api/reactions`
Toggles a user's reaction for a movie.
- **Payload**:
  ```json
  {
    "id": "rec-123456",
    "reaction": "hyped",
    "userName": "Alex"
  }
  ```
- **Response**: `{ "success": true, "reactions": { ... } }`

### 4. `POST /api/comments`
Adds or deletes a comment on a recommendation.
- **Payload (Add)**:
  ```json
  {
    "id": "rec-123456",
    "comment": {
      "author": "Sarah",
      "text": "Great suggestion!"
    }
  }
  ```
- **Payload (Delete)**:
  ```json
  {
    "id": "rec-123456",
    "deleteCommentId": "c-987654"
  }
  ```

### 5. `POST /api/recommendations/delete`
Deletes a recommendation (enforces author verification).
- **Payload**:
  ```json
  {
    "id": "rec-123456",
    "userName": "Geddi"
  }
  ```

---

## 🎨 Theme System (Light & Dark Mode)

The interface utilizes CSS Custom Properties declared in `:root` and `[data-theme="light"]`:
- Dark mode: deep cinematic slate `#0d1117`, card surfaces `#161b22`, neon gold accents `#ffd700`.
- Light mode: crisp off-white `#f6f8fa`, card surfaces `#ffffff`, high-contrast text `#1a202c`.
- User colors: generated by `getUserColor(userName)` using golden-angle HSL distribution for optimal readability on both dark and light surfaces.

---

## 🚀 Local Development & Wi-Fi Sharing

### Run via Python (zero setup)
```bash
python server.py
```
Outputs:
```text
💻 On this computer:
   👉 http://localhost:3000

📱 On your phone & friends' phones (Same Wi-Fi):
   👉 http://192.168.1.X:3000
```

### Run via Netlify CLI (with local Functions & Blobs simulation)
```bash
npm install
npx netlify dev
```

---

## 🌐 Production Deployment (Netlify)

The project is configured for one-click continuous deployment on Netlify:
1. Push this repository to GitHub.
2. Link your repository in Netlify ([app.netlify.com](https://app.netlify.com)).
3. Build Settings:
   - **Build command**: *(leave empty)*
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
4. Netlify automatically provides Blobs storage for the site.
5. Production URL: `https://cinematch-friends.netlify.app`

---

## 🤖 Developer & LLM Handover Guide

If you are an AI assistant or human developer continuing work on this project:

1. **Keep it lightweight**: Do NOT introduce heavyweight bundlers (Webpack, Vite, Tailwind CLI) unless requested. The app runs directly in any modern browser without a build step.
2. **Preserve Optimistic Locking**: Any changes to reaction or comment interactions must respect `isMutating` and `lastMutationTime` to prevent background poll overwrites.
3. **Movy.sx URLs**: Maintain the `https://www.movy.sx/movie/<tmdbId>?play=true` format. Ensure any new movie recommendation resolves `tmdbId` correctly.
4. **Data Consistency**: In `netlify/functions/api.js`, every recommendation must pass through `normalizeItemReactions()` to guarantee all reaction keys (`beg`, `hyped`, `loved`, `liked`, `disliked`, `hated`) and `comments` array exist.
5. **Netlify Functions Layout**: Both monolithic `/api/*` routing and individual function entry points (`recommendations.js`, `reactions.js`, `comments.js`) are kept in sync.

---

*Made with ❤️ for movie nights with friends.*
