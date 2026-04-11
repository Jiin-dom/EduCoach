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
from bs4 import BeautifulSoup

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
_ARROW_RE = re.compile(r'[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f\u25b6\u25ba\u279c-\u279e]')
_LEADING_ARTICLE_RE = re.compile(r'^(the|a|an)\s+', re.IGNORECASE)
_PPTX_CONTENT_TYPES = frozenset([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
])

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


def _is_numeric_heavy(text: str) -> bool:
    """True when >40% of non-space characters are digits or decimal points."""
    stripped = re.sub(r'\s', '', text)
    if not stripped:
        return True
    digit_dots = sum(1 for c in stripped if c.isdigit() or c == '.')
    return digit_dots / len(stripped) > 0.4


_CODE_LIKE_RE = re.compile(
    r'\b(import\s+\w|from\s+\w+\.\w+\s+import|def\s+\w+\(|class\s+\w+[(:])' 
    r'|Sequential|Dense|model\.\w+|\.fit\(|\.predict\(|\.compile\(',
    re.IGNORECASE,
)

def _is_code_like(text: str) -> bool:
    """True when text looks like a code snippet rather than prose."""
    if _CODE_LIKE_RE.search(text):
        return True
    special = sum(1 for c in text if c in '{};=')
    return special >= 3


def _strip_arrows(text: str) -> str:
    """Remove arrow characters and normalize surrounding whitespace."""
    result = _ARROW_RE.sub(' ', text)
    return _MULTISPACE_RE.sub(' ', result).strip()


