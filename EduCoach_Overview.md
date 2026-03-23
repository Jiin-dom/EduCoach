# EduCoach Overview

Welcome, apprentice! This document provides a high-level overview of the **EduCoach** project. Think of it as your map to the territory.

## What is EduCoach?

EduCoach is an **AI-powered personalized learning platform**. Its main goal is to help students study smarter, not just harder. It takes raw study materials and transforms them into active learning tools. 

Here is what it allows users to do:
- **Upload Study Materials:** Users can upload PDFs, Word documents, text files, and markdown files.
- **AI Extraction:** The system uses Google Gemini AI to read these documents, summarize them, and extract core concepts.
- **Active Recall:** (Coming soon) Generating quizzes and flashcards directly from the uploaded materials.
- **Personalized Learning Path:** (Coming soon) A study schedule and analytics tracker tailored to the student's learning style and goals.

## The Technology Stack (What's Under the Hood)

A good mechanic knows their tools. Here are ours:

### Frontend (The Face of the App)
- **React 18 & Vite:** For building a lightning-fast user interface.
- **TypeScript:** To catch bugs before they even run. Types are your best friend!
- **Tailwind CSS & shadcn/ui:** For styling. clean, modern, and highly reusable components.
- **TanStack Query (React Query):** For managing async state and API calls without losing our minds.

### Backend (The Engine Room)
- **Supabase:** Our Backend-as-a-Service (BaaS). It handles:
  - **PostgreSQL Database:** Where all our relational data lives.
  - **Authentication:** Keeping user data secure.
  - **Storage:** Where we keep the uploaded document files.
- **Supabase Edge Functions:** Serverless functions that run our heavy backend tasks, like processing documents.

### AI & Machine Learning (The Brains)
- **Google Gemini API (gemini-2.5-flash-lite):** We use this to read the text and pull out summaries and concepts.
- **text-embedding-004:** We generate "vector embeddings" of the text chunks.
- **pgvector:** A PostgreSQL extension that lets us search through these vectors. This is how we find relevant document chunks when generating quizzes!

## How It All Connects (The Architecture)

When a user uses EduCoach, here is the journey their data takes:

1. **Onboarding:** A user registers, logs in, and fills out a profiling form (learning style, goals, study time). This sets up their `user_profile` in Supabase.
2. **Uploading:** The user drops a PDF into the dashboard. It gets saved to **Supabase Storage**.
3. **Processing:** They click "Process". An **Edge Function** kicks off! It downloads the file, splits it into small text chunks, and sends them to **Gemini AI**.
4. **Extraction:** Gemini returns a summary, concepts, and vector embeddings. All of this gets saved back into the PostgreSQL database.
5. **Learning:** The frontend fetches these derived concepts so the user can review them, laying the groundwork for flashcards and quizzes.

## Current Project Status

As of right now, we have successfully built the **Foundation and AI Processing**:
- Authentication, profiling, file uploads, and AI concept extraction are **working**.
- Next up on the chopping block: Quiz generation, flashcards, and the personalized learning path scheduling!
