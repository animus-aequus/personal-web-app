import type { TranslationDictionary } from "@/lib/i18n/messages/en";

export const de = {
  common: {
    confirm: "Bestätigen",
    cancel: "Abbrechen",
    retry: "Erneut versuchen",
    ok: "OK",
    send: "Senden",
    loading: "Laden",
    copied: "Kopiert",
    copyMeetLink: "Meet-Link kopieren",
    days: "Tage",
    hours: "Stunden",
    minutes: "Minuten",
    seconds: "Sekunden",
    meeting: "Meeting",
    close: "Schließen",
  },
  sidebar: {
    language: "Sprache",
    openMenu: "Menü öffnen",
    closeMenu: "Menü schließen",
  },
  greeting: {
    headline: "Hey! Ich bin Kacpers KI-Assistent.",
    hints: {
      ask: "Frag alles über Kacper",
      book: "Ein Meeting buchen",
      contact: "Kacper direkt kontaktieren",
    },
  },
  chat: {
    placeholder: "Frag etwas…",
    loadingChat: "Chat wird geladen",
    loadingOlder: "Ältere Nachrichten werden geladen",
    assistantThinking: "Assistent denkt nach…",
    scrollUpOlder: "Nach oben scrollen für ältere Nachrichten",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    messageTooLong: "Die Nachricht darf nicht länger als {{length}} Zeichen sein.",
    stopResponse: "Antwort stoppen",
    endVoice: "Sprachgespräch beenden",
    startVoice: "Sprachgespräch starten",
    startListening: "Sprechen beginnen",
    sendVoiceTurn: "Sprachnachricht senden",
    exitToText: "Zum Textchat wechseln",
    voiceLoading: "Sprachverbindung wird aufgebaut…",
    agentThinking: "Assistent denkt nach",
    voiceEmptyTurn:
      "Keine Sprache erkannt — tippe auf das Mikrofon, um es erneut zu versuchen.",
    voiceSomethingWentWrong:
      "Bei der Sprachfunktion ist etwas schiefgelaufen. Versuche es erneut oder wechsle zum Text.",
    voiceThinkingTooLong: "Entschuldigung, der Assistent hat zu lange nachgedacht.",
    voiceMicrophonePermission:
      "Aktiviere das Mikrofon für diese Seite in den Browser- oder Systemeinstellungen, um den Sprachmodus zu nutzen.",
    sendMessage: "Nachricht senden",
    enableAudio: "Audio aktivieren",
    interrupted: "Vor Fertigstellung unterbrochen",
    lengthTruncated: "Äußerung gekürzt — maximale Länge erreicht",
    voiceLanguageLabel: "Sprachsprache",
    aiTermsNotice:
      "Mit der Nutzung des Chats akzeptierst du die <termsLink>Nutzungsbedingungen</termsLink>.",
  },
  terms: {
    title: "Nutzungsbedingungen",
    backToChat: "Zurück zum Chat",
    updated: "Zuletzt aktualisiert: 3. August 2026",
    intro:
      "Diese Bedingungen gelten für diese persönliche Website und den darauf verfügbaren KI-Chat-Assistenten. Mit der Nutzung des Chats (Text oder Sprache) stimmst du ihnen zu.",
    sections: {
      service: {
        title: "Was dieser Dienst ist",
        body: "Der Assistent ist eine experimentelle KI-Demo auf meiner persönlichen Website. Er kann Fragen zu mir beantworten, bei der Terminbuchung helfen oder eine private Nachricht weiterleiten. Er ist kein kommerzielles Produkt, kein Ersatz für den direkten Kontakt zu mir und keine laufende professionelle Unterstützung.",
      },
      ai: {
        title: "KI-generierte Antworten",
        body: "Chat- und Sprachantworten werden von künstlicher Intelligenz erzeugt. Sie können unvollständig, veraltet oder falsch sein. Wichtige Informationen solltest du selbst prüfen, bevor du dich darauf stützt.",
      },
      noAdvice: {
        title: "Keine Fachberatung",
        body: "Nichts, was der Assistent sagt, ist rechtliche, medizinische, finanzielle oder sonstige professionelle Beratung. Behandle Antworten nicht als Anleitung für Entscheidungen mit rechtlichen, gesundheitlichen oder finanziellen Folgen.",
      },
      liability: {
        title: "Verantwortung",
        body: "Ich garantiere nicht, dass Antworten richtig, vollständig oder für einen bestimmten Zweck geeignet sind. Soweit gesetzlich zulässig, hafte ich nicht für Entscheidungen, Handlungen oder Schäden, die aus der Nutzung des Assistenten oder dem Vertrauen auf seine Ausgaben entstehen.",
      },
      data: {
        title: "Daten und Sitzungen",
        body: "Die Chat-Nutzung erzeugt eine Sitzung und kann Gesprächsinhalte speichern, die für den Betrieb nötig sind (einschließlich Buchungs- oder Kontaktdaten, die du angibst). Sende keine sensiblen personenbezogenen Daten, die du nicht teilen möchtest. Missbrauch, Spam oder Störungen können zu einer Einschränkung oder Pausierung des Zugangs führen.",
      },
      changes: {
        title: "Änderungen",
        body: "Ich kann diese Bedingungen jederzeit aktualisieren oder den öffentlichen Zugang pausieren. Die weitere Nutzung des Chats nach Änderungen bedeutet die Annahme der aktualisierten Bedingungen.",
      },
    },
  },
  aboutMe: {
    title: "Über mich",
    backToChat: "Zurück zum Chat",
    comingSoon: "Diese Seite folgt in Kürze.",
  },
  voice: {
    ttsFallbackWarning:
      "Sprachantworten in dieser Sprache werden noch nicht unterstützt. Der Assistent antwortet auf Englisch.",
  },
  pause: {
    title: "Assistent pausiert",
    defaultMessage:
      "Aufgrund des großen Interesses ist der Zugang zum Assistenten vorübergehend pausiert.",
  },
  invite: {
    invalidTitle: "Ungültige Einladung",
    invalidBody:
      "Dieser Einladungslink ist ungültig, abgelaufen oder bereits aufgebraucht. Du kannst als regulärer Besucher fortfahren.",
    welcomeTitle: "Hallo, {{name}}!",
    welcomeBody:
      "Danke, dass du diese Einladung genutzt hast. Schau dich gerne um, probiere den Assistenten aus, buche ein Meeting und nimm Kontakt auf — ich freue mich darauf.",
    welcomeCta: "Los geht's",
  },
  rateLimit: {
    title: "Limit erreicht",
    bodyChat:
      "Du hast das Nachrichtenlimit im Chat erreicht. Versuche es in {{time}} erneut.",
    bodyVoice:
      "Du hast das Sprachnachrichtenlimit erreicht. Versuche es in {{time}} erneut.",
    bodyDirectMessage:
      "Du hast das Limit für private Nachrichten erreicht. Versuche es in {{time}} erneut.",
    bodyEdge:
      "Zu viele Anfragen von deinem Netzwerk. Versuche es in {{time}} erneut.",
    tryAgainNow: "Du kannst es jetzt erneut versuchen.",
    understand: "Verstanden",
  },
  turnstile: {
    verifyNew: "Wir müssen verifizieren, dass du ein Mensch bist, um fortzufahren.",
    verifyExpired:
      "Sitzung abgelaufen. Wir müssen verifizieren, dass du ein Mensch bist, um fortzufahren.",
    verificationFailed: "Verifizierung fehlgeschlagen. Bitte versuche es erneut.",
    securityVerification: "Sicherheitsüberprüfung",
  },
  language: {
    changeFailed: "Sprache konnte nicht geändert werden. Bitte versuche es erneut.",
  },
  systemNotes: {
    booking: {
      confirmed: 'Buchung „{{name}}” bestätigt',
      cancelled: 'Buchung „{{name}}” storniert',
    },
    meeting: {
      cancelled: 'Termin „{{name}}” storniert',
    },
    cancellation: {
      aborted: 'Stornierung von „{{name}}” abgebrochen',
    },
    private: {
      message_sent:
        "Private Nachricht von {{name}} ({{email}}): {{message}}",
      message_cancelled: "Private Nachricht abgebrochen",
    },
  },
  booking: {
    otpTitle: "Bestätigungscode eingeben",
    otpSent: "Code an {{email}} gesendet. Läuft ab in {{timer}}.",
    otpAria: "Buchungsbestätigungscode",
    codeExpired: "Bestätigungscode abgelaufen.",
    tooManyAttempts: "Zu viele falsche Versuche.",
    slotUnavailable: "Dieser Zeitslot ist nicht mehr verfügbar.",
    incorrectCode: "Falscher Code. Versuche es erneut.",
    confirmFailed: "Buchung konnte nicht bestätigt werden.",
    cancelled: "Buchung storniert.",
    cancelFailed: "Buchung konnte nicht storniert werden.",
    successTitle: "Meeting bestätigt",
    successDescription:
      "Eine Einladung wurde an {{email}} gesendet. Das Meeting sollte bereits in deinem Kalender sein — prüfe deinen Posteingang, falls du es nicht siehst.",
    joinMeet: "Mit Google Meet beitreten",
    downloadInvite: "Einladung herunterladen",
    backupInviteHint:
      "Backup-Option — nur wenn die Einladung nicht in deinem Kalender erschien.",
    inviteTooltip:
      "Wenn das Meeting nicht automatisch zu deinem Kalender hinzugefügt wurde, öffne diese Datei, um es manuell hinzuzufügen (funktioniert mit Google Calendar, Outlook und Apple Calendar).",
    aboutDownload: "Über das Herunterladen der Einladung",
  },
  cancellation: {
    title: "Meeting absagen",
    otpSent: "Code an {{email}} gesendet. Läuft ab in {{timer}}.",
    codeExpired: "Stornierungscode abgelaufen.",
    tooManyAttempts: "Zu viele falsche Versuche.",
    incorrectCode: "Falscher Code. Versuche es erneut.",
    cancelFailed: "Meeting konnte nicht abgesagt werden.",
    cancelled: "Meeting abgesagt.",
    aborted: "Stornierung abgebrochen.",
    abortFailed: "Stornierung konnte nicht abgebrochen werden.",
    confirmCancel: "Absage bestätigen",
    keepMeeting: "Meeting behalten",
    emailSuppressed:
      "Diese E-Mail kann keine Codes empfangen. Verwende eine andere Adresse oder kontaktiere den Gastgeber.",
    cannotCancel: "Dieses Meeting kann nicht mehr abgesagt werden.",
    startFailed: "Stornierung konnte nicht gestartet werden.",
  },
  meetings: {
    upcomingAria: "Deine bevorstehenden Meetings",
    noUpcoming: "Keine bevorstehenden Meetings in dieser Sitzung.",
    details: "Details",
    detailsTitle: "Meeting-Details",
    startsIn: "Beginnt in",
    started: "Dieses Meeting hat begonnen.",
    countdownDays:
      "{{days}} Tage, {{hours}} Stunden, {{minutes}} Minuten, {{seconds}} Sekunden verbleibend",
    countdownShort:
      "{{hours}} Stunden, {{minutes}} Minuten, {{seconds}} Sekunden verbleibend",
    countdownMin: "Min",
    countdownSec: "Sek",
    noMeetLink: "Für dieses Meeting ist kein Google-Meet-Link verfügbar.",
    cancelMeeting: "Meeting absagen",
  },
  directMessage: {
    formAria: "Formular für private Nachricht",
    title: "Private Nachricht senden",
    description:
      "Deine Nachricht geht direkt an den Eigentümer. Telefon ist optional.",
    name: "Name",
    email: "E-Mail",
    phoneOptional: "Telefonnummer (optional)",
    message: "Nachricht",
    placeholder: "Schreibe deine Nachricht…",
    sent: "Private Nachricht gesendet.",
    sendFailed: "Nachricht konnte nicht gesendet werden.",
    cancelled: "Nachricht abgebrochen.",
    cancelFailed: "Nachrichtenformular konnte nicht abgebrochen werden.",
    errors: {
      nameRequired: "Name ist erforderlich.",
      nameMax: "Name darf höchstens {{max}} Zeichen haben.",
      emailInvalid: "Gib eine gültige E-Mail-Adresse ein.",
      phoneInvalid: "Gib eine gültige Telefonnummer ein.",
      messageLength: "Nachricht muss {{min}}–{{max}} Zeichen haben.",
    },
  },
} satisfies TranslationDictionary;
