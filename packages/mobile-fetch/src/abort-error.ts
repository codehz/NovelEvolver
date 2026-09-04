const ABORT_ERROR_NAME = "AbortError";

export function createAbortError(message = "This operation was aborted"): Error {
  const error = new Error(message);
  error.name = ABORT_ERROR_NAME;
  return error;
}
