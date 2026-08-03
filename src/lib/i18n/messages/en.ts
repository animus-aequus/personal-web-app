/** English UI catalog — source of truth for TranslationDictionary. */

export const en = {
  common: {
    confirm: "Confirm",
    cancel: "Cancel",
    retry: "Retry",
    ok: "OK",
    send: "Send",
    loading: "Loading",
    copied: "Copied",
    copyMeetLink: "Copy Meet link",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    meeting: "Meeting",
    close: "Close",
  },
  sidebar: {
    language: "Language",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  greeting: {
    headline: "Hey! Kacper's AI assistant here.",
    hints: {
      ask: "Ask anything about Kacper",
      book: "Book a meeting",
      contact: "Contact Kacper directly",
    },
  },
  chat: {
    placeholder: "Ask anything…",
    loadingChat: "Loading chat",
    loadingOlder: "Loading older messages",
    assistantThinking: "Assistant is thinking…",
    scrollUpOlder: "Scroll up for older messages",
    errorGeneric: "Something went wrong. Please try again.",
    stopResponse: "Stop response",
    endVoice: "End voice conversation",
    startVoice: "Start voice conversation",
    sendMessage: "Send message",
    enableAudio: "Enable audio",
    interrupted: "Interrupted before finishing",
    voiceLanguageLabel: "Voice language",
  },
  voice: {
    ttsFallbackWarning:
      "Voice replies in this language are not supported yet. The agent will answer in English.",
  },
  pause: {
    title: "Assistant paused",
    defaultMessage:
      "Due to high interest, public access to the assistant is temporarily paused.",
  },
  turnstile: {
    verifyNew: "We need to verify you are human to continue.",
    verifyExpired:
      "Session expired. We need to verify you are human to continue.",
    verificationFailed: "Verification failed. Please try again.",
    securityVerification: "Security verification",
  },
  language: {
    changeFailed: "Could not update language. Please try again.",
  },
  systemNotes: {
    booking: {
      confirmed: 'Booking "{{name}}" confirmed',
      cancelled: 'Booking "{{name}}" cancelled',
    },
    meeting: {
      cancelled: 'Meeting "{{name}}" cancelled',
    },
    cancellation: {
      aborted: 'Cancellation of "{{name}}" aborted',
    },
    private: {
      message_sent:
        "Private message sent from {{name}} ({{email}}): {{message}}",
      message_cancelled: "Private message cancelled",
    },
  },
  booking: {
    otpTitle: "Enter confirmation code",
    otpSent: "Code sent to {{email}}. Expires in {{timer}}.",
    otpAria: "Booking confirmation code",
    codeExpired: "Confirmation code expired.",
    tooManyAttempts: "Too many incorrect attempts.",
    slotUnavailable: "That time slot is no longer available.",
    incorrectCode: "Incorrect code. Try again.",
    confirmFailed: "Could not confirm the booking.",
    cancelled: "Booking cancelled.",
    cancelFailed: "Could not cancel the booking.",
    successTitle: "Meeting confirmed",
    successDescription:
      "An invitation was sent to {{email}}. The meeting should already be in your calendar — check your inbox if you do not see it yet.",
    joinMeet: "Join with Google Meet",
    downloadInvite: "Download the invitation",
    backupInviteHint:
      "Backup option — only if the invite did not appear in your calendar.",
    inviteTooltip:
      "If the meeting was not added to your calendar automatically, open this file to add it manually (works with Google Calendar, Outlook, and Apple Calendar).",
    aboutDownload: "About downloading the invitation",
  },
  cancellation: {
    title: "Cancel meeting",
    otpSent: "Code sent to {{email}}. Expires in {{timer}}.",
    codeExpired: "Cancellation code expired.",
    tooManyAttempts: "Too many incorrect attempts.",
    incorrectCode: "Incorrect code. Try again.",
    cancelFailed: "Could not cancel the meeting.",
    cancelled: "Meeting cancelled.",
    aborted: "Cancellation aborted.",
    abortFailed: "Could not abort cancellation.",
    confirmCancel: "Confirm cancel",
    keepMeeting: "Keep meeting",
    emailSuppressed:
      "This email cannot receive codes. Use a different address or contact the host.",
    cannotCancel: "That meeting can no longer be cancelled.",
    startFailed: "Could not start cancellation.",
  },
  meetings: {
    upcomingAria: "Your upcoming meetings",
    noUpcoming: "No upcoming meetings in this session.",
    details: "Details",
    detailsTitle: "Meeting details",
    startsIn: "Starts in",
    started: "This meeting has started.",
    countdownDays:
      "{{days}} days, {{hours}} hours, {{minutes}} minutes, {{seconds}} seconds remaining",
    countdownShort:
      "{{hours}} hours, {{minutes}} minutes, {{seconds}} seconds remaining",
    countdownMin: "Min",
    countdownSec: "Sec",
    noMeetLink: "No Google Meet link is available for this meeting.",
    cancelMeeting: "Cancel meeting",
  },
  directMessage: {
    formAria: "Private message form",
    title: "Send a private message",
    description:
      "Your message goes directly to the owner. Phone is optional.",
    name: "Name",
    email: "Email",
    phoneOptional: "Phone number (optional)",
    message: "Message",
    placeholder: "Write your message…",
    sent: "Private message sent.",
    rateLimited: "Too many messages. Please try again later.",
    sendFailed: "Could not send the message.",
    cancelled: "Message cancelled.",
    cancelFailed: "Could not cancel the message form.",
    errors: {
      nameRequired: "Name is required.",
      nameMax: "Name must be at most {{max}} characters.",
      emailInvalid: "Enter a valid email address.",
      phoneInvalid: "Enter a valid phone number.",
      messageLength: "Message must be {{min}}–{{max}} characters.",
    },
  },
} as const;

/** Nested string leaves matching the English catalog shape. */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type TranslationDictionary = DeepStringify<typeof en>;
