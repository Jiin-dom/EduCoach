# Supabase Edge Functions Deployment Guide

This guide explains how to deploy Edge Functions to your Supabase project.

## Project Details
- **Project Reference**: `gibufmvycrefsthfzhgy`
- **Edge Functions Directory**: `supabase/functions/`

---

## Prerequisites

1. You need a Supabase access token. Get one from:
   - Go to: https://supabase.com/dashboard/account/tokens
   - Create a new token with a descriptive name
   - Copy and save it securely

---

## Deployment Commands

### Quick Deploy (All Functions)
```powershell
# Deploy all edge functions
npx supabase functions deploy --project-ref gibufmvycrefsthfzhgy --no-verify-jwt
```

### Deploy Specific Function
```powershell
# Deploy only the process-document function
npx supabase functions deploy process-document --project-ref gibufmvycrefsthfzhgy --no-verify-jwt
```

### First-Time Login
If you haven't logged in before, you'll be prompted to enter your access token:
```powershell
npx supabase login
```

---

## Command Flags Explained

| Flag | Description |
|------|-------------|
| `--project-ref` | Your Supabase project reference ID |
| `--no-verify-jwt` | Allows functions to be called without JWT auth (useful for webhook/public endpoints) |
| `--debug` | Shows detailed logs during deployment |

---

## Troubleshooting

### "Access token required"
Run `npx supabase login` first and paste your access token.

### "Function not found"
Make sure the function directory exists in `supabase/functions/<function-name>/index.ts`

### View Deployed Function Logs
```powershell
npx supabase functions logs process-document --project-ref gibufmvycrefsthfzhgy
```

---

## Available Edge Functions

| Function Name | Description |
|---------------|-------------|
| `process-document` | AI-powered document summarization using Google Gemini |

---

## Environment Variables Required

These are set in Supabase Dashboard > Edge Functions > Secrets:
- `GEMINI_API_KEY` - Your Google Gemini API key
- `SUPABASE_URL` - Auto-configured by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured by Supabase

---

## Full Example Workflow

```powershell
# 1. Navigate to project directory
cd D:\UC Subjects\4th Year 2nd Sem\CAPSTONE2\code\Dev-EduCoachv1\educoach> 

# 2. Login (first time only - will open browser)
npx supabase login

# 3. Deploy the function
npx supabase functions deploy process-document --project-ref gibufmvycrefsthfzhgy --no-verify-jwt
npx supabase functions deploy generate-quiz --project-ref gibufmvycrefsthfzhgy --no-verify-jwt
npx supabase functions deploy ai-tutor --project-ref gibufmvycrefsthfzhgy --no-verify-jwt


# 4. (Optional) Check logs
npx supabase functions logs process-document --project-ref gibufmvycrefsthfzhgy --tail
```

---

*Last Updated: 2026-01-12*
