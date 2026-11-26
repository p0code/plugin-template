import { definePlugin, PluginContext, type PluginInstance } from "@t3tools/plugin-api";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  EXAMPLE_PING_ROUTE,
  EXAMPLE_PLUGIN_ID,
  exampleActions,
  greet,
  type NoteInput,
} from "./actions.ts";

const NOTE_KEY = "note";

/**
 * Runs when someone turns the plugin on, inside a scope the host closes when they turn it off.
 * Exported on its own so tests can run it with only a fake `PluginContext`.
 */
export const startExample = Effect.gen(function* () {
  const context = yield* PluginContext;
  const readNote = context.storage.get(NOTE_KEY).pipe(Effect.map(Option.getOrNull));

  yield* context.reportStatus("Ready.");
  yield* Effect.addFinalizer(() => Effect.logInfo("Example plugin stopped"));

  return {
    actions: {
      greet: (input) => Effect.succeed(greet(input)),
      // Uses the host's per-plugin secret store, which needs no capability.
      note: Effect.fn("ExamplePlugin.note")(function* (input: NoteInput) {
        if (input.text === undefined) return { text: yield* readNote };
        if (input.text === "") {
          yield* context.storage.remove(NOTE_KEY);
          yield* context.reportStatus("Ready.");
          return { text: null };
        }
        yield* context.storage.set(NOTE_KEY, input.text);
        yield* context.reportStatus("Note saved.");
        return { text: input.text };
      }),
    },
    // Needs "http:routes" and the path in `httpRoutes`. Anyone who can reach the server can call
    // it without signing in, so never return private data from a route.
    routes: {
      [EXAMPLE_PING_ROUTE]: () =>
        Effect.succeed({ status: 200, body: { ok: true, plugin: EXAMPLE_PLUGIN_ID } }),
    },
    // Needs "agent:instructions". Appended to every agent turn while enabled; null adds nothing.
    agentInstructions: readNote.pipe(
      Effect.map((note) =>
        note === null ? null : `A note from the user's example plugin: ${note}`,
      ),
      Effect.orElseSucceed(() => null),
    ),
  } satisfies PluginInstance<typeof exampleActions>;
});

// Keep the manifest a literal object here: the plugin shop reads id, version, capabilities and
// externalServices from this file without running it.
export const examplePlugin = definePlugin({
  manifest: {
    id: EXAMPLE_PLUGIN_ID,
    name: "Example",
    description:
      "A starting point for p0code plugins: greets you, keeps one note, answers a ping route and tells agents about the note.",
    version: "0.1.0",
    unofficial: false,
    externalServices: [],
    capabilities: ["http:routes", "agent:instructions"],
    httpRoutes: [EXAMPLE_PING_ROUTE],
  },
  actions: exampleActions,
  start: startExample,
});

// The installed-bundle loader imports a shop bundle's `plugin.mjs` and reads `default`, so a
// plugin that is not exported as the default cannot be installed from the shop.
export default examplePlugin;