def _extract_slides_from_html(html_content: str) -> List[dict]:
    """
    Parse Tika's XHTML output to extract slide boundaries and content.
    Works for PPTX (div.slide-content) and PDF pages (div.page).
    """
    try:
        soup = BeautifulSoup(html_content, 'lxml')
    except Exception:
        return []

    slides: List[dict] = []

    # PPTX: Tika wraps each slide in <div class="slide-content">
    slide_divs = soup.find_all('div', class_='slide-content')

    if not slide_divs:
        # PDF: Tika wraps each page in <div class="page">
        slide_divs = soup.find_all('div', class_='page')

    if not slide_divs:
        return []

    for i, div in enumerate(slide_divs):
        # Skip master-slide content (PPTX template headers/footers)
        if 'slide-master-content' in (div.get('class') or []):
            continue

        paragraphs: List[str] = []
        for el in div.find_all(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            # Skip master-slide child elements
            parent_classes = ' '.join(el.parent.get('class', []) if el.parent else [])
            if 'slide-master' in parent_classes:
                continue

            text = el.get_text(strip=True)
            if text and len(text) > 1:
                paragraphs.append(_repair_encoding(text))

        if not paragraphs:
            continue

        # First short paragraph is likely the slide title
        title = ''
        bullets: List[str] = []
        for j, para in enumerate(paragraphs):
            if j == 0 and len(para) < 150 and not para.startswith(('-', '*', '\u2022')):
                title = para
            else:
                bullets.append(para)

        if title or bullets:
            slides.append({
                'slide_number': i + 1,
                'title': _strip_arrows(title),
                'bullets': [_strip_arrows(b) for b in bullets],
            })

    return slides


def _detect_document_type(raw_text: str, slides: List[dict], content_type: str = '') -> str:
    """
    Detect whether a document is slide-based or prose.
    Uses content type, HTML structure, and text heuristics.
    """
    # Definitive: PPTX MIME type
    ct_lower = (content_type or '').lower()
    if any(pt in ct_lower for pt in _PPTX_CONTENT_TYPES):
        return 'slides'

    # Definitive: HTML parsing found multiple slide boundaries
    if len(slides) >= 3:
        return 'slides'

    # Heuristic: analyze raw text characteristics
    lines = [ln.strip() for ln in raw_text.split('\n') if ln.strip()]
    if not lines:
        return 'prose'

    short_line_count = sum(1 for ln in lines if len(ln) < 60)
    arrow_count = len(_ARROW_RE.findall(raw_text))
    avg_line_len = sum(len(ln) for ln in lines) / len(lines)

    # Slides tend to have many short lines, arrows, and low avg line length
    slide_score = 0
    if len(lines) > 5 and short_line_count / len(lines) > 0.5:
        slide_score += 2
    if arrow_count > 3:
        slide_score += 1
    if avg_line_len < 50:
        slide_score += 2
    if len(lines) > 10 and all(len(ln) < 120 for ln in lines[:10]):
        slide_score += 1

    return 'slides' if slide_score >= 3 else 'prose'


def _process_slides_keywords(slides: List[dict]) -> List[str]:
    """
    Run KeyBERT per-slide for better keyword relevance.
    Also attaches a 'keywords' list to each slide dict in-place.
    Returns merged global keywords.
    """
    all_keywords: List[str] = []
    seen: set = set()

    for slide in slides:
        # Filter out code-like and numeric-heavy bullets before keyword extraction
        usable_bullets = [
            b for b in slide.get('bullets', [])
            if not _is_numeric_heavy(b) and not _is_code_like(b)
        ]
        slide_text = ' '.join([slide.get('title', '')] + usable_bullets)
        slide_text = _strip_arrows(slide_text)
        if len(slide_text) < 20:
            slide['keywords'] = []
            continue

        try:
            kws = kw_model.extract_keywords(
                slide_text[:KEYBERT_INPUT_MAX_CHARS],
                keyphrase_ngram_range=(1, 2),
                stop_words='english',
                top_n=5,
                use_maxsum=True,
                nr_candidates=15,
            )
            slide_kws: List[str] = []
            for phrase, score in kws:
                if score < 0.15:
                    continue
                clean = _strip_arrows(phrase)
                low = clean.lower()
                if not low or len(low) < 3:
                    continue
                if _is_numeric_heavy(clean):
                    continue
                slide_kws.append(clean)
                if low not in seen:
                    seen.add(low)
                    all_keywords.append(clean)
            slide['keywords'] = filter_keywords(slide_kws)[:5]
        except Exception:
            slide['keywords'] = []

    return filter_keywords(all_keywords)[:KEYBERT_TOP_N]


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


def clean_extracted_text(text: str, skip_merge: bool = False) -> str:
    """
    Make Tika output more study-friendly:
    - remove URLs and obvious slide/page markers
    - strip arrow characters
    - reduce PDF mojibake artifacts
    - merge short lines from PDF slides (skipped for slide-type documents)
    - collapse whitespace while keeping sentence boundaries mostly intact
    """
    if not text:
        return ""

    text = _repair_encoding(text)
    text = _strip_arrows(text)

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

    # Merge consecutive short fragments — but NOT for slide-type documents
    # where merging destroys the natural slide-boundary structure.
    if not skip_merge:
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

_INTERROGATIVE_STARTS = re.compile(
    r"^(how|what|why|when|where|who|which|can|could|should|would|"
    r"is|are|do|does|did|will|has|have|shall|may|might)\b",
    re.IGNORECASE,
)

_ELLIPSIS_RE = re.compile(r"\.\.\.|[\u2026]")


def _is_declarative_statement(sentence: str) -> bool:
    """True only for declarative sentences suitable for True/False questions."""
    s = sentence.strip()
    if s.endswith("?"):
        return False
    if _INTERROGATIVE_STARTS.match(s):
        return False
    if _ELLIPSIS_RE.search(s):
        return False
    try:
        doc = nlp(s[:200])
        if doc and doc[0].pos_ == "VERB" and doc[0].dep_ == "ROOT":
            return False
    except Exception:
        pass
    return True


def is_good_sentence(sentence: str) -> bool:
    s = sentence.strip()
    if len(s) < 40 or len(s) > 400:
        return False

    if s.endswith("?"):
        return False
    if _ELLIPSIS_RE.search(s):
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
    "agenda", "outline", "recap", "contents", "objectives", "topics",
    "references", "bibliography", "questions",
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
        # Strip arrows and leading articles before evaluation
        phrase = _strip_arrows(phrase)
        phrase = _LEADING_ARTICLE_RE.sub('', phrase).strip()
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
        if _is_numeric_heavy(phrase):
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
        # Reject phrases that are just connectors/prepositions
        if all(w in _CONJUNCTION_PREPS for w in words):
            continue
        # Reject 2-word phrases where one token is purely numeric
        if len(words) == 2 and any(w.replace('.', '').isdigit() for w in words):
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
    processing_quality: Optional[float] = None
    concept_relationships: Optional[List[dict]] = None
    document_type: str = "prose"
    slides: Optional[List[dict]] = None
    error: Optional[str] = None

# ============================================
# Processing Quality Score
# ============================================

def compute_processing_quality(
    text: str,
    important_sentences: List[str],
    keywords: List[str],
    sentence_clusters: List[dict],
    cluster_quality: Optional[float],
    document_type: str,
    slides: Optional[List[dict]],
) -> float:
    """
    Composite 0-1 quality score that tells users how useful the
    extracted study material is likely to be.

    Components (weighted):
      - cluster_coherence   0.25  — average intra-cluster similarity
      - sentence_coverage   0.25  — fraction of document represented in pool
      - keyword_diversity    0.20  — unique keyword roots / total keywords
      - concept_density      0.15  — clusters or slides / expected for doc length
      - content_length       0.15  — penalise very short documents
    """
    scores: Dict[str, float] = {}

    # 1. Cluster coherence (already computed, 0-1)
    scores["cluster_coherence"] = min(1.0, cluster_quality or 0.0)

    # 2. Sentence coverage
    all_sents_approx = max(1, text.count(". ") + text.count("! ") + text.count("? "))
    pool_size = len(important_sentences)
    coverage = min(1.0, pool_size / max(1, min(30, all_sents_approx)))
    scores["sentence_coverage"] = coverage

    # 3. Keyword diversity
    if keywords:
        roots = set()
        for kw in keywords:
            tokens = kw.lower().split()
            roots.add(tokens[-1] if tokens else kw.lower())
        scores["keyword_diversity"] = min(1.0, len(roots) / max(1, len(keywords)))
    else:
        scores["keyword_diversity"] = 0.0

    # 4. Concept density
    if document_type == "slides" and slides:
        actual = len([s for s in slides if len(s.get("bullets", [])) > 0])
        expected = max(3, len(slides) * 0.6)
    else:
        actual = len(sentence_clusters)
        chars = len(text)
        expected = max(3, min(12, chars / 3000))
    scores["concept_density"] = min(1.0, actual / max(1, expected))

    # 5. Content length penalty
    char_count = len(text)
    if char_count < 200:
        scores["content_length"] = 0.1
    elif char_count < 1000:
        scores["content_length"] = 0.5
    else:
        scores["content_length"] = min(1.0, char_count / 5000)

    weights = {
        "cluster_coherence": 0.25,
        "sentence_coverage": 0.25,
        "keyword_diversity": 0.20,
        "concept_density": 0.15,
        "content_length": 0.15,
    }

    quality = sum(scores[k] * weights[k] for k in weights)
    return round(min(1.0, max(0.0, quality)), 3)


# ============================================
# Concept Relationship Extraction
# ============================================

def extract_concept_relationships(
    sentence_clusters: List[dict],
    important_sentences: List[str],
    keywords: List[str],
) -> List[dict]:
    """
    Find relationships between clusters using:
    1. Semantic similarity between cluster centroids (via st_model)
    2. Keyword co-occurrence in the same sentences

    Returns [{source_idx, target_idx, similarity, relationship_type}]
    where indices map to the cluster list order (same order as concepts).
    """
    if len(sentence_clusters) < 2:
        return []

    relationships: List[dict] = []

    try:
        # Build per-cluster text for embedding
        cluster_texts: List[str] = []
        for cluster in sentence_clusters:
            indices = cluster.get("sentence_indices", [])
            sents = [important_sentences[i] for i in indices if i < len(important_sentences)]
            cluster_texts.append(" ".join(sents) if sents else "")

        # Semantic similarity between cluster centroids
        if any(t for t in cluster_texts):
            embeddings = st_model.encode(cluster_texts)
            sim_matrix = 1.0 - cosine_distances(embeddings)

            for i in range(len(sentence_clusters)):
                for j in range(i + 1, len(sentence_clusters)):
                    sim = float(sim_matrix[i][j])
                    if sim > 0.35:
                        relationships.append({
                            "source_idx": i,
                            "target_idx": j,
                            "similarity": round(sim, 3),
                            "relationship_type": "semantic",
                        })

        # Keyword co-occurrence: if keywords from two clusters appear in the same sentence
        cluster_keyword_sets: List[set] = []
        for cluster in sentence_clusters:
            terms = set(t.lower() for t in cluster.get("key_terms", []))
            label_words = set(cluster.get("label", "").lower().split())
            cluster_keyword_sets.append(terms | label_words)

        for sent in important_sentences:
            lower_sent = sent.lower()
            present_clusters: List[int] = []
            for idx, kw_set in enumerate(cluster_keyword_sets):
                if any(kw in lower_sent for kw in kw_set if len(kw) > 3):
                    present_clusters.append(idx)

            for a in range(len(present_clusters)):
                for b in range(a + 1, len(present_clusters)):
                    ci, cj = present_clusters[a], present_clusters[b]
                    already = any(
                        r for r in relationships
                        if (r["source_idx"] == ci and r["target_idx"] == cj)
                        or (r["source_idx"] == cj and r["target_idx"] == ci)
                    )
                    if not already:
                        relationships.append({
                            "source_idx": ci,
                            "target_idx": cj,
                            "similarity": 0.3,
                            "relationship_type": "co_occurrence",
                        })

    except Exception as e:
        print(f"[nlp-service] relationship extraction failed gracefully: {e}", flush=True)

    return relationships


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

        # Step 1: Extract XHTML from Tika (preserves slide/page structure)
        content = file.file.read()
        print(f"[nlp-service] /process start filename={file.filename} type={file.content_type} size_bytes={len(content)}", flush=True)
        
        response = requests.put(
            f"{TIKA_URL}/tika",
            data=content,
            headers={
                "Accept": "text/html",
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
                error="The document could not be read. It may be corrupted or in an unsupported format. Please try re-uploading or converting it to PDF first."
            )
        
        html_content = response.text.strip()

        # Step 1b: Parse HTML for slide/page boundaries
        slides = _extract_slides_from_html(html_content)

        # Step 1c: Extract plain text from the HTML
        try:
            html_soup = BeautifulSoup(html_content, 'lxml')
            body = html_soup.find('body')
            raw_text = body.get_text('\n').strip() if body else html_soup.get_text('\n').strip()
        except Exception:
            raw_text = html_content

        # Step 1d: Detect document type before cleaning
        document_type = _detect_document_type(raw_text, slides, file.content_type or '')

        # Clean text — skip destructive short-line merging for slides
        text = clean_extracted_text(raw_text, skip_merge=(document_type == 'slides'))
        print(
            f"[nlp-service] tika done seconds={(time.time() - start):.2f} "
            f"text_chars={len(text)} raw_chars={len(raw_text)} "
            f"document_type={document_type} slides_found={len(slides)}",
            flush=True
        )
        
        if not text or len(text) < 50:
            return ProcessResponse(
                success=False,
                text="",
                keywords=[],
                important_sentences=[],
                char_count=0,
                error="Not enough readable text found in this document. It may contain mostly images, scanned pages, or non-text content. Try uploading a text-based version instead."
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

        # Step 3b: Per-slide keyword extraction (slide documents only)
        slide_keywords: List[str] = []
        if document_type == 'slides' and slides:
            slide_kw_start = time.time()
            slide_keywords = _process_slides_keywords(slides)
            merged_kw_set = set(k.lower() for k in keywords)
            for sk in slide_keywords:
                if sk.lower() not in merged_kw_set:
                    keywords.append(sk)
                    merged_kw_set.add(sk.lower())
            print(f"[nlp-service] slide_keywords done seconds={(time.time() - slide_kw_start):.2f} slide_keywords={len(slide_keywords)}", flush=True)

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

        # Step 7: Composite processing quality score
        processing_quality = compute_processing_quality(
            text, important_sentences, keywords,
            sentence_clusters, cluster_quality,
            document_type, slides,
        )

        # Step 8: Concept relationship extraction
        concept_relationships = extract_concept_relationships(
            sentence_clusters, important_sentences, keywords,
        )
        print(
            f"[nlp-service] quality={processing_quality} relationships={len(concept_relationships)}",
            flush=True,
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
            processing_quality=processing_quality,
            concept_relationships=concept_relationships,
            document_type=document_type,
            slides=slides if document_type == 'slides' and slides else None,
        )
        
    except requests.exceptions.RequestException as e:
        print(f"[nlp-service] Tika connection error: {e}", flush=True)
        return ProcessResponse(
            success=False,
            text="",
            keywords=[],
            important_sentences=[],
            char_count=0,
            error="The text extraction service is temporarily unavailable. Please try again in a few moments."
        )
    except Exception as e:
        print(f"[nlp-service] /process unexpected error: {e}", flush=True)
        return ProcessResponse(
            success=False,
            text="",
            keywords=[],
            important_sentences=[],
            char_count=0,
            error="Something unexpected happened while analyzing your document. Please try again."
        )
    finally:
        try:
            if 'acquired' in locals() and acquired:
                PROCESS_LOCK.release()
        except Exception:
            pass


# ============================================
# Flashcard Generation
# ============================================

class FlashcardInput(BaseModel):
    concept_name: str
    description: str = ""
    keywords: List[str] = []
    source_page: Optional[int] = None

class GenerateFlashcardsInput(BaseModel):
    concepts: List[FlashcardInput]
    important_sentences: List[str] = []
    max_cards: int = 30

class FlashcardOutput(BaseModel):
    front: str
    back: str
    concept_name: str
    difficulty: str = "intermediate"
    source_page: Optional[int] = None

class GenerateFlashcardsResponse(BaseModel):
    success: bool
    flashcards: List[FlashcardOutput] = []
    error: Optional[str] = None

FLASHCARD_LOCK = Lock()

def _build_definition_card(concept: FlashcardInput) -> Optional[FlashcardOutput]:
    """'What is X?' / description answer."""
    desc = (concept.description or "").strip()
    if len(desc) < 20:
        return None
    templates = [
        f"What is {concept.concept_name}?",
        f"Define {concept.concept_name}.",
    ]
    return FlashcardOutput(
        front=random.choice(templates),
        back=desc,
        concept_name=concept.concept_name,
        difficulty="beginner",
        source_page=concept.source_page,
    )


def _build_cloze_card(
    concept: FlashcardInput,
    sentences: List[str],
) -> Optional[FlashcardOutput]:
    """Blank a keyphrase in a supporting sentence."""
    name_lower = concept.concept_name.lower()
    for sent in sentences:
        if name_lower in sent.lower() and len(sent) > 30:
            pattern = re.compile(re.escape(concept.concept_name), re.IGNORECASE)
            blanked = pattern.sub("__________", sent, count=1)
            return FlashcardOutput(
                front=blanked,
                back=concept.concept_name,
                concept_name=concept.concept_name,
                difficulty="intermediate",
                source_page=concept.source_page,
            )
    return None


def _build_keyword_card(concept: FlashcardInput) -> Optional[FlashcardOutput]:
    """'Name key aspects of X' / keyword list."""
    if len(concept.keywords) < 2:
        return None
    return FlashcardOutput(
        front=f"Name the key aspects or components of {concept.concept_name}.",
        back=", ".join(concept.keywords),
        concept_name=concept.concept_name,
        difficulty="intermediate",
        source_page=concept.source_page,
    )


@app.post("/generate-flashcards", response_model=GenerateFlashcardsResponse)
def generate_flashcards(input: GenerateFlashcardsInput):
    """
    Generate study flashcards from extracted concepts.
    Three card types: definition, cloze (fill-in-blank), keyword recall.
    """
    try:
        start = time.time()
        FLASHCARD_LOCK.acquire()
        acquired = True

        cards: List[FlashcardOutput] = []
        seen_fronts: set = set()

        for concept in input.concepts:
            if len(cards) >= input.max_cards:
                break

            # Definition card
            defn = _build_definition_card(concept)
            if defn and defn.front.lower() not in seen_fronts:
                seen_fronts.add(defn.front.lower())
                cards.append(defn)

            # Cloze card
            cloze = _build_cloze_card(concept, input.important_sentences)
            if cloze and cloze.front.lower() not in seen_fronts:
                seen_fronts.add(cloze.front.lower())
                cards.append(cloze)

            # Keyword recall card
            kw_card = _build_keyword_card(concept)
            if kw_card and kw_card.front.lower() not in seen_fronts:
                seen_fronts.add(kw_card.front.lower())
                cards.append(kw_card)

        elapsed = time.time() - start
        print(f"[nlp-service] /generate-flashcards done seconds={elapsed:.2f} cards={len(cards)}", flush=True)

        return GenerateFlashcardsResponse(success=True, flashcards=cards)

    except Exception as e:
        print(f"[nlp-service] /generate-flashcards error: {e}", flush=True)
        return GenerateFlashcardsResponse(success=False, error=str(e))
    finally:
        try:
            if 'acquired' in locals() and acquired:
                FLASHCARD_LOCK.release()
        except Exception:
            pass


# ============================================
# Automatic Question Generation (AQG)
# Template-driven, grounded in source text.
# Per Obj3 sections 6-8, upgraded in Phase 4.2.
# ============================================

AQG_LOCK = Lock()
_AMBIGUOUS_QUALIFIERS = re.compile(
    r"\b(sometimes|often|usually|may|might|could|perhaps|occasionally|rarely|"
    r"probably|generally|typically|possibly|approximately|almost|nearly)\b",
    re.IGNORECASE,
)

class ConceptInput(BaseModel):
    name: str
    importance: int = 5
    difficulty_level: str = "intermediate"
    keywords: List[str] = []
    description: str = ""
    source_pages: Optional[List[int]] = None

class ChunkInput(BaseModel):
    chunk_id: str
    text: str
    keyphrases: List[str] = []
    important_sentences: List[str] = []
    max_questions: Optional[int] = None

class MasteryContextInput(BaseModel):
    concept_name: str
    mastery_score: Optional[float] = None
    mastery_level: Optional[str] = None
    adaptive_difficulty: Optional[str] = None

class GenerateQuestionsInput(BaseModel):
    chunks: List[ChunkInput]
    all_keyphrases: List[str] = []
    question_types: List[str] = ["identification", "true_false", "multiple_choice", "fill_in_blank"]
    # Optional explicit targets per question type (e.g., {"multiple_choice": 8, "true_false": 7}).
    # When provided, generation should prefer meeting these quotas deterministically.
    question_type_targets: Optional[Dict[str, int]] = None
    max_questions_per_chunk: int = 3
    max_total_questions: int = 15
    difficulty: str = "mixed"
    concepts: List[ConceptInput] = []
    document_type: str = "prose"
    mastery_context: Optional[List[MasteryContextInput]] = None

class GeneratedQuestion(BaseModel):
    chunk_id: str
    question_type: str
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    difficulty_label: str = "intermediate"
    explanation: Optional[str] = None

class GenerateQuestionsResponse(BaseModel):
    success: bool
    questions: List[GeneratedQuestion] = []
    stats: Optional[dict] = None
    error: Optional[str] = None

_IDENTIFICATION_TEMPLATES_BEGINNER = [
    "What is {kp}?",
    "Define {kp}.",
    "What does {kp} refer to?",
]
_IDENTIFICATION_TEMPLATES_INTERMEDIATE = [
    "What term is being described?",
    "Which concept matches this description?",
    "Identify the concept related to {kp}.",
    "What is the name of the concept discussed here?",
]
_IDENTIFICATION_TEMPLATES_ADVANCED = [
    "Which topic best matches this description?",
    "What concept is being referenced here?",
    "Name the concept described in this statement.",
    "Identify the key term discussed here.",
]

IDENTIFICATION_MAX_WORDS = 8
IDENTIFICATION_MAX_CHARS = 80
_IDENTIFICATION_LONG_FORM_PROMPT_RE = re.compile(r"^(explain|describe|compare|analyze|why|how)\b", re.IGNORECASE)
_IDENTIFICATION_SENTENCE_MARKER_RE = re.compile(r"[.!?]|[,;:]")

_DIFFICULTY_TYPE_WEIGHTS = {
    "beginner":     {"identification": 3, "true_false": 4, "multiple_choice": 2, "fill_in_blank": 1},
    "intermediate": {"identification": 2, "true_false": 2, "multiple_choice": 3, "fill_in_blank": 3},
    "advanced":     {"identification": 1, "true_false": 1, "multiple_choice": 4, "fill_in_blank": 4},
    "mixed":        {"identification": 2, "true_false": 2, "multiple_choice": 3, "fill_in_blank": 3},
}


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


def _pick_distractors_semantic(correct: str, chunk_keyphrases: List[str],
                               all_keyphrases: List[str], count: int = 3) -> List[str]:
    """
    Build MCQ distractors using semantic similarity (sentence-transformers).
    Picks keyphrases that are related but distinct from the correct answer.
    Falls back to length-based sorting if embedding fails.
    """
    correct_lower = correct.lower().strip()
    candidates: List[str] = []
    seen = {correct_lower}

    def _try_add(phrase: str):
        p = phrase.strip()
        low = p.lower()
        if low in seen or not p or len(p) < 2:
            return
        seen.add(low)
        candidates.append(p)

    for kp in chunk_keyphrases:
        _try_add(kp)
    for kp in all_keyphrases:
        _try_add(kp)
        if len(candidates) >= count * 5:
            break

    if not candidates:
        return []

    try:
        correct_emb = st_model.encode([correct])
        cand_embs = st_model.encode(candidates)
        sims = (1.0 - cosine_distances(correct_emb, cand_embs))[0]
        scored = sorted(zip(candidates, sims), key=lambda x: x[1], reverse=True)
        # Pick the most semantically similar (plausible) but not identical
        result = [c for c, s in scored if 0.15 < s < 0.85]
        return result[:count]
    except Exception:
        correct_len = len(correct)
        candidates.sort(key=lambda c: abs(len(c) - correct_len))
        return candidates[:count]


def _build_explanation(sentence_text: str, keyphrase: str = "") -> str:
    """Build a source-grounded explanation from the supporting sentence."""
    clean = sentence_text.strip()
    if len(clean) > 200:
        clean = clean[:197] + "..."
    if keyphrase:
        return f"The answer is '{keyphrase}'. According to the document: {clean}"
    return f"According to the document: {clean}"


def _select_difficulty_label(target_difficulty: str, question_type: str) -> str:
    """Pick a difficulty label consistent with the target and question type."""
    if target_difficulty in ("beginner", "intermediate", "advanced"):
        return target_difficulty
    # 'mixed' - vary by question type
    defaults = {
        "true_false": "beginner",
        "identification": "intermediate",
        "multiple_choice": "intermediate",
        "fill_in_blank": "intermediate",
    }
    return defaults.get(question_type, "intermediate")


def _generate_identification(sentence_text: str, keyphrase: str,
                             chunk_id: str, difficulty: str = "mixed") -> Optional[GeneratedQuestion]:
    """Template-based identification question with difficulty-varied templates."""
    answer = keyphrase.strip()
    if len(answer) < 2:
        return None

    diff_label = _select_difficulty_label(difficulty, "identification")
    if diff_label == "beginner":
        templates = _IDENTIFICATION_TEMPLATES_BEGINNER
    elif diff_label == "advanced":
        templates = _IDENTIFICATION_TEMPLATES_ADVANCED
    else:
        templates = _IDENTIFICATION_TEMPLATES_INTERMEDIATE

    q_text = random.choice(templates).format(kp=keyphrase)
    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="identification",
        question_text=q_text,
        correct_answer=answer,
        difficulty_label=diff_label,
        explanation=_build_explanation(sentence_text, keyphrase),
    )


def _generate_true_false(sentence_text: str, chunk_id: str,
                         keyphrases: List[str] = [],
                         difficulty: str = "mixed") -> Optional[GeneratedQuestion]:
    """
    Present a key sentence as True, or create a False variant.
    Uses entity/keyphrase swapping for more natural False statements.
    Falls back to verb negation if swapping fails.
    """
    if not _is_declarative_statement(sentence_text):
        return None
    if _AMBIGUOUS_QUALIFIERS.search(sentence_text):
        return None

    diff_label = _select_difficulty_label(difficulty, "true_false")
    make_false = random.random() < 0.5

    if not make_false:
        return GeneratedQuestion(
            chunk_id=chunk_id,
            question_type="true_false",
            question_text=sentence_text.strip(),
            correct_answer="true",
            difficulty_label=diff_label,
            explanation=_build_explanation(sentence_text),
        )

    # Strategy 1: Entity/keyphrase swapping (more natural)
    swapped = _try_entity_swap(sentence_text, keyphrases)
    if swapped:
        return GeneratedQuestion(
            chunk_id=chunk_id,
            question_type="true_false",
            question_text=swapped.strip(),
            correct_answer="false",
            difficulty_label=diff_label,
            explanation=f"This statement is false. {_build_explanation(sentence_text)}",
        )

    # Strategy 2: Verb negation fallback
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
        difficulty_label=diff_label,
        explanation=f"This statement is false because 'not' changes the meaning. {_build_explanation(sentence_text)}",
    )


def _try_entity_swap(sentence_text: str, keyphrases: List[str]) -> Optional[str]:
    """Try to swap a named entity or keyphrase with another to create a false statement."""
    doc = nlp(sentence_text)
    entities = [(ent.text, ent.start_char, ent.end_char, ent.label_)
                for ent in doc.ents if len(ent.text) > 2]

    if entities:
        target = random.choice(entities)
        target_text, start, end, label = target
        # Find a different entity of the same type
        same_type = [e for e in entities if e[3] == label and e[0] != target_text]
        if same_type:
            replacement = random.choice(same_type)[0]
            return sentence_text[:start] + replacement + sentence_text[end:]

    # Try keyphrase swapping
    sent_lower = sentence_text.lower()
    found_kps = [(kp, sent_lower.find(kp.lower())) for kp in keyphrases
                 if kp.lower() in sent_lower]
    if len(found_kps) >= 1:
        target_kp, pos = found_kps[0]
        # Find a different keyphrase to swap in
        others = [kp for kp in keyphrases if kp.lower() != target_kp.lower()
                  and abs(len(kp) - len(target_kp)) < len(target_kp)]
        if others:
            replacement = random.choice(others)
            pattern = re.compile(re.escape(target_kp), re.IGNORECASE)
            return pattern.sub(replacement, sentence_text, count=1)

    return None


def _generate_mcq(sentence_text: str, keyphrase: str, chunk_keyphrases: List[str],
                   all_keyphrases: List[str], chunk_id: str,
                   difficulty: str = "mixed") -> Optional[GeneratedQuestion]:
    """
    Blank the keyphrase in the sentence to form the stem, use semantically
    similar keyphrases as distractors.
    """
    pattern = re.compile(re.escape(keyphrase), re.IGNORECASE)
    if not pattern.search(sentence_text):
        return None

    stem = pattern.sub("__________", sentence_text, count=1).strip()
    distractors = _pick_distractors_semantic(keyphrase, chunk_keyphrases, all_keyphrases, count=3)
    if len(distractors) < 2:
        return None

    options = distractors[:3] + [keyphrase]
    random.shuffle(options)

    diff_label = _select_difficulty_label(difficulty, "multiple_choice")
    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="multiple_choice",
        question_text=stem,
        options=options,
        correct_answer=keyphrase,
        difficulty_label=diff_label,
        explanation=_build_explanation(sentence_text, keyphrase),
    )


