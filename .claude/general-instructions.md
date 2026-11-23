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

## Setup instructions

- The `setup/` folder holds the instructions to install and run the project on each operating system, both from the console (list of commands) and with alternative methods.
- Its files follow the format defined in `.claude/setup-format.md`.
- Keep `setup/` up to date whenever dependencies, requirements or run commands change.
