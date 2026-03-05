"""
EduCoach NLP Microservice

Provides text extraction (via Apache Tika), sentence ranking (TextRank), 
and keyword extraction (KeyBERT) for the document processing pipeline.
"""

import os
import time
import re
import random
import requests
import spacy
import pytextrank
import numpy as np
import ftfy
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from keybert import KeyBERT
from sentence_transformers import SentenceTransformer
from threading import Lock
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances

# Initialize FastAPI app
app = FastAPI(
    title="EduCoach NLP Service",
    description="Text extraction, sentence ranking, and keyword extraction",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
TIKA_URL = os.getenv("TIKA_URL", "http://tika:9998")
MAX_ANALYSIS_CHARS = int(os.getenv("MAX_ANALYSIS_CHARS", "50000"))
KEYBERT_INPUT_MAX_CHARS = int(os.getenv("KEYBERT_INPUT_MAX_CHARS", "15000"))
TEXTRANK_TOP_N = int(os.getenv("TEXTRANK_TOP_N", "10"))
KEYBERT_TOP_N = int(os.getenv("KEYBERT_TOP_N", "15"))
KEYBERT_NR_CANDIDATES = int(os.getenv("KEYBERT_NR_CANDIDATES", "30"))
KEYBERT_USE_MAXSUM = os.getenv("KEYBERT_USE_MAXSUM", "true").lower() == "true"

SENTENCE_POOL_MAX = int(os.getenv("SENTENCE_POOL_MAX", "30"))
CLUSTER_DISTANCE_THRESHOLD = float(os.getenv("CLUSTER_DISTANCE_THRESHOLD", "0.65"))
CLUSTER_MIN_CONCEPTS = int(os.getenv("CLUSTER_MIN_CONCEPTS", "3"))
CLUSTER_MAX_CONCEPTS = int(os.getenv("CLUSTER_MAX_CONCEPTS", "12"))
CLUSTERING_LOG_LEVEL = os.getenv("CLUSTERING_LOG_LEVEL", "info")

PROCESS_LOCK = Lock()

# Load spaCy model with TextRank
nlp = spacy.load("en_core_web_sm")
nlp.add_pipe("textrank")

# Load sentence-transformer model (shared with KeyBERT to save memory)
st_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
kw_model = KeyBERT(model=st_model)

# ============================================
# Text Cleaning / Filtering Helpers
# ============================================

_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
_SLIDE_RE = re.compile(r"\b(slide|page)\s*\d+\b", re.IGNORECASE)
_MULTISPACE_RE = re.compile(r"\s+")
_NON_LETTER_RE = re.compile(r"[^a-zA-Z]+")

_STRAY_ACCENT_RE = re.compile(r"\xe2[\x80-\xbf]*")
_LEFTOVER_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")

def _repair_encoding(text: str) -> str:
    """
    Multi-layer encoding repair using ftfy + latin1 round-trip.
    """
    text = ftfy.fix_text(text, normalization="NFC")

    if "\u00e2" in text or "\u00c3" in text:
        try:
            repaired = text.encode("latin-1", errors="ignore").decode("utf-8", errors="ignore")
            if repaired and len(repaired) > len(text) * 0.5:
                text = repaired
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

    text = _STRAY_ACCENT_RE.sub(" ", text)
    text = _LEFTOVER_CONTROL_RE.sub("", text)
    text = re.sub(r"  +", " ", text)
    return text


def _is_noise_line(line: str) -> bool:
    if not line:
        return True

    l = line.strip()
    if not l:
        return True

    # Lines that are basically URLs / slide markers / navigation junk.
    if _URL_RE.search(l) and len(_NON_LETTER_RE.sub("", l)) < 8:
        return True
    if _SLIDE_RE.fullmatch(l.strip().lower()):
        return True

    # Heuristic: if the line is very short and mostly non-letters, it is likely noise.
    letters = len(_NON_LETTER_RE.sub("", l))
    if len(l) <= 12 and letters <= 3:
        return True

    return False

def _merge_short_lines(lines: List[str], min_len: int = 60) -> List[str]:
    """Merge consecutive short lines (common in PDF slides) into coherent sentences."""
    merged = []
    buffer = ""
    for ln in lines:
        if len(ln) < min_len and not ln.endswith((".", "!", "?", ":")):
            buffer = (buffer + " " + ln).strip() if buffer else ln
        else:
            if buffer:
                combined = (buffer + " " + ln).strip()
                merged.append(combined)
                buffer = ""
            else:
                merged.append(ln)
    if buffer:
        merged.append(buffer)
    return merged


def clean_extracted_text(text: str) -> str:
    """
    Make Tika output more study-friendly:
    - remove URLs and obvious slide/page markers
    - reduce PDF mojibake artifacts
    - merge short lines from PDF slides
    - collapse whitespace while keeping sentence boundaries mostly intact
    """
    if not text:
        return ""

    text = _repair_encoding(text)

    # Work line-by-line to drop obvious junk early.
    lines = [ln.strip() for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    kept = []
    seen = set()

    for ln in lines:
        if _is_noise_line(ln):
            continue

        ln = _URL_RE.sub("", ln)
        ln = _SLIDE_RE.sub("", ln)
        ln = ln.strip(" -\t")
        ln = _MULTISPACE_RE.sub(" ", ln).strip()

        if not ln:
            continue

        key = ln.lower()
        if key in seen:
            continue
        seen.add(key)
        kept.append(ln)

    # Merge consecutive short fragments from PDF slides into coherent sentences
    kept = _merge_short_lines(kept, min_len=60)

    cleaned = " ".join(kept)
    cleaned = _MULTISPACE_RE.sub(" ", cleaned).strip()
    return cleaned

_CONJUNCTION_PREPS = frozenset([
    "and", "or", "but", "nor", "for", "yet", "so",
    "of", "in", "to", "with", "on", "at", "by", "from", "as", "into",
    "through", "during", "before", "after", "between", "about",
])

_CONSECUTIVE_CAPS_RE = re.compile(r"(?:\b[A-Z][a-z]*\s+){5,}")

def is_good_sentence(sentence: str) -> bool:
    s = sentence.strip()
    if len(s) < 40 or len(s) > 400:
        return False

    words = s.split()
    if len(words) < 8:
        return False

    if _URL_RE.search(s):
        return False
    if "slide" in s.lower() and re.search(r"\bslide\s*\d+\b", s.lower()):
        return False

    letters = len(_NON_LETTER_RE.sub("", s))
    if letters / max(1, len(s)) < 0.45:
        return False

    # Reject mashed slide titles (>4 consecutive capitalized words mid-sentence)
    if _CONSECUTIVE_CAPS_RE.search(s[1:]):
        return False

    # Reject if conjunction/preposition ratio is too high (fragmented PDF join)
    conj_count = sum(1 for w in words if w.lower() in _CONJUNCTION_PREPS)
    if len(words) > 0 and conj_count / len(words) > 0.30:
        return False

    return True

_GENERIC_STOPWORDS = frozenset([
    "thing", "things", "stuff", "way", "ways", "lot", "lots", "bit", "type",
    "types", "kind", "kinds", "number", "numbers", "part", "parts", "point",
    "points", "area", "areas", "case", "cases", "fact", "facts", "datum",
    "data", "result", "results", "work", "works", "time", "times", "end",
    "place", "form", "value", "values", "set", "sets", "group", "groups",
    "order", "side", "level", "line", "lines", "change", "changes", "use",
    "uses", "need", "needs", "something", "anything", "everything",
    "example", "examples", "instance", "figure", "table", "section",
    "chapter", "slide", "page", "unit", "module", "lecture", "review",
    "overview", "introduction", "conclusion", "summary", "note", "notes",
    "step", "steps", "item", "items", "list", "issue", "issues",
    "you", "your", "we", "our", "they", "their", "one", "ones",
    "portion", "portions", "function", "method", "approach", "process",
    "state", "states", "problem", "question", "answer", "idea", "idea",
    "information", "understanding", "learning", "term", "terms",
])

def filter_keywords(phrases: list) -> list:
    filtered = []
    seen = set()
    for p in phrases:
        phrase = (p or "").strip()
        if not phrase:
            continue
        low = phrase.lower()
        if low in seen:
            continue
        if _URL_RE.search(low) or "http" in low or "www" in low:
            continue
        if _SLIDE_RE.search(low) or low in ("slide", "page"):
            continue
        if len(phrase) < 3:
            continue
        # Reject single-word generic terms
        words = low.split()
        if len(words) == 1 and low in _GENERIC_STOPWORDS:
            continue
        # Reject if ALL tokens are stopwords
        if all(w in _GENERIC_STOPWORDS or w in _CONJUNCTION_PREPS for w in words):
            continue
        # Reject very short single words that aren't acronyms
        if len(words) == 1 and len(phrase) <= 3 and not phrase.isupper():
            continue
        seen.add(low)
        filtered.append(phrase)
    return filtered

# ============================================
# Noun Phrase Extraction & Sentence Clustering
# ============================================

def extract_noun_phrases(doc) -> List[dict]:
    """Extract and rank noun phrases from a spaCy Doc using noun_chunks."""
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


def dedup_keywords(keywords_with_scores: List[tuple]) -> List[tuple]:
    """Remove keywords that share >70% of tokens with a higher-scored keyword."""
    accepted: List[tuple] = []
    for phrase, score in keywords_with_scores:
        tokens = set(phrase.lower().split())
        is_dup = False
        for kept_phrase, _ in accepted:
            kept_tokens = set(kept_phrase.lower().split())
            overlap = len(tokens & kept_tokens)
            union_size = len(tokens | kept_tokens)
            if union_size > 0 and overlap / union_size > 0.7:
                is_dup = True
                break
        if not is_dup:
            accepted.append((phrase, score))
    return accepted


def _extract_key_terms_from_sentences(sentences: List[str], max_terms: int = 5) -> List[str]:
    """Extract meaningful multi-word or technical terms from cluster sentences."""
    phrase_counts: Dict[str, int] = {}
    for sent in sentences:
        doc = nlp(sent[:5000])
        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip()
            if chunk.root.pos_ == "PRON":
                continue
            low = phrase.lower()
            # Prefer multi-word phrases; single words must not be generic
            words = low.split()
            if len(words) == 1 and (low in _GENERIC_STOPWORDS or low in _CONJUNCTION_PREPS or len(low) <= 3):
                continue
            if len(low) < 4:
                continue
            phrase_counts[low] = phrase_counts.get(low, 0) + 1

    ranked = sorted(phrase_counts.items(), key=lambda x: (len(x[0].split()) > 1, x[1]), reverse=True)
    seen_roots: set = set()
    result: List[str] = []
    for term, _ in ranked:
        root = term.split()[-1]
        if root in seen_roots:
            continue
        seen_roots.add(root)
        result.append(term)
        if len(result) >= max_terms:
            break
    return result


def _extract_cluster_label(cluster_text: str) -> str:
    """
    Use KeyBERT on the concatenated cluster text to find the single best
    keyphrase that represents the cluster topic. Falls back to spaCy noun
    chunks if KeyBERT returns nothing useful.
    """
    text = cluster_text[:8000]
    try:
        kws = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            top_n=5,
            use_maxsum=True,
            nr_candidates=15,
        )
        for phrase, score in kws:
            if score < 0.15:
                continue
            words = phrase.split()
            # Skip single generic words
            if len(words) == 1 and phrase.lower() in _GENERIC_STOPWORDS:
                continue
            if all(w.lower() in _GENERIC_STOPWORDS or w.lower() in _CONJUNCTION_PREPS for w in words):
                continue
            return phrase.title()
    except Exception:
        pass

    # Fallback: most frequent multi-word noun chunk
    doc = nlp(text[:5000])
    counts: Dict[str, int] = {}
    for chunk in doc.noun_chunks:
        if chunk.root.pos_ == "PRON":
            continue
        t = chunk.text.strip()
        if len(t.split()) >= 2 and len(t) > 5:
            low = t.lower()
            if low not in _GENERIC_STOPWORDS:
                counts[low] = counts.get(low, 0) + 1
    if counts:
        best = max(counts, key=counts.get)
        return best.title()
    return ""


def _do_cluster(sentences: List[str], embeddings: np.ndarray, dist_matrix: np.ndarray,
                threshold: float, max_concepts: int) -> List[dict]:
    """Run agglomerative clustering on semantic embeddings and build cluster objects."""
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=threshold,
        metric="precomputed",
        linkage="average",
    )
    labels = clustering.fit_predict(dist_matrix)

    buckets: Dict[int, List[int]] = {}
    for idx, label in enumerate(labels):
        buckets.setdefault(label, []).append(idx)

    result = []
    for _cluster_label, indices in buckets.items():
        cluster_embeddings = embeddings[indices]
        centroid = cluster_embeddings.mean(axis=0, keepdims=True)

        dists_to_centroid = cosine_distances(centroid, cluster_embeddings)[0]
        rep_idx = indices[int(dists_to_centroid.argmin())]

        if len(indices) > 1:
            pairwise = 1.0 - dist_matrix[np.ix_(indices, indices)]
            n = len(indices)
            coherence = float((pairwise.sum() - n) / max(1, n * (n - 1)))
        else:
            coherence = 1.0

        cluster_sents = [sentences[i] for i in indices]
        key_terms = _extract_key_terms_from_sentences(cluster_sents, max_terms=5)

        cluster_text = " ".join(cluster_sents)
        best_label = _extract_cluster_label(cluster_text)

        result.append({
            "label": best_label,
            "sentence_indices": indices,
            "key_terms": key_terms,
            "representative_index": rep_idx,
            "coherence_score": round(coherence, 3),
        })

    result.sort(key=lambda c: len(c["sentence_indices"]), reverse=True)
    return result[:max_concepts]


