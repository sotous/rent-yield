# Repository organization

Status: completed. User-requested removal of duplicate `.agents/` directory completed.

## Purpose

Make current specifications, implementation plans, decisions, research, and historical reviews easier to find without changing executable behavior.

This worktree starts from local main at commit 0104cb6. Branch: codex/repository-organization.

The initial inventory below was collected on codex/rent-model-deterministic-spec before switching the worktree to main; revalidate candidate paths against main before implementation.

## Observations

- apps/ already separates the frontend, backend, crawlers, and rent-model workbench.
- packages/ holds the shared listing-storage contracts.
- specs/ is small enough to remain flat.
- plan/ mixes implementation plans, a technology decision, and retrospectives.
- docs/reviews/ contains other implementation assessments, splitting related material across locations.
- README.md and other documentation use absolute checkout paths, which do not travel with a worktree or repository clone.
- Removed duplicate .agents/skills/ files after confirming they matched .codex/skills/ exactly. Maintain skills under .codex/skills/.

## Recommended structure

```text
rent-yield/
├── README.md                 # Short entry point and development commands
├── AGENTS.md                 # Canonical agent instructions
├── CLAUDE.md                 # Compatibility pointer
├── apps/                     # Existing runnable applications/workbenches
│   ├── frontend/
│   ├── backend/
│   ├── crawlers/
│   └── rent-model/
├── packages/                 # Existing shared libraries/contracts
│   └── listing-storage-contracts/
├── specs/                    # Current authoritative behavior and scope
├── plan/                     # Plans, with status metadata and an index
│   ├── README.md
│   └── archive/              # Only plans verified as completed/superseded
├── docs/
│   ├── README.md             # Documentation map
│   ├── architecture/         # Current system design
│   ├── api/                  # API reference and consumer contracts
│   ├── decisions/            # Durable choices and their rationale
│   ├── research/             # Exploratory findings and market research
│   └── reviews/              # Reviews and retrospectives
├── .codex/                   # Canonical maintained agent configuration
│   ├── skills/               # Portable reusable workflows
│   └── agents/               # Specialist roles and adapters
└── .claude/                  # Directory symlinks only
    ├── agents -> ../.codex/agents
    └── skills -> ../.codex/skills
```

## Placement rules

- specs/ explains what the product must do.
- plan/ explains how a scoped change will be delivered. Record draft, approved, in-progress, completed, or superseded status inside each plan; do not infer completion from age.
- docs/architecture/ explains the current implementation.
- docs/decisions/ records why a durable choice was made.
- docs/research/ contains findings that may inform decisions but are not themselves specifications.
- docs/reviews/ records implementation assessments and retrospectives, linking back to their plans.
- Application README files retain local setup and usage instructions.
- Use repository-relative Markdown links so documentation works across clones and worktrees.
- Keep the existing code directories and test placement during this organizational pass.

## Agreed agent configuration direction

- Maintain shared skills in .codex/skills/ and specialist definitions in .codex/agents/. Do not recreate .agents/ or a discovery symlink there. Tool-agnostic content does not require a neutral parent directory name.
- Keep skill frontmatter portable, using shared fields such as name and description. Keep provider-specific metadata separate from shared frontmatter and instructions.
- Maintain .claude/agents -> ../.codex/agents and .claude/skills -> ../.codex/skills as relative directory symlinks. Both already exist and resolve correctly in this worktree. Maintain all underlying files in .codex/; no separate Claude copies or selective file links. Tool-specific definition formats can coexist in the canonical directory.
- Treat Claude compatibility as a required outcome: each `SKILL.md` must use portable Markdown and frontmatter, and each Markdown file in `.codex/agents/` must be usable through `.claude/agents/`. Codex-only TOML agent definitions may remain alongside the portable Markdown definitions.
- Keep AGENTS.md as the canonical repository policy and CLAUDE.md as its compatibility pointer.
- Do not maintain duplicate copies of shared instructions. Verify how each tool consumes shared role instructions before selecting an adapter mechanism.
- Validate skill discovery and role loading for each supported tool; portability of content does not guarantee universal automatic discovery.

## Completed classification moves

- `docs/decisions/prototype-v1-frontend-tech-stack-decision.md` contains the frontend technology decision.
- `docs/research/business-model-market-validation.md` contains the market-validation memo.
- `docs/reviews/` contains the completed crawler and rent-model retrospectives.
- Completed plans remain in `plan/` unless their status is verified as completed or superseded before archival.

## Main merge adaptation

The merged crawler fixture-redaction work added a fixture-redaction
retrospective, a crawler project status review, and a completed remediation
plan. The retrospective and review were classified under `docs/reviews/`.
The remediation plan was marked completed and moved to `plan/archive/` because
the merged implementation and retrospective verify its delivery. The current
canary plan remains in `plan/` because it describes future work.

## Delivery approach

1. Consolidate agent configuration around `.codex/` and validate the existing Claude symlinks and portable Markdown definitions.
2. Reclassify the identified decision, research, and retrospective documents under the agreed documentation taxonomy.
3. Add documentation and planning indexes, mark plan statuses, and repair repository-relative links.
4. Validate the final tree, links, formatting, and compatibility assumptions; record the retrospective.

## Risks and validation

Search tracked files for references to every moved path, including skills and agent configuration. Preserve all document content and avoid changing the authority of specifications. Check relative link targets from each referring file. Confirm `.claude/agents` and `.claude/skills` resolve to `.codex`, inspect shared frontmatter for Claude-compatible fields, and verify that no agent instructions rely on Codex-only behavior without a portable equivalent. Inspect the final diff for accidental source/configuration changes and run documentation formatting checks. Documentation-only moves need no new executable tests; any later behavioral or architectural scope requires a separate TDD plan.

## Open decisions

- Whether to prefer this document-type organization or a feature-oriented documentation layout.
- Which plans are actually completed or superseded.
- Exact discovery links and role adapters needed by each tool, following the agreed shared-source direction.

## Retrospective

The delivered structure matches the approved plan: `.codex/` is the maintained agent-configuration source, `.claude/agents` and `.claude/skills` remain relative directory symlinks, and the duplicate `.agents/` tree was removed. The decision, research memo, and four retrospectives now live in their document-type directories; `docs/README.md` and `plan/README.md` provide stable entry points.

The implementation stayed within organizational scope. Markdown agent definitions use portable `name` and `description` frontmatter, while Codex-only TOML definitions remain alongside them. The worktree validated that both Claude symlinks resolve, all 47 tracked Markdown files have resolvable local link targets, no checkout-specific paths remain in tracked Markdown or TOML, and both staged and unstaged diffs pass `git diff --check`.

After merging `origin/main` at `654f2d1`, the fixture-redaction retrospective
and crawler project status review were placed under `docs/reviews/`. The
fixture-remediation plan was archived only after the merged implementation and
its retrospective established completion. A future fresh Claude session should
confirm its runtime discovery behavior; the repository-level compatibility
evidence validates paths and portable content but cannot prove an external
tool's session behavior.
