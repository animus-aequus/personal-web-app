import type { TranslationDictionary } from "@/lib/i18n/messages/en";

export const es = {
  common: {
    confirm: "Confirmar",
    cancel: "Cancelar",
    retry: "Reintentar",
    ok: "OK",
    send: "Enviar",
    loading: "Cargando",
    copied: "Copiado",
    copyMeetLink: "Copiar enlace de Meet",
    days: "Días",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    meeting: "Reunión",
    close: "Cerrar",
  },
  sidebar: {
    language: "Idioma",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
  },
  greeting: {
    headline: "¡Hola! Soy el asistente de IA de Kacper.",
    hints: {
      ask: "Pregunta lo que quieras sobre Kacper",
      book: "Reservar una reunión",
      contact: "Contactar con Kacper directamente",
    },
  },
  chat: {
    placeholder: "Pregunta lo que quieras…",
    loadingChat: "Cargando chat",
    loadingOlder: "Cargando mensajes anteriores",
    assistantThinking: "El asistente está pensando…",
    scrollUpOlder: "Desplázate hacia arriba para ver mensajes anteriores",
    errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
    messageTooLong: "El mensaje no puede tener más de {{length}} caracteres.",
    stopResponse: "Detener respuesta",
    endVoice: "Finalizar conversación por voz",
    startVoice: "Iniciar conversación por voz",
    startListening: "Empezar a hablar",
    sendVoiceTurn: "Enviar mensaje de voz",
    exitToText: "Cambiar al chat de texto",
    voiceLoading: "Conectando voz…",
    agentThinking: "El asistente está pensando",
    voiceEmptyTurn:
      "No se detectó voz — toca el micrófono para intentarlo de nuevo.",
    voiceSomethingWentWrong:
      "Algo salió mal con la voz. Inténtalo de nuevo o cambia al texto.",
    voiceThinkingTooLong: "Lo siento, el asistente estuvo pensando demasiado tiempo.",
    voiceMicrophonePermission:
      "Activa el micrófono para este sitio en los ajustes del navegador o del sistema para usar el modo de voz.",
    sendMessage: "Enviar mensaje",
    enableAudio: "Activar audio",
    interrupted: "Interrumpido antes de terminar",
    lengthTruncated: "Intervención cortada — límite de longitud alcanzado",
    voiceLanguageLabel: "Idioma de voz",
    aiTermsNotice:
      "Al usar el chat, aceptas los <termsLink>términos</termsLink>.",
  },
  terms: {
    title: "Términos de uso",
    backToChat: "Volver al chat",
    updated: "Última actualización: 3 de agosto de 2026",
    intro:
      "Estos términos se aplican a este sitio personal y al asistente de chat con IA disponible en él. Al usar el chat (texto o voz), los aceptas.",
    sections: {
      service: {
        title: "Qué es este servicio",
        body: "El asistente es una demo experimental de IA en mi sitio personal. Puede responder preguntas sobre mí, ayudar a reservar una reunión o reenviar un mensaje privado. No es un producto comercial, no sustituye el contacto directo conmigo y no es un soporte profesional continuo.",
      },
      ai: {
        title: "Respuestas generadas por IA",
        body: "Las respuestas de chat y voz las genera la inteligencia artificial. Pueden ser incompletas, desactualizadas o incorrectas. Verifica siempre la información importante antes de confiar en ella.",
      },
      noAdvice: {
        title: "Sin asesoramiento profesional",
        body: "Nada de lo que diga el asistente constituye asesoramiento legal, médico, financiero u otro asesoramiento profesional. No trates las respuestas como instrucciones para decisiones con consecuencias legales, de salud o financieras.",
      },
      liability: {
        title: "Responsabilidad",
        body: "No garantizo que las respuestas sean exactas, completas o adecuadas para ningún fin. En la mayor medida permitida por la ley, no soy responsable de decisiones, acciones o pérdidas derivadas del uso del asistente o de confiar en su resultado.",
      },
      data: {
        title: "Datos y sesiones",
        body: "Usar el chat crea una sesión y puede almacenar el contenido de la conversación necesario para el servicio (incluidos los datos de reserva o contacto que proporciones). No envíes datos personales sensibles que no quieras compartir. El abuso, el spam o los intentos de interrumpir el servicio pueden limitar o pausar el acceso.",
      },
      changes: {
        title: "Cambios",
        body: "Puedo actualizar estos términos o pausar el acceso público en cualquier momento. Seguir usando el chat tras los cambios implica aceptar los términos actualizados.",
      },
    },
  },
  aboutMe: {
    title: "Sobre mí",
    backToChat: "Volver al chat",
    comingSoon: "Esta página estará disponible pronto.",
  },
  voice: {
    ttsFallbackWarning:
      "Las respuestas de voz en este idioma aún no están disponibles. El asistente responderá en inglés.",
  },
  pause: {
    title: "Asistente en pausa",
    defaultMessage:
      "Debido al gran interés, el acceso al asistente está temporalmente en pausa.",
  },
  invite: {
    invalidTitle: "Invitación no válida",
    invalidBody:
      "Este enlace de invitación no es válido, ha caducado o ya se ha agotado. Puedes continuar como visitante habitual.",
    welcomeTitle: "¡Hola, {{name}}!",
    welcomeBody:
      "Gracias por usar esta invitación. Explora la aplicación, habla con el asistente, reserva una reunión y escríbeme — estaré encantado de conectar.",
    welcomeCta: "Vamos",
  },
  rateLimit: {
    title: "Límite alcanzado",
    bodyChat:
      "Has alcanzado el límite de mensajes del chat. Puedes intentarlo de nuevo en {{time}}.",
    bodyVoice:
      "Has alcanzado el límite de mensajes de voz. Puedes intentarlo de nuevo en {{time}}.",
    bodyDirectMessage:
      "Has alcanzado el límite de mensajes privados. Puedes intentarlo de nuevo en {{time}}.",
    bodyEdge:
      "Demasiadas solicitudes desde tu red. Puedes intentarlo de nuevo en {{time}}.",
    tryAgainNow: "Ya puedes intentarlo de nuevo.",
    understand: "Entendido",
  },
  turnstile: {
    verifyNew: "Necesitamos verificar que eres humano para continuar.",
    verifyExpired:
      "Sesión expirada. Necesitamos verificar que eres humano para continuar.",
    verificationFailed: "La verificación falló. Inténtalo de nuevo.",
    securityVerification: "Verificación de seguridad",
  },
  language: {
    changeFailed: "No se pudo cambiar el idioma. Inténtalo de nuevo.",
  },
  systemNotes: {
    booking: {
      confirmed: 'Reserva «{{name}}» confirmada',
      cancelled: 'Reserva «{{name}}» cancelada',
    },
    meeting: {
      cancelled: 'Reunión «{{name}}» cancelada',
    },
    cancellation: {
      aborted: 'Cancelación de «{{name}}» abortada',
    },
    private: {
      message_sent:
        "Mensaje privado de {{name}} ({{email}}): {{message}}",
      message_cancelled: "Mensaje privado cancelado",
    },
  },
  booking: {
    otpTitle: "Introduce el código de confirmación",
    otpSent: "Código enviado a {{email}}. Expira en {{timer}}.",
    otpAria: "Código de confirmación de reserva",
    codeExpired: "El código de confirmación ha expirado.",
    tooManyAttempts: "Demasiados intentos incorrectos.",
    slotUnavailable: "Ese horario ya no está disponible.",
    incorrectCode: "Código incorrecto. Inténtalo de nuevo.",
    confirmFailed: "No se pudo confirmar la reserva.",
    cancelled: "Reserva cancelada.",
    cancelFailed: "No se pudo cancelar la reserva.",
    successTitle: "Reunión confirmada",
    successDescription:
      "Se envió una invitación a {{email}}. La reunión debería estar ya en tu calendario — revisa tu bandeja de entrada si no la ves.",
    joinMeet: "Unirse con Google Meet",
    downloadInvite: "Descargar la invitación",
    backupInviteHint:
      "Opción de respaldo — solo si la invitación no apareció en tu calendario.",
    inviteTooltip:
      "Si la reunión no se añadió automáticamente a tu calendario, abre este archivo para añadirla manualmente (funciona con Google Calendar, Outlook y Apple Calendar).",
    aboutDownload: "Sobre la descarga de la invitación",
  },
  cancellation: {
    title: "Cancelar reunión",
    otpSent: "Código enviado a {{email}}. Expira en {{timer}}.",
    codeExpired: "El código de cancelación ha expirado.",
    tooManyAttempts: "Demasiados intentos incorrectos.",
    incorrectCode: "Código incorrecto. Inténtalo de nuevo.",
    cancelFailed: "No se pudo cancelar la reunión.",
    cancelled: "Reunión cancelada.",
    aborted: "Cancelación abortada.",
    abortFailed: "No se pudo abortar la cancelación.",
    confirmCancel: "Confirmar cancelación",
    keepMeeting: "Mantener reunión",
    emailSuppressed:
      "Este correo no puede recibir códigos. Usa otra dirección o contacta al anfitrión.",
    cannotCancel: "Esta reunión ya no se puede cancelar.",
    startFailed: "No se pudo iniciar la cancelación.",
  },
  meetings: {
    upcomingAria: "Tus próximas reuniones",
    noUpcoming: "No hay reuniones próximas en esta sesión.",
    details: "Detalles",
    detailsTitle: "Detalles de la reunión",
    startsIn: "Comienza en",
    started: "Esta reunión ha comenzado.",
    countdownDays:
      "{{days}} días, {{hours}} horas, {{minutes}} minutos, {{seconds}} segundos restantes",
    countdownShort:
      "{{hours}} horas, {{minutes}} minutos, {{seconds}} segundos restantes",
    countdownMin: "Min",
    countdownSec: "Seg",
    noMeetLink: "No hay enlace de Google Meet disponible para esta reunión.",
    cancelMeeting: "Cancelar reunión",
  },
  directMessage: {
    formAria: "Formulario de mensaje privado",
    title: "Enviar un mensaje privado",
    description:
      "Tu mensaje llega directamente al propietario. El teléfono es opcional.",
    name: "Nombre",
    email: "Correo electrónico",
    phoneOptional: "Teléfono (opcional)",
    message: "Mensaje",
    placeholder: "Escribe tu mensaje…",
    sent: "Mensaje privado enviado.",
    sendFailed: "No se pudo enviar el mensaje.",
    cancelled: "Mensaje cancelado.",
    cancelFailed: "No se pudo cancelar el formulario de mensaje.",
    errors: {
      nameRequired: "El nombre es obligatorio.",
      nameMax: "El nombre debe tener como máximo {{max}} caracteres.",
      emailInvalid: "Introduce una dirección de correo válida.",
      phoneInvalid: "Introduce un número de teléfono válido.",
      messageLength: "El mensaje debe tener entre {{min}} y {{max}} caracteres.",
    },
  },
} satisfies TranslationDictionary;