def cluster_sentences(sentences: List[str]) -> List[dict]:
    """Cluster the filtered sentence pool into topic groups using semantic embeddings."""
    if len(sentences) < 3:
        return []

    try:
        embeddings = st_model.encode(sentences)
        dist_matrix = cosine_distances(embeddings)

        sem_threshold = min(CLUSTER_DISTANCE_THRESHOLD, 0.45)

        clusters = _do_cluster(sentences, embeddings, dist_matrix,
                               sem_threshold, CLUSTER_MAX_CONCEPTS)

        if len(clusters) < CLUSTER_MIN_CONCEPTS and sem_threshold > 0.2:
            retry_threshold = sem_threshold - 0.12
            retry = _do_cluster(sentences, embeddings, dist_matrix,
                                retry_threshold, CLUSTER_MAX_CONCEPTS)
            if len(retry) > len(clusters):
                clusters = retry

        return clusters
    except Exception as e:
        print(f"[nlp-service] clustering failed gracefully: {e}", flush=True)
        return []


# ============================================
# MMR Extractive Summarization
# ============================================

def extract_summary_mmr(
    sentences: List[str],
    embeddings: np.ndarray,
    top_n: int = 5,
    lambda_param: float = 0.6,
) -> List[dict]:
    """
    Maximal Marginal Relevance: pick sentences that are relevant to the
    document as a whole but diverse from each other.
    Returns [{text, index, relevance_score}] ordered by original position.
    """
    if len(sentences) == 0:
        return []
    if len(sentences) <= top_n:
        return [{"text": s, "index": i, "relevance_score": 1.0}
                for i, s in enumerate(sentences)]

    doc_centroid = embeddings.mean(axis=0, keepdims=True)
    relevance = (1.0 - cosine_distances(doc_centroid, embeddings))[0]

    selected_indices: List[int] = []
    selected_embeddings: List[np.ndarray] = []

    for _ in range(top_n):
        best_score = -1e9
        best_idx = -1

        for i in range(len(sentences)):
            if i in selected_indices:
                continue

            rel = float(relevance[i])

            if selected_embeddings:
                sel_matrix = np.array(selected_embeddings)
                sims = 1.0 - cosine_distances(embeddings[i:i+1], sel_matrix)[0]
                redundancy = float(sims.max())
            else:
                redundancy = 0.0

            score = lambda_param * rel - (1 - lambda_param) * redundancy
            if score > best_score:
                best_score = score
                best_idx = i

        if best_idx < 0:
            break

        selected_indices.append(best_idx)
        selected_embeddings.append(embeddings[best_idx])

    # Return ordered by original document position for natural reading
    results = []
    for idx in sorted(selected_indices):
        results.append({
            "text": sentences[idx],
            "index": idx,
            "relevance_score": round(float(relevance[idx]), 3),
        })
    return results


