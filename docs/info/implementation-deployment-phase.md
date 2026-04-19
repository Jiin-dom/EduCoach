# Implementation/Deployment Phase

The system was implemented and deployed to actual users across web and mobile environments during the implementation and deployment phases. All specification requirements, including software, hardware, and human resources, are identified and thoroughly explained. Step-by-step instructions on accessing and using the application through web browsers and mobile devices were provided. The target goal and the rationale behind the application's creation were elaborated so that users clearly understood its purpose as an AI-powered academic coaching platform.

---

## Deployment Diagram

A deployment diagram models the physical deployment of software components on hardware nodes, showing their distribution and communication. It is used to visualize the deployment architecture of a system or application.

### Figure 1. Deployment Diagram

```
┌───────────────────────┐         ┌──────────────────────────────────┐
│        Client          │         │    EduCoach Application Server    │
│                        │         │                                  │
│  <<component>>         │         │  <<artifact>>                    │
│  Students              │         │  AI Tutor                        │
│                        │────────▶│                                  │
│  <<component>>         │         │  <<artifact>>                    │
│  Educators             │         │  Quiz Generation                 │
│                        │         │                                  │
│  <<component>>         │         │  <<artifact>>                    │
│  Admins                │         │  Learning Path                   │
│                        │         │                                  │
└───────────┬────────────┘         │  <<artifact>>                    │
            │                      │  Document Processing             │
            │                      │                                  │
            │                      └────────────────┬─────────────────┘
            │                                       │
            ▼                                       ▼
┌───────────────────────┐         ┌──────────────────────────────────┐
│  EduCoach Admin Server │         │       Database Server             │
│                        │         │                                  │
│  <<artifact>>          │         │  <<component>>                   │
│  User Management       │────────▶│  User Database                   │
│                        │         │                                  │
│  <<artifact>>          │         │  <<component>>                   │
│  Subscription          │         │  Learning Data                   │
│   Management           │         │                                  │
│                        │         │                                  │
└────────────────────────┘         └──────────────────────────────────┘
```

### Deployment Diagram Explanation

The deployment design for the EduCoach application with four nodes is depicted in the above figure. It shows the physical components and artifacts involved in the system's operation.

The **Client** node contains components for managing three types of users: Learners and Admins, allowing each user group to interact with the platform's various educational features. Students access the system to upload study materials, take quizzes, follow learning paths, and consult the AI tutor. Admins access administrative functions for managing user accounts and overseeing system-wide subscription operations.

The **EduCoach Application Server** node includes four primary artifacts that encompass the core functionalities of the application: AI Study Assistant for providing contextual, conversational academic coaching grounded in the student's own uploaded materials through a Retrieval-Augmented Generation pipeline; Quiz Generation for producing quizzes and flashcards from uploaded documents through a hybrid NLP and AI processing pipeline; Learning Path for organizing personalized study schedules, adaptive tasks, and progress tracking based on student goals and performance; and Document Processing for ingesting, extracting, embedding, and summarizing uploaded study materials in PDF, DOCX, and TXT formats.

The **EduCoach Admin Server** node includes two primary artifacts: User Management for handling user-related activities such as account creation, role assignment, profile administration, and access control across the platform; and Subscription Management for managing subscription statuses, plan tiers, and billing operations that determine user access to premium features such as advanced analytics and unlimited AI tutor interactions.

The **Database Server** node consists of two components: the User Database, which stores user profile data, authentication records, role assignments, subscription information, and notification history; and the Learning Data component, which holds all educational content and progress data including uploaded documents, document embeddings, generated quizzes, quiz results, flashcards, learning paths, study goals, study time preferences, AI Assistant Chat session histories, mastery records, and adaptive study tasks. This setup ensures a structured, modular approach to managing academic content and user interactions within the EduCoach application.

---

## Cost Specification

This section lists projected expenses for implementing the project, covering resources such as software, hosting infrastructure, and external service costs.

### Table 1: Cost Specification

| Resource | Description | Amount |
|----------|-------------|--------|
| Supabase (Free Tier) | Authentication, PostgreSQL database, storage (1 GB), edge functions, and realtime services | Free |
| DigitalOcean Droplet | Basic Droplet: 2 vCPUs, 4 GB RAM, 50 GB SSD Disk — hosts the NLP microservice and Apache Tika containers via Docker Compose | $24.00/month |
| Google AI Studio (Gemini API) | Usage-based pricing for Gemini 2.5 Flash Lite (generative) and Gemini Embedding 001 (embeddings) — charges are calculated per input/output token processed; free tier includes a generous allocation for development and low-volume production use | Usage-based (Free tier available) |
| Domain Name | Custom domain registration for the web application | ~$12.00/year |
| **Total Estimated Monthly Cost** | | **$24.00/month** (excluding variable AI usage) |

