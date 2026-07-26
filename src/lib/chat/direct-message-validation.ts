const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_RE = /^\+?[\d\s().-]{8,32}$/;

export const DIRECT_MESSAGE_NAME_MAX = 100;
export const DIRECT_MESSAGE_MESSAGE_MIN = 8;
export const DIRECT_MESSAGE_MESSAGE_MAX = 1000;

export type DirectMessageFormValues = {
  name: string;
  email: string;
  phoneNumber: string;
  message: string;
};

export type DirectMessageFieldErrors = Partial<
  Record<keyof DirectMessageFormValues, string>
>;

function isValidPhone(raw: string): boolean {
  if (!PHONE_ALLOWED_RE.test(raw)) {
    return false;
  }
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/** Returns field errors; empty object means valid. */
export function validateDirectMessageForm(
  values: DirectMessageFormValues,
): DirectMessageFieldErrors {
  const errors: DirectMessageFieldErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length > DIRECT_MESSAGE_NAME_MAX) {
    errors.name = `Name must be at most ${DIRECT_MESSAGE_NAME_MAX} characters.`;
  }

  const email = values.email.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const phoneRaw = values.phoneNumber.trim();
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    errors.phoneNumber = "Enter a valid phone number.";
  }

  const message = values.message.trim();
  if (
    message.length < DIRECT_MESSAGE_MESSAGE_MIN ||
    message.length > DIRECT_MESSAGE_MESSAGE_MAX
  ) {
    errors.message = `Message must be ${DIRECT_MESSAGE_MESSAGE_MIN}–${DIRECT_MESSAGE_MESSAGE_MAX} characters.`;
  }

  return errors;
}

export function normalizeDirectMessagePayload(values: DirectMessageFormValues): {
  name: string;
  email: string;
  message: string;
  phoneNumber?: string;
} {
  const phoneRaw = values.phoneNumber.trim();
  let phoneNumber: string | undefined;
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, "");
    phoneNumber = phoneRaw.startsWith("+") ? `+${digits}` : digits;
  }
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    message: values.message.trim(),
    phoneNumber,
  };
}
