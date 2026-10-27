import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { saveEnquiry, listEnquiries } from '@/lib/db';
import { categorizeEnquiry } from '@/lib/ai';
import { validateEnquiryInput } from '@/lib/validation';
import { Enquiry } from '@/lib/types';

// GET /api/enquiries?status=New - List enquiries newest first; filter optional
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || undefined;

    const enquiries = listEnquiries(statusFilter);
    return NextResponse.json(enquiries, { status: 200 });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve enquiries. Please try again later.' },
      { status: 500 }
    );
  }
}

// POST /api/enquiries - Validate, save first, then attempt categorization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Server-side validation
    const validation = validateEnquiryInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const { name, email, message } = body;
    const enquiryId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // 2. CRITICAL SPECIFICATION: Save to persistent DB FIRST before calling AI
    const newEnquiry: Enquiry = {
      id: enquiryId,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt,
      status: 'New',
      category: null,
      categorizationState: 'Pending',
    };

    saveEnquiry(newEnquiry);

    // 3. Attempt automatic AI categorization
    const aiResult = await categorizeEnquiry(enquiryId, newEnquiry.message);

    if (aiResult.success && aiResult.category) {
      // 4A. Valid category received
      const { updateCategorization } = await import('@/lib/db');
      updateCategorization(enquiryId, aiResult.category, 'Completed');
      newEnquiry.category = aiResult.category;
      newEnquiry.categorizationState = 'Completed';
    } else {
      // 4B. AI service or output failure -> Retain enquiry with Failed state
      const { updateCategorization } = await import('@/lib/db');
      updateCategorization(enquiryId, null, 'Failed');
      newEnquiry.category = null;
      newEnquiry.categorizationState = 'Failed';
    }

    return NextResponse.json(newEnquiry, { status: 201 });
  } catch (error) {
    console.error('Error creating enquiry:', error);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while processing your enquiry.' },
      { status: 500 }
    );
  }
}
