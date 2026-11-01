// Feedback aus der Beta (components/feedbackModal.js).
//
// FEEDBACK_ENDPOINT: Formspree-Formular-URL ("https://formspree.io/f/xxxxxxx").
// Leer = Feedback geht nur über das Mailprogramm des Nutzers an FEEDBACK_EMAIL.
// Beide Werte sind ohnehin öffentlich (stehen im ausgelieferten JavaScript).
export const FEEDBACK_ENDPOINT = "https://formspree.io/f/xpppyerr";
export const FEEDBACK_EMAIL = "";

export const FEEDBACK_KINDS = [
  { value: "bug", label: "Fehler" },
  { value: "text", label: "Text / Formulierung" },
  { value: "usability", label: "Bedienung unklar" },
  { value: "idea", label: "Idee" },
  { value: "other", label: "Sonstiges" },
];