The Supabase free tier provides sufficient capacity for initial deployment, offering authentication for up to 50,000 monthly active users, 500 MB of database storage, 1 GB of file storage, and 500,000 edge function invocations per month. The DigitalOcean Basic Droplet at the specified configuration provides adequate computational resources to run both the Python NLP microservice and the Apache Tika document extraction service concurrently within Docker containers. Google AI Studio operates on a usage-based pricing model where costs are determined by the number of input and output tokens processed through the Gemini API; the free tier provides a sufficient allocation for development-phase testing and early production use with moderate traffic. As user volume scales beyond the free tier thresholds, costs for Supabase and Google AI Studio will increase proportionally based on usage.

---

## Human Resource Specification

A collaborative team of diverse professionals drives the development of the EduCoach application, each bringing their specialized expertise to ensure a comprehensive and effective AI-powered academic coaching platform for students. The individuals involved in creating the application are the software engineers, UI/UX designers, database engineers, AI/ML integration specialists, testers, and stakeholders.

The **Software Engineers** (Frontend and Backend) are responsible for coding the core functionalities that enable document management, quiz generation, learning path planning, and AI-powered tutoring. The frontend engineers develop the React 19 web application and the Expo React Native mobile application, ensuring responsive and performant user interfaces across both platforms. The backend engineers develop and maintain the Supabase Edge Functions that handle document processing, quiz generation pipelines, AI tutor logic, and subscription management. They also maintain the Python NLP microservice and its Docker containerization. The software engineers play a crucial role in integrating the various features seamlessly to support a unified learning experience across web and mobile environments.

The **UI/UX Designers** focus on creating intuitive and user-friendly interfaces that allow easy navigation and enhance the overall user experience. Their work ensures that students can efficiently interact with the platform, whether uploading study materials, taking quizzes, consulting the AI tutor, or reviewing their learning analytics. The designers apply established design principles using Tailwind CSS and Radix UI component primitives to maintain visual consistency across the application. Their contributions are essential in reducing cognitive load and ensuring that the educational tools are accessible and engaging for users of varying technical proficiency.

The **Database Engineers** build and maintain a secure and scalable database infrastructure using Supabase PostgreSQL that stores user profiles, documents, embeddings, quizzes, learning paths, study goals, subscriptions, and notification data. They design and implement the database schema through versioned migrations, configure Row-Level Security policies to enforce strict data isolation between users, and optimize query performance for vector similarity searches used in the RAG pipeline. They ensure the data is accessible in real-time through Supabase's realtime subscription capabilities, supporting live notification delivery and enabling accurate monitoring of student progress.

The **AI/ML Integration Specialists** are responsible for designing and implementing the artificial intelligence features that distinguish EduCoach from conventional study tools. They configure and optimize the Google Gemini API integrations for document summarization, quiz question generation and enhancement, and conversational tutoring responses. They develop and maintain the Retrieval-Augmented Generation pipeline that enables the AI tutor to provide contextual answers grounded in students' own uploaded materials. Additionally, they manage the NLP microservice that performs deterministic text processing, keyword extraction, and template-based quiz generation using spaCy, KeyBERT, and sentence transformer models. Their expertise ensures that the AI features are accurate, educationally sound, and aligned with pedagogical best practices.

The **Testers and Users** (Students) play a dual role as both the primary user base and active contributors to quality assurance. Students interact with the platform by uploading their course materials, generating quizzes, engaging with the AI tutor, and following personalized learning paths. Their participation in real-world usage allows for practical feedback on functionality, usability, content quality, and any additional features needed to better address their academic challenges. Testing encompasses both automated test suites using Vitest and manual user acceptance testing conducted by students across various academic disciplines and device configurations.

The **Stakeholders** (Educators and Learners) are involved throughout the development process to provide input on educational requirements, pedagogical approaches, and content accuracy standards. Educators contribute domain expertise that guides the AI tutor's response quality, quiz difficulty calibration, and learning path sequencing. Learners provide feedback on whether the application aligns with their study habits, academic goals, and preferred learning modalities. Their collective input ensures that EduCoach delivers genuine educational value rather than serving as a mere productivity tool.

