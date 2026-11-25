# Contributing

This repo is the starting point people copy to build a [p0code](https://github.com/p0code/p0code)
plugin. Fixes here should keep the example small and true to the current plugin API; your own
plugin belongs in your own repo (see the README).

Contributions are welcome: bug reports, unclear docs, and small focused PRs. I'm one busy person, so
reviews and replies can take a while — please be patient, and don't ping repeatedly. One polite bump
after a couple of weeks is fine.

## Setup

You need Node and pnpm at the versions in p0code's `package.json`, plus git. Then:

```sh
scripts/verify.sh   # clones p0code@main, mounts this repo, installs, typechecks and tests
```

`KEEP=1` keeps the temporary clone so you can poke at it; `SKIP_WEB=1` skips the web typecheck.
CI runs the same script on every PR and once a week against p0code `main`.

## What makes a PR easy to land

- One thing per PR.
- Keep the example minimal. A new pattern is worth adding only if most plugins will need it.
- If the plugin API changed upstream, update the code, the tests and the README together.
- Conventional-commit-ish messages (`fix: ...`, `feat: ...`, `docs: ...`).
- No drive-by refactors or reformatting.

## License

MIT. By contributing you agree that your work is released under the MIT license. See
[LICENSE](LICENSE).
