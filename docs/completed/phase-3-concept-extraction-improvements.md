## Phase 3 – Concept Extraction Improvements (Implemented)

This document describes the concrete implementation work done to improve the quality of extracted study content for uploaded documents (PDF/DOCX), based on the plan in `.cursor/plans/improve_concept_extraction_quality_885e26db.plan.md`.

It covers changes to:

- The Python NLP microservice (`nlp-service/`)
- The `process-document` Supabase Edge Function
- The resulting behaviour in the EduCoach frontend

The goal was to move from a **keyword‑first** concept builder to a **sentence‑first, topic‑cluster** approach, while keeping the system compatible with existing Phase 3 architecture and keeping Gemini as an optional fallback.

---

## 1. Previous Behaviour (Before Improvements)

### 1.1 Pure NLP Path

Before these changes, the Pure NLP concept builder in `process-document/index.ts` worked like this:

1. Call NLP service `/process` to get:
   - `text`: full cleaned document text
   - `important_sentences`: TextRank top sentences
   - `keywords`: KeyBERT keyphrases (1–3 grams)
2. Build a **sentence pool** from `important_sentences` (using `isStudyFriendlySentence` for quality).
3. Build concepts by iterating over **keywords**:
   - Promote each keyword to a concept `name` (via `toTitleCase`).
   - Find the first sentence containing that keyword and use it as the `description`.
   - Derive `keywords` field by matching keyphrases in that sentence.
4. Deduplicate concepts by **exact name** only.
5. Summary = concatenation of the top 3 sentences from the pool.

This produced:

- Duplicated or near‑duplicate concepts (e.g. “Padding Building CNN”, “Building CNN Using”, “CNN Using Keras”).
- No semantic deduplication or clustering.
- Raw, noisy sentences as descriptions.
- Hardcoded difficulty and category for all concepts.

Gemini remained as a fallback if Pure NLP produced 0 concepts or an empty summary.

---

## 2. Python NLP Microservice Changes (`nlp-service/`)

### 2.1 Configuration & Dependencies

**Files:**

- `nlp-service/main.py`
- `nlp-service/requirements.txt`

**Changes:**

- Added `scikit-learn>=1.3.0` to `requirements.txt` to support lightweight clustering:
  - `TfidfVectorizer`
  - `AgglomerativeClustering`
  - `cosine_distances`
- Added new configuration constants:

```12:18:educoach/nlp-service/main.py
SENTENCE_POOL_MAX = int(os.getenv("SENTENCE_POOL_MAX", "30"))
CLUSTER_DISTANCE_THRESHOLD = float(os.getenv("CLUSTER_DISTANCE_THRESHOLD", "0.65"))
CLUSTER_MIN_CONCEPTS = int(os.getenv("CLUSTER_MIN_CONCEPTS", "3"))
CLUSTER_MAX_CONCEPTS = int(os.getenv("CLUSTER_MAX_CONCEPTS", "12"))
CLUSTERING_LOG_LEVEL = os.getenv("CLUSTERING_LOG_LEVEL", "info")
```

These allow tuning sentence pool size and clustering behaviour via environment variables (no code changes required).

### 2.2 Stronger Sentence Filtering

**Goal:** Ensure the clustering operates only on a **small, high‑quality sentence pool**, not on all sentences.

**Function updated:** `is_good_sentence(sentence: str) -> bool`

Key changes:

- Enforced **minimum word count** (≥ 8 words).
- Rejected sentences with > 4 consecutive capitalized words (common for mashed slide titles).
- Added conjunction/preposition ratio check (reject if > 30% of tokens are conjunctions/prepositions).
- Kept existing checks:
  - Length between 40 and 400 characters.
  - No URLs or slide markers.
  - Minimum letter ratio (≥ 45%).

This significantly reduces noisy fragments that previously became concept descriptions.

### 2.3 Noun Phrase Extraction

**New function:** `extract_noun_phrases(doc) -> List[dict]`

**Location:** After `filter_keywords` in `main.py`.

Behaviour:

- Uses spaCy `doc.noun_chunks` to collect noun phrases.
- Filters out:
  - Pronouns.
  - Very short phrases (< 2 words or < 5 chars).
  - Phrases containing URLs or slide markers.
- Counts frequency and returns the top ~30 phrases:

