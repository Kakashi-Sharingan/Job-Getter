# Job Getter

Free job discovery, source-backed application documents, and private tracking.

## Hosted dashboard

https://kakashi-sharingan.github.io/Job-Getter/

- Eight verified Greenhouse/Lever company feeds refresh daily through GitHub Actions.
- Multiword search matches terms across titles, descriptions and skills. Canada matches recognized Canadian cities even where the country name is omitted.
- Default minimum fit is 25%; Any fit and Clear filters reveal lower-scoring matches. Counts explain matches hidden by the threshold.
- Scores are keyword heuristics, not AI evaluations or eligibility decisions. Sources are company boards, not a global LinkedIn/Indeed search.
- Import a PDF/TXT resume or verified JSON profile. The conservative parser expects clear Summary, Skills, Experience and Education sections; employer/title/date structure must be reviewed. Unsupported formats stop for review.
- Generate tailored resume, cover-letter and combined PDFs entirely in the browser, with embedded fonts. Relevant source-backed achievements and skills are reordered. XYZ audits retain missing measurements as unknown; numerical improvement metrics are never invented. This is source-based tailoring, not a hosted LLM.
- Keep private application stages, notes, dates, follow-ups and applied-time snapshots. Export/import a backup before switching devices.

Candidate contact details, resume data and application history are not included in this public repository. Imported resumes remain in page memory; close/reload the page to clear the imported profile. Tracking data stays in local browser storage. Never commit private exports.

## Submission worker

GitHub Pages is a static website and cannot itself run Playwright or a secure submission server. `scripts/greenhouse-worker.cjs` is a separate, approval-bound worker for one supported Hootsuite requisition. It requires Playwright/Chromium in an execution environment. It is not an always-running service deployed by Pages.

The worker rejects missing approval, changed documents, unresolved questions and unreviewed privacy acknowledgement before networking. Approval must match the SHA-256 of a private manifest containing exact answers, destination and attachment hashes. It fills the live form, uploads only the reviewed combined PDF, and requires an explicit employer confirmation heading before recording success. It does not solve CAPTCHA, bypass access restrictions or blindly retry ambiguous submissions. An `attempt.json` blocks retries until a human verifies the result. This version supports only the reviewed Hootsuite requisition, not arbitrary employers.

```bash
node scripts/render-application.mjs private/candidate.json private/job.json private/application
node scripts/greenhouse-worker.cjs private/application/manifest.json --approved-sha256 REVIEWED_HASH
```

The worker's application/receipt files stay private. No real employer submission is inferred from a fixture test or from clicking a button. A successful employer receipt is required to establish live end-to-end submission.

## Test and run locally

```bash
python -m unittest discover -s tests
node --test tests/*.test.mjs
python scripts/discover.py
python -m http.server 8001 --directory docs
# With Playwright and Chromium available:
node tests/browser.cjs
node tests/worker-browser.cjs
```

Browser tests use isolated contexts and mocked data; the worker browser test uses an intercepted form and does not send an employer application. `BASE_URL` can target the hosted dashboard, and `CHROMIUM_PATH` selects the test browser. Test synthetic profiles do not contain real candidate data.

Discovery keeps stable IDs and first-seen dates, isolates failed sources, and labels retained records stale. Shortened descriptions are marked and their hashes identify the stored text. Unreadable local tracker data is protected from overwrites and can be downloaded before an explicit reset.

## Career Ops and dependencies

The pinned [Career Ops](https://github.com/career-ops-hq/career-ops) router is in `.agents/skills/career-ops/SKILL.md`; `bash scripts/install-career-ops.sh` restores the full ignored toolkit. Private upstream onboarding is separate. `AGENTS.md` preserves project guidance for future sessions.

Role-clarity checks run the adapted upstream six-point English heuristic with quoted evidence and recruiter questions. They do not affect scores or establish employer legitimacy.

Vendored dependencies are jsPDF 3.0.4, PDF.js 4.10.38, and Liberation Sans. License notices are in `docs/vendor/`. PDF reading and rendering need no external AI API or upload. GitHub Pages and standard Actions are subject to GitHub's free usage limits; no paid runner or model provider is enabled.