Together, this integrated team ensures that EduCoach becomes an effective, reliable, and learner-centric solution that meets the dynamic demands of modern academic study and AI-assisted learning.

---

## User Guide

This section's goal is to instruct users on how to use the EduCoach application. Another name for it is the User Manual.

### 1. Introduction

EduCoach is an AI-powered academic coaching platform designed to help students study more effectively. It enables users to upload their course materials, automatically generate quizzes and flashcards from those materials, engage in contextual conversations with an AI tutor grounded in their own content, and follow personalized learning paths. The platform streamlines study management, progress tracking, and knowledge retention, helping students optimize their study time and achieve their academic goals efficiently.

### 2. System Summary

#### 2.1 System Configuration

EduCoach runs on devices such as desktop computers, laptops, tablets, and mobile phones. The web application is accessible through modern web browsers including Google Chrome (version 90 and above), Mozilla Firefox (version 88 and above), Microsoft Edge (version 90 and above), and Safari (version 14 and above). The mobile application is compatible with Android devices running Android 10 (API level 29) and above, as well as iOS devices running iOS 14 and above. The application requires an active Internet connection for all features, as document processing, quiz generation, and AI tutoring are performed server-side.

#### 2.2 User Access Level

Users who register through the web application can access all student features available on the web platform, including the administrative panel for users assigned the admin role. Users who register through the mobile application can access all student features available on the mobile platform. Both platforms share the same user account and data through Supabase, allowing users to switch between web and mobile seamlessly. Admin-level features are accessible exclusively through the web application.

### 3. Installation

The EduCoach web application does not require a traditional installation process. Users access the platform directly through a web browser by navigating to the application URL. The mobile application can be installed on Android and iOS devices through the Expo distribution channel. Detailed installation steps are provided in the Installation Guide section of this document.

### 4. User Manual

#### Login Flow (Web Application)

1. Navigate to the EduCoach web application URL using a supported web browser.
2. On the login page, enter a valid email address in the email input field.
3. Enter the corresponding password in the password input field.
4. Click the "Login" button to authenticate and access the dashboard.
5. Alternatively, click "Continue with Google" to log in using an existing Google account.
6. Alternatively, click "Continue with Facebook" to log in using an existing Facebook account.
7. Alternatively, click "Continue with Apple" to log in using an existing Apple account.
8. If the password has been forgotten, click the "Forgot Password" link to initiate the password reset process via email.
9. If no account exists, click "Create Account" to navigate to the registration page.

#### Signup Flow (Web Application)

1. Click "Create Account" from the login page to navigate to the registration form.
2. Enter a valid email address in the email input field.
3. Enter a secure password in the password input field.
4. Re-enter the password in the confirmation field to verify accuracy.
5. Click the "Sign Up" button to create the account.
6. Alternatively, click "Continue with Google" to register using an existing Google account.
7. Alternatively, click "Continue with Facebook" to register using an existing Facebook account.
8. Alternatively, click "Continue with Apple" to register using an existing Apple account.
9. After successful registration, the user is redirected to the profiling screen.
10. Complete the profiling questionnaire to set up study preferences, academic goals, and learning style.
11. Upon completing the profiling step, the user is granted access to the main dashboard.
12. If the user already has an account, click the "Login" link to return to the login page.

#### Login Flow (Mobile Application)

1. Open the EduCoach mobile application on the device.
2. On the login screen, enter a valid email address in the email input field.
3. Enter the corresponding password in the password input field.
4. Tap the "Login" button to authenticate and access the dashboard.
5. Alternatively, tap "Continue with Google" to log in using an existing Google account.
6. Alternatively, tap "Continue with Facebook" to log in using an existing Facebook account.
7. Alternatively, tap "Continue with Apple" to log in using an existing Apple account.
8. If the password has been forgotten, tap the "Forgot Password" link to initiate the password reset process.
9. If no account exists, tap "Create Account" to navigate to the registration screen.

#### Signup Flow (Mobile Application)

