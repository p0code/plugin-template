#!/usr/bin/env bash
# Proves the template builds against a real p0code checkout:
# clone p0code, mount this repo as plugins/template, wire it into the server and web app,
# install, then typecheck and test. The clone is deleted afterwards unless KEEP=1.
#
#   scripts/verify.sh            # against p0code main
#   P0CODE_REF=some-branch scripts/verify.sh
#   SKIP_WEB=1 scripts/verify.sh # skip the (slow) web app typecheck
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
P0CODE_REPO="${P0CODE_REPO:-https://github.com/p0code/p0code}"
P0CODE_REF="${P0CODE_REF:-main}"
WORK="$(mktemp -d)"
if [ "${KEEP:-0}" != "1" ]; then trap 'rm -rf "$WORK"' EXIT; fi
P0="$WORK/p0code"

step() { printf '\n==> %s\n' "$*"; }

step "Clone $P0CODE_REPO@$P0CODE_REF into $P0"
git clone --quiet --depth 1 --branch "$P0CODE_REF" --recurse-submodules --shallow-submodules \
  "$P0CODE_REPO" "$P0"

step "Mount the template at plugins/template"
mkdir -p "$P0/plugins/template"
tar -C "$TEMPLATE_DIR" --exclude=.git --exclude=node_modules -cf - . | tar -C "$P0/plugins/template" -xf -

step "Wire it: workspace dependency, server registry, settings panel"
cd "$P0"
node -e '
  const fs = require("node:fs");
  for (const file of ["apps/server/package.json", "apps/web/package.json"]) {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.dependencies["@p0code/plugin-template"] = "workspace:*";
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  }
'
REGISTRY=apps/server/src/plugins/registry.ts
node -e '
  const fs = require("node:fs");
  const file = process.argv[1];
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes("@p0code/plugin-template")) {
    text = `import { examplePlugin } from "@p0code/plugin-template";\n${text}`;
  }
  const list = /^(export )?const bundledPlugins = \[([\s\S]*?)\];/m;
  if (!list.test(text)) {
    console.error(`Could not find bundledPlugins in ${file}`);
    process.exit(1);
  }
  text = text.replace(list, (_match, exported, inside) => {
    const items = inside.trim().replace(/,$/, "");
    return `${exported ?? ""}const bundledPlugins = [${items}, examplePlugin];`;
  });
  fs.writeFileSync(file, text);
' "$REGISTRY"
grep -q 'examplePlugin\];' "$REGISTRY" || { echo "Could not add examplePlugin to $REGISTRY" >&2; exit 1; }

SETTINGS=apps/web/src/components/settings/PluginsSettings.tsx
cp plugins/template/web/ExamplePanel.tsx apps/web/src/components/settings/ExamplePanel.tsx
sed -i.bak '1i\
import { EXAMPLE_PLUGIN_ID } from "@p0code/plugin-template/actions";\
import { ExampleDisclosure, ExamplePanel } from "./ExamplePanel";
' "$SETTINGS"
sed -i.bak 's/^const PLUGIN_PANELS: Readonly<Record<string, PluginPanel>> = {$/&\
  [EXAMPLE_PLUGIN_ID]: { Disclosure: ExampleDisclosure, Panel: ExamplePanel },/' "$SETTINGS"
grep -q 'EXAMPLE_PLUGIN_ID\]:' "$SETTINGS" || { echo "Could not add the panel to $SETTINGS" >&2; exit 1; }
rm -f "$REGISTRY.bak" "$SETTINGS.bak"
git --no-pager diff --stat

step "pnpm install"
pnpm install --no-frozen-lockfile --ignore-scripts

step "Plugin typecheck + tests"
pnpm --filter @p0code/plugin-template run typecheck
pnpm --filter @p0code/plugin-template run test

step "Server typecheck (registry imports the plugin)"
pnpm exec vp run --filter t3 typecheck

if [ "${SKIP_WEB:-0}" != "1" ]; then
  step "Web typecheck (settings panel)"
  pnpm exec vp run --filter @t3tools/web typecheck
fi

step "OK: the template builds and passes inside p0code@$P0CODE_REF"
