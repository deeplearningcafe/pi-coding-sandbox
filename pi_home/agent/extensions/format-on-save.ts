/**
 * Format-on-Save Extension for Pi Coding Agent
 *
 * Automatically formats code after every `write` and `edit` tool call,
 * mirroring LazyVim's "format on save" behavior powered by conform.nvim.
 *
 * Intercepted tools: `write`, `edit`
 * After each tool completes, the target file is routed through the
 * appropriate formatter based on file extension.
 *
 * Formatters (matching LazyVim/Mason defaults):
 *   Python      → ruff format
 *   JS/TS/JSON  → prettier
 *   Markdown    → prettier
 *   HTML/CSS    → prettier
 *   YAML/TOML   → prettier
 *   Vue/Svelte  → prettier
 *   GraphQL     → prettier
 *
 * Safe defaults:
 *   - Skips node_modules/, .git/, vendor/, .next/, dist/, build/
 *   - Skips binary files
 *   - Skips files > 1 MB
 *   - Non-fatal: formatter errors are logged but never block the agent
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { extname, resolve } from "node:path";

// ── Formatter registry ──────────────────────────────────────────────────────
// Maps file extensions → formatter config.

const EXTENSION_FORMATTERS: Record<
	string,
	{
		/** Primary formatter command */
		cmd: string;
		/** Args to pass (use "{file}" as placeholder for the file path) */
		args: string[];
		/** Whether the formatter reads from stdin */
		stdin: boolean;
	}
> = {
	// Python — ruff format (in-place)
	".py": { cmd: "ruff", args: ["format"], stdin: false },
	".pyi": { cmd: "ruff", args: ["format"], stdin: false },
	".pyw": { cmd: "ruff", args: ["format"], stdin: false },

	// Fallback formatters (prettier) for all other supported types
	".jsx": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".tsx": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".json": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".jsonc": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".json5": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".md": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".mdx": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".html": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".htm": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".css": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".scss": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".sass": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".less": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".yaml": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".yml": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".toml": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".vue": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".svelte": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".graphql": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".gql": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
	".xml": { cmd: "prettier", args: ["--write", "--stdin-filepath", "{file}"], stdin: true },
};

// ── Skip patterns ───────────────────────────────────────────────────────────

const SKIP_PATH_PATTERNS = [
	/\/node_modules\//,
	/\/\.git\//,
	/\/vendor\//,
	/\/\.next\//,
	/\/\.nuxt\//,
	/\/dist\//,
	/\/build\//,
];

const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".ico",
	".bmp",
	".tiff",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".otf",
	".mp3",
	".mp4",
	".avi",
	".mov",
	".zip",
	".tar",
	".gz",
	".rar",
	".7z",
	".pdf",
	".exe",
	".dll",
	".so",
	".dylib",
	".o",
	".pyc",
	".pyo",
	".class",
	".war",
	".ear",
	".jar",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 1_048_576; // 1 MB

function shouldSkipPath(absolutePath: string): boolean {
	return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(absolutePath));
}

function isBinaryFile(absolutePath: string): boolean {
	const ext = extname(absolutePath).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

function getFormatter(absolutePath: string): (typeof EXTENSION_FORMATTERS)[string] | null {
	const ext = extname(absolutePath).toLowerCase();
	return EXTENSION_FORMATTERS[ext] ?? null;
}

/**
 * Run a command with stdin input using spawn (reliable for all formatters).
 */
function runCommand(cmd: string, args: string[], input: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		child.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		child.on("close", (code: number | null) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				reject({ stdout, stderr, code });
			}
		});

		child.on("error", reject);

		// Write input to stdin
		child.stdin.write(input);
		child.stdin.end();

		// Safety timeout
		setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error("Formatter timed out"));
		}, 10_000);
	});
}

/**
 * Run a stdin-based formatter (prettier, eslint).
 * Pipes file content via stdin, returns formatted stdout.
 */
async function runStdinFormatter(
	cmd: string,
	args: string[],
	content: string,
	filePath: string,
	cwd: string,
): Promise<string | null> {
	try {
		const normalizedArgs = args.map((a) => (a === "{file}" ? filePath : a));
		const { stdout } = await runCommand(cmd, normalizedArgs, content, cwd);
		return stdout;
	} catch {
		return null;
	}
}

/**
 * Run an in-place formatter (ruff format).
 * Formats the file directly on disk.
 */
async function runInPlaceFormatter(cmd: string, args: string[], filePath: string, cwd: string): Promise<boolean> {
	try {
		await runCommand(cmd, args, "", cwd);
		return true;
	} catch {
		return false;
	}
}

/**
 * Format a file and write back the formatted content if it changed.
 * Non-fatal: errors are silently ignored.
 */
async function formatFile(absolutePath: string, cwd: string): Promise<void> {
	// Skip forbidden paths
	if (shouldSkipPath(absolutePath)) return;

	// Skip binary files
	if (isBinaryFile(absolutePath)) return;

	// Read file content
	let content: string;
	try {
		await access(absolutePath, constants.R_OK);
		content = await readFile(absolutePath, "utf-8");
	} catch {
		return; // Unreadable or non-existent
	}

	// Skip oversized files
	if (content.length > MAX_FILE_SIZE) return;

	// Detect formatter
	const formatter = getFormatter(absolutePath);
	if (!formatter) return; // No formatter registered

	// Execute formatter
	if (formatter.stdin) {
		// Stdin-based: pipe content, compare, write back if changed
		const formatted = await runStdinFormatter(formatter.cmd, formatter.args, content, absolutePath, cwd);
		if (formatted !== null && formatted !== content) {
			await writeFile(absolutePath, formatted, "utf-8");
		}
	} else {
		// In-place: format the file directly
		await runInPlaceFormatter(formatter.cmd, formatter.args, absolutePath, cwd);
	}
}

// ── Extension entry point ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// Format the file AFTER each write/edit tool completes
	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") return;
		if (event.isError) return; // Don't format if the tool call itself failed

		// Extract target file path from the tool input
		let targetPath: string | undefined;
		if (event.input && typeof event.input === "object" && "path" in event.input) {
			targetPath = event.input.path as string | undefined;
		}

		if (!targetPath) return;

		const absolutePath = resolve(ctx.cwd, targetPath);
		await formatFile(absolutePath, ctx.cwd);
	});

	// Notify user on session start
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("Format-on-save: ruff + prettier enabled", "info");
	});
}

