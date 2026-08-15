# Format-on-Save Extension

Deterministic code formatting for the Pi coding agent, mirroring LazyVim's "format on save" behavior powered by [conform.nvim](https://github.com/stevearc/conform.nvim).

## What It Does

Every time the agent calls `write` or `edit` to modify a file, this extension:

1. Detects the file type from its extension
2. Routes it through the appropriate formatter
3. Writes back the formatted content automatically

The result is **deterministic formatting** — code is always formatted the same way, regardless of what the LLM outputs.

## Formatters (Matching LazyVim/Mason Defaults)

| Language | Formatters |
|----------|-----------|
| Python | `ruff format` |
| JavaScript / TypeScript / JSX / TSX | `prettier` |
| JSON / JSONC / JSON5 | `prettier` |
| Markdown / MDX | `prettier` |
| HTML / CSS / SCSS / SASS / LESS | `prettier` |
| YAML / TOML | `prettier` |
| Vue / Svelte | `prettier` |
| GraphQL | `prettier` |
| XML | `prettier` |

## Safe Defaults

- **Skips** `node_modules/`, `.git/`, `vendor/`, `.next/`, `dist/`, `build/`
- **Skips** binary files (images, archives, compiled binaries)
- **Skips** files larger than 1 MB
- **Non-fatal**: formatter errors are silently ignored — the agent never blocks

## Installation

Place the extension in one of these locations:

```
# Project-local
.pi/extensions/format-on-save.ts

# Global
~/.pi/agent/extensions/format-on-save.ts
```

Then reload pi with `/reload` or restart.

## How It Works

```
Agent calls write("src/app.py", content)
  │
  ▼
write tool executes → file written to disk
  │
  ▼
tool_execution_end fires
  │
  ▼
Extension reads file, detects ".py" → runs "ruff format"
  │
  ▼
Formatted content written back to disk
  │
  ▼
Agent continues — code is already formatted
```

## Comparison with LazyVim

| LazyVim | This Extension |
|---------|---------------|
| `conform.nvim` for formatting | Direct formatter execution |
| `nvim-lint` for linting | (formatting only, no linting) |
| `lsp_format = "fallback"` | Direct formatter calls |
| Format on save via autocmd | Format on `tool_execution_end` |
| Neovim plugin | Pi coding agent extension |

## Files

```
.pi/extensions/format-on-save.ts   # Extension entry point
```
