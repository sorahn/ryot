#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

architecture="${1:-amd64}"
engine="${CONTAINER_ENGINE:-podman}"
case "$architecture" in
  amd64) target='x86_64-unknown-linux-gnu'; native_machine='x86_64' ;;
  arm64) target='aarch64-unknown-linux-gnu'; native_machine='aarch64' ;;
  *) echo 'Usage: ci/build-fork.sh [amd64|arm64]' >&2; exit 2 ;;
esac

command -v "$engine" >/dev/null
command -v cargo >/dev/null
command -v node >/dev/null
python3 ci/fork-sync.py HEAD

revision="$(git rev-parse --short=12 HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  revision="${revision}-dirty"
fi
export APP_VERSION="${APP_VERSION:-fork-${revision}}"
image="${FORK_IMAGE:-localhost/ryot:fork-${revision}-${architecture}}"

node .yarn/releases/yarn-4.1.1.cjs install --immutable
node .yarn/releases/yarn-4.1.1.cjs turbo run build --filter=@ryot/transactional
node .yarn/releases/yarn-4.1.1.cjs workspace @ryot/transactional copy-templates

if [[ "$(uname -m)" == "$native_machine" ]]; then
  cargo build --release --locked
  binary='target/release/backend'
else
  command -v cross >/dev/null
  CROSS_CONTAINER_ENGINE="$engine" cross build --release --locked --target "$target"
  binary="target/${target}/release/backend"
fi

mkdir -p "artifact/backend-${architecture}"
cp "$binary" "artifact/backend-${architecture}/backend"
"$engine" build --platform "linux/${architecture}" --build-arg "TARGETARCH=${architecture}" --tag "$image" .
"$engine" tag "$image" localhost/ryot:latest
printf '\nBuilt local image: %s\n' "$image"
printf 'Export with: %s save --format oci-archive -o ryot-%s.tar %s\n' "$engine" "$architecture" "$image"
