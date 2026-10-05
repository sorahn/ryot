# Ryot GPL fork

This is a modified GPLv3 fork of [IgnisDa/ryot](https://github.com/IgnisDa/ryot),
maintained at [sorahn/ryot](https://github.com/sorahn/ryot). It enables the features
that upstream labels Pro without a subscription or license key. It is not an
official Ryot release and does not include upstream's hosted service or support.

## Feature change

`crates/utils/dependent/core/src/lib.rs` always sets the existing
`is_server_key_validated` core-details field to true. The GraphQL API and existing
frontend checks stay compatible. The self-hosted backend no longer contacts Unkey
or needs `UNKEY_ROOT_KEY` at build time. `SERVER_PRO_KEY` is accepted for config
compatibility but has no effect. Ordinary authentication, ownership checks, and
administrator permissions remain enforced.

External metadata API credentials, SMTP, and file storage must still be configured
for features that require them. The marketing/payment website is not part of the
self-hosted container and its deployment workflow is disabled for this fork.

## Upstream policy

The fixed GPL baseline is recorded in `.fork/upstream-base`:
`1b888ee9fa2dc2452cea095b0bd783c2fa7e2e8b` (2026-10-04).

Pull changes while upstream remains under the current licensing terms. Stop at
the first licensing change and maintain this code independently afterward.
The current `ultra-rewrite` branch uses Elastic License 2.0 and must not be merged
into this fork. Never advance or reset the baseline to get past a guard failure.

From a clean checkout on the branch you want to update:

```sh
python3 ci/fork-sync.py --fetch
python3 ci/fork-sync.py --merge
```

The first command fetches upstream main and checks it; the second merges the
exact checked local upstream commit. You can check or merge a particular earlier
commit by passing its SHA instead of the default `upstream/main`. Once a licensing
change is found, inspect upstream history to choose the last acceptable commit,
merge that commit, and stop further upstream updates.

The guard requires ancestry from the baseline and compares license/notice files
and declared npm/Cargo licenses at **every** intervening commit, including side
branches. A later revert does not erase a licensing change. Changed, new, and
deleted licensing metadata all stop the update for review. This deliberately
errs on the side of stopping; it is not a legal determination. Review source
headers, embedded terms, new dependencies, and changed functionality as well.

After merging, check for new independent feature gates, run validation, and review
the resulting diff before committing/pushing. Do not use GitHub's unguarded
**Sync fork** button. CI also checks the full branch history before building.

## Container builds

The Fork build workflow produces AMD64 and ARM64 images at
`ghcr.io/sorahn/ryot`. Main pushes publish `latest`, `develop`, and a commit SHA
tag. Prefer a tested immutable `sha-...` tag or digest for deployment. Pull-request
builds do not publish images. The workflow uses the repository's `GITHUB_TOKEN`
for GHCR; no upstream Unkey or Docker Hub secrets are needed.

The existing Dockerfile expects compiled binaries at
`artifact/backend-amd64/backend` and `artifact/backend-arm64/backend`. The workflow
builds the email templates and Rust backend before assembling the container.
Running `docker build .` from a fresh checkout alone is insufficient.

## Validation

```sh
python3 ci/test-fork-sync.py
python3 ci/fork-sync.py HEAD
yarn install --immutable
yarn turbo run build --filter=@ryot/transactional
yarn workspace @ryot/transactional copy-templates
APP_VERSION=fork-dev cargo clippy --locked
yarn turbo run typecheck
yarn turbo run build --filter=@ryot/docs
APP_VERSION=fork-dev cargo build --release --locked
yarn turbo run test --filter=@ryot/tests
```

The integration suite requires a Docker-compatible daemon, Caddy, and the frontend
toolchain. It creates disposable PostgreSQL/S3 containers and mock OIDC/local
application processes. The health regression asserts that Pro status is enabled
without a key; the existing authorization/security tests exercise access boundaries.
Back up the database before deploying an upgrade. No schema changes are required
by this fork's feature change.

If the upstream default MinIO image is unavailable, set `TEST_S3_IMAGE` to
`rustfs/rustfs@sha256:1803faef57627e2d9c2e7d89d655d712ddded5389040054987163043fecb6a3c`,
the S3-compatible image used by the fork's CI. The upstream harness supports it.
Build the release backend first: the harness runs `target/release/backend`
directly, matching its other security-test servers, rather than rebuilding it.
