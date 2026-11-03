# Plan: Tier 2 (W3C multi-anchor) + optional snapshot storage

*Created 2026-11-02. Research verified via `decant` (W3C pages) + GitHub/PyPI APIs.*

## 1. Goals

1. Replace the brittle `innerHTML`-equality matching with **W3C Web Annotation–style multi-anchor (Tier 2)**: store multiple redundant anchors per annotation, resolve via a scored cascade.
2. Add **snapshot-based storage as an optional mode**: capture a page-subtree snapshot at save time; use as a 100%-stable fallback when live-page anchoring fails.
3. Preserve: zero-data ethos, client-only form factor, backward compatibility with existing annotations, no account/server requirement.

## 2. Verified background

- The W3C Web Annotation **Working Group is closed**. Published documents: Data Model (REC 2017), Vocabulary (REC), Protocol (REC), Embedding in HTML (WG Note), Selectors and States (WG Note 2017).
- **Robust anchoring was never delivered.** From w3.org/annotation: *"The needs of a Client-Side API for Annotations as well as the topic of Robust Anchoring were under exploration, but no output were produced during the current charter."* The W3C standardized the *selector syntax* (TextQuoteSelector with exact/prefix/suffix, TextPositionSelector, CssSelector, XPath, etc.) but **not** the *resolution algorithm* (scoring / fuzzy / best-effort).
- **No official W3C reference implementation exists.** The w3c GitHub org contains only the specs repo (frozen, last push 2017) and the conformance test suite `w3c/web-annotation-tests` (last push 2019). There is no `web-annotations` package on PyPI.
- **`@dokieli/web-annotation`** (npm, v1.1.0, Apache-2.0, TypeScript) is the de facto W3C-aligned JS implementation:
  - Maintained by Sarven Capadisli (Web Annotation WG co-chair) + Virginia Balseiro; copyright 2012–2026.
  - NLnet-funded 2025-09 → 2026-06; still active (last push 2026-08-24; releases v1.0.0/v1.0.1/v1.1.0 in Jul–Aug 2026).
  - Conformance-validated against the official `w3c/web-annotation-tests` suite (`yarn test:conformance`).
  - Provides: JSON-LD create/parse/serialize, HTML+RDFa embedding, selector construction (`selectionToTextQuote` with prefix/suffix `contextLength`, position, XPath, CSS), resolution (`setSelectionFromTextQuote`: exact phrase → exact-only fallback; `setSelectionByOffset`; XPath; `refinedBy` cascade per W3C §4.2 "first that resolves wins"), DOM marking, and `ignoreSelector` (skip injected subtrees — directly addresses the ad-injection problem).
  - Limitation: **exact string matching only** — no fuzzy/scoring (consistent with the W3C gap). `findTextQuoteOffsets` returns all occurrences, leaving disambiguation to the caller.
  - `dist/` is not committed (built with yarn); published on npm → available via unpkg/jsdelivr.
- Hypothesis's `@hypothesis/anchormeta` (from prior knowledge, not re-verified this session) is the most battle-tested *anchoring algorithm* in the wild (fuzzy + scoring), but is not W3C.

## 3. Key decision: W3C-aligned library vs hand-rolled Tier 2

**Framing note:** since no official W3C reference implementation exists, "use the W3C implementation" means **use `@dokieli/web-annotation`** (WG co-chair–maintained, conformance-validated against the official test suite).

### Option A — Hand-rolled Tier 2 (no dependencies)

Implement the W3C-compatible data model + selector construction + resolution cascade ourselves in vanilla JS.

**Pros**
- Zero dependencies; fits the bookmarklet / no-build-step form factor perfectly.
- Full control over the algorithm (scoring, fuzzy, snapshot integration).
- No third-party maintenance risk; no license considerations beyond our own GPL.
- Bundle stays small; everything inspectable.

**Cons**
- We re-implement and own the W3C data model + selector code (~300–500 lines) — more code to write and maintain.
- Conformance is "we think so" unless we also run the official test suite (possible: `w3c/web-annotation-tests` is public; we could port the relevant assertions into our tests).
- Interop with other W3C tools is at the data level only (JSON is JSON), but subtle spec deviations are possible.
- The fuzzy/scoring layer is ours either way (W3C never delivered it) — so the library's savings are only the exact-match layer.

### Option B — `@dokieli/web-annotation` for the W3C layer + hand-rolled marginalia layer

Use the library for data model + selector construction + exact resolution; hand-roll: fuzzy/scoring, pageHash, snapshot, legacy compat, UI.

