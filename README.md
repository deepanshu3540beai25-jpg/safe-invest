# safe-invest

# InvestSafe — Fear Less, Grow More

> Contextualize risk. Simulate losses. Build real investing confidence — before touching a single rupee.

---

## 1. Project Overview

InvestSafe is a fully client-side, zero-installation web application designed to help first-time and fearful investors in India confront, understand, and manage investment risk through immersive simulations — without risking real money.

The platform bridges the emotional gap between *knowing* you should invest and actually doing it, using real financial data, behavioral psychology, and AI-generated insights to transform fear into informed action.

### The Problem We Solve

Over 80% of working Indians keep their savings in Fixed Deposits or cash despite equity markets historically delivering 3–4x better long-term returns. The #1 reason: **fear of loss**. InvestSafe directly addresses this with:

- Live portfolio simulations with real volatility models
- Emotional panic-response training with historical crash data
- AI-powered plain-English portfolio explanations
- Investor personality profiling via a 10-question behavioral quiz
- "What If" regret calculators showing the cost of waiting

### Key Modules

| Module | Description |
|--------|-------------|
| 🎮 Module 01 — Risk Simulation Sandbox | Simulate ₹5K–₹5L portfolios across 1–20 year horizons with low/medium/high volatility. Interactive sliders, live chart, best/worst case projections. |
| 🎯 Module 02 — Loss Probability Meter | Animated radial meter showing real loss probability by asset class (FD, index funds, stocks/crypto). Includes a Fear Index gauge. |
| 🤖 Module 03 — AI Portfolio Explainer | Anthropic Claude API explains your portfolio allocation in plain language, adapting tone to your risk level. |
| 📊 Module 04 — Projected Outcomes | Four scenario cards (Best / Expected / Bad / Worst) updated in real time after each simulation. |
| 🧠 Module 05 — Emotional Alert System | Enter any market drop %. The system responds with a calming advisor message, historical crash statistics, and data-driven recovery timelines. |
| ⏳ Module 06 — What If? Simulator | See exactly how much you would have today if you had invested ₹X in Nifty 50, Gold, or FD on any past date. Includes delay-regret cards. |
| 🧬 Module 07 — Investor Quiz | 10 behaviorally-designed questions produce one of four personality profiles (Dragon, Owl, Turtle, Phoenix) with tailored allocation recommendations. |

---

## 2. Tech Stack

InvestSafe is intentionally built with **zero dependencies or build tools** — a deliberate design choice to demonstrate that a polished, production-grade financial tool can be shipped as a single HTML file.

| Category | Technology | Purpose |
|----------|------------|---------|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES6+) | Core application layer |
| Typography | Google Fonts — Syne + DM Mono | Design system fonts |
| Charts | HTML5 Canvas API (custom renderer) | Simulation line charts |
| AI / LLM | Anthropic Claude API (claude-sonnet-4-20250514) | Portfolio explainer module |
| Animations | CSS keyframes + transitions | All UI motion |
| Data | Hardcoded JSON constants | Historical crash & return data |
| Build Tools | None — zero dependencies | Single-file deployment |
| Hosting | Any static host (Netlify / Vercel / GH Pages) | No backend required |

---

## 3. Setup Instructions

### Option A — Run Instantly (No Setup)

Simply open the HTML file in any modern browser:

```bash
# macOS
open investsafe_final.html

# Windows
start investsafe_final.html

# Linux
xdg-open investsafe_final.html
```

> ⚠️ The AI Portfolio Explainer (Module 03) requires an Anthropic API key and a local server due to browser CORS restrictions. For that module, use Option B.

---

### Option B — Local Development Server

**Prerequisites**
- Node.js v18+ (https://nodejs.org) OR Python 3.8+
- An Anthropic API key (https://console.anthropic.com)

**Step 1 — Clone / Download the project**

```bash
git clone https://github.com/your-username/investsafe.git
cd investsafe
```

**Step 2 — Set your Anthropic API key**

Open `investsafe_final.html` in a text editor and locate the API configuration block (around line 900). Replace the placeholder:

```js
// Find this line in the <script> section:
const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

// Replace with your actual key:
const ANTHROPIC_API_KEY = 'sk-ant-api03-XXXXXXXXXXXX';
```

**Step 3 — Start a local server**

```bash
# Using Node.js (npx — no install needed):
npx serve .
# Open: http://localhost:3000

# Using Python:
python3 -m http.server 8080
# Open: http://localhost:8080
```

Using VS Code: Install the "Live Server" extension → right-click `investsafe_final.html` → "Open with Live Server"

---

### Option C — Deploy to Production (Netlify)

```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

Set `ANTHROPIC_API_KEY` in Netlify dashboard under **Site Settings → Environment Variables**.

---

### File Structure

```
investsafe/
  ├── investsafe_final.html    # Complete application (single file)
  ├── README.md                # This document
  └── assets/                  # Optional: favicon, screenshots
```

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Recommended |
| Firefox 88+ | ✅ |
| Safari 14+ | ✅ |
| Edge 90+ | ✅ |
| IE 11 | ❌ Not supported |

---

## 4. APIs & External Services

| Service | Type | Used For | Cost |
|---------|------|----------|------|
| Anthropic Claude API | REST / JSON | AI Portfolio Explainer — plain-language portfolio breakdowns | Pay-per-use (~₹0.01/call) |
| Google Fonts CDN | CSS CDN | Syne (headings) + DM Mono (body) fonts | Free |
| Self-contained data | — | All financial data hardcoded as JS constants | Free |

### Anthropic Claude API — Details

- **Endpoint:** `POST https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Max tokens:** 1,000 per request
- **Required headers:** `Content-Type: application/json`, `x-api-key: <your-key>`, `anthropic-version: 2023-06-01`

Example request payload:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1000,
  "messages": [{
    "role": "user",
    "content": "Explain this portfolio for a beginner: 40% equity, 30% mutual funds, 20% gold, 10% FD. ₹50,000 over 3 years. Risk level: medium. Keep it simple and encouraging."
  }]
}
```

### Data Sources (Embedded)

| Asset | 1-Year CAGR | 5-Year CAGR | 10-Year CAGR |
|-------|------------|------------|-------------|
| Nifty 50 | ~12% | ~14.5% | ~13.8% |
| Gold ETF | ~8% | ~13.2% | ~11.4% |
| Fixed Deposit | ~7% (post-tax ~5.1%) | — | — |

**Historical crash data:**
- 2000 Dot-com: −56%
- 2008 GFC: −60.9%
- 2020 COVID: −38%
- 2022 Bear: −16.9%

All data sourced from NSE/BSE historical records and embedded as constants.

---

## 5. Why InvestSafe Wins

- **Zero setup for judges** — Open one HTML file, the full product runs. No `npm install`, no Docker, no env files.
- **Real AI integration** — Claude API is wired into the core user journey, not bolted on as a demo.
- **Behavioral design** — Every module is grounded in behavioral finance research: loss aversion, fear response, regret theory.
- **India-first** — All amounts in INR, all data from NSE/BSE, all profiles calibrated for the Indian retail investor.
- **Production polish** — Custom animations, responsive layout, dark mode design system, ticker, and quiz — not a prototype.
- **Single-file architecture** — The entire app ships as one ~2,000-line HTML file — a deliberate engineering choice demonstrating constraint-driven creativity.
