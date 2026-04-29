# Phase 3.5: Study Content Quality Upgrade

**Status:** Implemented  
**Date:** March 5, 2026  
**Scope:** Pure NLP pipeline quality fixes (no Phase 4/Quiz changes)

## Problem Statement

After Phase 3's semantic upgrade (sentence-transformers, MMR summarization, structured summary), the extracted study content still had significant quality issues:

1. **Mojibake artifacts** — Characters like `canât`, `â large`, `understandingâ¦` appeared throughout summaries, concepts, and keywords due to broken UTF-8/Latin-1 encoding from PDF extraction via Tika.
2. **Garbage concept names** — Labels like "Model Datum Optimizer", "That Grid", "Edges 128 Step" because the labeling algorithm picked noun phrases from garbled text.
3. **Generic keywords** — Tags like "datum", "portion", "function", "you", "something" provided no study value.
4. **Arbitrary detailed sections** — The Detailed summary view used cluster titles (arbitrary phrases) instead of stable pedagogical categories.
5. **Homogeneous bullet labels** — Nearly all bullets were labeled "KEY CONCEPT" because the pattern matching was too broad.

## Root Cause Analysis

### Mojibake

Tika extracts PDF text as raw bytes. When the PDF's internal encoding is UTF-8 but Tika (or an intermediate layer) assumes Latin-1, multi-byte UTF-8 sequences get split into separate Latin-1 characters:

- `'` (U+2019, UTF-8 bytes `E2 80 99`) becomes `â€™` (three Latin-1 chars: `â` + `€` + `™`)
- `—` (em-dash) becomes `â€"`

The previous fix tried to match these garbled strings with a dictionary, but the dictionary entries themselves got double-encoded when saved to the file (triple mojibake). The regex fallback `[\xc3\xc2][\x80-\xbf]` used literal Python escape sequences that didn't match the actual Unicode characters in the string.

### Concept Labels

The labeling algorithm found the noun phrase (from spaCy `noun_chunks`) most similar to the cluster centroid. But noun phrases extracted from garbled text are themselves garbage — no amount of semantic embedding comparison can fix a garbage-in label.

### Keywords

The `filter_keywords` function only checked for URLs, slides, and length < 3. Academic-irrelevant words like "datum", "portion", "function" passed right through.

### Sections & Bullets

Detailed sections used cluster labels as titles instead of fixed categories. Bullet label matching had `KEY CONCEPT` with pattern `\b(key|important|fundamental|essential|core|main)\b` which matches most academic sentences.

## Changes Made

### 1. NLP Microservice (`nlp-service/main.py`)

**Encoding repair** — Replaced the broken mojibake dictionary + regex with a proper multi-layer repair strategy:
- Added `ftfy` library (Fix Text For You) as the primary repair engine
- Added latin1→utf8 round-trip fallback for remaining garble
- Added stray accent character stripping
- Added non-printable control character removal

**Concept label extraction** — Replaced noun-phrase-to-centroid similarity with **KeyBERT on cluster text**:
- Concatenate all sentences in a cluster
- Run KeyBERT to find the best 1-3 word keyphrase representing the cluster
- Apply generic stopword filtering to reject labels like "Model Datum Optimizer"
- Fallback to most frequent multi-word noun chunk if KeyBERT fails

**Keyword quality** — Added `_GENERIC_STOPWORDS` frozenset with 80+ generic academic words and applied multi-layer filtering:
- Single-word generic terms rejected
- All-stopword phrases rejected
- KeyBERT score threshold of 0.15 (low-relevance terms dropped before dedup)
- Ngram range expanded to (1, 3) for richer phrases

**Key terms from clusters** — Improved `_extract_key_terms_from_sentences` to prefer multi-word noun phrases over single words, with root-deduplication.

### 2. Edge Function (`process-document/index.ts`)

**Structured summary sections** — Replaced arbitrary cluster-title sections with 5 fixed pedagogical categories:
- **Introduction** — definitions, overview, background
- **Core Concepts** — theory, principles, mechanisms, architecture
- **Key Components** — layers, modules, parameters, types
- **Applications** — implementation, code, training, real-world usage
- **Challenges** — limitations, trade-offs, problems

Each cluster is classified into one of these sections using regex-based content heuristics. Clusters mapping to the same section are merged.

**Concept name validation** — Expanded `cleanConceptLabel` with:
- Article stripping ("the", "this", "that")
- Mojibake character rejection (`\u00e2`, `\u00c3`, etc.)
- 50+ additional penalty terms (generic nouns, pronouns, academic filler)
- Known acronym expansion (SGD, ADAM, ReLU, etc.)

