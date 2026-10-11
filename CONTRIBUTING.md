# Contributing to GrassRoute 🌱

Thanks for taking the time to contribute! GrassRoute is an early-stage project exploring how open-weight AI can encourage more real-world outdoor activity. Contributions of code, documentation, testing, accessibility improvements, bug reports, and thoughtful product ideas are welcome.

Before participating, please read the [Code of Conduct](CODE_OF_CONDUCT.md).

> **License note:** The repository currently has no `LICENSE` file. The maintainers should add a project license before accepting contributions for redistribution as an open-source release. Please don't assume a license from the fact that the repository is public.

## Ways to contribute

- Report reproducible bugs or propose features through GitHub Issues.
- Improve setup instructions, API documentation, accessibility, or error messages.
- Improve map search resilience, route validation, and graceful handling of provider failures.
- Improve mission quality, output validation, privacy, or safe outdoor guidance.
- Add automated tests and document manual verification steps.
- Help make the app usable across browsers, screen sizes, and assistive technologies.

## Before starting work

1. Search existing issues and pull requests to avoid duplicating effort.
2. For a substantial change, open an issue first and describe the problem, proposed solution, and any trade-offs.
3. Keep issues focused. A small, reviewable change is easier to maintain than a broad rewrite.
4. Never include credentials, personal data, precise location history, or private logs in issues, commits, screenshots, or pull requests.

## Local development

GrassRoute currently has three local components:

- `frontend/`: React, Vite, TypeScript, and React-Leaflet
- `backend/`: Express and TypeScript API
- `backend/ai/`: FastAPI service using Ollama and Gemma 3 4B

Use the setup instructions in [`README.md`](README.md) to install dependencies and start each service. Map search and routing require internet access. Mission generation uses the local Ollama model when it is running, but fallback mission behavior is expected if AI inference is unavailable.

## Branches and commits

Create a feature branch from the current default branch. Suggested names:

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`
- `test/short-description`

Use clear commit messages. Conventional Commit style is encouraged, for example:

- `feat(maps): add route retry handling`
- `fix(ai): validate malformed model output`
- `docs: explain local Gemma setup`
- `test(missions): cover invalid duration input`

## Code expectations

- Preserve the current architecture unless a change clearly benefits from a documented alternative.
- Prefer small, typed functions with explicit inputs and outputs.
- Validate API input at service boundaries and handle upstream errors explicitly.
- Don't trust model output blindly; validate structured responses and preserve a safe fallback.
- Don't log API keys, user coordinates, or other sensitive values.
- Keep location sharing opt-in. Don't add background tracking without clear consent and controls.
- Avoid claiming routes or mapped locations are safe, open, public, or accessible unless verified.
- Keep accessibility in mind: keyboard focus, readable contrast, clear labels, and responsive layouts.
- Add comments when explaining a non-obvious decision, not when restating the code.
- Update relevant documentation and `.env.example` when configuration changes.
- Do not commit `.env` files, API keys, virtual environments, `node_modules`, build artifacts, or local database files.

## Validation checklist

Run the relevant checks and include the results in your pull request.

```bash
# Backend
cd backend
npm run typecheck
npm run build

# Frontend
cd ../frontend
npm run build

# Python syntax check, from repository root
cd ..
python -m compileall backend/ai
```

For changes to map search, test both a successful result and an upstream failure. For routing, verify geometry shape, distance/time units, invalid coordinates, identical start/destination, and provider failure behavior. For mission generation, test a valid request, invalid duration/radius, Ollama unavailable, and malformed model output where practical.

There is no comprehensive automated test suite yet. Don't describe checks as passing unless you ran them; mention any test you could not run.

## Pull request checklist

Before opening your pull request:

- [ ] The change addresses one main concern and has a clear explanation.
- [ ] The code is formatted consistently with nearby code.
- [ ] Relevant type-checks/builds or tests were run, and their results are described.
- [ ] UI changes include screenshots or a short recording when useful.
- [ ] API changes include example request/response behavior or updated documentation.
- [ ] Errors, timeouts, and fallback behavior are considered.
- [ ] No secrets, private data, or unneeded precise location data are included.
- [ ] Documentation and example environment variables are updated.
- [ ] Accessibility and the outdoor safety implications were considered.

## Reporting security or privacy issues

Please do not publish API keys, credentials, exploit details, or other sensitive information in a public issue. Contact the project maintainer privately through the maintainer's GitHub profile and include a concise description, affected component, impact, and reproduction details that can safely be shared. Allow time for the issue to be investigated before public disclosure.

## Review process

Maintainers may ask for changes, tests, a narrower scope, or clearer documentation. Be respectful during review and respond constructively. Not every proposal will be accepted; decisions should focus on project scope, user safety, maintainability, and community benefit.

Thanks for helping GrassRoute make outdoor exploration a little easier. 🌿