def _generate_fill_in_blank(sentence_text: str, keyphrase: str,
                            chunk_id: str,
                            difficulty: str = "mixed") -> Optional[GeneratedQuestion]:
    """Remove a keyphrase from the sentence to create a blank."""
    pattern = re.compile(re.escape(keyphrase), re.IGNORECASE)
    if not pattern.search(sentence_text):
        return None

    blanked = pattern.sub("__________", sentence_text, count=1).strip()
    diff_label = _select_difficulty_label(difficulty, "fill_in_blank")
    return GeneratedQuestion(
        chunk_id=chunk_id,
        question_type="fill_in_blank",
        question_text=blanked,
        correct_answer=keyphrase,
        difficulty_label=diff_label,
        explanation=_build_explanation(sentence_text, keyphrase),
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


def _validate_question(q: GeneratedQuestion) -> bool:
    """Quality gate: reject questions that are too short, trivial, or malformed."""
    if len(q.question_text) < 15:
        return False
    if len(q.correct_answer) < 2:
        return False
    if q.question_type == "identification":
        answer_words = [word for word in q.correct_answer.strip().split() if word]
        if len(q.correct_answer.strip()) > IDENTIFICATION_MAX_CHARS:
            return False
        if len(answer_words) > IDENTIFICATION_MAX_WORDS:
            return False
        if _IDENTIFICATION_SENTENCE_MARKER_RE.search(q.correct_answer):
            return False
        if _IDENTIFICATION_LONG_FORM_PROMPT_RE.match(q.question_text.strip()):
            return False
    if q.question_type == "true_false":
        text = q.question_text.strip()
        if text.endswith("?"):
            return False
        if _INTERROGATIVE_STARTS.match(text):
            return False
        if _ELLIPSIS_RE.search(text):
            return False
    if q.question_type == "multiple_choice":
        if not q.options or len(q.options) < 3:
            return False
        unique_opts = set(o.lower().strip() for o in q.options)
        if len(unique_opts) < 3:
            return False
    if q.question_type == "fill_in_blank":
        if "__________" not in q.question_text:
            return False
    return True


def _generate_slide_questions(
    concepts: List[ConceptInput],
    all_keyphrases: List[str],
    difficulty: str,
    question_types: List[str],
    max_questions: int,
) -> List[GeneratedQuestion]:
    """
    Generate questions specifically from slide-based concept data.
    Uses concept names as natural topic stems and descriptions as answer material.
    """
    questions: List[GeneratedQuestion] = []
    type_set = set(question_types)

    _SLIDE_IDENT_TEMPLATES = [
        "Which concept matches this slide description: {desc}?",
        "What topic is described here: {desc}?",
        "Identify the concept referred to in this slide summary: {desc}",
    ]
    _SLIDE_MCQ_TEMPLATES = [
        "Which of the following best describes {name}?",
        "What is the main purpose of {name}?",
    ]

    sorted_concepts = sorted(concepts, key=lambda c: c.importance, reverse=True)

    for concept in sorted_concepts:
        if len(questions) >= max_questions:
            break

        name = concept.name
        desc = concept.description.strip()
        if not desc or len(desc) < 20:
            continue

        diff_label = _select_difficulty_label(difficulty, "identification")

        # Identification from slide topic
        if "identification" in type_set and len(questions) < max_questions:
            template = random.choice(_SLIDE_IDENT_TEMPLATES)
            desc_short = desc[:180].rstrip()
            q = GeneratedQuestion(
                chunk_id="",
                question_type="identification",
                question_text=template.format(desc=desc_short),
                correct_answer=name,
                difficulty_label=diff_label,
                explanation=f"This is covered in the slide on '{name}': {desc[:150]}",
            )
            if _validate_question(q):
                questions.append(q)

        # MCQ using concept name and other concepts as distractors
        if "multiple_choice" in type_set and len(questions) < max_questions:
            other_names = [c.name for c in sorted_concepts if c.name != name]
            if len(other_names) >= 2:
                distractors = random.sample(other_names, min(3, len(other_names)))
                desc_short = desc.split('.')[0].strip()
                if len(desc_short) > 15:
                    template = random.choice(_SLIDE_MCQ_TEMPLATES)
                    options = distractors[:3] + [desc_short]
                    random.shuffle(options)
                    q = GeneratedQuestion(
                        chunk_id="",
                        question_type="multiple_choice",
                        question_text=template.format(name=name),
                        options=options,
                        correct_answer=desc_short,
                        difficulty_label=_select_difficulty_label(difficulty, "multiple_choice"),
                        explanation=f"The correct answer describes {name}: {desc[:150]}",
                    )
                    if _validate_question(q):
                        questions.append(q)

        # Fill-in-blank from description
        if "fill_in_blank" in type_set and len(questions) < max_questions:
            name_lower = name.lower()
            desc_lower = desc.lower()
            if name_lower in desc_lower:
                pattern = re.compile(re.escape(name), re.IGNORECASE)
                blanked = pattern.sub("__________", desc, count=1)
                q = GeneratedQuestion(
                    chunk_id="",
                    question_type="fill_in_blank",
                    question_text=blanked[:300],
                    correct_answer=name,
                    difficulty_label=_select_difficulty_label(difficulty, "fill_in_blank"),
                    explanation=f"The blank should be filled with '{name}'.",
                )
                if _validate_question(q):
                    questions.append(q)

    return questions


def _balance_by_concept_coverage(
    all_questions: List[GeneratedQuestion],
    max_total: int,
    concept_names: List[str],
) -> List[GeneratedQuestion]:
    """
    Reorder questions to ensure coverage across concepts.
    Prioritizes one question per concept before duplicating.
    """
    if not concept_names or len(all_questions) <= max_total:
        return all_questions

    concept_lower = [c.lower() for c in concept_names]
    concept_buckets: Dict[str, List[GeneratedQuestion]] = {c: [] for c in concept_lower}
    unbucketed: List[GeneratedQuestion] = []

    for q in all_questions:
        q_text_lower = q.question_text.lower() + " " + q.correct_answer.lower()
        placed = False
        for cn in concept_lower:
            if cn in q_text_lower:
                concept_buckets[cn].append(q)
                placed = True
                break
        if not placed:
            unbucketed.append(q)

    result: List[GeneratedQuestion] = []
    round_num = 0
    while len(result) < max_total:
        added_this_round = False
        for cn in concept_lower:
            if round_num < len(concept_buckets[cn]) and len(result) < max_total:
                result.append(concept_buckets[cn][round_num])
                added_this_round = True
        round_num += 1
        if not added_this_round:
            break

    for q in unbucketed:
        if len(result) >= max_total:
            break
        result.append(q)

    return result[:max_total]


def _build_mastery_lookup(mastery_context: Optional[List[MasteryContextInput]]) -> Dict[str, MasteryContextInput]:
    lookup: Dict[str, MasteryContextInput] = {}
    if not mastery_context:
        return lookup
    for item in mastery_context:
        key = item.concept_name.strip().lower()
        if key:
            lookup[key] = item
    return lookup


def _resolve_adaptive_difficulty(
    sentence: str,
    keyphrase: Optional[str],
    mastery_lookup: Dict[str, MasteryContextInput],
    fallback_difficulty: str,
) -> str:
    if not mastery_lookup:
        return fallback_difficulty

    candidates: List[str] = []
    if keyphrase:
        candidates.append(keyphrase.strip().lower())

    lower_sentence = sentence.lower()
    for concept_name in mastery_lookup.keys():
        if concept_name in lower_sentence:
            candidates.append(concept_name)

    for candidate in candidates:
        item = mastery_lookup.get(candidate)
        if not item:
            continue
        adaptive = (item.adaptive_difficulty or "").strip().lower()
        if adaptive in _DIFFICULTY_TYPE_WEIGHTS:
            return adaptive

    return fallback_difficulty


@app.post("/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(input: GenerateQuestionsInput):
    """
    Template-driven Automatic Question Generation (AQG).
    Generates grounded questions from chunk text using spaCy NLP.
    Supports difficulty targeting and concept coverage balancing.
    """
    try:
        start = time.time()
        AQG_LOCK.acquire()
        acquired = True

        difficulty = input.difficulty or "mixed"
        default_type_weights = _DIFFICULTY_TYPE_WEIGHTS.get(difficulty, _DIFFICULTY_TYPE_WEIGHTS["mixed"])
        mastery_lookup = _build_mastery_lookup(input.mastery_context)

        # Optional: type quotas. Filter to selected question_types and normalize to non-negative ints.
        remaining_by_type: Optional[Dict[str, int]] = None
        target_total = input.max_total_questions
        if input.question_type_targets:
            filtered: Dict[str, int] = {}
            for qt in input.question_types:
                raw = input.question_type_targets.get(qt)
                if raw is None:
                    continue
                try:
                    n = int(raw)
                except Exception:
                    continue
                if n > 0:
                    filtered[qt] = n
            if filtered:
                remaining_by_type = dict(filtered)
                target_total = min(input.max_total_questions, sum(filtered.values()))

        print(f"[nlp-service] /generate-questions start chunks={len(input.chunks)} "
              f"types={input.question_types} difficulty={difficulty} "
              f"max_total={target_total} concepts={len(input.concepts)} "
              f"mastery_ctx={len(input.mastery_context or [])}", flush=True)

        all_questions: List[GeneratedQuestion] = []
        type_set = set(input.question_types)
        used_keyphrases: set = set()

        for chunk in input.chunks:
            if len(all_questions) >= target_total * 2:
                break

            chunk_questions: List[GeneratedQuestion] = []
            chunk_max_questions = (
                chunk.max_questions
                if chunk.max_questions is not None and chunk.max_questions > 0
                else input.max_questions_per_chunk
            )
            text = chunk.text.strip()
            if len(text) < 50:
                continue

            sentences = _get_sentences(text)
            good_sentences = [
                str(s).strip() for s in sentences if is_good_sentence(str(s))
            ]

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

            imp_sentences = chunk.important_sentences if chunk.important_sentences else good_sentences[:5]

            for sent in imp_sentences:
                if len(chunk_questions) >= chunk_max_questions:
                    break
                if remaining_by_type is not None and sum(remaining_by_type.values()) <= 0:
                    break

                kp = _find_keyphrase_in_sentence(sent, keyphrases)

                # Prefer keyphrases not yet used (for diversity)
                if kp and kp.lower() in used_keyphrases:
                    alt_kp = None
                    for other_kp in keyphrases:
                        if other_kp.lower() not in used_keyphrases and other_kp.lower() in sent.lower():
                            alt_kp = other_kp
                            break
                    if alt_kp:
                        kp = alt_kp

                effective_difficulty = _resolve_adaptive_difficulty(
                    sent, kp, mastery_lookup, difficulty
                )
                effective_weights = _DIFFICULTY_TYPE_WEIGHTS.get(effective_difficulty, default_type_weights)
                weighted_types = []
                for qt in input.question_types:
                    if remaining_by_type is not None and remaining_by_type.get(qt, 0) <= 0:
                        continue
                    w = effective_weights.get(qt, 1)
                    weighted_types.extend([qt] * w)
                random.shuffle(weighted_types)

                # Pick question type from weighted rotation
                for qt in weighted_types:
                    if len(chunk_questions) >= chunk_max_questions:
                        break
                    if qt not in type_set:
                        continue
                    if remaining_by_type is not None and remaining_by_type.get(qt, 0) <= 0:
                        continue

                    q = None
                    if qt == "identification" and kp:
                        q = _generate_identification(sent, kp, chunk.chunk_id, effective_difficulty)
                    elif qt == "true_false":
                        if not _is_declarative_statement(sent):
                            continue
                        q = _generate_true_false(sent, chunk.chunk_id, keyphrases, effective_difficulty)
                    elif qt == "multiple_choice" and kp:
                        q = _generate_mcq(sent, kp, keyphrases, input.all_keyphrases, chunk.chunk_id, effective_difficulty)
                    elif qt == "fill_in_blank" and kp:
                        q = _generate_fill_in_blank(sent, kp, chunk.chunk_id, effective_difficulty)

                    if q and _validate_question(q):
                        chunk_questions.append(q)
                        if kp:
                            used_keyphrases.add(kp.lower())
                        if remaining_by_type is not None:
                            remaining_by_type[qt] = max(0, remaining_by_type.get(qt, 0) - 1)
                        break

            all_questions.extend(chunk_questions)

        # Supplement with slide-specific questions when document is slide-based
        if input.document_type == "slides" and input.concepts:
            slide_questions = _generate_slide_questions(
                input.concepts,
                input.all_keyphrases,
                difficulty,
                input.question_types,
                max(3, target_total - len(all_questions)),
            )
            all_questions.extend(slide_questions)
            if slide_questions:
                print(f"[nlp-service] added {len(slide_questions)} slide-specific questions", flush=True)

        # Validation: dedup, quality filter, concept balancing
        all_questions = _deduplicate_questions(all_questions)

        concept_names = [c.name for c in input.concepts] if input.concepts else []
        all_questions = _balance_by_concept_coverage(
            all_questions, target_total, concept_names
        )

        if len(all_questions) > target_total:
            all_questions = all_questions[:target_total]

        by_type: dict = {}
        for q in all_questions:
            by_type[q.question_type] = by_type.get(q.question_type, 0) + 1

        elapsed = time.time() - start
        print(f"[nlp-service] /generate-questions done seconds={elapsed:.2f} "
              f"total={len(all_questions)} by_type={by_type} difficulty={difficulty}", flush=True)

        return GenerateQuestionsResponse(
            success=True,
            questions=all_questions,
            stats={
                "total": len(all_questions),
                "by_type": by_type,
                "difficulty": difficulty,
                "requested_type_targets": input.question_type_targets or None,
            },
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