```213:227:educoach/nlp-service/main.py
def extract_noun_phrases(doc) -> List[dict]:
    counts: Dict[str, int] = {}
    for chunk in doc.noun_chunks:
        phrase = chunk.text.strip().lower()
        if chunk.root.pos_ == "PRON":
            continue
        if len(phrase) < 5 or len(phrase.split()) < 2:
            continue
        if _URL_RE.search(phrase) or _SLIDE_RE.search(phrase):
            continue
        counts[phrase] = counts.get(phrase, 0) + 1

    ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    return [{"phrase": p, "count": c} for p, c in ranked[:30]]
```

These noun phrases are later used by the Edge Function to label topic clusters.

### 2.4 Keyword Deduplication

**New function:** `dedup_keywords(keywords_with_scores: List[tuple]) -> List[tuple]`

**Purpose:** Reduce overlapping KeyBERT n‑gram permutations (e.g. “padding building cnn”, “building cnn using”).

Behaviour:

- For each `(phrase, score)`:
  - Compares token overlap with already‑accepted phrases.
  - If Jaccard token overlap > 0.7 vs a higher‑scored phrase, it is dropped.

This generates a smaller, more diverse keyword list for both the old and new paths.

### 2.5 Sentence Clustering

**New functions:**

- `_do_cluster(sentences, dist_matrix, vectorizer, noun_phrases, threshold, max_concepts)`
- `cluster_sentences(sentences: List[str], noun_phrases: List[dict]) -> List[dict]`

**Algorithm:**

1. TF‑IDF vectorization (`TfidfVectorizer`).
2. Pairwise cosine distance matrix (`cosine_distances`).
3. Agglomerative clustering with:
   - `metric="precomputed"`
   - `linkage="average"`
   - `distance_threshold=CLUSTER_DISTANCE_THRESHOLD` (no fixed `n_clusters`).
4. For each cluster:
   - Compute top TF‑IDF terms as `key_terms`.
   - Select representative sentence closest to the cluster centroid.
   - Label the cluster with the most frequent noun phrase found in its sentences (falls back to top TF‑IDF terms).
5. Sort clusters by size and cap at `CLUSTER_MAX_CONCEPTS`.
6. Adaptive retry:
   - If cluster count < `CLUSTER_MIN_CONCEPTS` and threshold > 0.3, rerun clustering with a slightly lower threshold.

**Output shape (per cluster):**

```224:229:educoach/nlp-service/main.py
{
    "label": best_label,
    "sentence_indices": indices,
    "key_terms": key_terms,
    "representative_index": rep_idx,
}
```

### 2.6 Enhanced `/process` Endpoint

**Function:** `process_document(file: UploadFile)`

Key changes:

- Increased TextRank candidate pool to support clustering:
  - Requests more sentences, then filters to at most `SENTENCE_POOL_MAX`.
- Updated KeyBERT configuration:
  - `keyphrase_ngram_range=(1, 2)` instead of `(1, 3)` to avoid 3‑gram permutations.
  - Applied `dedup_keywords` post‑filter before `filter_keywords`.
- Added:
  - `noun_phrases = extract_noun_phrases(doc)`
  - `sentence_clusters = cluster_sentences(important_sentences[:SENTENCE_POOL_MAX], noun_phrases)`
- Extended `ProcessResponse` model:

```573:582:educoach/nlp-service/main.py
class ProcessResponse(BaseModel):
    success: bool
    text: str
    keywords: List[str]
    important_sentences: List[str]
    char_count: int
    noun_phrases: Optional[List[dict]] = None
    sentence_clusters: Optional[List[dict]] = None
    error: Optional[str] = None
```

- Added clustering diagnostics logging (conditionally based on `CLUSTERING_LOG_LEVEL`):
  - Sentence pool size.
  - Cluster count and cluster sizes.
  - Noun phrase count.
  - Distance threshold.

**Backward compatibility:** `noun_phrases` and `sentence_clusters` are optional fields. Existing callers that only read `text`, `keywords`, and `important_sentences` continue to work unchanged.

---

## 3. Supabase Edge Function Changes (`supabase/functions/process-document/index.ts`)

### 3.1 Parsing New NLP Results

**Interface extended:**

