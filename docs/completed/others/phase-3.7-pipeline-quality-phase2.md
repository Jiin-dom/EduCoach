# Phase 3.7: Pipeline Quality Enhancement Phase 2

**Status:** Implemented  
**Date:** March 6, 2026  
**Scope:** Post-slide-pipeline quality fixes: numeric filtering, meta-slide detection, compound term protection, bullet label diversity, code content detection, keyword quality

## Problem Statement

After Phase 3.6 (slide-aware pipeline), reprocessed slide documents showed improvement but still had quality issues:

- Raw numeric values (pixel data like `0.49411765`) leaking into summaries, bullets, and keywords
- Meta-slides ("Agenda", "Overview") incorrectly becoming concepts
- Compound domain terms broken by penalty filter ("Deep Learning" -> "Deep")
- Leading prepositions left behind ("Of Convolution" instead of "Convolution")
- All bullet points labeled "KEY CONCEPT" due to narrow pattern matching
- Code import statements mixed into prose summaries
- Low-quality keywords like "2948404 image", "Agenda", "recap digital"

## Changes Made

### Files Modified

- `educoach/nlp-service/main.py`
- `educoach/supabase/functions/process-document/index.ts`

### Fix 1: Numeric Content Filter

Added `_is_numeric_heavy()` (Python) and `isNumericHeavy()` (TypeScript) helpers that reject text where >40% of non-space characters are digits or decimal points. Applied in:
- `filter_keywords()`, `_process_slides_keywords()` (Python)
- `buildConceptsFromSlides()`, `buildStructuredSummaryFromSlides()`, `filterKeywordsForStudy()`, `filterConceptTags()` (TypeScript)

### Fix 2: Meta-Slide Detection

Added `META_SLIDE_TITLES` set and `isMetaSlide()` function. Slides titled "Agenda", "Outline", "Overview", "References", etc. are now skipped when building concepts, summary sections, and bullet points. Cover slides matching course numbering patterns (e.g., "Deep Learning: 2.") on slide 1 are also skipped.

### Fix 3: Protected Compound Domain Terms

Added `PROTECTED_BIGRAMS` set containing established compound terms like "deep learning", "machine learning", "neural network", "computer vision", etc. The `cleanConceptLabel()` function now detects bigrams before penalty filtering and protects both tokens from removal.

### Fix 4: Leading Preposition Stripping

Added `LEADING_PREPS` set and a while-loop in `cleanConceptLabel()` that strips leading prepositions (of, for, in, on, to, by, with, from) that remain after penalty term removal.

### Fix 5: Improved Bullet Label Detection

Broadened `BULLET_LABEL_PATTERNS` to catch:
- Technical process terms: operation, convolution, mathematical, computation, algorithm
- ML architecture terms: network, layer, neuron, kernel, filter, channel
- Challenge terms: vanishing gradient, overfitting, underfitting
- Common misspellings: "verses" (for "versus")
- Colon-definition fallback: "Term: explanation" format detected as DEFINITION

### Fix 6: Code Content Detection

Added `isCodeLikeContent()` (TypeScript) and `_is_code_like()` (Python) helpers that detect import statements, framework-specific patterns (Sequential, Dense, model.fit), and multi-special-character code syntax. Applied to filter code bullets from concept descriptions, summary sections, and keyword extraction input.

### Fix 7: Keyword Quality Improvements

- Added meta-slide terms ("agenda", "outline", "recap", etc.) to stopword sets in both files
- Added 2-word numeric fragment rejection (phrases where one token is purely numeric)
- All filters work together: numeric + meta + code + generic stopwords

## Expected Output Improvement

For the CNN slide deck, before and after:

| Issue | Before | After |
|-------|--------|-------|
| Numeric values | "Computer Vision with Deep Learning: 0.49411765..." | Filtered out entirely |
| Agenda concept | "Agenda" with topic list as description | Skipped (meta-slide) |
| Broken term | "Computer Vision With Deep" | "Computer Vision With Deep Learning" |
| Leading prep | "Of Convolution" | "Convolution" |
| Bullet labels | All "KEY CONCEPT" | Mix of DEFINITION, PROCESS, KEY DISTINCTION |
| Code in summary | "From tensorflow.keras import Sequential" | Filtered out |
| Bad keywords | "2948404 image", "Agenda", "recap digital" | Filtered out |

## Deployment

Same as Phase 3.6 -- rebuild NLP service Docker image and redeploy Supabase Edge Function:

```bash
cd educoach
docker compose build nlp-service
docker compose up -d nlp-service
npx supabase functions deploy process-document --no-verify-jwt
```

Then reprocess the CNN document to verify improvements.
