export type BusinessStatus = 'New' | 'In Progress' | 'Resolved';

export type Category = 'Sales' | 'Support' | 'Billing' | 'Other';

export type CategorizationState = 'Pending' | 'Completed' | 'Failed';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  status: BusinessStatus;
  category: Category | null;
  categorizationState: CategorizationState;
}

export interface CreateEnquiryInput {
  name: string;
  email: string;
  message: string;
}