```455:459:educoach/supabase/functions/process-document/index.ts
interface NlpExtractionResult {
    text: string
    keywords: string[]
    importantSentences: string[]
    nounPhrases: NounPhrase[]
    sentenceClusters: SentenceCluster[]
}
```

**`extractWithNlpService()` now returns and parses:**

```497:501:educoach/supabase/functions/process-document/index.ts
return {
    text: result.text,
    keywords: result.keywords || [],
    importantSentences: result.important_sentences || [],
    nounPhrases: result.noun_phrases || [],
    sentenceClusters: result.sentence_clusters || [],
}
```

**Main handler stores the new fields:**

```205:222:educoach/supabase/functions/process-document/index.ts
let extractedKeywords: string[] = []
let importantSentences: string[] = []
let extractedNounPhrases: NounPhrase[] = []
let extractedClusters: SentenceCluster[] = []
...
const nlpResult = await extractWithNlpService(...)
textContent = nlpResult.text
extractedKeywords = nlpResult.keywords
importantSentences = nlpResult.importantSentences
extractedNounPhrases = nlpResult.nounPhrases
extractedClusters = nlpResult.sentenceClusters
```

### 3.2 Cluster-Based Types & Helpers

**New interfaces:**

```787:796:educoach/supabase/functions/process-document/index.ts
interface NounPhrase {
    phrase: string
    count: number
}

interface SentenceCluster {
    label: string
    sentence_indices: number[]
    key_terms: string[]
    representative_index: number
}
```

**Label penalty terms and known acronyms:**

```799:809:educoach/supabase/functions/process-document/index.ts
const LABEL_PENALTY_TERMS = new Set([
    'using', 'building', 'creating', 'importing', 'making', 'doing',
    'overview', 'introduction', 'general', 'example', 'review',
    'understanding', 'learning', 'studying', 'applying', 'getting',
    'started', 'basics', 'chapter', 'section', 'slide', 'page',
    'module', 'lecture', 'part', 'unit',
])

const KNOWN_ACRONYMS = new Set([
    'CNN', 'RNN', 'LSTM', 'GRU', 'BPTT', 'NLP', 'ML', 'AI', 'GPU', 'CPU',
    'API', 'SQL', 'HTML', 'CSS', 'HTTP', 'REST', 'JSON', 'XML', 'TCP', 'UDP',
    'OOP', 'DFS', 'BFS', 'SVM', 'PCA', 'GAN', 'VAE', 'MLP', 'KNN',
])
```

**`cleanConceptLabel()` now:**

- Removes generic verbs/boilerplate words.
- Prefers 2–4 word noun phrases.
- Allows single‑word labels only for known acronyms.

### 3.3 Difficulty & Category Heuristics

**New helper:** `estimateDifficulty(description, _conceptName)`

- Uses patterns (introductory phrases, math symbols, advanced ML vocabulary) and average word length.
- Returns `'beginner' | 'intermediate' | 'advanced'`.
- Wrapped in `try`/`catch`; defaults to `'intermediate'` on any error.

**New helper:** `detectCategory(conceptName, keywords)`

- Matches the combined text against a set of category regexes:
  - Neural Networks, CNN Architecture, Training, Hyperparameters, Activation Functions, Algorithms, Data Structures, Databases, OOP, Programming Fundamentals.
- Returns a label or `'General Study'` by default.
- Also wrapped in `try`/`catch`.

Both heuristics are **best‑effort only** and never block the pipeline.

### 3.4 Semantic Deduplication

**New helpers:**

- `jaccardSimilarity(nameA, nameB)`
- `isContainedIn(shorter, longer)`
- `deduplicateConcepts(concepts: Concept[]): Concept[]`

`deduplicateConcepts` applies three strategies in order:

1. Exact normalized match (existing behaviour).
2. Containment (one name’s tokens are a subset of the other).
3. Jaccard token overlap:
   - Threshold 0.5 for names with ≥3 tokens.
   - Threshold 0.7 for short names (1–2 tokens).

When duplicates are found:

- The concept with higher `importance` wins.
- Ties are broken in favour of shorter names.
- Keyword tags are merged (union), capped.

This is what collapses noisy variants like `"Padding Building CNN"` and `"Building CNN Using"` into a single cleaner concept.

### 3.5 Summary Generation from Clusters

