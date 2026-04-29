# Phase 3.6: Slide-Aware Document Processing Pipeline

**Status:** Implemented  
**Date:** March 6, 2026  
**Scope:** Slide-aware extraction, document-type detection, improved filtering

## Problem Statement

The document processing pipeline produced incoherent study material for slide-based documents (PPTX, PDF slides). Specific issues:

1. **Fragmented summaries** — Tika's plain-text mode flattened slide structure, and `_merge_short_lines` joined unrelated fragments into Frankenstein sentences
2. **Garbage concept names** — "Flowers Grass", "Useful", "Architecture" because cluster labels were derived from garbled merged text
3. **Arrow noise in keywords** — `"→ more memory stride length"` passed through filters
4. **Article noise in terms** — `"the output"`, `"a dense layer"` persisted in top terms
5. **Generic single-word concepts** — "Connected", "Dense", "Useful" accepted as concept names

## Root Cause

The pipeline treated all documents as prose (textbooks/articles). Student uploads are predominantly **presentation slides** which have short bullet points, arrow notation, and no paragraph structure. The TextRank/clustering pipeline requires proper sentences to function.

## Architecture Change

New three-tier branching in `buildPureNlpResult`:

```
1. Slides path    → document_type === 'slides' && slides.length >= 3
2. Cluster path   → sentenceClusters.length >= 3  (existing)
3. Keyword path   → fallback                       (existing)
```

The NLP service now requests Tika's XHTML output (instead of plain text), parses slide boundaries, detects document type, and returns structured slide data alongside the existing NLP signals.

## Changes Made

### 1. NLP Service (`nlp-service/main.py`)

**Tika XHTML extraction** — Changed from `Accept: text/plain` to `Accept: text/html`. BeautifulSoup parses the HTML for both slide structure and plain text extraction.

**`_extract_slides_from_html(html)`** — Parses `div.slide-content` (PPTX) or `div.page` (PDF) elements. Extracts per-slide title and bullets. Skips master-slide template content. Applies encoding repair and arrow stripping.

**`_detect_document_type(raw_text, slides, content_type)`** — Three-level detection:
- Definitive: PPTX MIME type
- Definitive: HTML had 3+ slide boundary divs
- Heuristic: short-line ratio, arrow count, average line length

**`_process_slides_keywords(slides)`** — Runs KeyBERT per-slide for better keyword relevance. Attaches `keywords` list to each slide dict. Merges into global keyword list.

**`_strip_arrows(text)`** — Removes Unicode arrow characters (U+2190-U+21FF, etc.)

**`clean_extracted_text(text, skip_merge=False)`** — New `skip_merge` parameter. For slides, skips `_merge_short_lines` which was destructive to slide boundaries. Arrow stripping added to cleaning pipeline.

**`filter_keywords(phrases)`** — Now strips arrows and leading articles before evaluation. Rejects phrases that are just connectors/prepositions.

**`ProcessResponse`** — New fields: `document_type: str`, `slides: Optional[List[dict]]`

### 2. Edge Function (`supabase/functions/process-document/index.ts`)

**`SlideData` interface** — `slide_number`, `title`, `bullets`, optional `keywords`.

**`NlpExtractionResult`** — Added `documentType` and `slides` fields.

**`stripArrowsAndArticles(text)`** — Strips Unicode arrows and leading articles ("the", "a", "an").

**`buildConceptsFromSlides(slides)`** — Uses slide titles as concept names (already well-structured by lecturers). Combines slide bullets into coherent descriptions. Per-slide keywords become concept tags. Importance based on slide position.

**`buildStructuredSummaryFromSlides(slides)`** — Short summary from first slides with content. Detailed sections by classifying slides into pedagogical categories. Bullets from each substantive slide.

**`buildPureNlpResult`** — New parameters `documentType` and `slides`. Branches to slide path before existing cluster/keyword paths.

**`cleanConceptLabel`** — Strips arrows before tokenizing. Added `COMMON_SINGLE_WORDS` rejection set for "useful", "connected", "dense", etc.

**`filterKeywordsForStudy`** — Strips arrows and articles before evaluation.

**`filterConceptTags`** — Strips arrows and articles from tags.

**`stripNoisyInlineContent`** — Added arrow character stripping.

### 3. Dependencies

- Added `beautifulsoup4>=4.12.0` and `lxml>=4.9.0` to `requirements.txt`
- Added `libxml2-dev` and `libxslt-dev` to Dockerfile system dependencies

### 4. No Frontend Changes Required

The `StructuredSummary` and `Concept` shapes are unchanged. Better content flows through the same rendering path.

## Files Modified

| File | Change |
|------|--------|
| `nlp-service/requirements.txt` | Added `beautifulsoup4`, `lxml` |
| `nlp-service/Dockerfile` | Added `libxml2-dev`, `libxslt-dev` |
| `nlp-service/main.py` | XHTML extraction, slide parsing, type detection, arrow/article filtering |
| `supabase/functions/process-document/index.ts` | Slide builders, branching, improved filtering |

## Expected Output (CNN Slides)

### Before (broken)
- Concepts: "Flowers Grass", "Useful", "Connected", "Dense"
- Summary: "More kernels → more channels/feature maps → more data → more memory Stride Length..."
- Terms: "→ more memory stride length", "the output", "the fully connected layers"

### After (fixed)
- Concepts: "CNN Architecture", "Zero Padding", "Stride Length", "Convolutional Layer", "Dense Layer"
- Summary: "CNN Architecture: Convolutional Neural Networks use learnable kernels to extract features. Zero Padding: Adds border pixels to preserve spatial dimensions."
- Terms: "convolutional layer", "feature maps", "zero padding", "dense layer"

## Deployment Steps

1. Rebuild the NLP service Docker image (new dependencies):
   ```bash
   cd educoach && docker compose build nlp-service
   docker compose up -d
   ```
2. Deploy the updated Edge Function:
   ```bash
   supabase functions deploy process-document
   ```
3. Re-process existing documents to regenerate concepts/summaries

## Backward Compatibility

- Prose documents follow the existing cluster-based or keyword-based paths unchanged
- The `document_type` and `slides` fields are optional in the NLP response
- If NLP service is unavailable, defaults to `document_type='prose'` with no slides
- No database schema changes required
- No frontend code changes required
