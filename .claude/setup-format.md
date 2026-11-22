# Setup Instructions Format

Format for the files inside `setup/`. They explain how to install and run the project on each operating system.

## Files

- `setup/README.md`: index with a short quick start and links to every file below.
- `setup/windows.md`, `setup/macos.md`, `setup/linux.md`: one file per operating system.
- Optional: `setup/docker.md` (Docker / Docker Compose) and `setup/devcontainer.md` (Dev Containers / GitHub Codespaces).

## Sections of each operating system file

1. **Prerequisites**: required tools, minimum versions and install links.
2. **Console setup**: numbered list of commands, each in a code block, covering:
   1. Clone the repository.
   2. Install dependencies.
   3. Configure environment variables (for example, copy `.env.example` to `.env`).
   4. Run the project.
   5. Run the tests.

   Windows uses PowerShell (and Git Bash when relevant); macOS and Linux use bash/zsh.
3. **Alternative methods**: any that apply, such as:
   - Package managers: winget or Chocolatey (Windows), Homebrew (macOS), apt or dnf (Linux).
   - IDE: VS Code tasks, launch configurations or the Run button.
   - Docker / Docker Compose.
   - Dev Containers / GitHub Codespaces.
   - Provided scripts: `setup.ps1`, `setup.sh`, `Makefile`.
4. **Verification**: how to confirm the project works (URL to open, expected output).
5. **Troubleshooting**: common errors and their fixes.
