import type { SignupInput } from "~/domain/entities/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_DIGIT_REGEX = /\d/;

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") {
    return "L'email est requis";
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return "Format d'email invalide";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "Le mot de passe est requis";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`;
  }
  if (!PASSWORD_UPPERCASE_REGEX.test(password)) {
    return "Le mot de passe doit contenir au moins une majuscule";
  }
  if (!PASSWORD_DIGIT_REGEX.test(password)) {
    return "Le mot de passe doit contenir au moins un chiffre";
  }
  return null;
}

export function validateSignupInput(input: SignupInput): string | null {
  if (!input.name || typeof input.name !== "string" || input.name.trim().length === 0) {
    return "Le nom est requis";
  }

  const emailError = validateEmail(input.email);
  if (emailError) return emailError;

  const passwordError = validatePassword(input.password);
  if (passwordError) return passwordError;

  return null;
}
