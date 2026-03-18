# Architectural Decision Records

An ADR captures a significant architectural decision: the context that prompted
it, what was chosen, and what the consequences are. The goal is not process — it
is institutional memory. Future contributors (including your future self) should
be able to read an ADR and understand *why* the codebase looks the way it does,
not just *what* it does.

## When to write an ADR

Write one when:
- You choose between two or more reasonable approaches
- The choice has non-obvious trade-offs
- The choice would be confusing or surprising without context
- You are knowingly accepting a limitation now with a plan to revisit later

You do not need an ADR for decisions that are obvious, reversible with low cost,
or entirely contained within a single file.

## Format

```markdown
# ADR-NNN: Title

**Status:** Accepted | Superseded by ADR-NNN | Deprecated

## Context
What problem were we solving? What constraints existed?

## Decision
What did we choose and why?

## Consequences
What is easier now? What is harder? What must be kept in mind going forward?
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-ioredis-over-cache-manager.md) | ioredis directly over cache-manager | Accepted |
| [002](002-refresh-token-storage.md) | Refresh token storage strategy | Accepted |
