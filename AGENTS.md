# Astra / Sol / Gemini workflow repository

This repository packages orchestration instructions and a Gemini screenshot review adapter.
Use `.agents/skills/astra-sol-gemini/SKILL.md` when the user requests this workflow.
The main chat coordinates; GPT-6.1 Sol implements; GPT-6 Astra independently reviews;
the official Gemini API reviews actual screenshots and emits seven dimension scores.

Preserve user instructions, business facts, copy and original image assets.
Only the implementation agent writes the target page during a review round.
Review the same frozen revision; after changes, capture fresh screenshots.
Never claim that missing screenshots, font evidence, API calls or model reviews passed.
Respect browser policy: do not bypass rejected navigation or replace screenshots with source guesses.
Do not spawn agents except when requested by the user or this invoked workflow skill.

Do not commit credentials, OAuth caches, runtime records, private screenshots or binaries.
Use GEMINI_API_KEY via process environment or stdin. The GitHub Actions secret is separate
from a local credential; cloning the repository does not download it.
Do not automatically enable paid models, change global proxies or retry without a bound.

The original native HTML project rules are retained in docs/native-html-project-rules.md
as an example. They apply when explicitly selected for a page project, not to every project.
