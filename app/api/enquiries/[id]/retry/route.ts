import { NextRequest, NextResponse } from 'next/server';
import { findEnquiryById, updateCategorization } from '@/lib/db';
import { categorizeEnquiry } from '@/lib/ai';

// POST /api/enquiries/:id/retry - Retry failed categorization
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const enquiry = findEnquiryById(id);
    if (!enquiry) {
      return NextResponse.json(
        { error: `Enquiry with ID "${id}" was not found.` },
        { status: 404 }
      );
    }

    // Call mock AI with the same original enquiry ID and customer message
    const aiResult = await categorizeEnquiry(enquiry.id, enquiry.message);

    if (aiResult.success && aiResult.category) {
      updateCategorization(enquiry.id, aiResult.category, 'Completed');
      enquiry.category = aiResult.category;
      enquiry.categorizationState = 'Completed';
    } else {
      updateCategorization(enquiry.id, null, 'Failed');
      enquiry.category = null;
      enquiry.categorizationState = 'Failed';
    }

    // Returns updated existing record (never creates a duplicate)
    return NextResponse.json(enquiry, { status: 200 });
  } catch (error) {
    console.error('Error during AI retry:', error);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while retrying categorization.' },
      { status: 500 }
    );
  }
}
