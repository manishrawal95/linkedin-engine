# Agentic LinkedIn Planner

> **Your LinkedIn posts teach AI how to write your next ones.**
> Add metrics → AI builds your playbook → AI drafts in your voice → You review → Post. Runs locally. No SaaS subscription.

[Live Demo →](https://linkedin-planner.vercel.app/linkedin)

---

## The Loop

Most LinkedIn tools help you write posts. This one learns from every post you publish and gets smarter over time.

```
Your Posts → Metrics → AI Analysis → Playbook → AI Drafts → Post
     ↑                                                          |
     └──────────────────── repeat ─────────────────────────────┘
```

Every post you log makes the next draft better. The AI extracts what's working, builds a personal playbook of your DOs and DON'Ts, then uses that playbook -- plus your top-performing posts as voice reference -- to generate new drafts that sound like you.

You stay in the loop at every step. Nothing posts without your approval.

---

## How It Works

**Step 1 -- Log your posts and metrics**
Add published posts and record performance (impressions, likes, comments, saves) at 12h, 24h, 48h, and 1-week intervals. Or bulk-import from LinkedIn's Creator Analytics export.

**Step 2 -- AI classifies and learns**
Each post is scored as hit, average, or miss against your personal baseline. AI extracts 2–4 insights per post with confidence scores (e.g., *"contrarian hooks drive 2x saves -- 91% confidence"*). Confidence grows when the same insight is confirmed across multiple posts.

**Step 3 -- Your playbook is generated**
All learnings are compiled into a living strategy doc -- your personal DOs, DON'Ts, and best practices. Automatically regenerates when your learnings change.

**Step 4 -- AI generates ideas and drafts**
The Idea Engine generates post ideas based on your pillars, memory, and past performance. Approve an idea and AI drafts multiple variants using your playbook, top posts as voice reference, hook library, and hashtag sets.

**Step 5 -- Review, refine, and post**
Improve drafts with AI actions (punch hook, shorten, apply playbook). Preview how it looks on LinkedIn. Auto-schedule to your best posting times, or post directly via OAuth.

---

## What's Inside

**Dashboard**
Morning briefing, growth pulse (hit rate, weekly progress, streak, content health score), upcoming posts, pending ideas for review, and AI-powered action suggestions.

**Idea Engine**
AI-generated post ideas based on your creator profile, content pillars, and performance data. Approve ideas to auto-generate drafts; reject to skip.

**Draft Workshop**
AI-generated or manual drafts with pillar color bars, status tracking (draft → revised → scheduled → posted), inline AI improver, LinkedIn preview, character counter with word count sweet spot, and direct LinkedIn posting via OAuth.

**Post Library**
Full CRUD for posts and metrics. Collapsible filters (author, pillar, type, classification), search, sort by engagement/impressions/comments/saves. Batch AI analysis. Bulk metrics import from LinkedIn Creator Analytics exports.

**Content Calendar**
Monthly view for scheduling posts. Link drafts to dates, AI-powered auto-scheduling based on your best posting times and pillar balance.

**Analytics** (tabbed)
- *Performance* -- Monthly trends, pillar performance, post type comparison, hook style radar chart, content length sweet spot scatter plot, top/bottom performers
- *Strategy* -- AI strategy review with health score, playbook viewer, goal tracking
- *System* -- Posting heatmap, LLM token usage tracking

**Creator Profile & Memory**
Your about-me and writing style guide that the AI uses in every draft and idea. AI-generated condensed context. Creator memory system that accumulates patterns over time.

**Mood Board**
Collect inspiration by content pillar -- ideas, quotes, links, saved posts. Generate AI drafts directly from mood board items.

**Hooks & Hashtags**
Save and track opening lines by style (question, contrarian, story, stat, cliffhanger, list, statement). Reusable hashtag sets by pillar with usage tracking.

**Content Series**
Recurring content formats with preferred day/time and frequency tracking.

**Competitors**
Track competitor profiles with engagement benchmarks.

**Settings**
Configure AI provider (Gemini/Claude), model, temperature, creator display name, weekly posting goal, and default post time -- all from the UI.

---

## AI Provider

Configurable -- use Gemini or Claude. Switch from Settings or environment:

```env
LINKEDIN_LLM_PROVIDER=gemini   # or "claude"
```

Both supported with retry logic and JSON parsing built in.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | FastAPI, SQLite (WAL mode), Pydantic |
| LLM | Google Gemini or Anthropic Claude -- configurable |

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
LINKEDIN_LLM_PROVIDER=gemini        # or "claude"
GEMINI_API_KEY=your-key-here         # if using Gemini
ANTHROPIC_API_KEY=your-key-here      # if using Claude
```

```bash
python -m backend.server
# Runs on http://localhost:8200
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

Open `http://localhost:3000/linkedin`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LINKEDIN_LLM_PROVIDER` | Yes | `gemini` or `claude` |
| `GEMINI_API_KEY` | If Gemini | Google GenAI API key |
| `ANTHROPIC_API_KEY` | If Claude | Anthropic API key |
| `LINKEDIN_GEMINI_MODEL` | No | Default: `gemini-2.5-pro` |
| `LINKEDIN_CLAUDE_MODEL` | No | Default: `claude-sonnet-4-6` |
| `LINKEDIN_LLM_TEMPERATURE` | No | Default: `0.7` |
| `LINKEDIN_SQLITE_PATH` | No | Default: `backend/linkedin_data.db` |
| `LINKEDIN_CLIENT_ID` | OAuth only | LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | OAuth only | LinkedIn app client secret |

---

## LinkedIn OAuth Setup (Optional)

To enable direct posting:

1. Create an app at [LinkedIn Developers](https://developer.linkedin.com)
2. Set redirect URI to `http://localhost:8200/auth/linkedin/callback`
3. Request scopes: `openid`, `profile`, `w_member_social`
4. Add `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` to `backend/.env`

---

## Project Structure

```
├── backend/
│   ├── server.py        # FastAPI endpoints
│   ├── analyzer.py      # AI classification + learning extraction
│   ├── drafter.py       # AI draft generation (6 context sources)
│   ├── ideator.py       # AI idea generation pipeline
│   ├── briefing.py      # Morning briefing engine
│   ├── suggestions.py   # Growth pulse, action suggestions, up-next
│   ├── scheduler.py     # AI-powered auto-scheduling
│   ├── strategist.py    # Strategy review + health scoring
│   ├── memory.py        # Creator memory accumulation
│   ├── profile.py       # Creator profile + condensed context
│   ├── prompts.py       # All LLM prompt templates
│   ├── llm.py           # Gemini/Claude abstraction with retry
│   ├── db.py            # SQLite schema + indexes
│   ├── models.py        # Pydantic request/response models
│   ├── importer.py      # LinkedIn analytics Excel import
│   └── config.py        # Environment config
│
└── frontend/
    ├── app/linkedin/
    │   ├── page.tsx              # Dashboard
    │   ├── ideas/page.tsx        # Idea engine
    │   ├── drafts/page.tsx       # Draft workshop
    │   ├── posts/page.tsx        # Post library
    │   ├── calendar/page.tsx     # Content calendar
    │   ├── analytics/page.tsx    # Analytics (3 tabs)
    │   ├── mood-board/page.tsx   # Mood board
    │   ├── hooks-library/page.tsx # Hooks & hashtags
    │   ├── series/page.tsx       # Content series
    │   ├── competitors/page.tsx  # Competitor tracking
    │   ├── profile/page.tsx      # Creator profile & memory
    │   ├── settings/page.tsx     # App settings
    │   └── components/           # Shared UI components
    ├── components/ui/            # shadcn/ui primitives
    ├── hooks/                    # Custom React hooks
    └── types/linkedin.ts         # Shared TypeScript interfaces
```

---

## Contributing

Found a gap in the loop? A missing insight type? PRs welcome.

Open an issue describing what you hit and what you expected.

---

## License

MIT