1. Tap "Create Account" from the login screen to navigate to the registration form.
2. Enter a valid email address in the email input field.
3. Enter a secure password in the password input field.
4. Re-enter the password in the confirmation field to verify accuracy.
5. Tap the "Sign Up" button to create the account.
6. Alternatively, tap "Continue with Google" to register using an existing Google account.
7. Alternatively, tap "Continue with Facebook" to register using an existing Facebook account.
8. Alternatively, tap "Continue with Apple" to register using an existing Apple account.
9. After successful registration, the user is redirected to the profiling screen.
10. Complete the profiling questionnaire to configure study preferences, academic discipline, and learning goals.
11. Upon completing the profiling step, the user is granted access to the main dashboard and bottom navigation tabs.
12. If the user already has an account, tap the "Login" link to return to the login screen.

#### Uploading Study Materials (Web Application)

1. From the dashboard, click "Files" in the sidebar navigation to access the file management page.
2. Click the "Upload" button to open the file upload dialog.
3. Select one or more files from the device. Supported formats include PDF, DOCX, and PPTX.
4. The selected files are uploaded to the Supabase storage bucket and queued for processing.
5. The system automatically extracts text content using Apache Tika and the NLP microservice.
6. Document embeddings are generated using Gemini Embedding 001 for semantic search and AI tutor integration.
7. Once processing is complete, the file status updates to indicate that quizzes and flashcards can be generated.
8. Click on a processed file to view its contents, generated summaries, and available actions.

#### Accessing the AI Tutor (Web Application)

1. From any page, locate the EduBuddy floating action button positioned at the bottom-right corner of the screen.
2. Click the floating button to open the AI tutor chat interface.
3. Type a question related to uploaded study materials in the message input field.
4. Press Enter or click the send button to submit the query.
5. The AI tutor retrieves relevant content from the user's uploaded documents using vector similarity search.
6. A contextual response grounded in the user's own materials is generated by Gemini 2.5 Flash Lite and displayed in the chat window.
7. Continue the conversation by asking follow-up questions for deeper understanding.
8. The conversation history is preserved in the AI session records for future reference.

---

## Installation Guide

The Installation Guide is a useful resource that assists users in correctly setting up and accessing the EduCoach application on their devices.

### Web Application Installation

The steps to access the web application include:

1. **Check device requirements**
   a. The device must have a modern web browser installed. Supported browsers include Google Chrome (version 90+), Mozilla Firefox (version 88+), Microsoft Edge (version 90+), or Safari (version 14+).
   b. The device must be connected to the Internet with a stable connection, as all document processing, quiz generation, and AI tutoring features require server communication.

2. **Access the application**
   a. Open a supported web browser on the device.
   b. Navigate to the EduCoach web application URL in the browser address bar.
   c. The login page will load, indicating that the application is accessible and ready for use.

3. **Create an account**
   a. Click the "Create Account" button on the login page.
   b. Enter a valid email address, a secure password, and confirm the password.
   c. Alternatively, click one of the OAuth provider buttons (Google, Facebook, or Apple) to register with an existing account.
   d. Complete the profiling questionnaire that appears after successful registration to configure study preferences and academic goals.

4. **Log in and start using EduCoach**
   a. Enter the registered email address and password on the login page.
   b. Click the "Login" button to authenticate.
   c. Upon successful login, the user is directed to the main dashboard where they can upload study materials, generate quizzes, access the AI tutor, and manage their learning path.
   d. The application is now ready to use.

### Mobile Application Installation

The steps to install the mobile application include:

1. **Check device requirements**
   a. For Android devices, the device must be running Android 10 (API level 29) or higher.
   b. For iOS devices, the device must be running iOS 14 or higher.
   c. The device must be connected to the Internet with a stable connection.

2. **Install the application**
   a. Download the EduCoach application from the designated distribution channel (Expo build or direct APK for Android).
   b. For Android, if installing via APK, enable the "Install from Unknown Sources" option in the device security settings to allow installation from third-party sources.
   c. For iOS, follow the TestFlight or direct installation instructions provided.
   d. Wait for the installation to complete.

3. **Create an account**
   a. Open the EduCoach application on the device.
   b. Tap the "Create Account" button on the login screen.
   c. Enter a valid email address, a secure password, and confirm the password.
   d. Alternatively, tap one of the OAuth provider buttons (Google, Facebook, or Apple) to register with an existing account.
   e. Complete the profiling questionnaire to set up study preferences and learning goals.

4. **Log in and start using EduCoach**
   a. Enter the registered email address and password on the login screen.
   b. Tap the "Login" button to authenticate.
   c. Upon successful login, the user is directed to the main dashboard with bottom navigation tabs for accessing the library, quizzes, learning path, analytics, and AI tutor features.
   d. The application is now ready to use.
