"""
EduCoach NLP Microservice

Provides text extraction (via Apache Tika), sentence ranking (TextRank), 
and keyword extraction (KeyBERT) for the document processing pipeline.
"""

import os
import io
import requests
import spacy
import pytextrank
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from keybert import KeyBERT

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
async def extract_text(file: UploadFile = File(...)):
    """
    Extract plain text from a document using Apache Tika.
    Supports PDF, DOCX, PPTX, TXT, and more.
    """
    try:
        # Read file content
        content = await file.read()
        
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
async def rank_sentences(input: TextInput):
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
async def extract_keywords(input: TextInput):
    """
    Extract key phrases using KeyBERT (BERT-based semantic similarity).
    """
    try:
        # Extract keywords with KeyBERT
        keywords = kw_model.extract_keywords(
            input.text,
            keyphrase_ngram_range=(1, 3),  # 1 to 3 word phrases
            stop_words="english",
            top_n=input.top_n,
            use_maxsum=True,
            nr_candidates=20
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
async def process_document(file: UploadFile = File(...)):
    """
    Full document processing pipeline:
    1. Extract text with Tika
    2. Rank sentences with TextRank
    3. Extract keywords with KeyBERT
    
    This is the main endpoint called by the Edge Function.
    """
    try:
        # Step 1: Extract text with Tika
        content = await file.read()
        
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
        
        if not text or len(text) < 50:
            return ProcessResponse(
                success=False,
                text="",
                keywords=[],
                important_sentences=[],
                char_count=0,
                error="Document appears to be empty or unreadable"
            )
        
        # Step 2: TextRank - Get important sentences
        doc = nlp(text)
        important_sentences = []
        
        for sent in doc._.textrank.summary(limit_sentences=10):
            important_sentences.append(str(sent).strip())
        
        # Step 3: KeyBERT - Extract keywords
        keywords_raw = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            top_n=15,
            use_maxsum=True,
            nr_candidates=30
        )
        
        keywords = [kw[0] for kw in keywords_raw]
        
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


if __name__ == "__main__":
    import uvicorn
    from logging_config import LOGGING_CONFIG
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        log_config=LOGGING_CONFIG
    )
