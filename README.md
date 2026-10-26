# LetterDesk — RA/TA Outreach Studio (full rewrite)

Pure **HTML + Tailwind CSS (CDN) + vanilla JavaScript**. No build step, no backend required.

## Run it
```bash
python3 -m http.server 8000     # then open http://localhost:8000
```
(Opening index.html directly also works; a local server is recommended so all APIs behave consistently.)

## Files
| File | Purpose |
|---|---|
| `index.html` | Full page: hero, 3-step wizard, modals (How-it-works, Stipends, Settings), pipeline |
| `css/styles.css` | Supplemental styles (cards, stepper states, pills, toasts, switches) |
| `js/data.js` | Demo professor dataset + stipend-by-country table |
| `js/search.js` | Multi-engine search (OpenAlex · Semantic Scholar · Crossref) + live email verification via Google DNS-over-HTTPS (`dns.google/resolve`) |
| `js/draft.js` | 150-word draft engine: local templates, cliché filter/enforcer, Groq·Llama-3 client, ChatGPT mega-prompt builder |
| `js/app.js` | Wizard state machine (step gating & navigation), rendering, feasibility scoring, pipeline, settings, persistence (localStorage) |
| `archive/` | All previous code, kept for reference |

## The 3 steps
1. **Search & Select** — live topic search (or *Load Demo Data* offline), per-engine progress, fit-scored professor cards with h-index, citations, recent papers + real DOIs. Selecting unlocks Step 2.
2. **Profile & Fit Score** — student profile form, skills chips, live acceptance-feasibility ring with point-by-point breakdown, selected-professor summary + stipend snapshot. Name + thesis topic unlock Step 3.
3. **Draft Studio** — generate (<150 words, cliché-free) in 3 modes: ⚡ Local template (free/offline), 🤖 Groq Llama 3 (bring free API key via ⚙ Settings), 📋 ChatGPT Prompt Builder (no key). Live word meter, cliché scanner, email deliverability check, copy/download/mailto, and a status pipeline (Not sent → Sent → Replied → Interview → Offer).

## Notes
- Scholarly APIs are public and CORS-enabled; they rate-limit occasionally — the UI falls back to demo data gracefully.
- Email verification uses MX/A lookups through Google DoH (mailbox-level SMTP checks need a server; this is documented honestly in the UI).
- Groq key is stored only in browser localStorage and sent only to api.groq.com.
