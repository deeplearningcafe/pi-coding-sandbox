# AGENTS.md — Global AI Coding Guidelines

This document defines global instructions, code quality standards, and
interaction protocols for AI coding agents.

## 1. Implementation Philosophy
- **Pragmatism Over Abstraction**: Implement simple, readable, and direct
  solutions first. Avoid speculative engineering, unnecessary utility classes,
  or excessive layering.
- **Solid Design**: Apply SOLID principles and design patterns only when they
  reduce duplicate logic or solve a clear architectural problem.
- **Sparse Commenting**: Code must be self-documenting. Use inline comments
  sparingly to explain complex "why" decisions, not "how" the code works.

## 2. Formatting & Style Standards
- **Four-Space Indentation**: Use exactly four spaces for indentation.
- **Column Limit (soft)**: No line of code must exceed 80 columns. Wrap long function
  signatures, lists, and boolean chains cleanly. Linters will be used to correct the formatting.
- **Modern Python Idioms**: Follow PEP 8 guidelines. Use type hints where they
  clarify complex interfaces, but do not clutter simple utilities with them.

## 3. Workflow Protocol
- **Plan First**: Before writing code, analyze existing files to understand
  data flow and potential side effects. State your proposed steps clearly
  before execution.
- **Incremental Changes**: Do not rewrite unchanged files. Only output or edit
  the modified regions/files.
- **Dependency Preservation**: Match existing package managers and build tools
  without upgrading dependencies unless requested.
- **Library Installation**: Ask the user to install the necessary libraries
and packages if needed. Do not try complex approaches to skip the libraries
usage, just ask the user and wait until confirmation.

## 4. Response & Output Format
- **Professional Directness**: Omit conversational fluff, polite greetings, or
  robotic disclaimers. Provide direct answers.
- **Critical Judgment**: Challenge user assumptions critically if they violate
  best practices, security, or codebase consistency. Propose correct
  alternatives with logical reasoning.
- **Concise Justification**: Accompany every modification with a brief,
  factual explanation of the change and its implications.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
