import { z } from "zod";

// Schema per la validazione dell'email
// Richiede che l'email contenga @ e almeno un punto (.)
export const emailSchema = z
  .string()
  .min(1, "L'email è obbligatoria")
  .email("Inserisci un'email valida")
  .refine(
    (email) => email.includes("@") && email.includes("."),
    {
      message: "L'email deve contenere @ e un punto (.)",
    }
  );

// Schema per il login
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La password è obbligatoria"),
});

// Schema per la registrazione
export const registerSchema = z.object({
  firstName: z.string().min(1, "Il nome è obbligatorio"),
  lastName: z.string().min(1, "Il cognome è obbligatorio"),
  email: emailSchema,
  password: z.string().min(6, "La password deve essere di almeno 6 caratteri"),
  confirmPassword: z.string().min(1, "Conferma la password"),
  phone: z.string().min(1, "Il telefono è obbligatorio"),
  birthDate: z.string().min(1, "La data di nascita è obbligatoria"),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  taxCode: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "Devi accettare i termini di servizio",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non combaciano",
  path: ["confirmPassword"],
});

// Funzione helper per validare l'email
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  try {
    emailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message || "Email non valida" };
    }
    return { isValid: false, error: "Email non valida" };
  }
};

