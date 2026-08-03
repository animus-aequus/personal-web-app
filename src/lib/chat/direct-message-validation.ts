import type { TFunction } from "i18next";

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
  t: TFunction,
): DirectMessageFieldErrors {
  const errors: DirectMessageFieldErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = t("directMessage.errors.nameRequired");
  } else if (name.length > DIRECT_MESSAGE_NAME_MAX) {
    errors.name = t("directMessage.errors.nameMax", {
      max: DIRECT_MESSAGE_NAME_MAX,
    });
  }

  const email = values.email.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    errors.email = t("directMessage.errors.emailInvalid");
  }

  const phoneRaw = values.phoneNumber.trim();
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    errors.phoneNumber = t("directMessage.errors.phoneInvalid");
  }

  const message = values.message.trim();
  if (
    message.length < DIRECT_MESSAGE_MESSAGE_MIN ||
    message.length > DIRECT_MESSAGE_MESSAGE_MAX
  ) {
    errors.message = t("directMessage.errors.messageLength", {
      min: DIRECT_MESSAGE_MESSAGE_MIN,
      max: DIRECT_MESSAGE_MESSAGE_MAX,
    });
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
