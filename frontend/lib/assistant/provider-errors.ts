// Do not expose raw provider errors: they can contain request data or credentials.
export function geminiFailure(error: unknown): { status: number; message: string } {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
  if (status === 429) return { status: 429, message: "Google Gemini has reached its request or quota limit. Try again later, or use the offline guide." };
  if ([400, 401, 403].includes(status)) return { status: 503, message: "Google Gemini rejected the app configuration. The project owner needs to check its API key, restrictions, and model access. You can use the offline guide meanwhile." };
  if (status === 404) return { status: 503, message: "The configured Gemini model is unavailable to this project. The project owner needs to check the model setting." };
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) return { status: 504, message: "Google Gemini took too long to respond. Please try again." };
  return { status: 503, message: "Google Gemini is temporarily unavailable. Try again later, or use the offline guide." };
}
