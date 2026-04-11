# NLP Service Dependency Pinning Fix

- Date: 2026-04-11
- App affected: both
- Type of work: fix

## Summary of what was implemented

Pinned the NLP service embedding stack to explicit package versions so Docker rebuilds stop pulling newer `sentence-transformers` and `transformers` releases that change runtime behavior.

## Problem being solved

The `nlp-service` rebuilt successfully, but `/process` started failing at runtime after dependency reinstall. The container picked up a newer `sentence-transformers`/`transformers` combination than the previous working image because `requirements.txt` allowed open-ended upgrades.

## Scope of changes

- Replaced open-ended NLP dependency ranges with exact versions.
- Documented the rebuild and verification steps needed after the pinning change.

## Files/modules/screens/components/services affected

- `educoach/nlp-service/requirements.txt`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- NLP service rebuilds should now stay on a stable text-processing dependency set.
- Document processing should stop drifting across rebuilds because the embedding stack is reproducible.

## Developer notes or architectural decisions

- Pinned versions:
  - `sentence-transformers==2.7.0`
  - `transformers==4.41.2`
  - `scikit-learn==1.5.2`
  - `numpy==1.26.4`
- The fix is intentionally conservative: reproducibility is more important here than chasing latest releases in a production NLP service.

## Testing/verification performed

- Verified from the production rebuild logs that the failing image had drifted to:
  - `sentence-transformers 5.4.0`
  - `transformers 5.5.3`
- Confirmed the repo previously used open-ended version ranges that allowed this drift.

## Known limitations

- This change still requires rebuilding and restarting the running `nlp-service` container before production behavior changes.
- Runtime verification of `/process` must be done on the deployment host after rebuild.

## Follow-up tasks or recommended next steps

- Rebuild and restart the NLP service:
  - `docker compose up -d --build --no-deps nlp-service`
- Verify installed versions in the running container:
  - `docker exec -it educoach-nlp-service-1 python -c "import sentence_transformers, transformers; print(sentence_transformers.__version__); print(transformers.__version__)"`
- Re-run a real document processing request and confirm `/process` no longer throws the modality error.
