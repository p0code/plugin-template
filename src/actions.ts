import * as Schema from "effect/Schema";

// Rename these when you copy the template. The id is what people see in settings and what the
// plugin shop lists; it must match /^[a-z0-9][a-z0-9-]{0,62}$/.
export const EXAMPLE_PLUGIN_ID = "example";
/** Must also appear in the manifest's `httpRoutes`; `definePlugin` refuses undeclared routes. */
export const EXAMPLE_PING_ROUTE = "/api/plugins/example/ping";

export const GreetInput = Schema.Struct({ name: Schema.String });
export const GreetOutput = Schema.Struct({ message: Schema.String });
export type GreetInput = typeof GreetInput.Type;
export type GreetOutput = typeof GreetOutput.Type;

/** Omit `text` to read the note, pass "" to clear it, anything else saves it. */
export const NoteInput = Schema.Struct({
  text: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(2000))),
});
export const NoteOutput = Schema.Struct({ text: Schema.NullOr(Schema.String) });
export type NoteInput = typeof NoteInput.Type;
export type NoteOutput = typeof NoteOutput.Type;

/**
 * The calls a settings panel can make through the host's plugin invoke RPC. `definePlugin`
 * decodes each input and encodes each output with these codecs, so handlers get typed values.
 */
export const exampleActions = {
  greet: { input: GreetInput, output: GreetOutput },
  note: { input: NoteInput, output: NoteOutput },
};
export type ExampleAction = keyof typeof exampleActions;

/** A pure action: no host services, easy to test. */
export function greet(input: GreetInput): GreetOutput {
  const name = input.name.trim();
  return { message: `Hello, ${name.length > 0 ? name : "there"}!` };
}
