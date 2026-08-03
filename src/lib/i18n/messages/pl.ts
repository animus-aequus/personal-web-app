import type { TranslationDictionary } from "@/lib/i18n/messages/en";

export const pl = {
  common: {
    confirm: "Potwierdź",
    cancel: "Anuluj",
    retry: "Spróbuj ponownie",
    ok: "OK",
    send: "Wyślij",
    loading: "Ładowanie",
    copied: "Skopiowano",
    copyMeetLink: "Kopiuj link Meet",
    days: "Dni",
    hours: "Godziny",
    minutes: "Minuty",
    seconds: "Sekundy",
    meeting: "Spotkanie",
    close: "Zamknij",
  },
  sidebar: {
    language: "Język",
    openMenu: "Otwórz menu",
    closeMenu: "Zamknij menu",
  },
  greeting: {
    headline: "Cześć! Jestem asystentem AI Kacpra.",
    hints: {
      ask: "Zapytaj o cokolwiek dotyczące Kacpra",
      book: "Umów spotkanie",
      contact: "Skontaktuj się z Kacprem bezpośrednio",
    },
  },
  chat: {
    placeholder: "Zapytaj o cokolwiek…",
    loadingChat: "Ładowanie czatu",
    loadingOlder: "Ładowanie starszych wiadomości",
    assistantThinking: "Asystent myśli…",
    scrollUpOlder: "Przewiń w górę, aby zobaczyć starsze wiadomości",
    errorGeneric: "Coś poszło nie tak. Spróbuj ponownie.",
    stopResponse: "Zatrzymaj odpowiedź",
    endVoice: "Zakończ rozmowę głosową",
    startVoice: "Rozpocznij rozmowę głosową",
    sendMessage: "Wyślij wiadomość",
    enableAudio: "Włącz dźwięk",
    interrupted: "Przerwano przed zakończeniem",
    voiceLanguageLabel: "Język głosu",
    aiTermsNotice:
      "Korzystając z czatu, akceptujesz <termsLink>regulamin</termsLink>.",
  },
  terms: {
    title: "Regulamin",
    backToChat: "Wróć do czatu",
    updated: "Ostatnia aktualizacja: 3 sierpnia 2026",
    intro:
      "Niniejszy regulamin dotyczy tej strony osobistej oraz dostępnego na niej asystenta AI. Korzystając z czatu (tekstowego lub głosowego), akceptujesz jego treść.",
    sections: {
      service: {
        title: "Czym jest ta usługa",
        body: "Asystent to eksperymentalne demo AI na mojej stronie osobistej. Może odpowiadać na pytania o mnie, pomagać w umówieniu spotkania lub przekazać prywatną wiadomość. Nie jest produktem komercyjnym, nie zastępuje kontaktu ze mną bezpośrednio i nie stanowi stałego wsparcia zawodowego.",
      },
      ai: {
        title: "Odpowiedzi generowane przez AI",
        body: "Odpowiedzi w czacie i głosie generuje sztuczna inteligencja. Mogą być niepełne, nieaktualne lub błędne. Ważne informacje zawsze weryfikuj samodzielnie, zanim się na nich oprzesz.",
      },
      noAdvice: {
        title: "Brak porady fachowej",
        body: "Żadna wypowiedź asystenta nie stanowi porady prawnej, medycznej, finansowej ani innej porady zawodowej. Nie traktuj odpowiedzi jako wskazówek do decyzji mających skutki prawne, zdrowotne lub finansowe.",
      },
      liability: {
        title: "Odpowiedzialność",
        body: "Nie gwarantuję, że odpowiedzi są poprawne, kompletne ani przydatne do jakiegokolwiek celu. W najszerszym zakresie dozwolonym przez prawo nie ponoszę odpowiedzialności za decyzje, działania ani szkody wynikające z korzystania z asystenta lub polegania na jego treściach.",
      },
      data: {
        title: "Dane i sesje",
        body: "Korzystanie z czatu tworzy sesję i może przechowywać treść rozmowy potrzebną do działania usługi (w tym dane do rezerwacji lub kontaktu, które podasz). Nie przesyłaj wrażliwych danych osobowych, których nie chcesz udostępniać. Nadużycia, spam lub próby zakłócania działania mogą skutkować ograniczeniem lub wstrzymaniem dostępu.",
      },
      changes: {
        title: "Zmiany",
        body: "Mogę w każdej chwili zaktualizować ten regulamin lub wstrzymać publiczny dostęp. Dalsze korzystanie z czatu po zmianach oznacza ich akceptację.",
      },
    },
  },
  voice: {
    ttsFallbackWarning:
      "Odpowiedzi głosowe w tym języku nie są jeszcze obsługiwane. Asystent odpowie po angielsku.",
  },
  pause: {
    title: "Asystent wstrzymany",
    defaultMessage:
      "Ze względu na duże zainteresowanie publiczny dostęp do asystenta jest tymczasowo wstrzymany.",
  },
  turnstile: {
    verifyNew: "Musimy zweryfikować, że jesteś człowiekiem, aby kontynuować.",
    verifyExpired:
      "Sesja wygasła. Musimy zweryfikować, że jesteś człowiekiem, aby kontynuować.",
    verificationFailed: "Weryfikacja nie powiodła się. Spróbuj ponownie.",
    securityVerification: "Weryfikacja bezpieczeństwa",
  },
  language: {
    changeFailed: "Nie udało się zmienić języka. Spróbuj ponownie.",
  },
  systemNotes: {
    booking: {
      confirmed: 'Rezerwacja „{{name}}” potwierdzona',
      cancelled: 'Rezerwacja „{{name}}” anulowana',
    },
    meeting: {
      cancelled: 'Spotkanie „{{name}}” anulowane',
    },
    cancellation: {
      aborted: 'Anulowanie „{{name}}” przerwane',
    },
    private: {
      message_sent:
        "Prywatna wiadomość od {{name}} ({{email}}): {{message}}",
      message_cancelled: "Prywatna wiadomość anulowana",
    },
  },
  booking: {
    otpTitle: "Wpisz kod potwierdzający",
    otpSent: "Kod wysłany na {{email}}. Wygasa za {{timer}}.",
    otpAria: "Kod potwierdzenia rezerwacji",
    codeExpired: "Kod potwierdzający wygasł.",
    tooManyAttempts: "Zbyt wiele nieprawidłowych prób.",
    slotUnavailable: "Ten termin nie jest już dostępny.",
    incorrectCode: "Nieprawidłowy kod. Spróbuj ponownie.",
    confirmFailed: "Nie udało się potwierdzić rezerwacji.",
    cancelled: "Rezerwacja anulowana.",
    cancelFailed: "Nie udało się anulować rezerwacji.",
    successTitle: "Spotkanie potwierdzone",
    successDescription:
      "Zaproszenie wysłano na {{email}}. Spotkanie powinno być już w Twoim kalendarzu — sprawdź skrzynkę, jeśli go nie widzisz.",
    joinMeet: "Dołącz przez Google Meet",
    downloadInvite: "Pobierz zaproszenie",
    backupInviteHint:
      "Opcja zapasowa — tylko jeśli zaproszenie nie pojawiło się w kalendarzu.",
    inviteTooltip:
      "Jeśli spotkanie nie zostało dodane automatycznie do kalendarza, otwórz ten plik, aby dodać je ręcznie (działa z Google Calendar, Outlook i Apple Calendar).",
    aboutDownload: "O pobieraniu zaproszenia",
  },
  cancellation: {
    title: "Anuluj spotkanie",
    otpSent: "Kod wysłany na {{email}}. Wygasa za {{timer}}.",
    codeExpired: "Kod anulowania wygasł.",
    tooManyAttempts: "Zbyt wiele nieprawidłowych prób.",
    incorrectCode: "Nieprawidłowy kod. Spróbuj ponownie.",
    cancelFailed: "Nie udało się anulować spotkania.",
    cancelled: "Spotkanie anulowane.",
    aborted: "Anulowanie przerwane.",
    abortFailed: "Nie udało się przerwać anulowania.",
    confirmCancel: "Potwierdź anulowanie",
    keepMeeting: "Zachowaj spotkanie",
    emailSuppressed:
      "Ten adres e-mail nie może otrzymywać kodów. Użyj innego adresu lub skontaktuj się z gospodarzem.",
    cannotCancel: "Tego spotkania nie można już anulować.",
    startFailed: "Nie udało się rozpocząć anulowania.",
  },
  meetings: {
    upcomingAria: "Twoje nadchodzące spotkania",
    noUpcoming: "Brak nadchodzących spotkań w tej sesji.",
    details: "Szczegóły",
    detailsTitle: "Szczegóły spotkania",
    startsIn: "Rozpoczęcie za",
    started: "To spotkanie się rozpoczęło.",
    countdownDays:
      "Pozostało {{days}} dni, {{hours}} godzin, {{minutes}} minut, {{seconds}} sekund",
    countdownShort:
      "Pozostało {{hours}} godzin, {{minutes}} minut, {{seconds}} sekund",
    countdownMin: "Min",
    countdownSec: "Sek",
    noMeetLink: "Brak linku Google Meet dla tego spotkania.",
    cancelMeeting: "Anuluj spotkanie",
  },
  directMessage: {
    formAria: "Formularz prywatnej wiadomości",
    title: "Wyślij prywatną wiadomość",
    description:
      "Twoja wiadomość trafia bezpośrednio do właściciela. Telefon jest opcjonalny.",
    name: "Imię i nazwisko",
    email: "E-mail",
    phoneOptional: "Numer telefonu (opcjonalnie)",
    message: "Wiadomość",
    placeholder: "Napisz wiadomość…",
    sent: "Prywatna wiadomość wysłana.",
    rateLimited: "Zbyt wiele wiadomości. Spróbuj ponownie później.",
    sendFailed: "Nie udało się wysłać wiadomości.",
    cancelled: "Wiadomość anulowana.",
    cancelFailed: "Nie udało się anulować formularza wiadomości.",
    errors: {
      nameRequired: "Imię i nazwisko jest wymagane.",
      nameMax: "Imię może mieć maksymalnie {{max}} znaków.",
      emailInvalid: "Podaj prawidłowy adres e-mail.",
      phoneInvalid: "Podaj prawidłowy numer telefonu.",
      messageLength: "Wiadomość musi mieć od {{min}} do {{max}} znaków.",
    },
  },
} satisfies TranslationDictionary;
