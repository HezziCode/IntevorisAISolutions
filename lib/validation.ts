export interface ValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    email?: string;
    message?: string;
  };
}

// RFC 5322 compliant simple email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEnquiryInput(data: {
  name?: string;
  email?: string;
  message?: string;
}): ValidationResult {
  const errors: { name?: string; email?: string; message?: string } = {};

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';

  if (!name) {
    errors.name = 'Full name is required and cannot be blank.';
  }

  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please provide a valid email address (e.g. user@example.com).';
  }

  if (!message) {
    errors.message = 'Enquiry message is required and cannot be blank.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
