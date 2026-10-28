# Customer Enquiry Tracker

## 1. Setup Commands

Run the following commands in your terminal:

```bash
# 1. Install dependencies
npm install

# 2. Terminal 1: Start the Mock AI Service (Port 8787)
node mock-ai-service.mjs

# 3. Terminal 2: Start the Next.js Application (Port 3000)
npm run dev
```

Open your browser at **http://localhost:3000**.

---

## 3. Mock Service Instructions

* **Test Triggers**:
  1. **Success**: `"Please send pricing for your automation service."` $\rightarrow$ returns category `Sales`.
  2. **Temporary Failure**: `"[FAIL_ONCE] I have an invoice question."` $\rightarrow$ returns HTTP 503 on attempt 1, then `Billing` on retry.
  3. **Invalid AI Output**: `"[INVALID_ONCE] My login is broken."` $\rightarrow$ returns category `Unexpected` on attempt 1, then `Support` on retry.


---

## 4. Architecture Flow & Request/Response Examples

### Architecture Process Flow
```
Customer Form ──► Next.js Backend ──► SQLite Database (Save First) ──► Mock AI Service
```

### Request Example
* **Endpoint**: `POST /api/enquiries`
* **Payload sent by form**:
```json
{
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "Please send pricing for automation"
}
```

### Response Example
* **HTTP Status**: `201 Created`
* **Payload returned by backend**:
```json
{
  "id": "c5d19484-90aa-43d9-9524-7e50b1d3d63c",
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "Please send pricing for automation",
  "createdAt": "2026-10-28T16:00:00.000Z",
  "status": "New",
  "category": "Sales",
  "categorizationState": "Completed"
}
```


---

## 5. Verification Checklist & Results

| Check | Test Requirement | Observed Result | Status |
| :--- | :--- | :--- | :---: |
| **A** | Valid enquiry saves and survives page refresh | Enquiry is saved in SQLite database. Data stays intact after page reload. | **PASSED** |
| **B** | Empty fields and malformed email are rejected | Blank fields and bad email formats are stopped with HTTP 400 and clear error messages. | **PASSED** |
| **C** | Valid category is stored and shown | Valid AI category (`Sales`, `Support`, `Billing`, `Other`) is saved in database and shown on the dashboard. | **PASSED** |
| **D** | `[FAIL_ONCE]` preserves record and shows Failed | Simulates a 503 error. Customer message is safely kept in database with state `Failed`. | **PASSED** |
| **E** | Retry recovers without creating duplicate enquiry | Clicking "Retry AI" updates the same existing record without creating any duplicate row. | **PASSED** |
| **F** | `[INVALID_ONCE]` is rejected, then recovers on retry | Bad category `Unexpected` is rejected by backend. Clicking Retry successfully updates to `Support`. | **PASSED** |
| **G** | Status changes survive refresh | Changing status to `In Progress` or `Resolved` stays saved even after refreshing the page. | **PASSED** |
| **H** | Status filter returns correct enquiries | Filter dropdown correctly shows only the enquiries matching the selected status. | **PASSED** |


---

