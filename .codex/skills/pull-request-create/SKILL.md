---
name: pull-request-create
description: Creates a pull request from the current branch with a well-structured description following project conventions. Reads the PR description template for formatting guidance. Use when you're ready to open a PR for your current work.
allowed-tools: Bash, Read, Glob, Grep
---

# Pull Request Create

Create a pull request from the current branch, targeting `$ARGUMENTS` as the base branch. If no base branch was provided, default to `staging`.

## Step 1: Gather Context

1. Run `git status` to confirm the working tree is clean. If there are uncommitted changes, warn the user and ask whether to proceed or commit first.
2. Run `git log --oneline $(git merge-base HEAD origin/<base-branch>)..HEAD` to collect all commits on this branch.
3. Run `git diff origin/<base-branch>...HEAD --stat` to get a summary of changed files.
4. Run `git diff origin/<base-branch>...HEAD` to read the full diff.
5. Parse the current branch name to extract the type prefix (e.g., `feature/`, `bugfix/`, `hotfix/`) and ticket identifier if present.

## Step 2: Read the PR Description Template

Read the template at `docs/references/pull-request-description-template.md` for formatting guidance and best practices. Use its structure as the basis for the PR body.

## Step 3: Analyze the Changes

Review the diff and commit history to understand:

- **What** changed — summarize the concrete modifications
- **Why** it changed — infer the motivation from commit messages, ticket references, and code context
- **How** it changed — note the approach taken (new files, refactors, config changes, etc.)
- **What to watch** — identify areas reviewers should pay close attention to

If the changes touch tests, note what's covered. If they don't and probably should, flag it.

## Step 4: Draft the PR

Compose the PR following project conventions from `.github/CONTRIBUTING.md`:

### Title

Format: `[<ticket-id>][<Type>] <short description>`

- Extract the ticket ID from the branch name or commit messages (e.g., `RH-444`).
- Map the branch prefix to a type: `feature` → `Feature`, `bugfix` → `Bugfix`, `hotfix` → `Hotfix`, `refactor` → `Refactor`, `docs` → `Docs`, `style` → `Style`, `test` → `Test`, `perform` → `Performance`.
- If no ticket ID is found, ask the user or omit the bracket.

### Body

Follow the structure from the PR description template. Keep it concise but complete — a reviewer should understand the PR without reading every line of code.

## Step 5: Confirm with the User

Present the full draft (title + body) to the user before creating anything. Ask them to confirm, edit, or adjust.

## Step 6: Push and Create the PR

1. Ensure the branch is pushed to the remote: `git push -u origin <current-branch>`.
2. Create the PR using:
   ```
   gh pr create --base <base-branch> --title "<title>" --body "<body>"
   ```
3. Report back the PR URL.

## Step 7: Post-Creation

After the PR is created, ask the user if they'd like to:

1. **Request reviewers** — use `gh pr edit <number> --add-reviewer <handle>`.
2. **Add labels** — use `gh pr edit <number> --add-label <label>`.
3. **Link to a Linear issue** — add a comment with the issue link.
4. **Done** — no further action.

## Guidelines

- Always present the draft for user approval before creating the PR.
- Keep descriptions scannable — use bullet points and short paragraphs over walls of text.
- If the diff is large (20+ files), organize the summary by area of the codebase rather than listing every file.
- Never include secrets, tokens, or sensitive data in the PR description.
- When in doubt about the motivation behind changes, ask the user rather than guessing.
