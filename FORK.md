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
Building the foreign-architecture container also requires working binfmt/QEMU
emulation. Building on a native ARM64 machine avoids those requirements. ARM64
cross-building has not yet been validated on this Fedora workstation.

The local runtime uses Node 24 on Debian Trixie, which supports the glibc symbols
used by the Fedora-built native backend. The Dockerfile checks linked libraries
before finishing; an older runtime may reject a newer host-built binary.

The Dockerfile expects the binary in `artifact/backend-ARCH/backend`; the script
creates that ignored directory. Running `podman build .` from a fresh checkout
alone is insufficient.

A registry is optional. Export a local image, copy the archive to the target
machine, and load it there:

```sh
podman save --format oci-archive -o ryot-arm64.tar localhost/ryot:fork-COMMIT-arm64
# Copy ryot-arm64.tar to the target machine using your preferred transfer method.
# With containerd/K3s on that machine:
sudo k3s ctr images import ryot-arm64.tar
```

For Kubernetes, use the imported image's exact name and set `imagePullPolicy: Never`
(or `IfNotPresent`). Import on every node that might run the pod, or constrain it
to the node where the image is loaded. A registry simplifies distribution across
nodes but is not necessary. Deployment and database backup are separate steps.

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
Back up the database before deploying an upgrade. No schema changes are required
by this fork's feature change.

If the upstream default MinIO image is unavailable, set `TEST_S3_IMAGE` to
`rustfs/rustfs@sha256:1803faef57627e2d9c2e7d89d655d712ddded5389040054987163043fecb6a3c`,
the S3-compatible image used for this fork's local checks. The upstream harness supports it.
Build the release backend first: the harness runs `target/release/backend`
directly, matching its other security-test servers, rather than rebuilding it.

For rootless Podman tests, start a temporary `podman system service` socket and set
`DOCKER_HOST` to its Unix URL and `TESTCONTAINERS_RYUK_DISABLED=true`. The harness
explicitly tears down its containers. Turbo passes through the `DOCKER_*`, `TEST_*`,
and `TESTCONTAINERS_*` variables needed by this setup.
