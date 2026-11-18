export const LEGAL_VERSION = "2026-11-17";
export const LEGAL_DATE = "November 17, 2026";
export const PROJECT_CONTACT = "varungullanki@gmail.com";

export function hasSignupAgreement(form: FormData) {
  return form.get("acceptTerms") === "on" && form.get("adultConfirmation") === "on";
}
