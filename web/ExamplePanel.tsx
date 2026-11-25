// Copy into apps/web/src/components/settings/ in your p0code checkout and add it to PLUGIN_PANELS
// in PluginsSettings.tsx (see the README). The imports below resolve from that folder.
import type { EnvironmentId } from "@t3tools/contracts";
import {
  EXAMPLE_PLUGIN_ID,
  type ExampleAction,
  GreetOutput,
  NoteOutput,
} from "@p0code/plugin-template/actions";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { useEffect, useState } from "react";

import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const decodeGreet = Schema.decodeUnknownOption(GreetOutput);
const decodeNote = Schema.decodeUnknownOption(NoteOutput);

/** Shown before the plugin is turned on, beside the host's own capability list. */
export function ExampleDisclosure() {
  return (
    <p className="text-muted-foreground">
      <T>Keeps one note on this server and adds it to every agent turn while enabled.</T>
    </p>
  );
}

/** Rendered only while the plugin runs. Every call goes through the host's plugin invoke RPC. */
export function ExamplePanel({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const gt = useGT();
  const invoke = useAtomCommand(serverEnvironment.pluginsInvoke);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const call = async (action: ExampleAction, input: unknown) => {
    const result = await invoke({
      environmentId,
      input: { pluginId: EXAMPLE_PLUGIN_ID, action, input },
    });
    return result._tag === "Success" ? Option.some(result.value) : Option.none();
  };
  const saveNote = async (text: string) => {
    const decoded = Option.flatMap(await call("note", { text }), decodeNote);
    if (Option.isSome(decoded)) setNote(decoded.value.text ?? "");
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the note lives in the plugin, so the panel reads it once when it mounts.
  useEffect(() => {
    void invoke({
      environmentId,
      input: { pluginId: EXAMPLE_PLUGIN_ID, action: "note", input: {} },
    }).then((result) => {
      if (result._tag !== "Success") return;
      const decoded = decodeNote(result.value);
      if (Option.isSome(decoded)) setNote(decoded.value.text ?? "");
    });
  }, [environmentId, invoke]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            const decoded = Option.flatMap(await call("greet", { name: "p0code" }), decodeGreet);
            setGreeting(Option.isSome(decoded) ? decoded.value.message : null);
          }}
        >
          <T>Say hello</T>
        </Button>
        {greeting ? <span className="text-muted-foreground">{greeting}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={gt("Note for agents")}
          placeholder={gt("A note every agent turn will see")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button variant="outline" onClick={() => void saveNote(note)}>
          <T>Save note</T>
        </Button>
      </div>
    </div>
  );
}
