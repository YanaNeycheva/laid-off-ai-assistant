# comeback

An interactive assistant that supports a laid-off professional through the **whole** arc of finding their next job — from the shock of the layoff to signing the next offer. One conversation, in **Bulgarian**, that covers benefits, CV, job-search strategy, and interviews — with a steadying, human layer running underneath all of it.

- **Language (what you see):** Bulgarian
- **Who it's for:** any laid-off professional — junior to senior, any industry
- **Where it runs:** [Claude Code](https://claude.com/claude-code), **or [OpenCode](https://opencode.ai) for free** (free tool + free built-in models — no paid AI plan needed) — it's an agent you talk to, not a website
- **Sibling project:** the [uncoachable.work](https://uncoachable.work) blog; the guide that grounds this agent is also published there

## Why this exists

The market is full of single-purpose tools: CV builders, auto-appliers, interview drills. People stack two or three of them because none covers the whole journey — and every one optimizes a *document* or a *performance* while ignoring the *person*. There is almost nothing good in Bulgarian, and nothing that holds someone steadily across the entire process.

`comeback` does the opposite: **one assistant for the entire comeback**, in your language, that also handles the thing Bulgarian tools ignore — the money-and-deadlines side of losing a job — and never loses sight of the human going through it.

## What it does

It's not a CV tool with extras. It covers six things, and it decides which one you need by talking to you:

- **📋 Benefits & the legal clock** *(Bulgaria-specific)* — Are you owed unemployment benefit, how much, and by when must you act? It works out your **actual** Бюро по труда deadline (7 working days) and НОИ deadline (3 months) from your termination date, estimates your benefit, and orients you on severance and the electronic trudova kniga at НАП. The dates and amounts are computed deterministically and **verified against official НОИ/НАП sources** — never guessed.
- **📄 CV / resume** — Build one from scratch or clean up what you have, tailor it to a specific posting, sanity-check it for ATS, and reframe the layoff honestly. You get a finished `.docx` **and** a `.pdf`.
- **🎯 Job-search strategy** — A networking-first plan, a living application **tracker** the assistant maintains for you, and outreach drafts — so you're not just firing CVs into the void.
- **🗣️ Interview practice** — Mock interviews with real feedback, the "why did you leave?" story worked out until it lands, and delivery.
- **🔎 Company research** *(optional)* — For a specific posting: an honest fit read, concrete "why here" angles, and sharp questions to ask.
- **🫂 Emotional footing** — An always-on steadying layer underneath everything. You never have to ask for it; it's the part competitors skip.

> **A note on trust:** anything the assistant tells you about benefits, deadlines, or documents is checked by a **separate verifier** against the official source before you see it. If something can't be confirmed, it says so and points you to НОИ/Бюро по труда rather than handing you a confident wrong number.

## How to use it

### Before you start — pick how you'll run it
The assistant is the same either way; the only difference is the tool you talk to it in.

**Option A — OpenCode (free, no paid plan).** [OpenCode](https://opencode.ai) is free and ships with free built-in models (OpenCode Zen), so you can run the **whole** assistant at no cost — no Claude subscription, no API key.
1. Install OpenCode and open **this project folder** in it.
2. Start a new session and pick the **Comeback** agent (the agent selector, bottom-left).
3. Say what happened — it opens with triage and takes it from there. The default free model works out of the box; the full benefits → CV → search → interview flow runs on it.

**Option B — Claude Code.** The tool this project is authored in.
1. Open this project in **Claude Code** with **this folder** as the working directory — that's what puts the subagents and the CV skill in scope. (On a plain Claude.ai project without them, only the conversation works — no file output.)
2. Type **`/comeback`**, or just say what happened.

*Optional (either tool):* install **LibreOffice** if you want CV **PDFs** rendered locally with correct Cyrillic. Without it you still get the `.docx`.

### Just talk to it
Whichever tool you picked, say what happened — in Bulgarian or English:

> „Съкратиха ме." · „Останах без работа." · „laid off"

It opens with a short, human check-in — what happened and where you are — and then routes to whatever you need. **You don't pick a mode or memorize commands; you just talk to it.** (In Claude Code you can also type `/comeback`; in OpenCode you pick the **Comeback** agent first, then talk.)

### What you can ask for
You steer it in plain language. A few examples of what to say and what happens:

| Say something like… | …and it |
|---|---|
| „Съкратиха ме вчера, откъде да започна?" | Steadies you, then lays out the first days — with your benefit deadlines if the clock is ticking |
| „Полагат ли ми се пари и до кога да се регистрирам?" | Works out eligibility, your **exact** Бюро/НОИ deadlines and a benefit estimate — verified against official sources |
| „Помогни ми да стегна CV-то за тази обява" *(paste the job ad)* | Produces a tailored, ATS-clean CV as `.docx` + `.pdf` |
| „Имам интервю в петък, дай да порепетираме" | Runs a mock interview with feedback and helps you tell the layoff story |
| „Не знам как да си търся работа" | Builds a networking-first plan, a tracker, and outreach drafts |
| „Разкажи ми за тази компания преди интервюто" *(paste the posting)* | Fit read, „защо точно тук" angles, and questions to ask |
| *(feeling low / overwhelmed)* | The steadying layer is always on — you don't have to ask |

**CV only?** You can invoke the CV engine directly: **`/build-cv`** to create or ATS-clean your base CV (no job posting needed), or **`/tailor-cv`** to tailor a clean base to a specific posting.

### What you get, and where
Everything produced **for you** lives in a private, **git-ignored** `Personal/<date>-you/` folder — so nothing about your situation is ever committed to the repo:
- a **dossier** — the assistant's running memory of your situation (so it never re-asks)
- your tailored **CV** (`.docx` + `.pdf`)
- a job-search **tracker**
- **interview** notes

## How it works

One **orchestrator** is the single voice you talk to. It holds the relationship — the check-in, the steadying layer, and one consistent tone — and never hands that off. For concrete work it quietly delegates to specialized **subagents** (CV, interview, search, benefits, company research), each of which reads and writes your shared **dossier**. A separate **freshness-checker** independently verifies every benefits/legal claim before it reaches you. You never see the machinery — just one assistant.

```
agent/            orchestrator (the voice), triage, always-on support, dossier schema
.claude/agents/   the subagents (authored here): cv-builder, interview-coach, search-strategist,
                  bg-navigator, company-intel, and the freshness-checker verifier
.claude/skills/   /comeback (the front door), /build-cv (base CV) and /tailor-cv (tailor to a posting)
.opencode/agents/ the same agents, generated for OpenCode from .claude/ (tools/gen_agents.py)
knowledge-base/   the Bulgarian guide + BG legal/benefits facts + sources
scripts/          harness-independent CV .docx/.pdf + tracker .xlsx output
```

The assistant is **authored once in `.claude/`**; the other tools' trees are *generated* from it with `python tools/gen_agents.py`, so they run the same agent. Contributors edit `.claude/` and regenerate — they never hand-edit the generated trees. Per-tool model choices live in [tiers.json](tiers.json).

- **OpenCode** (`.opencode/agents/`) — generated and **validated** end-to-end (free to run).
- **Codex** (`.codex/agents/`) and **Copilot** (`.github/agents/`) — generated and structurally linted, but **not yet behaviorally tested** (those tools aren't set up here). Treat them as experimental; the agent bodies are the same, but each tool's entry point and web-search wiring still need a real run to confirm.

Full architecture and conventions are in [CLAUDE.md](CLAUDE.md).

## Status

Shipped and stable (see `VERSION`). The full orchestrator → subagent → verification flow works end-to-end and is backed by an automated test suite (`tests/`), enforced before every push by a local test gate (see [CONTRIBUTING.md](CONTRIBUTING.md)). History is in [CHANGELOG.md](CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), and [CLAUDE.md](CLAUDE.md) for the full conventions.

## License

Dual-licensed. The code and everything outside `knowledge-base/` is under the [MIT License](LICENSE). The written content in `knowledge-base/` — the guide, `bg-legal`, and `sources` — is under [Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)](knowledge-base/LICENSE): share and adapt with attribution, non-commercial only.
