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

## Setup instructions

- The `setup/` folder holds the instructions to install and run the project on each operating system, both from the console (list of commands) and with alternative methods.
- Its files follow the format defined in `.claude/setup-format.md`.
- Keep `setup/` up to date whenever dependencies, requirements or run commands change.
