# CLAUDE.md — LinkedIn Post Planner

Personal LinkedIn growth tool. Solo developer, local-only app.

## Stack
- **Backend**: FastAPI + SQLite (WAL) + Pydantic — port 8200
- **Frontend**: Next.js 16 + React 19 + TypeScript strict + Tailwind CSS 4 — port 3000
- **AI**: Gemini or Claude via `LINKEDIN_LLM_PROVIDER` env var
- **DB**: `backend/linkedin_data.db` (13 tables, 12 indexes)

## Core Workflow
Post → Metrics → AI Analysis (hit/average/miss) → Learnings → Playbook → AI Drafts

## Project Conventions

### Backend
- All endpoints in `backend/server.py`. Keep handlers thin — delegate to `analyzer.py`/`drafter.py`.
- Typed request bodies via Pydantic models in `backend/models.py` with `Field()` constraints.
- LLM calls through `backend/llm.py` abstraction only. Never call Gemini/Claude directly.
- JSON parsing: `backend/utils.py:parse_llm_json()`. Never strip code fences inline.
- Datetime: `datetime.now(timezone.utc)`. Never `datetime.utcnow()`.
- SQL: parameterized queries only via `backend/db.py:get_connection()`.

### Frontend
- Shared types in `frontend/types/linkedin.ts` (31 interfaces). Never duplicate inline.
- API calls through `/api/linkedin/` proxy routes. Never hit `localhost:8200` from client.
- Errors: `console.error` with context. Never empty catch blocks.
- User feedback: `toast.success()`/`toast.error()`. Never `alert()`.
- Design tokens in `frontend/app/globals.css`. Never hardcode colors/spacing.
- Loading: skeleton screens. Errors: specific message + retry. Never silent failures.

### Naming
- Files: `kebab-case`. Components: `PascalCase`. Utils/hooks: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Same concept = same word: posts, drafts, pillars, playbook, hooks, learnings, metrics.

### Quality Bar
- Mobile-first at 375px. Touch targets ≥ 44px. Input font ≥ 16px.
- All 5 states: loading, empty, error, partial, edge case.
- Errors answer: what failed, where, why, what to do next.
- No dead code, no duplicates, no orphaned files.

---

## Agent System (MANDATORY)

Specialist agents in `.claude/agents/`. Invoke based on task type.

### Routing Table

| Trigger | Agent | When |
|---------|-------|------|
| New feature | `product-manager` | **BEFORE** — validate problem, scope |
| UI/frontend work | `design-thinking` | **BEFORE** — visual hierarchy, craft, anti-AI-look |
| UI/frontend work | `designer` | **BEFORE** — states, mobile, accessibility |
| After UI code written | `design-critic` | **AFTER** — adversarial review, catches generic/AI look |
| User-facing text | `ux-copywriter` | **DURING** — copy quality, terminology |
| Auth, data, APIs | `security-engineer` | **DURING** — threat model |
| After non-trivial code | `code-reviewer` | **AFTER** — consistency, DRY, naming |
| After non-trivial code | `qa-engineer` | **AFTER** — edge cases, failure modes |
| Backend/API work | `sre` | **DURING** — performance, reliability |
| AI/LLM features | `ai-architect` | **BEFORE** — AI-native design |
| 3+ files changed | `orchestrator` | **COORDINATES** — propose → challenge → resolve |

### Rules
1. **UI work**: `design-thinking` BEFORE → implement → `design-critic` AFTER. Critic has veto power.
2. **3+ files**: use `orchestrator` for debate cycle.
3. **Auth/data/APIs**: never skip `security-engineer`.
4. **AI features**: `ai-architect` before other specialists.
5. Run independent agents in parallel to save time.

### How to Invoke
```
Read .claude/agents/{agent-name}.md, then apply its expertise to evaluate: {question}
```
