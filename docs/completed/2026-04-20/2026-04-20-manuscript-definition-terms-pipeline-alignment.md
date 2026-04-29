# Manuscript Definition Terms Pipeline Alignment

Date: 2026-04-20

App affected: both

Type of work: fix

Summary of what was implemented

Updated the EduCoach manuscript definition of terms to reflect the actual file-upload, document-processing, concept-extraction, flashcard, embedding, and quiz-generation implementation. Also corrected one pipeline wording detail about quiz type allocation so the document matches the implemented allocator.

Problem being solved

The previous definition list included generic or outdated wording, duplicated the AI Study Assistant Chat term, and stated that automated quiz generation could produce essay-type questions even though the live generator only supports multiple-choice, identification, true/false, and fill-in-the-blank questions.

Scope of changes

- Refined existing definitions that already appeared in the manuscript.
- Added system-specific terms from the implemented pipeline, including Apache Tika, the NLP microservice, Pure NLP, document type detection, Gemini processing paths, sentence clustering, MMR, concept validation, quiz type allocation, semantic distractors, mastery context, and quota-aware degradation.
- Corrected the pipeline document's quiz allocation wording from stable remainder order to largest fractional remainder with stable selected type order.

Files/modules/screens/components/services affected

- `Docs/info/educoach-definition-of-terms.md`
- `Docs/info/file-upload-to-quiz-generation-pipeline.md`
- `educoach/nlp-service/main.py` reviewed
- `educoach/supabase/functions/process-document/index.ts` reviewed
- `educoach/supabase/functions/generate-quiz/index.ts` reviewed
- `educoach/supabase/functions/generate-quiz/quizAllocation.ts` reviewed
- `educoach/src/components/files/FileUploadDialog.tsx` reviewed
- `educoach/src/components/files/FilesContent.tsx` reviewed
- `educoach/src/hooks/useDocuments.ts` reviewed
- `educoach/src/hooks/useQuizzes.ts` reviewed
- `educoach-mobile/src/components/files/FileUploadModal.tsx` reviewed
- `educoach-mobile/src/screens/FilesScreen.tsx` reviewed

Supabase impact:

schema changes

No schema changes.

policy changes

No policy changes.

auth changes

No auth changes.

storage changes

No storage changes.

API/query changes

No API or query behavior changes. Existing Edge Function behavior was reviewed for documentation accuracy only.

User-facing behavior changes

No runtime behavior changes. The manuscript definitions now describe the actual implemented behavior more accurately.

Developer notes or architectural decisions

The definitions now describe EduCoach as an NLP-first, Gemini quality-gated pipeline. Gemini is documented as a multimodal PDF slide-deck processor, a document fallback/refinement layer, an embedding provider, and a quiz enhancement/validation layer rather than as the sole quiz generator.

Testing/verification performed

- Reviewed the reference definition style document.
- Reviewed the file upload to quiz generation pipeline document.
- Cross-checked implementation in the Python NLP service, process-document Edge Function, generate-quiz Edge Function, quiz allocation helper, web upload flow, web pending processing flow, mobile upload flow, and mobile pending processing flow.
- Verified the edited definition and pipeline documents contain the expected implementation-specific terms and no duplicate AI Study Assistant Chat definition.

Known limitations

No automated tests were required because this was a documentation-only update. The root `Docs/info` directory is outside the `educoach` git repository, so repository status must be checked from each app separately.

Follow-up tasks or recommended next steps

If the manuscript narrows its glossary to pipeline-only terms, consider moving non-pipeline product terms such as Admin Dashboard and Subscription Management into a separate general system glossary.
