#!/usr/bin/env bash
# Rebuild the four biology sims into biology/ for the hub deploy.
# Source stays in the Vulkan checkouts; the hub commits the wasm + js output
# because CI rsyncs static files and does not run rustc.
set -euo pipefail

HUB="$(cd "$(dirname "$0")/.." && pwd)"
VULKAN="${VULKAN_DIR:-/home/andypap/Documents/Code/Vulkan}"

if ! rustup target list --installed | grep -qx 'wasm32-unknown-unknown'; then
  rustup target add wasm32-unknown-unknown
fi

bind_one() {
  local crate="$1" slug="$2" js="$3"
  local manifest="${VULKAN}/${crate}/Cargo.toml"
  echo "build ${crate} -> biology/${slug}/"
  cargo build --manifest-path "${manifest}" --lib --release --target wasm32-unknown-unknown
  local target_dir
  target_dir="$(cargo metadata --format-version 1 --no-deps --manifest-path "${manifest}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')"
  local wasm="${target_dir}/wasm32-unknown-unknown/release/${crate}.wasm"
  local out="${HUB}/biology/${slug}"
  mkdir -p "${out}"
  wasm-bindgen --target web --no-typescript --out-dir "${out}" "${wasm}"
  cat > "${out}/boot.js" <<EOF
import init from "./${js}";

const status = document.getElementById("gpu-status");

if (!navigator.gpu) {
  status.textContent = "This browser has no WebGPU. A current Chrome, Edge, or Firefox will run it.";
} else {
  init().catch(function (err) {
    status.textContent = err && err.message ? err.message : String(err);
  });
}
EOF
}

bind_one cell_division_2d cell-division-2d cell_division_2d.js
bind_one cell_division_rs cell-division cell_division_rs.js
bind_one dna_replication_2d dna-replication-2d dna_replication_2d.js
bind_one dna_replication_rs dna-replication dna_replication_rs.js

echo "biology wasm rebuilt under ${HUB}/biology/"