**Bullet label diversity** — Reordered `BULLET_LABEL_PATTERNS` to check specific patterns first:
1. DEFINITION (is a, refers to, known as)
2. EXAMPLE (such as, e.g., for instance)
3. PROCESS (build, create, implement, train)
4. CHALLENGE (problem, limitation, error)
5. ADVANTAGE (benefit, improve, efficient)
6. KEY DISTINCTION (compare, differ, versus)
7. KEY CONCEPT (last resort)

**Tag filtering** — Added `EDGE_GENERIC_TAGS` set and `filterConceptTags` function for secondary quality gate on concept tags.

**Mojibake cleanup** — Replaced hardcoded mojibake string replacements with Unicode range regex patterns in `stripNoisyInlineContent`.

### 3. Dependencies

- Added `ftfy>=6.1.0` to `requirements.txt`

### 4. No Frontend Changes Required

The `StructuredSummary` JSON shape (`short`, `detailed[]`, `bullets[]`) is unchanged. `FileViewer.tsx` renders the same structure with better content.

## Files Modified

| File | Change |
|------|--------|
| `nlp-service/requirements.txt` | Added `ftfy>=6.1.0` |
| `nlp-service/main.py` | Replaced mojibake repair, rewrote cluster labeling, improved keyword/tag filtering |
| `supabase/functions/process-document/index.ts` | Pedagogical sections, concept name validation, bullet labels, tag filtering |

## Expected Output (CNN Sample)

### Short Summary
> Convolutional Neural Networks (CNNs) use convolutional layers with learnable kernels to extract spatial features from input data. Zero padding preserves spatial dimensions while stride controls the step size of the convolution operation. The dense layer performs final classification using features extracted by the convolutional layers.

### Detailed Sections
| Section | Content |
|---------|---------|
| **Introduction** | CNNs are deep learning models designed for processing grid-structured data like images... |
| **Core Concepts** | Convolution applies learnable kernels across the input to produce feature maps. Zero padding adds border pixels to preserve spatial dimensions... |
| **Key Components** | Convolutional layers, pooling layers, flatten layer, dense classification layer. Kernels of sizes 16, 32, 64, 128 extract hierarchical features... |
| **Applications** | Building a CNN using Keras: import Sequential, add Conv2D layers, compile with optimizer and loss function, train with model.fit()... |

### Bullets
| Label | Content |
|-------|---------|
| DEFINITION | Convolutional Layer: Applies learnable filters across input to produce feature maps that detect edges, textures, and patterns. |
| KEY CONCEPT | Zero Padding: Adds border pixels around the input so the kernel can process edge regions without losing spatial information. |
| PROCESS | Building CNN with Keras: Import necessary modules, create Sequential model, add Conv2D and Dense layers, compile and train. |
| KEY DISTINCTION | Stride vs Padding: Stride controls how much the kernel moves per step; padding controls whether spatial dimensions are preserved. |
| EXAMPLE | Feature Maps: With kernel size 3x3, 32 filters produce 32 feature maps, each detecting different spatial patterns. |

### Concepts (6-10 clean)
| Name | Category | Difficulty | Tags |
|------|----------|------------|------|
| Zero Padding | CNN Architecture | beginner | spatial dimensions, border pixels, convolution |
| Convolutional Layer | CNN Architecture | intermediate | kernel, feature maps, filters |
| Stride | CNN Architecture | intermediate | step size, spatial reduction |
| Dense Layer | Neural Networks | beginner | classification, fully connected |
| Flatten Layer | Neural Networks | beginner | reshape, feature vector |
| Feature Maps | CNN Architecture | intermediate | channels, spatial features |
| Optimizers and Loss | Training | advanced | adam, categorical crossentropy, gradient |
| Pooling Layer | CNN Architecture | intermediate | downsampling, max pooling |

## Acceptance Criteria

- [ ] No mojibake characters (`â`, `â€™`, `â€"`, etc.) in summaries, concepts, or keywords
- [ ] Detailed view shows 3-5 stable pedagogical section titles (Introduction, Core Concepts, etc.)
- [ ] Concept names are meaningful teachable topics (e.g., "Zero Padding" not "That Grid")
- [ ] Keywords/tags contain no generic words (datum, portion, function, you, something)
- [ ] Bullet labels are diverse (not all "KEY CONCEPT")
- [ ] Concept descriptions are clean 1-4 sentences, no fragments
- [ ] No regression in processing latency (ftfy adds ~5ms per document)
- [ ] Frontend renders correctly with no code changes
