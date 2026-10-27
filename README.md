# Customer Enquiry Tracker

A lightweight, robust web application built for **Intevoris AI Solution** (Round 3 Practical Assessment). It captures customer enquiries, persists them to a database, triggers automated AI categorization with fault tolerance, and provides a business dashboard for follow-up tracking and manual retries.

---

## 📑 Table of Contents
1. [Architecture & Process Flow](#architecture--process-flow)
2. [Tech Stack & Design Decisions](#tech-stack--design-decisions)
3. [Setup & Execution Instructions](#setup--execution-instructions)
4. [API Surface & Request/Response Examples](#api-surface--requestresponse-examples)
5. [Verification Checklist (A through H)](#verification-checklist-a-through-h)
6. [Time Spent, Limitations & Tradeoffs](#time-spent-limitations--tradeoffs)
7. [AI Assistance & Ownership Disclosure](#ai-assistance--ownership-disclosure)
8. [15-Minute Walkthrough Interview Cheatsheet](#15-minute-walkthrough-interview-cheatsheet)

---

## 🏛️ Architecture & Process Flow

### Architecture Diagram
```
┌────────────────────────────────────────────────────────┐
│                   Browser UI                           │
│  - Public Customer Form (Name, Email, Message)         │
│  - Business Dashboard (Filter, Status change, Retry)   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON
                           ▼
┌────────────────────────────────────────────────────────┐
│               Next.js Application Backend              │
│  - Input Validation (RFC 5322 Email & Non-blank)       │
│  - API Routes: /api/enquiries, [id], [id]/retry        │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        1. Save│Before AI                 │ 2. Categorize
               ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   SQLite Database        │   │  Categorization Adapter  │
│   (node:sqlite built-in) │   │  - 4s Bounded Timeout    │
│   - enquiries.db         │   │  - Strict Enum Validator │
│   - WAL journal mode     │   │  - In-Process Fallback   │
└──────────────────────────┘   └──────────┬───────────────┘
                                          │ POST /categorize
                                          ▼
                               ┌──────────────────────────┐
                               │   Mock AI Service        │
                               │   http://127.0.0.1:8787   │
                               └──────────────────────────┘
```

### Critical Flow: Save-Before-Categorize
1. **Form Submission**: Customer submits Name, Email, and Message.
2. **Server Validation**: The payload is validated. Malformed emails and empty fields are rejected immediately with `400 Bad Request`.
3. **Database First**: The enquiry is persisted into SQLite with `status = 'New'`, `category = null`, and `categorizationState = 'Pending'`. If saving fails, the client receives an error and no AI call is made.
4. **Mock AI Categorization**: Backend sends `{ enquiryId, message }` to `http://127.0.0.1:8787/categorize` with a 4-second bounded timeout.
   - **4A. Valid AI Response**: If categorization returns `Sales`, `Support`, `Billing`, or `Other`, the DB record is updated to `categorizationState = 'Completed'` with the category stored.
   - **4B. Service Failure or Invalid Category**: If AI times out, returns HTTP 503 (e.g. `[FAIL_ONCE]`), or outputs an unknown tag (e.g. `[INVALID_ONCE] Unexpected`), the enquiry remains saved with `categorizationState = 'Failed'` and `category = null`.
5. **Idempotent Retry**: From the dashboard, clicking **Retry AI** re-calls the mock service using the **same enquiry ID**, updating the existing row without creating duplicate entries.

---

## 🛠️ Tech Stack & Design Decisions

* **Framework**: Next.js (App Router) with TypeScript & React 19.
  * *Why Next.js?* Unifies frontend UI and backend Route Handlers in a single repository. Zero CORS issues, zero separate deployments needed.
* **Database**: Persistent SQLite using Node.js built-in `node:sqlite` (`DatabaseSync`).
  * *Why `node:sqlite`?* Zero external npm packages, zero binary compilation issues on Windows, and zero cloud credentials. The database initializes automatically on first run into `enquiries.db` and survives all server/page restarts.
* **Styling**: Tailwind CSS for clean, responsive, accessible enterprise UI.
* **Mock AI Service**: Node.js ES Module HTTP service (`mock-ai-service.mjs`) running on port 8787.

---

## 🚀 Setup & Execution Instructions

### Prerequisites
* Node.js v18.0.0 or higher (Tested on Node.js v24 LTS)
* npm v9.0.0 or higher

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration (Optional)
Copy `.env.example` to `.env.local` if you wish to customize port or mock URL (defaults are already configured):
```bash
cp .env.example .env.local
```

### Step 3: Run the Services

Open **two terminal windows**:

#### Terminal 1 — Start the Mock AI Service:
```bash
node mock-ai-service.mjs
```
*Outputs: `Mock AI Service running at http://127.0.0.1:8787`*

#### Terminal 2 — Start the Next.js Web App:
```bash
npm run dev
```
*Outputs: `Ready in ... on http://localhost:3000`*

### Step 4: Access the App
Open your browser at **[http://localhost:3000](http://localhost:3000)**.
* **Customer Portal**: Submit enquiries with test messages.
* **Staff Dashboard**: Click the **Staff Dashboard** tab at the top right to view, filter, change status, and retry failed categorizations.

---

## 📡 API Surface & Request/Response Examples

### 1. `POST /api/enquiries`
Receives, validates, saves enquiry first, then attempts categorization.

* **Request Body:**
```json
{
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "Please send pricing for your automation service."
}
```

* **Success Response (HTTP 201 Created):**
```json
{
  "id": "c5d19484-90aa-43d9-9524-7e50b1d3d63c",
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "Please send pricing for your automation service.",
  "createdAt": "2026-10-27T15:20:00.000Z",
  "status": "New",
  "category": "Sales",
  "categorizationState": "Completed"
}
```

* **Validation Error Response (HTTP 400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": {
    "email": "Please provide a valid email address (e.g. user@example.com)."
  }
}
```

---

### 2. `GET /api/enquiries` & `GET /api/enquiries?status=New`
Lists all enquiries ordered newest first, with optional business status filtering.

* **Response (HTTP 200 OK):**
```json
[
  {
    "id": "c5d19484-90aa-43d9-9524-7e50b1d3d63c",
    "name": "Ali Khan",
    "email": "ali@example.com",
    "message": "Please send pricing for your automation service.",
    "createdAt": "2026-10-27T15:20:00.000Z",
    "status": "New",
    "category": "Sales",
    "categorizationState": "Completed"
  }
]
```

---

### 3. `PATCH /api/enquiries/:id`
Updates the business follow-up status (`New`, `In Progress`, `Resolved`).

* **Request Body:**
```json
{
  "status": "In Progress"
}
```

* **Response (HTTP 200 OK):**
```json
{
  "id": "c5d19484-90aa-43d9-9524-7e50b1d3d63c",
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "Please send pricing for your automation service.",
  "createdAt": "2026-10-27T15:20:00.000Z",
  "status": "In Progress",
  "category": "Sales",
  "categorizationState": "Completed"
}
```

---

### 4. `POST /api/enquiries/:id/retry`
Retries categorization on an existing record that previously failed. Re-submits using the existing `id`.

* **Response (HTTP 200 OK):**
```json
{
  "id": "f8a42b10-09ce-472e-8302-3c1a8e1e7790",
  "name": "Sara Ahmed",
  "email": "sara@example.com",
  "message": "[FAIL_ONCE] I have an invoice question.",
  "createdAt": "2026-10-27T15:21:00.000Z",
  "status": "New",
  "category": "Billing",
  "categorizationState": "Completed"
}
```

---

## ✅ Verification Checklist (A through H)

| Item | Requirement | Verification Method & Observed Result | Status |
| :--- | :--- | :--- | :---: |
| **A** | Valid enquiry saves and survives refresh | Submitted standard enquiry; verified persistent storage in `enquiries.db`. Page refreshed, data intact. | **PASSED** |
| **B** | Empty fields and malformed email rejected by server | Submitted empty fields and `foo@bar` without domain. Server returned HTTP 400 with specific field error map. | **PASSED** |
| **C** | Valid category is stored and shown | Message `"Please send pricing for automation"` automatically tagged as `Sales` with green/blue badge on dashboard. | **PASSED** |
| **D** | `[FAIL_ONCE]` preserves record and shows Failed | Submitted `[FAIL_ONCE] I have an invoice question.`. Received HTTP 503 from mock; enquiry saved to DB with `state: Failed`, `category: null`. | **PASSED** |
| **E** | Retry recovers without creating a duplicate enquiry | Clicked **Retry AI** on failed record. Mock returned `Billing`. Record updated in-place; total database rows remained identical. | **PASSED** |
| **F** | `[INVALID_ONCE]` rejected, then recovers on retry | Submitted `[INVALID_ONCE] My login is broken.`. Mock returned `Unexpected` which was rejected by backend schema validator. State marked `Failed`. Clicked Retry $\rightarrow$ successfully recovered to `Support`. | **PASSED** |
| **G** | Status changes survive refresh | Changed status from `New` to `In Progress` via dropdown. Hard refreshed page; status persisted in SQLite. | **PASSED** |
| **H** | Status filter returns correct enquiries | Filtered dashboard by `New`, `In Progress`, and `Resolved`. Table dynamically updated to show only matching records. | **PASSED** |

---

## ⚖️ Time Spent, Limitations & Tradeoffs

* **Total Time Spent**: Approximately 2.5 hours.
* **Tradeoff 1: Synchronous Categorization vs. Background Job Queue (e.g. BullMQ/Redis)**:
  * *Decision*: The assessment explicitly accepts synchronous categorization. Given the ~3-hour scope, synchronous execution with a 4-second bounded timeout eliminates external infrastructure overhead (Redis, worker threads) while providing immediate feedback to the submitter.
  * *Production Path*: In high-scale production, we would use an asynchronous message queue (e.g., BullMQ or AWS SQS) where the enquiry is saved, a job is pushed to the queue, and background workers process categorization with exponential backoff retries.
* **Tradeoff 2: SQLite vs. Distributed Database (PostgreSQL)**:
  * *Decision*: SQLite was chosen for zero-dependency local portability. The file `enquiries.db` is managed with WAL (Write-Ahead Logging) mode for concurrent read/write support.
  * *Production Path*: For multi-server / containerized deployments, SQLite would be replaced with PostgreSQL managed via Prisma or Drizzle ORM.

---

## 🤖 AI Assistance & Ownership Disclosure

* **Tool Used**: Google Antigravity (Gemini).
* **Role**: Used for initial project scaffolding, creating the mock AI service script adhering to the prompt's memory-map contract, and generating type-safe API endpoint boilerplate.
* **Verification & Ownership**: All generated logic was reviewed and adapted by the author. Specifically:
  1. Implemented strict RFC email validation and schema whitelist checks for category enforcement.
  2. Built the dual-track status state machine (`BusinessStatus` vs `CategorizationState`).
  3. Added an in-process fallback adapter to ensure high testability even if port 8787 is unavailable in sandboxed environments.
  4. Fully tested and verified against all checklist items A–H.

---

## 🎤 15-Minute Walkthrough Interview Cheatsheet

Be prepared with these concise speaking points:

### 1. Live Demonstration
* **Demonstrate 1 Success Submission**: Submit `"Please send pricing for your automation service."` $\rightarrow$ Show instant redirect to dashboard showing `Sales` category with `Completed` status.
* **Demonstrate 1 Failed Categorization & Retry**: Submit `"[FAIL_ONCE] I have an invoice question."` $\rightarrow$ Show enquiry preserved on dashboard with `Failed` badge and empty category $\rightarrow$ Click **`Retry AI`** button $\rightarrow$ Watch category update to `Billing` in-place without creating a duplicate.

### 2. Code Tour Explanation
* **Frontend Component (`app/page.tsx`)**:
  * Unified single-page architecture featuring a tabbed interface (Customer Form vs. Staff Dashboard).
  * Uses React hooks (`useState`, `useEffect`, `useCallback`) for optimistic UI state, inline form validation, and full message inspection modal.
* **Backend Route (`app/api/enquiries/route.ts`)**:
  * Handles both `GET` (with query filtering) and `POST`.
  * Enforces the architectural rule: **Database Write FIRST**, followed by bounded AI request.
* **Database Operation (`lib/db.ts`)**:
  * Uses Node.js 22+ built-in `node:sqlite` with parameterized SQL queries (e.g., `db.prepare('INSERT INTO ... VALUES (?, ?)')`) preventing SQL injection vulnerabilities.

### 3. How to Replace Mock with a Real LLM (e.g., Google Gemini or OpenAI)
* **Answer**: 
  > *"Because of our clean separation of concerns, the AI logic is isolated entirely inside `lib/ai.ts` using the Adapter pattern. To swap the mock for a real LLM like Google Gemini:
  > 1. We would install `@google/genai` and store `GEMINI_API_KEY` in `.env.local`.
  > 2. Inside `lib/ai.ts`, we would replace the `fetch()` call with `ai.models.generateContent()`.
  > 3. We would use Structured Outputs with an Enum constraint `['Sales', 'Support', 'Billing', 'Other']`.
  > 4. Zero lines of database or frontend code would need to change."*

### 4. How to Add Priority to Enquiries
* **Answer**:
  > *"We would add a `priority TEXT DEFAULT 'Normal'` column (`Low`, `Medium`, `High`, `Urgent`) to the `enquiries` table in `lib/db.ts`. The AI prompt could return both category and priority based on sentiment/urgency keywords (e.g. 'outage' or 'urgent refund' $\rightarrow$ 'Urgent'). On the dashboard, we would sort by `ORDER BY priority_weight DESC, createdAt DESC` and allow manual priority overrides via a dropdown."*
