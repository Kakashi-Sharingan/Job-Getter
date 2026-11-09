# Career Ops integration

Source: https://github.com/career-ops-hq/career-ops
Pinned commit: `24da28e8307d19f3002cf32eb953ad990d71da95` (package version 1.39.0).
License: MIT, copyright Santiago Fernández de Valderrama; full notice in `docs/vendor/CAREER-OPS-LICENSE.txt`.

Installed upstream router: `.agents/skills/career-ops/SKILL.md`. Full toolkit: local ignored `career-ops/`, installed/restored with `bash scripts/install-career-ops.sh`. Private data: ignored `private/career-ops-data/`. The upstream install contains the full modes and scripts; copying only the router is not sufficient to run a mode.

The public app directly runs an adaptation of upstream `analyzeRoleClarity()` in the browser. Only Node imports, CLI and built-in tests were removed. Its six-point evidence/questions analysis does not affect match scores and is English-only. App tracker conventions, archived JD packages, and strict separation of triage from evaluation draw on the upstream Data Contract, source-of-truth rules, tracker and triage modes. The tracker is an independent browser implementation, not the upstream CLI tracker.

Not enabled: upstream AI workflows, PDF rendering, live application-form assistant, or automatic submission. Doctor currently requires private CV/profile/targeting/portals onboarding for profile-dependent modes. Do not create these from upstream example candidate facts. Unknown location, authorization, compensation and availability must stay unknown until supplied by the owner.

No upstream software is installed on the user's personal computer by this chat. The current installation is in the execution workspace; the pinned installer and skill persist in GitHub for future work.
