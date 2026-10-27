import { NextRequest, NextResponse } from 'next/server';
import { findEnquiryById, updateStatus, deleteEnquiry } from '@/lib/db';
import { BusinessStatus } from '@/lib/types';

const VALID_STATUSES: readonly BusinessStatus[] = ['New', 'In Progress', 'Resolved'];

// PATCH /api/enquiries/:id - Update business status
export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status as BusinessStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    updateStatus(id, status as BusinessStatus);
    enquiry.status = status as BusinessStatus;

    return NextResponse.json(enquiry, { status: 200 });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while updating status.' },
      { status: 500 }
    );
  }
}

// DELETE /api/enquiries/:id - Delete an enquiry
export async function DELETE(
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

    deleteEnquiry(id);
    return NextResponse.json({ success: true, message: 'Enquiry deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while deleting enquiry.' },
      { status: 500 }
    );
  }
}