# ============================================
# Request/Response Models
# ============================================

class TextInput(BaseModel):
    text: str
    top_n: Optional[int] = 5

class ExtractResponse(BaseModel):
    success: bool
    text: str
    char_count: int
    error: Optional[str] = None

class TextRankResponse(BaseModel):
    success: bool
    sentences: List[dict]  # [{text, rank, index}]
    error: Optional[str] = None

class KeywordResponse(BaseModel):
    success: bool
    keywords: List[dict]  # [{keyword, score}]
    error: Optional[str] = None

class ProcessResponse(BaseModel):
    success: bool
    text: str
    keywords: List[str]
    important_sentences: List[str]
    char_count: int
    noun_phrases: Optional[List[dict]] = None
    sentence_clusters: Optional[List[dict]] = None
    summary_sentences: Optional[List[dict]] = None
    cluster_quality: Optional[float] = None
    error: Optional[str] = None

# ============================================
# Health Check
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker"""
    return {"status": "healthy", "service": "nlp-service"}

# ============================================
# Text Extraction (via Tika)
# ============================================

@app.post("/extract", response_model=ExtractResponse)
def extract_text(file: UploadFile = File(...)):
    """
    Extract plain text from a document using Apache Tika.
    Supports PDF, DOCX, PPTX, TXT, and more.
    """
    try:
        # Read file content
        content = file.file.read()
        
        # Send to Tika
        response = requests.put(
            f"{TIKA_URL}/tika",
            data=content,
            headers={
                "Accept": "text/plain",
                "Content-Type": file.content_type or "application/octet-stream"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Tika extraction failed: {response.status_code}"
            )
        
        raw = response.text.strip()
        text = clean_extracted_text(raw)
        
        return ExtractResponse(
            success=True,
            text=text,
            char_count=len(text)
        )
        
    except requests.exceptions.RequestException as e:
        return ExtractResponse(
            success=False,
            text="",
            char_count=0,
            error=f"Tika connection error: {str(e)}"
        )
    except Exception as e:
        return ExtractResponse(
            success=False,
            text="",
            char_count=0,
            error=str(e)
        )

# ============================================
# TextRank Sentence Ranking
# ============================================

@app.post("/textrank", response_model=TextRankResponse)
def rank_sentences(input: TextInput):
    """
    Rank sentences by importance using TextRank algorithm.
    Returns top N most important sentences.
    """
    try:
        doc = nlp(input.text)
        
        # Get ranked sentences
        sentences = []
        for sent in doc._.textrank.summary(limit_sentences=input.top_n):
            sentences.append({
                "text": str(sent).strip(),
                "rank": float(sent._.textrank.rank) if hasattr(sent._, 'textrank') else 0.0,
                "index": list(doc.sents).index(sent) if sent in doc.sents else -1
            })
        
        return TextRankResponse(
            success=True,
            sentences=sentences
        )
        
    except Exception as e:
        return TextRankResponse(
            success=False,
            sentences=[],
            error=str(e)
        )

# ============================================
# KeyBERT Keyword Extraction
# ============================================

@app.post("/keywords", response_model=KeywordResponse)
def extract_keywords(input: TextInput):
    """
    Extract key phrases using KeyBERT (BERT-based semantic similarity).
    """
    try:
        # Extract keywords with KeyBERT (truncate to keep runtime predictable)
        text = input.text or ""
        if len(text) > KEYBERT_INPUT_MAX_CHARS:
            text = text[:KEYBERT_INPUT_MAX_CHARS]

        raw_kws = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 2),
            stop_words="english",
            top_n=input.top_n,
            use_maxsum=KEYBERT_USE_MAXSUM,
            nr_candidates=min(50, max(10, KEYBERT_NR_CANDIDATES))
        )
        deduped = dedup_keywords(raw_kws)
        
        result = []
        for phrase, score in deduped:
            if phrase in filter_keywords([phrase]):
                result.append({"keyword": phrase, "score": float(score)})
        
        return KeywordResponse(
            success=True,
            keywords=result
        )
        
    except Exception as e:
        return KeywordResponse(
            success=False,
            keywords=[],
            error=str(e)
        )

# ============================================
# Full Processing Pipeline
# ============================================

@app.post("/process", response_model=ProcessResponse)
def process_document(file: UploadFile = File(...)):
    """
    Full document processing pipeline:
    1. Extract text with Tika
    2. Rank sentences with TextRank
    3. Extract keywords with KeyBERT
    
    This is the main endpoint called by the Edge Function.
    """
    try:
        start = time.time()
        # Avoid multiple concurrent heavy jobs on small droplets.
        PROCESS_LOCK.acquire()
        acquired = True

        # Step 1: Extract text with Tika
        content = file.file.read()
        print(f"[nlp-service] /process start filename={file.filename} type={file.content_type} size_bytes={len(content)}", flush=True)
        
        response = requests.put(
            f"{TIKA_URL}/tika",
            data=content,
            headers={
                "Accept": "text/plain",
                "Content-Type": file.content_type or "application/octet-stream"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            return ProcessResponse(
                success=False,
                text="",
                keywords=[],
                important_sentences=[],
                char_count=0,
                error=f"Tika extraction failed: {response.status_code}"
            )
        
        raw_text = response.text.strip()
        text = clean_extracted_text(raw_text)
        print(
            f"[nlp-service] tika done seconds={(time.time() - start):.2f} "
            f"text_chars={len(text)} raw_chars={len(raw_text)}",
            flush=True
        )
        
        if not text or len(text) < 50:
            return ProcessResponse(
                success=False,
                text="",
                keywords=[],
                important_sentences=[],
                char_count=0,
                error="Document appears to be empty or unreadable"
            )
        
        analysis_text = text
        if len(analysis_text) > MAX_ANALYSIS_CHARS:
            analysis_text = analysis_text[:MAX_ANALYSIS_CHARS]
            print(f"[nlp-service] analysis truncated to {len(analysis_text)} chars (MAX_ANALYSIS_CHARS={MAX_ANALYSIS_CHARS})", flush=True)

        # Step 2: TextRank - Get important sentences (run on analysis_text, not full text)
        textrank_start = time.time()
        doc = nlp(analysis_text)
        important_sentences = []
        
        pool_target = max(TEXTRANK_TOP_N, SENTENCE_POOL_MAX)
        candidates = [str(sent).strip() for sent in doc._.textrank.summary(limit_sentences=min(60, pool_target * 3))]
        seen_sent = set()
        for s in candidates:
            if not is_good_sentence(s):
                continue
            key = s.lower()
            if key in seen_sent:
                continue
            seen_sent.add(key)
            important_sentences.append(s)
            if len(important_sentences) >= pool_target:
                break
        print(f"[nlp-service] textrank done seconds={(time.time() - textrank_start):.2f} sentences={len(important_sentences)}", flush=True)
        
        # Step 3: KeyBERT - Extract keywords
        keybert_source = " ".join(important_sentences) if important_sentences else analysis_text
        if len(keybert_source) > KEYBERT_INPUT_MAX_CHARS:
            keybert_source = keybert_source[:KEYBERT_INPUT_MAX_CHARS]

        keybert_start = time.time()
        keywords_raw = kw_model.extract_keywords(
            keybert_source,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            top_n=KEYBERT_TOP_N + 10,
            use_maxsum=KEYBERT_USE_MAXSUM,
            nr_candidates=min(50, max(10, KEYBERT_NR_CANDIDATES))
        )
        # Drop low-relevance keywords before dedup
        keywords_raw = [(kw, sc) for kw, sc in keywords_raw if sc >= 0.15]
        keywords_deduped = dedup_keywords(keywords_raw)
        keywords = filter_keywords([kw[0] for kw in keywords_deduped])[:KEYBERT_TOP_N]
        print(f"[nlp-service] keybert done seconds={(time.time() - keybert_start):.2f} keywords={len(keywords)}", flush=True)

        # Step 4: Noun phrases (reuse spaCy doc from step 2)
        np_start = time.time()
        noun_phrases = extract_noun_phrases(doc)
        print(f"[nlp-service] noun_phrases done seconds={(time.time() - np_start):.2f} count={len(noun_phrases)}", flush=True)

        # Step 5: Sentence clustering (only on filtered pool, capped at SENTENCE_POOL_MAX)
        pool_for_clustering = important_sentences[:SENTENCE_POOL_MAX]
        cluster_start = time.time()
        sentence_clusters = cluster_sentences(pool_for_clustering)
        print(f"[nlp-service] clustering done seconds={(time.time() - cluster_start):.2f} clusters={len(sentence_clusters)}", flush=True)

        # Step 6: MMR extractive summary using sentence embeddings
        mmr_start = time.time()
        summary_sentences = []
        cluster_quality = None
        try:
            pool_embeddings = st_model.encode(pool_for_clustering)
            summary_sentences = extract_summary_mmr(pool_for_clustering, pool_embeddings, top_n=5, lambda_param=0.6)

            # Compute average cluster coherence as quality signal
            coherence_scores = [c.get("coherence_score", 0) for c in sentence_clusters if "coherence_score" in c]
            if coherence_scores:
                cluster_quality = round(sum(coherence_scores) / len(coherence_scores), 3)
        except Exception as e:
            print(f"[nlp-service] MMR/quality failed gracefully: {e}", flush=True)
        print(f"[nlp-service] mmr done seconds={(time.time() - mmr_start):.2f} summary_sentences={len(summary_sentences)}", flush=True)

        if CLUSTERING_LOG_LEVEL in ("info", "debug"):
            print(
                f"[nlp-service] clustering: pool_size={len(important_sentences)} "
                f"cluster_count={len(sentence_clusters)} "
                f"cluster_sizes={[len(c['sentence_indices']) for c in sentence_clusters]} "
                f"noun_phrase_count={len(noun_phrases)} "
                f"distance_threshold={CLUSTER_DISTANCE_THRESHOLD} "
                f"cluster_quality={cluster_quality}",
                flush=True
            )

        print(f"[nlp-service] /process done total_seconds={(time.time() - start):.2f}", flush=True)
        
        return ProcessResponse(
            success=True,
            text=text,
            keywords=keywords,
            important_sentences=important_sentences,
            char_count=len(text),
            noun_phrases=noun_phrases,
            sentence_clusters=sentence_clusters,
            summary_sentences=summary_sentences,
            cluster_quality=cluster_quality,
        )
        
    except requests.exceptions.RequestException as e:
        return ProcessResponse(
            success=False,
            text="",
            keywords=[],
            important_sentences=[],
            char_count=0,
            error=f"Tika connection error: {str(e)}"
        )
    except Exception as e:
        return ProcessResponse(
            success=False,
            text="",
            keywords=[],
            important_sentences=[],
            char_count=0,
            error=str(e)
        )
    finally:
        try:
            if 'acquired' in locals() and acquired:
                PROCESS_LOCK.release()
        except Exception:
            pass


# ============================================
# Automatic Question Generation (AQG)
# Template-driven, grounded in source text.
# Per Obj3 sections 6-8.
# ============================================

AQG_LOCK = Lock()
_AMBIGUOUS_QUALIFIERS = re.compile(
    r"\b(sometimes|often|usually|may|might|could|perhaps|occasionally|rarely|"
    r"probably|generally|typically|possibly|approximately|almost|nearly)\b",
    re.IGNORECASE,
)

class ChunkInput(BaseModel):
    chunk_id: str
    text: str
    keyphrases: List[str] = []
    important_sentences: List[str] = []

class GenerateQuestionsInput(BaseModel):
    chunks: List[ChunkInput]
    all_keyphrases: List[str] = []
    question_types: List[str] = ["identification", "true_false", "multiple_choice", "fill_in_blank"]
    max_questions_per_chunk: int = 3
    max_total_questions: int = 15

class GeneratedQuestion(BaseModel):
    chunk_id: str
    question_type: str
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    difficulty_label: str = "intermediate"

class GenerateQuestionsResponse(BaseModel):
    success: bool
    questions: List[GeneratedQuestion] = []
    stats: Optional[dict] = None
    error: Optional[str] = None


def _get_sentences(text: str) -> List:
    """Parse text with spaCy and return sentence spans."""
    doc = nlp(text[:MAX_ANALYSIS_CHARS])
    return list(doc.sents)


def _find_keyphrase_in_sentence(sentence_text: str, keyphrases: List[str]) -> Optional[str]:
    """Return the first keyphrase found inside the sentence (case-insensitive)."""
    lower = sentence_text.lower()
    for kp in keyphrases:
        if kp.lower() in lower:
            return kp
    return None


def _pick_distractors(correct: str, chunk_keyphrases: List[str],
                      all_keyphrases: List[str], count: int = 3) -> List[str]:
    """
    Build MCQ distractors per Obj3 section 7:
    - Primary: other keyphrases from the same chunk
    - Fallback: keyphrases from the full document pool
    - Filters: unique, not the correct answer, similar length
    """
    correct_lower = correct.lower().strip()
    correct_len = len(correct)
    candidates = []
    seen = {correct_lower}

    def _try_add(phrase: str):
        p = phrase.strip()
        low = p.lower()
        if low in seen or not p:
            return
        if len(p) < 2:
            return
        seen.add(low)
        candidates.append(p)

    for kp in chunk_keyphrases:
        _try_add(kp)
    for kp in all_keyphrases:
        _try_add(kp)
        if len(candidates) >= count * 3:
            break

    # Rank by similarity in length to the correct answer 
    candidates.sort(key=lambda c: abs(len(c) - correct_len))
    return candidates[:count]


def _generate_identification(sentence_text: str, keyphrase: str,
                             chunk_id: str) -> Optional[GeneratedQuestion]:
    """Template: 'What is [keyphrase]?' / 'Define [keyphrase].'"""
    answer = sentence_text.strip()
    if len(answer) < 20:
        return None
    templates = [
        f"What is {keyphrase}?",
        f"Define {keyphrase}.",
        f"Explain {keyphrase}.",
    ]
    q_text = random.choice(templates)
    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="identification",
        question_text=q_text,
        correct_answer=answer,
        difficulty_label="intermediate",
    )


def _generate_true_false(sentence_text: str, chunk_id: str) -> Optional[GeneratedQuestion]:
    """
    Present a key sentence as True, or negate it for False.
    Reject ambiguous sentences (Obj3 section 8).
    """
    if _AMBIGUOUS_QUALIFIERS.search(sentence_text):
        return None

    make_false = random.random() < 0.5

    if not make_false:
        return GeneratedQuestion(
            chunk_id=chunk_id,
            question_type="true_false",
            question_text=sentence_text.strip(),
            correct_answer="true",
            difficulty_label="beginner",
        )

    # Negate by inserting "not" after the main verb using spaCy
    doc = nlp(sentence_text)
    negated = None
    for token in doc:
        if token.pos_ in ("AUX", "VERB") and token.dep_ in ("ROOT", "aux"):
            before = sentence_text[:token.idx + len(token.text)]
            after = sentence_text[token.idx + len(token.text):]
            negated = f"{before} not{after}"
            break

    if not negated:
        return None

    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="true_false",
        question_text=negated.strip(),
        correct_answer="false",
        difficulty_label="beginner",
    )


def _generate_mcq(sentence_text: str, keyphrase: str, chunk_keyphrases: List[str],
                   all_keyphrases: List[str], chunk_id: str) -> Optional[GeneratedQuestion]:
    """
    Blank the keyphrase in the sentence to form the stem, use other keyphrases
    as distractors (Obj3 section 7).
    """
    pattern = re.compile(re.escape(keyphrase), re.IGNORECASE)
    if not pattern.search(sentence_text):
        return None

    stem = pattern.sub("__________", sentence_text, count=1).strip()
    distractors = _pick_distractors(keyphrase, chunk_keyphrases, all_keyphrases, count=3)
    if len(distractors) < 2:
        return None

    options = distractors[:3] + [keyphrase]
    random.shuffle(options)

    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="multiple_choice",
        question_text=stem,
        options=options,
        correct_answer=keyphrase,
        difficulty_label="intermediate",
    )


def _generate_fill_in_blank(sentence_text: str, keyphrase: str,
                            chunk_id: str) -> Optional[GeneratedQuestion]:
    """Remove a keyphrase from the sentence to create a blank."""
    pattern = re.compile(re.escape(keyphrase), re.IGNORECASE)
    if not pattern.search(sentence_text):
        return None

    blanked = pattern.sub("__________", sentence_text, count=1).strip()
    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="fill_in_blank",
        question_text=blanked,
        correct_answer=keyphrase,
        difficulty_label="intermediate",
    )


def _deduplicate_questions(questions: List[GeneratedQuestion]) -> List[GeneratedQuestion]:
    """Remove near-duplicate questions based on normalized question text."""
    seen = set()
    result = []
    for q in questions:
        key = re.sub(r"[^a-z0-9 ]", "", q.question_text.lower()).strip()
        if key in seen:
            continue
        seen.add(key)
        result.append(q)
    return result


@app.post("/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(input: GenerateQuestionsInput):
    """
    Template-driven Automatic Question Generation (AQG).
    Generates grounded questions from chunk text using spaCy NLP.
    This is the core of Obj3 -- no free LLM generation.
    """
    try:
        start = time.time()
        AQG_LOCK.acquire()
        acquired = True

        print(f"[nlp-service] /generate-questions start chunks={len(input.chunks)} "
              f"types={input.question_types} max_total={input.max_total_questions}", flush=True)

        all_questions: List[GeneratedQuestion] = []
        type_set = set(input.question_types)

        for chunk in input.chunks:
            if len(all_questions) >= input.max_total_questions:
                break

            chunk_questions: List[GeneratedQuestion] = []
            text = chunk.text.strip()
            if len(text) < 50:
                continue

            # Get sentences via spaCy
            sentences = _get_sentences(text)
            good_sentences = [
                str(s).strip() for s in sentences if is_good_sentence(str(s))
            ]

            # Resolve keyphrases: use provided ones, or re-extract with KeyBERT
            keyphrases = filter_keywords(chunk.keyphrases) if chunk.keyphrases else []
            if not keyphrases:
                try:
                    kw_text = text[:KEYBERT_INPUT_MAX_CHARS]
                    raw = kw_model.extract_keywords(
                        kw_text,
                        keyphrase_ngram_range=(1, 3),
                        stop_words="english",
                        top_n=8,
                        use_maxsum=True,
                        nr_candidates=20,
                    )
                    keyphrases = filter_keywords([k[0] for k in raw])
                except Exception:
                    keyphrases = []

            # Resolve important sentences: use provided or derive from good_sentences
            imp_sentences = chunk.important_sentences if chunk.important_sentences else good_sentences[:5]

            # --- Generate each question type ---

            for sent in imp_sentences:
                if len(chunk_questions) >= input.max_questions_per_chunk:
                    break

                kp = _find_keyphrase_in_sentence(sent, keyphrases)

                # Identification
                if "identification" in type_set and kp and len(chunk_questions) < input.max_questions_per_chunk:
                    q = _generate_identification(sent, kp, chunk.chunk_id)
                    if q:
                        chunk_questions.append(q)

                # True/False
                if "true_false" in type_set and len(chunk_questions) < input.max_questions_per_chunk:
                    q = _generate_true_false(sent, chunk.chunk_id)
                    if q:
                        chunk_questions.append(q)

                # MCQ
                if "multiple_choice" in type_set and kp and len(chunk_questions) < input.max_questions_per_chunk:
                    q = _generate_mcq(sent, kp, keyphrases, input.all_keyphrases, chunk.chunk_id)
                    if q:
                        chunk_questions.append(q)

                # Fill-in-the-Blank
                if "fill_in_blank" in type_set and kp and len(chunk_questions) < input.max_questions_per_chunk:
                    q = _generate_fill_in_blank(sent, kp, chunk.chunk_id)
                    if q:
                        chunk_questions.append(q)

            all_questions.extend(chunk_questions)

        # Validation: dedup, cap at max_total_questions
        all_questions = _deduplicate_questions(all_questions)
        if len(all_questions) > input.max_total_questions:
            random.shuffle(all_questions)
            all_questions = all_questions[:input.max_total_questions]

        # Compute stats
        by_type: dict = {}
        for q in all_questions:
            by_type[q.question_type] = by_type.get(q.question_type, 0) + 1

        elapsed = time.time() - start
        print(f"[nlp-service] /generate-questions done seconds={elapsed:.2f} "
              f"total={len(all_questions)} by_type={by_type}", flush=True)

        return GenerateQuestionsResponse(
            success=True,
            questions=all_questions,
            stats={"total": len(all_questions), "by_type": by_type},
        )

    except Exception as e:
        print(f"[nlp-service] /generate-questions error: {e}", flush=True)
        return GenerateQuestionsResponse(
            success=False,
            questions=[],
            error=str(e),
        )
    finally:
        try:
            if 'acquired' in locals() and acquired:
                AQG_LOCK.release()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    from logging_config import LOGGING_CONFIG
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        log_config=LOGGING_CONFIG
    )
