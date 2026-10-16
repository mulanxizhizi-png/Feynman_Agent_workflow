# Workflow repository instructions

This repository ships a reusable workflow, not a product page. Start at
.agents/skills/feynman-agent/SKILL.md (Feynman Agent), which routes to
.agents/skills/independent-review-workflow/SKILL.md. The old sol-terra-gemini skill is an alias.
The executor (GPT-6 Sol / low) implements; the coordinator/reviewer (GPT-6.1 Sol / high)
orchestrates and audits in separate contexts, never co-designs or patches the reviewed version.
Target project rules and latest user requirements take precedence over workflow defaults.

Read docs/review-policy.md before selecting an audit action. Record original evidence and
run bin/workflow.mjs decide; do not change risk declarations or exemptions after a failed review.
Use fresh context for initial/final independent review. Reuse the same reviewer for ordinary
rechecks. Keep implementer opinions and historical verdicts out of the first-pass packet.
The reviewer owns its acquisition registry, first findings, issue ledger and checkpoints.
Related model families and different reasoning effort do not eliminate shared bias; preferences remain advisory.
Model agreement cannot establish universal user acceptance.

Schemas, CLI and context boundaries are defined once in docs/review-protocol.md,
docs/cli.md and docs/reviewer-context.md. Load only what the task needs.
Core implementation lives in src/review; bin/workflow.mjs is the only native CLI entry.
adapters/gemini is optional legacy schema 2 diagnostics, disabled by default.
Defaults in .codex are templates, not proof of actual runtime model or permissions.

Run npm run validate after source changes; regenerate MANIFEST.json with
node scripts/manifest.mjs build into a separate temporary file and apply the reviewed result.
Only manifest-listed workflow sources and MANIFEST.json belong in a publication.
Never commit runtime/, caches, screenshots, credentials, third-party binaries or target-project files.
Preserve unrelated changes; user-authorized publication is separate from model review status.
No command in this repository launches agents or automatically publishes.
Report source/contract status, technical status, independence evidence and scope limits separately.
