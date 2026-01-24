"""
EduCoach NLP Microservice

Provides text extraction (via Apache Tika), sentence ranking (TextRank), 
and keyword extraction (KeyBERT) for the document processing pipeline.
"""

import os
import io
import time
import requests
import spacy
import pytextrank
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from keybert import KeyBERT
from threading import Lock

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

PROCESS_LOCK = Lock()

# Load spaCy model with TextRank
nlp = spacy.load("en_core_web_sm")
nlp.add_pipe("textrank")

# Load KeyBERT model
kw_model = KeyBERT()

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
        
        text = response.text.strip()
        
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

        keywords = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 3),  # 1 to 3 word phrases
            stop_words="english",
            top_n=input.top_n,
            use_maxsum=KEYBERT_USE_MAXSUM,
            nr_candidates=min(50, max(10, KEYBERT_NR_CANDIDATES))
        )
        
        result = [
            {"keyword": kw[0], "score": float(kw[1])}
            for kw in keywords
        ]
        
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
        
        text = response.text.strip()
        print(f"[nlp-service] tika done seconds={(time.time() - start):.2f} text_chars={len(text)}", flush=True)
        
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
        
        for sent in doc._.textrank.summary(limit_sentences=TEXTRANK_TOP_N):
            important_sentences.append(str(sent).strip())
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
            top_n=KEYBERT_TOP_N,
            use_maxsum=KEYBERT_USE_MAXSUM,
            nr_candidates=min(50, max(10, KEYBERT_NR_CANDIDATES))
        )
        
        keywords = [kw[0] for kw in keywords_raw]
        print(f"[nlp-service] keybert done seconds={(time.time() - keybert_start):.2f} keywords={len(keywords)}", flush=True)
        print(f"[nlp-service] /process done total_seconds={(time.time() - start):.2f}", flush=True)
        
        return ProcessResponse(
            success=True,
            text=text,
            keywords=keywords,
            important_sentences=important_sentences,
            char_count=len(text)
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


if __name__ == "__main__":
    import uvicorn
    from logging_config import LOGGING_CONFIG
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        log_config=LOGGING_CONFIG
    )