**New helper:** `buildSummaryFromClusters(sentencePool, clusters, fallbackSentences)`

Behaviour:

- Picks representative sentences from the **top 3 clusters** by size.
- If there are fewer than 3, supplements with unused sentences from the pool.
- Reorders the selected sentences by their original position in the text to preserve natural reading flow.
- Concatenates them with `. ` separators, ensuring the summary ends with a period.
- Falls back to the old “first 3 sentences” summary if no clusters are available.

### 3.6 Cluster-Based Concept Builder

**New helper:** `buildConceptsFromClusters(sentencePool, clusters, _nounPhrases, _keywordPool)`

For each cluster:

1. Cleans and validates the cluster `label` using `cleanConceptLabel`.
2. Builds a description from the **representative sentence** plus a second sentence if available.
3. Strips leading conjunctions and truncates to ~300 characters on a sentence boundary.
4. Derives tags from `cluster.key_terms`, dropping those already contained in the label.
5. Scores importance based on cluster size and average sentence index (`sizeScore + rankScore + base`).
6. Computes difficulty and category via the heuristics above.

Returns up to 12 concepts, which are then deduplicated.

### 3.7 Integrating Cluster Mode into `buildPureNlpResult`

**Function signature extended:**

```1060:1066:educoach/supabase/functions/process-document/index.ts
function buildPureNlpResult(
    text: string,
    keywords: string[],
    importantSentences: string[],
    nounPhrases: NounPhrase[] = [],
    sentenceClusters: SentenceCluster[] = []
): GeminiResponse {
```

**Branch logic:**

- If `sentenceClusters.length >= 3`, use cluster‑based path:

```1090:1095:educoach/supabase/functions/process-document/index.ts
if (sentenceClusters.length >= 3) {
    const clusterConcepts = buildConceptsFromClusters(sentencePool, sentenceClusters, nounPhrases, keywordPool)
    const dedupedConcepts = deduplicateConcepts(clusterConcepts)
    const clusterSummary = buildSummaryFromClusters(sentencePool, sentenceClusters, sentencePool)
    return { summary: clusterSummary, concepts: dedupedConcepts }
}
```

- Otherwise, **fall back to the existing keyword‑based logic** unchanged:
  - The old `for (const phrase of keywordPool)` loop.
  - The sentence‑based fallback if fewer than 5 concepts.
  - Final `conceptMap` dedup by exact name.

**Call site updated**:

```290:295:educoach/supabase/functions/process-document/index.ts
const pureNlpResult = buildPureNlpResult(
    textContent, derivedKeywords, derivedImportantSentences,
    extractedNounPhrases, extractedClusters
)
```

This preserves the original behaviour when clustering is unavailable or weak, while enabling the new mode when the NLP service provides non‑empty clusters.

---

## 4. End-to-End Behaviour After Changes

With both the NLP service and Edge Function updated and redeployed:

- **NLP service**:
  - Extracts text with Tika.
  - Builds a high‑quality sentence pool via TextRank + stricter filtering.
  - Extracts KeyBERT keywords with reduced n‑gram noise and overlap deduplication.
  - Extracts noun phrases and clusters sentences into topics.
  - Returns `text`, `keywords`, `important_sentences`, `noun_phrases`, `sentence_clusters`.

- **Edge Function**:
  - Uses returned clusters to build **topic‑level concepts**.
  - Produces cleaner concept names (noun phrases and acronyms).
  - Generates multi‑sentence, trimmed descriptions.
  - Assigns difficulty and category heuristically.
  - Deduplicates near‑duplicate concepts using token overlap and containment logic.
  - Generates a summary from representative sentences of top clusters.
  - Falls back to the original keyword‑based path only when clustering data is missing or insufficient.

From the student’s perspective, this translates to:

- **Fewer but higher‑quality concepts** per document.
- **Titles that look like study topics**, not raw keyphrases.
- **Cleaner explanations** built from coherent sentences.
- **Better key terms** under each concept card.
- **More meaningful difficulty and category labels**, especially for ML/CS documents.

All changes are backward‑compatible with:

- The Phase 3 database schema.
- The Phase 3 React frontend (concept cards, summary, keyword highlighting).
- Phase 4 quiz generation and Phase 6 AI tutor RAG pipeline.

