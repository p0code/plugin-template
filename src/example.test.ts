import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { PluginManifest } from "@t3tools/contracts";
import { PluginContext } from "@t3tools/plugin-api";
import * as PtyAdapter from "@t3tools/shared/PtyAdapter";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  EXAMPLE_PING_ROUTE,
  EXAMPLE_PLUGIN_ID,
  exampleActions,
  greet,
  NoteOutput,
} from "./actions.ts";
import { examplePlugin, startExample } from "./index.ts";

const decodeManifest = Schema.decodeExit(PluginManifest);
const decodeNoteOutput = Schema.decodeUnknownEffect(NoteOutput);

/** A host stand-in: in-memory storage, a status log, and refusals for undeclared services. */
function fakeContext() {
  const stored = new Map<string, string>();
  const statuses: Array<string | null> = [];
  const refused = Effect.die("not declared");
  const context = PluginContext.of({
    pluginId: EXAMPLE_PLUGIN_ID,
    dataDir: "/tmp/example-plugin-test",
    storage: {
      get: (key) => Effect.sync(() => Option.fromNullishOr(stored.get(key))),
      set: (key, value) => Effect.sync(() => void stored.set(key, value)),
      remove: (key) => Effect.sync(() => void stored.delete(key)),
    },
    reportStatus: (message) => Effect.sync(() => void statuses.push(message)),
    environment: {
      environmentId: refused,
      descriptor: refused,
      localOrigin: refused,
    },
    deviceAccess: { issueCredential: () => refused, revokeAll: refused },
    agentActivity: { changes: Stream.empty, read: () => refused, activeThreadIds: refused },
    usage: { dailyTotals: () => refused },
  });
  return { context, stored, statuses };
}

// What the host provides besides PluginContext. The example uses none of it.
const layerPlatform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  FetchHttpClient.layer,
  Layer.succeed(
    PtyAdapter.PtyAdapter,
    PtyAdapter.PtyAdapter.of({ spawn: () => Effect.die("unused") }),
  ),
);

describe("manifest", () => {
  const manifest = examplePlugin.manifest;

  it("decodes as a PluginManifest", () => {
    assert.isTrue(Exit.isSuccess(decodeManifest(manifest)));
  });

  it("declares exactly what the plugin uses", () => {
    assert.deepStrictEqual([...manifest.capabilities].sort(), [
      "agent:instructions",
      "http:routes",
    ]);
    assert.deepStrictEqual(manifest.httpRoutes, [EXAMPLE_PING_ROUTE]);
    assert.deepStrictEqual(manifest.externalServices, []);
  });
});

describe("actions", () => {
  it("greet is pure", () => {
    assert.deepStrictEqual(greet({ name: " Ada " }), { message: "Hello, Ada!" });
    assert.deepStrictEqual(greet({ name: "" }), { message: "Hello, there!" });
  });

  it("note input is checked by its codec", () => {
    const decode = Schema.decodeUnknownExit(exampleActions.note.input);
    assert.isTrue(Exit.isSuccess(decode({})));
    assert.isTrue(Exit.isFailure(decode({ text: 42 })));
    assert.isTrue(Exit.isFailure(decode({ text: "x".repeat(2001) })));
  });

  it.effect("note saves, reads and clears through plugin storage", () =>
    Effect.gen(function* () {
      const { context, stored, statuses } = fakeContext();
      const instance = yield* startExample.pipe(Effect.provideService(PluginContext, context));

      assert.deepStrictEqual(yield* instance.actions.note({}), { text: null });
      assert.deepStrictEqual(yield* instance.actions.note({ text: "ship it" }), {
        text: "ship it",
      });
      assert.strictEqual(stored.get("note"), "ship it");
      assert.strictEqual(
        yield* instance.agentInstructions,
        "A note from the user's example plugin: ship it",
      );
      assert.deepStrictEqual(yield* instance.actions.note({ text: "" }), { text: null });
      assert.strictEqual(yield* instance.agentInstructions, null);
      assert.deepStrictEqual(statuses, ["Ready.", "Note saved.", "Ready."]);
    }).pipe(Effect.scoped),
  );
});

describe("definePlugin wiring", () => {
  it.effect("starts like the host starts it and decodes at the wire", () =>
    Effect.gen(function* () {
      const { context } = fakeContext();
      const started = yield* examplePlugin.start.pipe(
        Effect.provideService(PluginContext, context),
      );

      assert.deepStrictEqual(yield* started.invoke("greet", { name: "Ada" }), {
        message: "Hello, Ada!",
      });
      const saved = yield* started.invoke("note", { text: "hi" });
      assert.deepStrictEqual(yield* decodeNoteOutput(saved), { text: "hi" });

      const badInput = yield* Effect.exit(started.invoke("greet", { name: 1 }));
      assert.isTrue(Exit.isFailure(badInput));
      const unknown = yield* Effect.exit(started.invoke("nope", {}));
      assert.isTrue(Exit.isFailure(unknown));

      const ping = started.routes.get(EXAMPLE_PING_ROUTE);
      assert.isDefined(ping);
      if (ping !== undefined) {
        assert.deepStrictEqual(yield* ping(null), {
          status: 200,
          body: { ok: true, plugin: EXAMPLE_PLUGIN_ID },
        });
      }
    }).pipe(Effect.scoped, Effect.provide(layerPlatform)),
  );
});