**Pros**
- W3C conformance for free (validated against the official test suite; we can run `test:conformance`).
- Less code to write/maintain; the exact-match layer is already written and tested (vitest suite in the repo).
- `ignoreSelector` directly solves the injected-ads problem.
- Interop: our annotations become genuine W3C Web Annotations (JSON-LD) — portable to other tools.
- Active maintenance by the WG co-chair; Apache-2.0 is GPL-compatible (fine for a client-side app).
- Fits the existing pattern: we already load remotestoragejs from unpkg CDN; `@dokieli/web-annotation` is on npm → unpkg/jsdelivr.

**Cons**
- Introduces a dependency + a build/vendor step (dist not committed; we'd vendor the built bundle into `vendor/` or load from CDN).
- Bookmarklet size: the dist bundle must be loaded via a script tag from a hosted origin (the index.html already has this pattern via `/static/`) or inlined (size TBD — see decision gate).
- Maintenance risk: NLnet funding ended 2026-06 (still active as of 2026-08, but future uncertain); small community (5 stars).
- The library's resolution is exact-match only — we still hand-roll the fuzzy/scoring/snapshot layers, so the "Tier 2" robustness is ours either way.
- JSON-LD context handling adds weight to stored records (mitigation: store a compact marginalia-specific JSON that maps to/from the W3C model, or store full JSON-LD — decide in Phase 1).

### Option C (for completeness) — `@hypothesis/anchormeta`

The most battle-tested anchoring algorithm (fuzzy + scoring), but not W3C; pulls in the Hypothesis ecosystem. Not recommended for a zero-data personal tool; listed for completeness.

### Recommendation: **Option B, with a decision gate**

Use the library for the W3C layer (data model + selector construction + exact resolution); hand-roll the marginalia-specific layers (fuzzy/scoring, pageHash, snapshot, legacy compat, UI).

**Rationale:** the part the W3C actually delivered (data model + exact selector resolution) is exactly what the library does well and is conformance-validated; the part the W3C never delivered (robust anchoring algorithm) is hand-rolled either way. This maximizes spec compliance/interop while minimizing code, and keeps the zero-data, client-only form factor.

**Decision gate (Phase 0, day 1):** build `@dokieli/web-annotation`, measure the minified bundle size, and confirm the bookmarklet loading strategy (vendor vs CDN vs inline). If the bundle is >~150KB minified or the CDN dependency is unacceptable → **fall back to Option A** (bounded cost: the data model is simple JSON).

## 4. Design

### 4.1 Annotation record v2 (W3C-compatible)

```json
{
  "type": "Annotation",
  "motivatedBy": "commenting",
  "created": "2026-11-02T15:00:00Z",
  "lsid": "hl1234567890",
  "marginalia": { "hcolor": "yellow", "annotation": "note text" },
  "target": {
    "source": "https://example.com/page",
    "selector": {
      "type": "TextQuoteSelector",
      "exact": "selected text",
      "prefix": "…32 chars before",
      "suffix": "…32 chars after"
    },
    "refinedBy": [
      { "type": "TextPositionSelector", "start": 1234, "end": 1267 },
      { "type": "CssSelector", "value": "article > p:nth-of-type(3)" }
    ]
  },
  "marginaliaMeta": {
    "pageHash": "f3ab…",
    "snapshot": { "ref": "snap-<hash>", "size": 18342 }
  }
}
```

- `refinedBy` = W3C §4.2 co-equal alternatives (dokieli's `resolve.ts` implements "first that resolves wins"; we extend with scoring).
- Legacy records (`startNode`/`innerHTML`/…) are read via a compat shim that converts to v2 on load (and optionally re-saves as v2).
- Storage layout unchanged: per-URL lists in localStorage / remoteStorage.

### 4.2 Anchor generation (setAnnotation)

From the selection Range:
1. **TextQuoteSelector**: `exact` = `range.toString()`; `prefix`/`suffix` = 32 chars of surrounding text (dokieli `selectionToTextQuote` / `getTextQuoteSelector`).
2. **TextPositionSelector**: `start`/`end` = character offsets within `document.body` (dokieli `offsetInContainer`).
3. **CssSelector**: path of the start container (or nearest ancestor with a stable id/class).
4. **pageHash** (marginalia-specific, not W3C): FNV-1a/djb2 over whitespace-normalized `body.textContent`.
5. **Optional snapshot** (see 4.4).

### 4.3 Resolution cascade (loadAnnotations) — scored, best-effort

For each annotation, try in order; each step yields a confidence:

| # | Strategy | Confidence |
|---|----------|------------|
| 1 | pageHash matches current page → TextPositionSelector (trust offsets) | high |
| 2 | TextQuote exact+prefix+suffix (dokieli `setSelectionFromTextQuote`, `ignoreSelector` for injected decoration) | high |
| 3 | TextQuote exact-only (all occurrences via `findTextQuoteOffsets`; disambiguate by nearest prefix/suffix context) | medium |
| 4 | Fuzzy quote (hand-rolled: token-sequence similarity / Levenshtein sliding window, threshold ~0.8) | medium-low |
| 5 | CssSelector | low |
| 6 | TextPositionSelector (pageHash mismatch — text may have shifted) | low |
| 7 | Snapshot (if stored): resolve within snapshot DOM (position selector is exact there) | exact-but-stale |

- Report: "Applied N (M via snapshot), K failed (reasons)".
- Idempotency: applied spans get `data-lsid`; skip if already present (fixes the self-mutation bug where `hlite()` splits text nodes).

### 4.4 Snapshot option (orthogonal to storage backend)

- **What**: serialize the nearest stable ancestor subtree of the selection (e.g. the `<article>`/`<section>`/`<p>` container — configurable depth), not the full page (size). Full-page snapshot as an advanced option.
- **Storage**: content-addressed by hash → dedup across annotations on the same page.
  - remoteStorage: `/marginalia/snapshots/<hash>`.
  - localStorage: cap ~200KB per snapshot, warn on quota; snapshots recommended for remote mode.
- **When used**: last resort in the cascade (step 7), or when the user enables the snapshot toggle.
- **How applied**: render the snapshot into an overlay container, resolve the anchor inside it (the snapshot is the page as saved, so the position selector is exact), and show a snapshot view of the annotated passage. *Stretch goal:* DOM-diff the snapshot against the live page to map the highlight back onto the live DOM.
- **UI**: a separate remembered toggle ("Also store a page snapshot? y/n") — **not** a third backend option; keep the prompt `1 = localStorage, 2 = remoteStorage`. Index.html gets the toggle + status display.

## 5. Phases

### Phase 0 — Foundation (shared by both options)
- [ ] v2 record schema + legacy compat shim (old format → v2)
- [ ] pageHash utility + normalized text utilities
- [ ] Idempotency: `data-lsid` on applied spans; skip on re-apply
- [ ] Test harness: `test/` with static HTML fixtures + runner (vitest+jsdom if Option B; node+jsdom if Option A)
- [ ] **Decision gate:** build `@dokieli/web-annotation`, measure minified size, confirm bookmarklet loading strategy (vendor vs CDN vs inline) → lock Option A or B

### Phase 1 — Tier 2 core
- [ ] Anchor generation in `setAnnotation.js` (quote+prefix/suffix, position, css, pageHash)
- [ ] Resolution cascade in `loadAnnotations.js` (steps 1–6)
- [ ] Fuzzy layer (hand-rolled, tunable threshold)
- [ ] Disambiguation scoring for multiple occurrences
- [ ] User-facing report (applied/failed + which strategy won)
- [ ] Conformance: run the official `w3c/web-annotation-tests` against our serialization (Option B: the library's `test:conformance`; Option A: port the relevant assertions)
- [ ] Fixtures: unchanged page, reordered, duplicated elements, edited text, injected ads, legacy records

### Phase 2 — Snapshot option
- [ ] Snapshot capture (subtree serialization, size cap, content-addressed)
- [ ] Snapshot storage in both backends (localStorage quota handling)
- [ ] Snapshot application (overlay view; stretch: DOM-diff mapping back to live)
- [ ] UI: remembered toggle + index.html toggle + status display
- [ ] Pruning policy (cap snapshots per URL by count/size)

### Phase 3 — Polish
- [ ] index.html: snapshot toggle, docs section
- [ ] CLAUDE.md + README updates
- [ ] Bookmarklet rebuild (vendor/CDN strategy per decision gate)
- [ ] Manual test pass on real pages (news article, docs page, page with ads)

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| dokieli maintenance (funding ended 2026-06) | Apache-2.0 → we can vendor/fork; the code is small and readable |
| Bookmarklet size / CDN dependency | Phase-0 decision gate; fallback to Option A; existing `/static/` hosting pattern |
| localStorage quota with snapshots | Size cap + content-addressed dedup + pruning; recommend remote mode for snapshots |
| W3C anchoring is not a standard (no official algorithm) | Our scoring is marginalia-specific; interop is at the data-model level (document this) |
| Snapshot staleness (user sees old content) | Always label snapshot-applied highlights; prefer live anchoring |
| GPL v3 + Apache-2.0 | Compatible (Apache-2.0 is GPL-compatible); fine for a client-side app |

## 7. Out of scope

- Server-side anchor repair (Hypothesis-style) — breaks zero-data.
- Video/media annotation (TimeQuoteSelector).
- Public multi-user annotation.
- Full-page DOM-diff mapping (stretch goal only).
