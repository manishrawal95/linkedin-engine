# Agentic LinkedIn Planner

> **Your LinkedIn posts teach AI how to write your next ones.**
> Add metrics → AI builds your playbook → AI drafts in your voice → You review → Post. Runs locally. No SaaS subscription.

[Live Demo →](#)

---

## The Loop

Most LinkedIn tools help you write posts. This one learns from every post you publish and gets smarter over time.

```
Your Posts → Metrics → AI Analysis → Playbook → AI Drafts → Post
     ↑                                                          |
     └──────────────────── repeat ─────────────────────────────┘
```

Every post you log makes the next draft better. The AI extracts what's working, builds a personal playbook of your DOs and DON'Ts, then uses that playbook — plus your top-performing posts as voice reference — to generate new drafts that sound like you.

You stay in the loop at every step. Nothing posts without your approval.

---

## How It Works

**Step 1 — Log your posts and metrics**
Add published posts and record performance (impressions, likes, comments, saves) at 12h, 24h, 48h, and 1-week intervals.

**Step 2 — AI classifies and learns**
Each post is scored as hit, average, or miss against your personal baseline. AI extracts 2–4 insights per post with confidence scores (e.g., *"contrarian hooks drive 2x saves — 91% confidence"*). Confidence grows when the same insight is confirmed across multiple posts.

**Step 3 — Your playbook is generated**
All learnings are compiled into a living strategy doc — your personal DOs, DON'Ts, and best practices. Automatically regenerates when your learnings change.

**Step 4 — AI drafts in your voice**
Specify a topic and pillar. The AI generates multiple draft variants using your playbook, your top 5 posts as voice reference, your hook library, and your hashtag sets. Every draft sounds like you, not like ChatGPT.

**Step 5 — Review, refine, and post**
One-click actions to punch up hooks, shorten, adjust tone, or apply playbook rules. Preview exactly how it'll look on LinkedIn. Post directly via OAuth or copy to clipboard.

---

## What's Inside

**Dashboard**
Central hub with engagement trends, pillar balance, posting heatmap (best day/hour), content queue, action panel (surfaces unanalyzed posts and metrics due), and goal tracker.

**Post Library**
Full CRUD for posts and metrics. Filter by pillar, type, author. Batch analyze all posts with one click. AI auto-fills pillar, type, topic, and hook from post content.

**AI Analysis Pipeline**
- Baseline calculated from your own data — not industry averages
- Hit/average/miss classification against your personal engagement baseline
- Saves weighted higher than likes in scoring
- Confidence scores grow over time as insights are re-confirmed
- Safe re-analysis — learnings never deleted until new extraction succeeds

**Draft Workshop**
- Generates multiple variants with different hook styles per request
- Inline improver: punch hook, shorten, make specific, adjust tone, apply playbook
- LinkedIn preview before posting
- Direct publish via LinkedIn OAuth with optional image upload
- Character counter with 3,000-char limit

**Content Calendar**
Monthly view for scheduling posts. Link drafts to dates, track status (planned / ready / posted / skipped). AI suggests next week's content plan based on pillar balance and best posting times.

**Mood Board**
Collect inspiration by content pillar — ideas, quotes, links, saved posts. Generate AI drafts directly from mood board items.

**Hooks Library**
Save and track opening lines by style (question, contrarian, story, stat, cliffhanger, list, statement). Track usage count and average engagement per hook style.

**Analytics**
Monthly trends, pillar performance, post type comparison, hook style effectiveness (radar chart), content length sweet spot (scatter plot), top/bottom performers with improvement suggestions.

**Supporting Features**
Hashtag sets by pillar, content series for recurring formats, competitor tracking, goal setting and progress tracking.

---

## AI Provider

Configurable — use Gemini or Claude:

```env
LINKEDIN_LLM_PROVIDER=gemini   # or "claude"
```

Both supported out of the box with retry logic and JSON parsing built in.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | FastAPI, SQLite (WAL mode), Pydantic |
| LLM | Google Gemini or Anthropic Claude — configurable |

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
| `LINKEDIN_CLAUDE_MODEL` | No | Default: `claude-sonnet-4-5-20250929` |
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

## API Reference

### Posts & Metrics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/posts` | List posts — filter by author, pillar, type, date |
| `POST` | `/posts` | Create post |
| `GET` | `/posts/{id}` | Get post with metrics |
| `PUT` | `/posts/{id}` | Update post |
| `DELETE` | `/posts/{id}` | Delete post |
| `POST` | `/posts/{id}/metrics` | Add metrics snapshot |
| `GET` | `/posts/batch-metrics` | Batch fetch latest metrics |
| `POST` | `/posts/auto-fill` | AI auto-fill pillar, type, topic, hook from content |

### AI & Analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze/{id}` | Classify post + extract learnings |
| `POST` | `/analyze/batch` | Batch analyze multiple posts |
| `GET` | `/learnings` | List all learnings — filter by category, impact |
| `GET` | `/playbook` | Get latest playbook |
| `POST` | `/playbook/regenerate` | Force regenerate playbook |

### Drafts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/drafts/generate` | AI-generate draft variants |
| `GET` | `/drafts` | List drafts — filter by status |
| `POST` | `/drafts` | Create manual draft |
| `PUT` | `/drafts/{id}` | Update draft |
| `POST` | `/drafts/{id}/publish` | Convert draft to post |
| `POST` | `/drafts/{id}/improve` | AI-improve draft (punch hook, shorten, adjust tone) |
| `POST` | `/drafts/{id}/upload-image` | Upload image for draft |
| `POST` | `/drafts/{id}/post-to-linkedin` | Publish draft to LinkedIn |

### Content Organization

| Method | Endpoint | Description |
|---|---|---|
| `CRUD` | `/pillars` | Content pillars |
| `CRUD` | `/series` | Content series |
| `CRUD` | `/mood-board` | Mood board items |
| `CRUD` | `/hooks` | Hook lines |
| `POST` | `/hooks/extract` | AI-extract hook from post content |
| `CRUD` | `/hashtags` | Hashtag sets |
| `CRUD` | `/calendar` | Calendar entries |
| `CRUD` | `/goals` | Performance goals |
| `CRUD` | `/competitors` | Competitor profiles |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/stats` | Summary stats |
| `GET` | `/dashboard/heatmap` | Best posting times |
| `GET` | `/dashboard/pillar-balance` | Post distribution by pillar |
| `GET` | `/dashboard/analytics` | Full analytics breakdown |
| `GET` | `/dashboard/actions` | Action items — unanalyzed posts, metrics due |
| `GET` | `/dashboard/queue-status` | Upcoming scheduled posts |
| `POST` | `/dashboard/post-ideas` | AI-generate post ideas from raw thoughts |
| `GET` | `/calendar/suggestions` | AI content plan for next week |

### LinkedIn OAuth

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/linkedin/start` | Begin OAuth flow |
| `GET` | `/auth/linkedin/callback` | OAuth callback handler |
| `GET` | `/auth/linkedin/status` | Check connection status |
| `GET` | `/health` | Server health check |

---

## Project Structure

```
├── backend/
│   ├── server.py        # FastAPI endpoints
│   ├── analyzer.py      # AI classification + learning extraction
│   ├── drafter.py       # AI draft generation
│   ├── prompts.py       # All LLM prompt templates
│   ├── llm.py           # Gemini/Claude abstraction with retry logic
│   ├── db.py            # SQLite schema (13 tables) + indexes
│   ├── models.py        # Pydantic models
│   └── config.py        # Environment config
│
└── frontend/
    ├── app/linkedin/
    │   ├── page.tsx              # Dashboard
    │   ├── posts/page.tsx        # Post library
    │   ├── drafts/page.tsx       # Draft workshop
    │   ├── calendar/page.tsx     # Content calendar
    │   ├── mood-board/page.tsx   # Mood board
    │   ├── hooks-library/page.tsx
    │   ├── hashtags/page.tsx
    │   ├── analytics/page.tsx
    │   └── components/           # Shared UI components
    └── types/linkedin.ts         # 31 shared TypeScript interfaces
```

---

## Contributing

Found a gap in the loop? A missing insight type? PRs welcome.

Open an issue describing what you hit and what you expected.

---

## License

MIT
