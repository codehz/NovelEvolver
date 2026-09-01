const ABORT_ERROR_NAME = "AbortError";
const ABORT_ERROR_MESSAGE = "AI generation stopped by user.";

/** Hermes has no `DOMException`; keep abort as a plain Error with the AbortError name. */
export function createAbortError(message = ABORT_ERROR_MESSAGE): Error {
  const error = new Error(message);
  error.name = ABORT_ERROR_NAME;
  return error;
}

/** True for platform AbortError (DOMException on desktop, Error on Hermes). */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === ABORT_ERROR_NAME
  );
}
