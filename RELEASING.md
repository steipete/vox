# Releasing Vox

Vox ships source releases on GitHub. The root package is private and is not
published to npm; the unrelated npm package named `vox` is not this project.
The website has its own `deploy-website.yml` workflow and is not deployed by a
release. There are no Homebrew, native binary, or Sparkle release channels.

`.github/workflows/release.yml` calls the shared source archetype at `@v1`.
Update `package.json` and add exactly one dated changelog section, merge to
protected `main`, and wait for green push CI on that exact commit. Push an
annotated SSH-signed `vX.Y.Z` tag using the allowlisted release key. The workflow
validates metadata and CI, runs the CLI checks, and verifies immutable source
archives on two independent runners before publishing changelog notes,
archives, the asset inventory, and `SHA256SUMS` as a GitHub Release.

For a no-publish rehearsal, dispatch Release on current `main` with the manifest
version and `dry_run=true` (the default). A historical version with a dated
changelog section is valid: the rehearsal builds current main, not its old tag.
It runs the build and CLI help smoke without creating tags, releases, or deploys.
A live dispatch needs an existing signed tag. Tags are never moved, and an
existing release is accepted only if its bytes equal the verified payload.

Local checks remain `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`node dist/cli.js --help`. Publication is performed only by the release workflow.
After a release, verify the notes and assets and open the next Unreleased section.
