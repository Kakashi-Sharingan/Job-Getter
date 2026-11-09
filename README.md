# Job Getter

Free, GitHub-hosted job discovery and review dashboard, configured for Java/backend skills. No subscriptions, paid API, tracking analytics, candidate contact information, or uploaded resume included.

## What works

- Public Greenhouse and Lever discovery from the company registry in `sources.json`.
- Daily GitHub Actions refresh at 15:23 UTC (scheduled runs may be delayed).
- Stable job IDs, first-seen dates, description hashes, failed-source isolation and stale labeling.
- Transparent keyword ranking from `profile.json` (not AI or an eligibility assessment).
- Search, location filter, fit threshold, browser-local saved/reviewed statuses.
- Resume text can be pasted locally and exported with an editable, deliberately conservative cover-letter draft. Resume text is not uploaded or persisted by the app.
- GitHub Pages dashboard from the `main` branch root (a root entry page also supports `/docs`).

## Boundaries

This release does not submit applications, run n8n, call an LLM, generate tailored PDFs, or claim an application was sent. The export keeps the original resume unchanged. “Reviewed” is browser-local bookkeeping, not authenticated submission approval. No nationality, authorization, salary, or availability is inferred.

Public GitHub Pages has no private user account or secure backend. Never commit resumes, private answers, exported packages, tokens, or application receipts. Do not put secrets in frontend code. Anonymous visitors can see public job listings and generic skill weights. All browser-local choices are device-specific and can be lost if browser storage is cleared.

GitHub Pages is free for this public repository under GitHub's applicable limits. Hosted Actions uses standard Linux runners; do not enable paid larger runners. Public-repository schedules may be disabled after inactivity; inspect Actions if updates stop. Scheduled code commits do not themselves trigger another workflow; Pages branch publishing handles the updated static files.

## Local run / tests

```bash
python -m unittest discover -s tests
python scripts/discover.py
python -m http.server 8000 --directory docs
```

Open http://localhost:8000. Edit `sources.json` to add employer board identifiers. These APIs are company boards, not global job search. Closed listings disappear on successful refreshes. A source failure retains previous results as stale. This release neither scrapes LinkedIn/Indeed nor handles their logins.

## Next implementation stage

Use a private worker for local Ollama inference and PDF rendering. Send only necessary candidate evidence to a model you control. Bind approval to an authenticated owner, exact job description hash, documents, answers, and expiry. Add site-specific adapters only after testing; stop on CAPTCHA/MFA and unknown required answers. Never retry an ambiguous submission without checking a receipt. Do not attach a submission endpoint to this public static page without implementing authentication and server-side validation.

## Career Ops refinements

The pinned [Career Ops](https://github.com/career-ops-hq/career-ops) skill is installed in `.agents/skills/career-ops/SKILL.md`. Run `bash scripts/install-career-ops.sh` to restore the full local toolkit and locked dependencies. No paid provider is enabled. The current workspace install is not an installation on your personal computer. Profile-dependent upstream modes still require private onboarding.

- The dashboard runs Career Ops' six-point role-clarity analyzer locally, with exact evidence quotes and recruiter questions. English keyword checks only; no impact on fit score and no legitimacy verdict.
- Private pipeline stages include Saved, Reviewed, Applied, Responded, Assessment, Interview, Offer, Hired, Rejected, Discarded and SKIP. Applied requires an explicit self-submission checkbox and event date. Reviewed is not a full upstream evaluation.
- Event history, notes, optional follow-up dates, and full normalized JD snapshots stay in browser storage. Saved jobs remain available when they leave the live feed. Reminders are displayed only when you open the app; they are not scheduled notifications.
- Export/import JSON backups to move history between devices. Imports preview count/conflicts before replacing matching entries. Exported backups are private; never commit them to this public repository.
- Role-review and application packages now include normalized JD snapshots, source hashes, and role-clarity findings.

Durable project guidance is in `AGENTS.md`; source pin and integration scope are in `integrations/career-ops/`. This is repository memory, not a guarantee of assistant memory across chats. MIT attribution is in `docs/vendor/CAREER-OPS-LICENSE.txt`.

Checks: `python -m unittest discover -s tests` and `node --test tests/*.test.mjs`.
