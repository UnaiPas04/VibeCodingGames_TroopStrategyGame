# General Instructions

## Language rules

- All code, documentation and any other text, including file and folder names, is written in neutral English.
- The language of your chat replies follows the language the user writes in. If the user asks in Spanish, reply in Spanish.

## Skills

- Install skills at project level, into `.claude/skills/`, so they travel with the repository: `npx skills add <owner/repo> --skill <name> -a claude-code`. Do not use the global flag `-g` unless the user asks for it.
- Read a third-party skill's `SKILL.md` (and any scripts it ships) before installing it.

## Reply greeting

- Every reply starts with a greeting that states the model writing it and its effort mode, for example: "Hi, Opus 5.5 here on low!".
- The greeting follows the language rule: it is written in the language the user writes in.

## Programming practices

- **Encapsulate every responsibility, never duplicate it.** Each responsibility (a feature, an external API or library, a data format, a piece of business logic) lives in exactly one module, behind a small public API. The rest of the code uses that API: it never re-implements the logic nor reaches into the module's internals. For example, only one module talks to a given library or browser API, and everything else goes through it.
  - Before writing new logic, look for the module that already owns that responsibility and extend it.
  - When the same logic or the same value would appear in two places, extract it once (a function, a module or a configuration entry) and reuse it. Do not copy and paste.
  - Expose behavior, not internal state: keep a module's data private unless callers really need it.
- **Separate pure logic from input/output.** Rules, calculations and state changes are plain functions that do not touch the UI, the network, storage or timers, so they can be tested directly. Thin outer layers read inputs, call that logic and show or send the results.
- **Test every logic change.** New or changed logic comes with unit tests, and every bug fix comes with a test that reproduces the bug first. Run the test suite before considering a change done.
- **One place for configuration.** Tunable values, limits, identifiers and constants live in the project's configuration file or module, with a short comment on what each one does. No magic numbers or repeated literals scattered through the code.
- **Dependencies point one way.** No circular imports: higher layers (screens, features) depend on lower ones (logic, helpers), never the other way round. Optional features live in their own folder and are wired in from a few clearly marked places, so a project can remove them by deleting the folder and those lines.
- **Fail visibly.** Validate inputs at module boundaries and throw or report clear errors. Never swallow errors with an empty `catch`; when ignoring an error is intended (for example, unavailable storage), say why in a comment.

## Setup instructions

- The `setup/` folder holds the instructions to install and run the project on each operating system, both from the console (list of commands) and with alternative methods.
- Its files follow the format defined in `.claude/setup-format.md`.
- Keep `setup/` up to date whenever dependencies, requirements or run commands change.
