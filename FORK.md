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

## Custom fields

User-defined fields work across all media types. Manage definitions under
**Settings → Custom fields**, then edit values on an item's **Custom fields** tab.
Text, numbers, checkboxes, dates, and single/multiple choice fields are supported.
Definitions and values are private to each account, independent of provider
metadata and tracking status. See [the custom-fields guide](apps/docs/src/guides/custom-fields.md)
for editing, safe merge behavior, and the separate JSON export/import workflow.
No game-specific schema or Game Shelf import is included.

This feature adds the forward-only `m20261005_create_custom_fields` database
migration. Back up PostgreSQL before deploying it. Game Shelf and the live homelab
deployment are unchanged.

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
**Sync fork** button. The local build script checks the full branch history before building.

## Local container builds

GitHub Actions is disabled for this fork. Builds run locally and do not upload
images to a registry. Install Rust/rustup (the toolchain is pinned in
`rust-toolchain.toml`), Node 24, and Podman or Docker. Yarn is included in the repo.

```sh
bash ci/build-fork.sh amd64
# For the ARM64 homelab node:
bash ci/build-fork.sh arm64
```

The script checks the licensing history, builds the email templates and backend,
and assembles the existing Dockerfile. It creates a local image named
`localhost/ryot:fork-COMMIT-ARCH` and tags it `localhost/ryot:latest`. Override the
image name with `FORK_IMAGE` or choose Docker with `CONTAINER_ENGINE=docker`.
`APP_VERSION` can override the embedded version. Dirty checkouts get a `-dirty`
marker in the default image name.

When targeting a different CPU architecture, install `cross` and the Rust target
via rustup. Cross uses the container engine and pinned images in `Cross.toml`.
Use fully qualified image references with their pinned digest; Cross 0.2.5 does
not accept a digest-only `@sha256:...` reference. On Fedora, install
`qemu-user-static-aarch64` for ARM64 container emulation and verify it with
`podman run --rm --platform linux/arm64 docker.io/library/alpine:3.23 uname -m`.
Building the foreign-architecture container also requires working binfmt/QEMU
emulation. On 2026-10-06, this Fedora workstation successfully cross-built and
smoke-tested the ARM64 image, including all custom-field types and media types.
A native ARM64 Linux builder avoids cross-compilation and runtime emulation;
on a Mac, compile the backend inside an ARM64 Linux container.

The local runtime uses Node 24 on Debian Trixie, which supports the glibc symbols
used by the Fedora-built native backend. The Dockerfile checks linked libraries
before finishing; an older runtime may reject a newer host-built binary.

The Dockerfile expects the binary in `artifact/backend-ARCH/backend`; the script
creates that ignored directory. Running `podman build .` from a fresh checkout
alone is insufficient.

A registry is optional. Export a local image, copy the archive to the target
machine, and load it there:

```sh
mkdir -p artifact/images
podman save --format oci-archive -o artifact/images/ryot-arm64.tar localhost/ryot:fork-COMMIT-arm64
(cd artifact/images && sha256sum ryot-arm64.tar > ryot-arm64.tar.sha256)
# Copy the archive and checksum to the target machine.
# On the target, verify with sha256sum -c ryot-arm64.tar.sha256.
# With containerd/K3s on that machine:
sudo k3s ctr images import ryot-arm64.tar
```

For Kubernetes, use the imported image's exact name and set `imagePullPolicy: Never`
(or `IfNotPresent`). Import on every node that might run the pod, or constrain it
to the node where the image is loaded. A registry simplifies distribution across
nodes but is not necessary. Deployment and database backup are separate steps.

## Fast local development

Run `docker compose up` from this checkout, then open `http://127.0.0.1:8800`.
On Fedora with Podman, use `podman compose up` with a Compose provider installed.
The first start builds a development tool image, installs the pinned Yarn
workspace dependencies, and warms a separate Cargo debug cache. It does not build
an optimized release image. Subsequent starts reuse named caches.

The stack includes PostgreSQL 18, an incremental debug backend, the frontend dev
server, and Caddy. Frontend edits hot reload. Rust edits trigger a debug rebuild
and automatic backend restart; a failed rebuild leaves the last working backend
running. Library/model changes can still rebuild several crates. Watcher polling
also works with Docker Desktop bind mounts on the Mac. The runtime is Linux on
either machine, so host Rust/Node/Caddy installations are unnecessary.

On Fedora, a small backend source edit took 6.5 seconds for watch detection,
incremental compilation, restart, and GraphQL readiness with two compiler jobs.
Browser checks verified field save/reload on an existing game and a CSS hot update
against a private database copy. This is a leaf-edit measurement, not a guarantee
for schema or dependency changes. Container dependency trees and Yarn installation
state are isolated from host installations to avoid native-module mismatches.

The proxy and database bind only to loopback (ports 8800 and 55432). Background
jobs and telemetry are disabled. The development database is the persistent
`ryot-fork-dev-data` volume; production provider/SMTP configuration is not copied.
Existing entries work without those credentials; provider searches/refreshes may
need separate configuration. Game Shelf annotations remain in its schema until
an explicit import into custom fields is implemented.

To start with real data, use a private `pg_dump -Fc --no-owner --no-acl` snapshot.
Restore it **before the first backend start**, into an empty development database:

```sh
mkdir -p artifact/dev-data
chmod 700 artifact/dev-data
# Place a privately transferred snapshot at artifact/dev-data/home.dump.
docker compose up -d db
docker compose exec -T db pg_restore -U ryot_dev -d ryot_dev --no-owner --no-acl --exit-on-error < artifact/dev-data/home.dump
docker compose up
```

The snapshot contains private account/session data. Its directory is Git-ignored
and excluded from Docker build contexts. Sign in with the copied account. The
backend applies fork migrations only to the local copy. Restore into an empty
volume rather than combining dumps with an already migrated database. Nothing in
the stack connects to production or automatically refreshes the snapshot.

Use `docker compose logs -f backend` to inspect rebuilds and `docker compose down`
to stop everything while retaining data and caches. Avoid `down -v` unless you
intend to delete the local database and caches. Moving to the Mac requires the
checkout and a privately transferred snapshot; rebuild caches on that machine.
Leave the Mac migration for a separate task. Release deployment continues to use
`ci/build-fork.sh` and the licensing guard.

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
application processes. The health regressions check enabled status and access-link creation without a key,
and reject anonymous access; the existing authorization/security tests exercise access boundaries.
Back up the database before deploying an upgrade. Keyless feature availability
requires no schema changes; custom fields add two tables via a forward-only migration.

If the upstream default MinIO image is unavailable, set `TEST_S3_IMAGE` to
`rustfs/rustfs@sha256:1803faef57627e2d9c2e7d89d655d712ddded5389040054987163043fecb6a3c`,
the S3-compatible image used for this fork's local checks. The upstream harness supports it.
Build the release backend first: the harness runs `target/release/backend`
directly, matching its other security-test servers, rather than rebuilding it.

For rootless Podman tests, start a temporary `podman system service` socket and set
`DOCKER_HOST` to its Unix URL and `TESTCONTAINERS_RYUK_DISABLED=true`. The harness
explicitly tears down its containers. Turbo passes through the `DOCKER_*`, `TEST_*`,
and `TESTCONTAINERS_*` variables needed by this setup.
