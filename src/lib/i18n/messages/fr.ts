import type { TranslationDictionary } from "@/lib/i18n/messages/en";

export const fr = {
  common: {
    confirm: "Confirmer",
    cancel: "Annuler",
    retry: "Réessayer",
    ok: "OK",
    send: "Envoyer",
    loading: "Chargement",
    copied: "Copié",
    copyMeetLink: "Copier le lien Meet",
    days: "Jours",
    hours: "Heures",
    minutes: "Minutes",
    seconds: "Secondes",
    meeting: "Réunion",
    close: "Fermer",
  },
  sidebar: {
    language: "Langue",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  greeting: {
    headline: "Salut! Je suis l'assistant IA de Kacper.",
    hints: {
      ask: "Demandez tout sur Kacper",
      book: "Réserver une réunion",
      contact: "Contacter Kacper directement",
    },
  },
  chat: {
    placeholder: "Demandez n'importe quoi…",
    loadingChat: "Chargement du chat",
    loadingOlder: "Chargement des messages plus anciens",
    assistantThinking: "L'assistant réfléchit…",
    scrollUpOlder: "Faites défiler vers le haut pour les messages plus anciens",
    errorGeneric: "Une erreur s'est produite. Veuillez réessayer.",
    messageTooLong: "Le message ne peut pas dépasser {{length}} caractères.",
    stopResponse: "Arrêter la réponse",
    endVoice: "Terminer la conversation vocale",
    startVoice: "Démarrer la conversation vocale",
    startListening: "Commencer à parler",
    sendVoiceTurn: "Envoyer le message vocal",
    exitToText: "Passer au chat texte",
    voiceLoading: "Connexion vocale…",
    agentThinking: "L'assistant réfléchit",
    voiceEmptyTurn:
      "Aucune parole détectée — touchez le micro pour réessayer.",
    voiceSomethingWentWrong:
      "Un problème est survenu avec la voix. Réessayez ou passez au texte.",
    voiceThinkingTooLong:
      "Désolé, l'assistant a mis trop de temps à réfléchir.",
    sendMessage: "Envoyer le message",
    enableAudio: "Activer l'audio",
    interrupted: "Interrompu avant la fin",
    lengthTruncated: "Intervention coupée — limite de longueur atteinte",
    voiceLanguageLabel: "Langue vocale",
    aiTermsNotice:
      "En utilisant le chat, vous acceptez les <termsLink>conditions d'utilisation</termsLink>.",
  },
  terms: {
    title: "Conditions d'utilisation",
    backToChat: "Retour au chat",
    updated: "Dernière mise à jour : 3 août 2026",
    intro:
      "Ces conditions s'appliquent à ce site personnel et à l'assistant de chat IA qui y est disponible. En utilisant le chat (texte ou voix), vous les acceptez.",
    sections: {
      service: {
        title: "Nature du service",
        body: "L'assistant est une démo IA expérimentale sur mon site personnel. Il peut répondre à des questions sur moi, aider à réserver un rendez-vous ou transmettre un message privé. Ce n'est pas un produit commercial, ni un substitut à un contact direct avec moi, ni un support professionnel continu.",
      },
      ai: {
        title: "Réponses générées par l'IA",
        body: "Les réponses textuelles et vocales sont générées par l'intelligence artificielle. Elles peuvent être incomplètes, obsolètes ou incorrectes. Vérifiez toujours les informations importantes avant de vous y fier.",
      },
      noAdvice: {
        title: "Aucun conseil professionnel",
        body: "Rien de ce que dit l'assistant ne constitue un conseil juridique, médical, financier ou professionnel. Ne traitez pas les réponses comme des instructions pour des décisions ayant des conséquences juridiques, sanitaires ou financières.",
      },
      liability: {
        title: "Responsabilité",
        body: "Je ne garantis pas que les réponses sont exactes, complètes ou adaptées à un usage particulier. Dans toute la mesure permise par la loi, je ne suis pas responsable des décisions, actes ou pertes découlant de l'utilisation de l'assistant ou de la confiance accordée à ses résultats.",
      },
      data: {
        title: "Données et sessions",
        body: "L'utilisation du chat crée une session et peut stocker le contenu de conversation nécessaire au service (y compris les détails de réservation ou de contact que vous fournissez). N'envoyez pas de données personnelles sensibles que vous ne souhaitez pas partager. Les abus, le spam ou les tentatives de perturbation peuvent entraîner une limitation ou une suspension de l'accès.",
      },
      changes: {
        title: "Modifications",
        body: "Je peux mettre à jour ces conditions ou suspendre l'accès public à tout moment. Continuer à utiliser le chat après des modifications vaut acceptation des conditions mises à jour.",
      },
    },
  },
  voice: {
    ttsFallbackWarning:
      "Les réponses vocales dans cette langue ne sont pas encore prises en charge. L'assistant répondra en anglais.",
  },
  pause: {
    title: "Assistant en pause",
    defaultMessage:
      "En raison d'un fort intérêt, l'accès à l'assistant est temporairement suspendu.",
  },
  invite: {
    invalidTitle: "Invitation invalide",
    invalidBody:
      "Ce lien d'invitation est invalide, expiré ou déjà épuisé. Vous pouvez continuer en tant que visiteur classique.",
  },
  rateLimit: {
    title: "Limite atteinte",
    bodyChat:
      "Vous avez atteint la limite de messages du chat. Réessayez dans {{time}}.",
    bodyVoice:
      "Vous avez atteint la limite de messages vocaux. Réessayez dans {{time}}.",
    bodyDirectMessage:
      "Vous avez atteint la limite de messages privés. Réessayez dans {{time}}.",
    bodyEdge:
      "Trop de requêtes depuis votre réseau. Réessayez dans {{time}}.",
    tryAgainNow: "Vous pouvez réessayer maintenant.",
    understand: "J'ai compris",
  },
  turnstile: {
    verifyNew: "Nous devons vérifier que vous êtes humain pour continuer.",
    verifyExpired:
      "Session expirée. Nous devons vérifier que vous êtes humain pour continuer.",
    verificationFailed: "La vérification a échoué. Veuillez réessayer.",
    securityVerification: "Vérification de sécurité",
  },
  language: {
    changeFailed: "Impossible de changer la langue. Veuillez réessayer.",
  },
  systemNotes: {
    booking: {
      confirmed: 'Réservation « {{name}} » confirmée',
      cancelled: 'Réservation « {{name}} » annulée',
    },
    meeting: {
      cancelled: 'Rendez-vous « {{name}} » annulé',
    },
    cancellation: {
      aborted: 'Annulation de « {{name}} » interrompue',
    },
    private: {
      message_sent:
        "Message privé de {{name}} ({{email}}) : {{message}}",
      message_cancelled: "Message privé annulé",
    },
  },
  booking: {
    otpTitle: "Entrez le code de confirmation",
    otpSent: "Code envoyé à {{email}}. Expire dans {{timer}}.",
    otpAria: "Code de confirmation de réservation",
    codeExpired: "Le code de confirmation a expiré.",
    tooManyAttempts: "Trop de tentatives incorrectes.",
    slotUnavailable: "Ce créneau n'est plus disponible.",
    incorrectCode: "Code incorrect. Réessayez.",
    confirmFailed: "Impossible de confirmer la réservation.",
    cancelled: "Réservation annulée.",
    cancelFailed: "Impossible d'annuler la réservation.",
    successTitle: "Réunion confirmée",
    successDescription:
      "Une invitation a été envoyée à {{email}}. La réunion devrait déjà être dans votre calendrier — vérifiez votre boîte de réception si vous ne la voyez pas.",
    joinMeet: "Rejoindre avec Google Meet",
    downloadInvite: "Télécharger l'invitation",
    backupInviteHint:
      "Option de secours — uniquement si l'invitation n'est pas apparue dans votre calendrier.",
    inviteTooltip:
      "Si la réunion n'a pas été ajoutée automatiquement à votre calendrier, ouvrez ce fichier pour l'ajouter manuellement (fonctionne avec Google Calendar, Outlook et Apple Calendar).",
    aboutDownload: "À propos du téléchargement de l'invitation",
  },
  cancellation: {
    title: "Annuler la réunion",
    otpSent: "Code envoyé à {{email}}. Expire dans {{timer}}.",
    codeExpired: "Le code d'annulation a expiré.",
    tooManyAttempts: "Trop de tentatives incorrectes.",
    incorrectCode: "Code incorrect. Réessayez.",
    cancelFailed: "Impossible d'annuler la réunion.",
    cancelled: "Réunion annulée.",
    aborted: "Annulation interrompue.",
    abortFailed: "Impossible d'interrompre l'annulation.",
    confirmCancel: "Confirmer l'annulation",
    keepMeeting: "Garder la réunion",
    emailSuppressed:
      "Cet e-mail ne peut pas recevoir de codes. Utilisez une autre adresse ou contactez l'hôte.",
    cannotCancel: "Cette réunion ne peut plus être annulée.",
    startFailed: "Impossible de démarrer l'annulation.",
  },
  meetings: {
    upcomingAria: "Vos prochaines réunions",
    noUpcoming: "Aucune réunion à venir dans cette session.",
    details: "Détails",
    detailsTitle: "Détails de la réunion",
    startsIn: "Commence dans",
    started: "Cette réunion a commencé.",
    countdownDays:
      "{{days}} jours, {{hours}} heures, {{minutes}} minutes, {{seconds}} secondes restantes",
    countdownShort:
      "{{hours}} heures, {{minutes}} minutes, {{seconds}} secondes restantes",
    countdownMin: "Min",
    countdownSec: "Sec",
    noMeetLink: "Aucun lien Google Meet n'est disponible pour cette réunion.",
    cancelMeeting: "Annuler la réunion",
  },
  directMessage: {
    formAria: "Formulaire de message privé",
    title: "Envoyer un message privé",
    description:
      "Votre message va directement au propriétaire. Le téléphone est facultatif.",
    name: "Nom",
    email: "E-mail",
    phoneOptional: "Numéro de téléphone (facultatif)",
    message: "Message",
    placeholder: "Écrivez votre message…",
    sent: "Message privé envoyé.",
    sendFailed: "Impossible d'envoyer le message.",
    cancelled: "Message annulé.",
    cancelFailed: "Impossible d'annuler le formulaire de message.",
    errors: {
      nameRequired: "Le nom est obligatoire.",
      nameMax: "Le nom doit comporter au maximum {{max}} caractères.",
      emailInvalid: "Entrez une adresse e-mail valide.",
      phoneInvalid: "Entrez un numéro de téléphone valide.",
      messageLength:
        "Le message doit comporter entre {{min}} et {{max}} caractères.",
    },
  },
} satisfies TranslationDictionary;
