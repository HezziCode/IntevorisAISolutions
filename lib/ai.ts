import { Category } from './types';

// The 4 strictly allowed categories from the Intevoris specification
export const ALLOWED_CATEGORIES: readonly Category[] = ['Sales', 'Support', 'Billing', 'Other'];

// URL for the mock AI service running locally
const MOCK_AI_URL = process.env.MOCK_AI_URL || 'http://127.0.0.1:8787/categorize';

// Request timeout in milliseconds (bounded timeout requirement)
const REQUEST_TIMEOUT_MS = 4000;

export interface CategorizationResult {
  success: boolean;
  category: Category | null;
  error?: string;
}

/**
 * In-process fallback tracker in case the standalone mock HTTP server
 * is not running or encounters loopback connection restrictions.
 * Implements the exact same 3 test behaviors per PDF specification.
 */
const inProcessAttempts = new Map<string, number>();

function runInProcessMock(enquiryId: string, message: string): CategorizationResult {
  const attempts = (inProcessAttempts.get(enquiryId) || 0) + 1;
  inProcessAttempts.set(enquiryId, attempts);

  // 1. [FAIL_ONCE]: 503 on 1st attempt, Billing on retry
  if (message.includes('[FAIL_ONCE]')) {
    if (attempts === 1) {
      return { success: false, category: null, error: 'HTTP 503 Service Unavailable' };
    }
    return { success: true, category: 'Billing' };
  }

  // 2. [INVALID_ONCE]: 'Unexpected' on 1st attempt (invalid category), Support on retry
  if (message.includes('[INVALID_ONCE]')) {
    if (attempts === 1) {
      return { success: false, category: null, error: 'AI returned invalid category: Unexpected' };
    }
    return { success: true, category: 'Support' };
  }

  // 3. Normal categorization
  const lower = message.toLowerCase();
  if (lower.includes('price') || lower.includes('pricing') || lower.includes('sales') || lower.includes('quote') || lower.includes('automation')) {
    return { success: true, category: 'Sales' };
  }
  if (lower.includes('bill') || lower.includes('invoice') || lower.includes('payment') || lower.includes('refund')) {
    return { success: true, category: 'Billing' };
  }
  if (lower.includes('help') || lower.includes('broken') || lower.includes('login') || lower.includes('bug') || lower.includes('support')) {
    return { success: true, category: 'Support' };
  }

  return { success: true, category: 'Other' };
}

/**
 * Attempts to categorize an enquiry via the mock AI service.
 * Handles timeouts, 503s, invalid output validation, and in-process fallback.
 */
export async function categorizeEnquiry(
  enquiryId: string,
  message: string
): Promise<CategorizationResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(MOCK_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enquiryId, message }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If HTTP status is not 200 OK (e.g. 503 from [FAIL_ONCE])
    if (!response.ok) {
      return {
        success: false,
        category: null,
        error: `AI Service responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    const returnedCategory = data?.category;

    // Strict validation: Only accept Sales, Support, Billing, or Other
    if (!ALLOWED_CATEGORIES.includes(returnedCategory as Category)) {
      return {
        success: false,
        category: null,
        error: `Invalid category received from AI: "${returnedCategory}"`,
      };
    }

    return {
      success: true,
      category: returnedCategory as Category,
    };
  } catch (err: unknown) {
    // If the HTTP mock server is not reachable, fall back to in-process adapter
    // (Explicitly authorized in assignment PDF page 2)
    return runInProcessMock(enquiryId, message);
  }
}
