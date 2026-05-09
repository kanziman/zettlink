# Local Dashboard UI/UX Design

## Purpose

The local dashboard helps a single user rediscover captured cards and decide what to review, develop, and publish. It is not a full authoring environment. The first version focuses on reading, reviewing, artifact generation, and publish decisions.

## Scope

In scope:

- Kanban-style review board for captured cards.
- Card detail screen centered on the summary in `index.md`.
- Focused make room for generating `deep.md`, `til.md`, and `guide.md`.
- Read-only previews for generated artifacts.
- `reviewed` toggle for cards.
- Publish toggles for the card summary and generated artifacts.
- Filters for platform, tags, publish state, and artifact existence.
- Text search across title, summary, and tags.

Out of scope:

- Editing Markdown content in the dashboard.
- Full-text search across `transcript.md` or `extract.md`.
- Saved views or advanced search syntax.
- Batch artifact generation.
- Multi-user permissions or authentication.

## Information Architecture

The dashboard has three primary screens.

### Review Board

The Review Board is the default entry screen. It uses a Kanban layout with four columns:

- `Needs review`
- `Deep done`
- `TIL ready`
- `Published`

The board is organized by how far a card has developed, while the first column remains action-oriented. New automatic summaries appear in `Needs review` until the user explicitly marks them as reviewed.

Cards use an insight-first presentation. Each card shows platform, capture date, tags, title, the strongest insight, and a compact status indicator. The goal is fast rediscovery: the user should be able to tell why a card is worth reopening without reading the full summary.

The board header provides an `Active` / `All cards` scope control, filters, and search. `Active` shows cards that match a board column. `All cards` also includes reviewed cards that have no generated artifacts or published content. Search covers title, summary, and tags. Filters cover platform, tags, publish state, and artifact existence.

### Card Detail

Card Detail is centered on the card summary in `index.md`.

It shows:

- Title.
- One-line summary.
- Summary body.
- Insights.
- Tags.
- Platform metadata.
- Source link or embed.
- Collapsible `transcript.md` or `extract.md`.

This screen owns two actions:

- Marking the card as `reviewed`.
- Toggling publish state for the card summary in `index.md`.

Deep, TIL, and guide generation do not happen on this screen.

### Focused Make Room

Focused Make Room is a single-card artifact generation screen. It shows the selected card's title, platform, tags, and short summary, then provides three independent generation buttons:

- `Deep`
- `TIL`
- `Guide`

Each button generates the corresponding Markdown file if it does not exist:

- `deep.md`
- `til.md`
- `guide.md`

If the file already exists, the screen opens its read-only preview. The screen does not provide Markdown editing.

Artifact publish toggles live only in Focused Make Room. `deep.md`, `til.md`, and `guide.md` each keep their own `published` frontmatter value.

## State Model

The dashboard does not introduce a separate database. It derives card state from Markdown files and frontmatter in the vault.

Card-level state comes from `index.md`. Artifact state comes from files in the same card folder.

### Board Column Rules

Each active card appears in at most one board column. Column assignment uses this priority:

1. `Published`
2. `Needs review`
3. `TIL ready`
4. `Deep done`

Rules:

- `Published`: `index.md` has `published: true`, or any of `deep.md`, `til.md`, or `guide.md` has `published: true`.
- `Needs review`: `reviewed: false` or missing `reviewed` in `index.md`.
- `TIL ready`: `til.md` exists.
- `Deep done`: `deep.md` exists.

If a card is reviewed and has no generated artifact or published content, it is removed from the default board. It remains discoverable through search and filters when viewing all cards.

`guide.md` can be generated and published, but its existence does not move a card into `TIL ready`. The `TIL ready` column is based only on `til.md`.

`Reviewed` only means the card summary has been reviewed. It is independent from artifact existence and publish state.

## Core Flows

### Review A New Card

1. User opens Review Board.
2. New card appears in `Needs review`.
3. User opens Card Detail.
4. User reads the summary and insights.
5. User marks the card as reviewed.
6. Dashboard updates `index.md` frontmatter.
7. Board recalculates the card's column.

### Generate An Artifact

1. User opens Focused Make Room for a card.
2. User clicks `Deep`, `TIL`, or `Guide`.
3. Local API route calls the shared LLM wrapper.
4. The corresponding Markdown file is created.
5. The screen shows a read-only preview.
6. Board state is recalculated from file existence.

### Publish Summary

1. User opens Card Detail.
2. User toggles summary publish state.
3. Dashboard updates `published` in `index.md`.
4. Git commit and push run through the existing vault git helper.
5. The card appears in `Published`.

### Publish Artifact

1. User opens Focused Make Room.
2. User previews `deep.md`, `til.md`, or `guide.md`.
3. User toggles publish state for that artifact.
4. Dashboard updates the artifact frontmatter.
5. Git commit and push run through the existing vault git helper.
6. The card appears in `Published`.

## Error Handling

File and parsing errors are card-scoped. A malformed card should not break the whole board. The card receives an error badge and remains visible when enough metadata can be recovered.

LLM generation errors do not create partial artifact files. The make room shows the failure reason and a retry action.

Publish and reviewed toggle failures are not optimistic. The UI only changes after the file write and git operation succeed. If the operation fails, the dashboard keeps the previous state and shows the error.

## Testing

Test coverage should focus on the behavior that preserves the vault contract:

- Card folder scanning.
- Frontmatter parsing and writing.
- Board column priority calculation.
- Title, summary, and tag search.
- Platform, tag, publish, and artifact filters.
- `reviewed` toggle.
- Card summary publish toggle.
- Artifact publish toggles.
- Artifact generation success and failure paths.
- Rendering of Review Board, Card Detail, and Focused Make Room.

## Design Decisions

- The dashboard is read-only for Markdown body content in the first version.
- Summary publish belongs to Card Detail.
- Artifact publish belongs to Focused Make Room.
- TIL board progression is based only on `til.md`.
- `guide.md` is useful output, but it does not define the main board progression.
