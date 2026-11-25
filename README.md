# p0code plugin template

A small, working plugin for [p0code](https://github.com/p0code/p0code) (the T3 Code fork) that you
can copy to start your own. It is laid out exactly like the bundled plugins, so it mounts at
`p0code/plugins/<name>` as a git submodule or a plain folder.

The example plugin ("Example", id `example`) shows the pieces most plugins need:

| Piece | Where | Notes |
| --- | --- | --- |
| `definePlugin` with a literal manifest | [`src/index.ts`](src/index.ts) | The shop reads it without running your code. |
| A pure action with Schema codecs | `greet` in [`src/actions.ts`](src/actions.ts) | No host services. |
| An action that uses a host service | `note` in [`src/index.ts`](src/index.ts) | `PluginContext.storage`, the per-plugin secret store. Needs no capability. |
| An HTTP route | `POST /api/plugins/example/ping` | Needs `http:routes` and the path in `httpRoutes`. |
| Agent instructions | `agentInstructions` | Needs `agent:instructions`. Returns the saved note, or `null` for nothing. |
| A settings panel | [`web/ExamplePanel.tsx`](web/ExamplePanel.tsx) | Calls actions through the host's `pluginsInvoke` RPC. |
| Tests | [`src/example.test.ts`](src/example.test.ts) | Actions, codecs, manifest declarations, and a full `definePlugin` start. |

Like every bundled plugin it is **off until someone turns it on** in Settings → Plugins: the host
starts a plugin only when `settings.plugins[id].enabled` is `true`, and the default is `{}`.

## Make it yours

1. Use this repo as a template (or copy it) and rename: `EXAMPLE_PLUGIN_ID` and
   `EXAMPLE_PING_ROUTE` in `src/actions.ts`, the manifest `name`/`description` in `src/index.ts`,
   `examplePlugin`, `ExamplePanel`, and the package `name` in `package.json`.
2. Declare only the capabilities you use. Delete `routes`/`httpRoutes` and `agentInstructions` if
   you don't need them, and drop their capabilities with them.
3. Keep `manifest` a literal inside `definePlugin({ ... })`: `id` may be a string constant from a
   relative import, but `version`, `capabilities` and `externalServices` must be literals.
4. List every outside host you send data to in `externalServices`, and set `unofficial: true` if
   you talk to a service that didn't build or endorse your plugin.

## Workflow A: develop inside a p0code checkout

Plugins are compiled into the server; nothing is loaded from disk at runtime. So you mount yours
into a p0code checkout and register it.

```sh
git clone --recurse-submodules https://github.com/p0code/p0code.git
cd p0code
git submodule add https://github.com/you/your-plugin plugins/your-plugin   # or just copy the folder
```

`plugins/*` is already a pnpm workspace glob. Then wire it in three places:

```jsonc
// apps/server/package.json (and apps/web/package.json if you ship a panel)
"dependencies": {
  "@p0code/plugin-template": "workspace:*"
}
```

```ts
// apps/server/src/plugins/registry.ts
import { examplePlugin } from "@p0code/plugin-template";
export const bundledPlugins = [t3ConnectBridge, obsidianSharedMemory, tokscaleAutoPublish, examplePlugin];
```

```tsx
// Optional panel: copy web/ExamplePanel.tsx to apps/web/src/components/settings/, then in
// apps/web/src/components/settings/PluginsSettings.tsx:
import { EXAMPLE_PLUGIN_ID } from "@p0code/plugin-template/actions";
import { ExampleDisclosure, ExamplePanel } from "./ExamplePanel";
// ...inside PLUGIN_PANELS:
[EXAMPLE_PLUGIN_ID]: { Disclosure: ExampleDisclosure, Panel: ExamplePanel },
```

Install and check:

```sh
pnpm install
pnpm --filter @p0code/plugin-template run typecheck
pnpm --filter @p0code/plugin-template run test
pnpm exec vp run --filter t3 typecheck            # the server that imports it
pnpm exec vp run --filter @t3tools/web typecheck  # if you added the panel
```

`scripts/verify.sh` does all of the above in a throwaway clone of p0code `main` and deletes it
afterwards; CI ([`.github/workflows/verify.yml`](.github/workflows/verify.yml)) runs the same script
on every push, PR and weekly.

## Workflow B: list it in the plugin shop

The Shop tab reads the catalog at [p0code/plugins-shop](https://github.com/p0code/plugins-shop).
Your plugin stays in your repo; the catalog only pins it to a reviewed commit. Open a PR there that
adds `plugins/<id>.json`, where `<id>` is your manifest's `id`:

```json
{
  "$schema": "../schema/plugin.schema.json",
  "id": "example",
  "name": "Example",
  "description": "One or two sentences shown in the Shop.",
  "author": { "name": "you", "url": "https://github.com/you" },
  "repository": "https://github.com/you/your-plugin",
  "ref": "0123456789abcdef0123456789abcdef01234567",
  "version": "0.1.0",
  "capabilities": ["http:routes", "agent:instructions"],
  "externalServices": [],
  "license": "MIT",
  "official": false
}
```

- `ref` is a full commit SHA (preferred) or a tag; branches are refused. Updates are a PR that
  bumps `ref` and `version`.
- `id`, `version`, `capabilities` and `externalServices` must match your manifest at `ref`; the
  shop's build reads them from the file your `package.json` `exports["."]` points to.
- `official` is `true` only for repos owned by the `p0code` or `jsserve-org` orgs; the build
  enforces it.
- Optional: `path` (if `package.json` isn't at the repo root), `homepage`, `icon`, `screenshots`
  (all `https://`).

The shop's README and `schema/plugin.schema.json` are the source of truth for these fields.

## Capabilities

Declared in `manifest.capabilities` and shown to people before they turn the plugin on. "Enforced"
means the host refuses the API to a plugin that did not declare it, as of p0code `main` in
November 2026.

| Capability | What enabling this lets the plugin do | Enforced by the host? |
| --- | --- | --- |
| `http:routes` | Answer the web endpoints listed in `httpRoutes`, **without a signed-in session**, while enabled. | The paths are: `definePlugin` refuses a route not in `httpRoutes`, and the server only mounts declared paths. |
| `agent:instructions` | Add text to every agent turn while enabled. | Yes: `definePlugin` refuses to start, and the host skips the plugin, without it. |
| `auth:issue-device-credentials` | Pair devices that stay signed in to this server until the plugin is disabled. | Yes: `deviceAccess` fails without it; the host revokes those sessions when the plugin turns off. |
| `orchestration:read-activity` | See which agents are working or waiting, with thread and project titles. | Yes: `agentActivity` is empty or fails without it. |
| `usage:read` | Read token and cost totals per day, provider and model (never prompts, paths or titles). | Yes: `usage.dailyTotals` fails without it. |
| `data:backup` | Read a full copy of chats, attachments and settings, and propose restoring a backup. | **Not on p0code `main` yet** (branch `data-backup-host-api`); the shop schema accepts it, so a plugin can be listed ahead of the host API, but the app's manifest schema rejects it today. |
| `network:outbound` | Connect to outside services and send data from the server. | No: a declaration only. Plugins run in the server process and can reach the network anyway. |
| `process:spawn` | Run helper programs on the server, with its files and credentials. | No: a declaration only. It is a real shell-level process with your user's rights. |

The plugin shop's schema accepts the app's full capability set, including `usage:read` and
`data:backup`, and rejects unknown names. `data:backup` still needs the host API on p0code `main`
before a plugin using it can start.

## Security

- **Capabilities are enforced by the host, not by you.** Some are hard gates and some are only
  declarations (see the table). Plugins run inside the p0code server with your user's full rights,
  so people should install only plugins whose code they trust, and you should declare honestly.
- **`process:spawn` is a real process.** Anything you spawn can read and write what the server can.
  Never build command lines from untrusted input.
- **Routes are unauthenticated.** Anyone who can reach the server can call `httpRoutes` while the
  plugin is on. Authenticate the caller yourself and never return private data by default.
- **Never put secrets in the manifest** (or anywhere in the repo). The manifest is public and is
  copied into the shop. Store tokens with `PluginContext.storage`, which is namespaced to your
  plugin and kept in the server's secret store.
- **The enable dialog shows host-controlled text, not yours.** The capability wording people see
  before enabling comes from the host (p0code's own copy per capability, landing with the
  `plugin-api-hardening` work), never from your manifest, so you can't soften it. Your
  `Disclosure` component is extra context shown beside it, not a replacement.

## License

MIT. See [LICENSE](LICENSE). Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).
