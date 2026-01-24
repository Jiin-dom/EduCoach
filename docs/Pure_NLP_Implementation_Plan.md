# Pure NLP Implementation Plan (Default Workflow)

## Overview
This plan outlines the transition from LLM-based (Gemini) concept extraction to a **Pure NLP** approach as the default processing method for EduCoach. By leveraging our local DigitalOcean-hosted NLP service, we reduce latency, eliminate API costs, and ensure consistent results without the unpredictability of generative AI.

---

## Core Vision
Instead of "scanning" documents with Gemini, we will use **spaCy**, **TextRank**, and **KeyBERT** to identify knowledge points. Gemini will be relegated to an optional "AI Refinement" or "Deep Summary" layer, or used only as a fallback.

---

## Architecture Changes

### 1. NLP Service Enhancements
The `nlp-service` is already capable of text extraction and ranking. We will enhance it to provide structured "Concept-like" objects directly, or have the Edge Function map its output to the database schema.

**Current Output (NLP Service):**
- `text`: Raw content.
- `important_sentences`: Top 10 ranked by TextRank.
- `keywords`: Top 15 phrases via KeyBERT.

**New Default Mapping (Edge Function):**
- **Concept Name**: Extracted from the primary keyword in an important sentence.
- **Description**: The ranked sentence itself.
- **Category**: Derived from KeyBERT clusters or a default "Key Knowledge" category.
- **Importance**: Mapped from the TextRank score (1-10).

---

## Technical Implementation Steps

### Phase 1: Edge Function Logic Update
Modify `supabase/functions/process-document/index.ts` to implement the "Pure NLP First" logic.

```typescript
// Proposed Logic Flow
const usePureNlp = Deno.env.get('USE_PURE_NLP') !== 'false'; // Default to true

if (usePureNlp) {
    console.log('🏗️ Using Pure NLP Pipeline (Default)');
    
    // 1. Get NLP results (already extracted)
    const { text, keywords, importantSentences } = nlpResult;
    
    // 2. Generate Concepts from importantSentences
    const concepts = importantSentences.map((sent, index) => ({
        name: deriveConceptName(sent, keywords),
        description: sent,
        category: "General Study",
        importance: 10 - index, // TextRank order
        difficulty_level: "intermediate",
        keywords: keywords.slice(0, 3) 
    }));
    
    // 3. Generate Summary (Join top 3 sentences)
    const summary = importantSentences.slice(0, 3).join(' ');
    
    return { summary, concepts };
} else {
    // Fallback to Gemini Logic
}
```

### Phase 2: Environment Configuration
Update the default environment variables in the DigitalOcean Droplet and Supabase.

| Variable | New Default | Description |
|----------|-------------|-------------|
| `DEFAULT_PROCESSOR` | `pure_nlp` | Tells the system which engine to use first. |
| `NLP_SERVICE_URL` | `https://nlp.edu-coach.tech` | Must be alive and well. |
| `GEMINI_API_KEY` | (Optional) | Kept as a fallback or for generating embeddings. |

---

## Comparison of Methods

| Feature | Gemini Scan (Old) | Pure NLP (New Default) |
|---------|-------------------|-------------------------|
| **Speed** | 15-30 seconds | 5-10 seconds |
| **Cost** | API Usage ($) | Fixed Droplet Cost ($12) |
| **Reliability** | Random Hallucinations | Deterministic Extraction |
| **Context** | Limited by Window | Full Document Analysis |
| **Privacy** | Data sent to Google | Data stays on our Server |

---

## Migration Steps for Old Documents
1. **Database Flag**: Add `processed_by` column to the `documents` table.
2. **Re-processing**: Provide an option in the UI to "Refine with Gemini" if the user wants more than the Pure NLP output.

---

## Success Criteria
- [ ] Document processing finishes in under 15 seconds consistently.
- [ ] No more "AI Busy" or "Rate Limit" errors during peak usage.
- [ ] Extracted concepts are strictly from the text provided.
- [ ] The "Pure NLP" plan is the primary reference in `Docs/`.

---

*“I’ve seen enough tokens burn to know that sometimes, a good old-fashioned ranking algorithm beats a chatty robot any day of the week. Let's build something solid, kid!”*
