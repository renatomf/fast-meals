const UNIQUE_VIOLATION = "23505";

// O Drizzle embrulha o erro do driver num DrizzleQueryError; o código do PostgreSQL
// e o nome da constraint ficam no cause.
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const driverError = error instanceof Error && error.cause !== undefined ? error.cause : error;
  return (
    typeof driverError === "object" &&
    driverError !== null &&
    "code" in driverError &&
    driverError.code === UNIQUE_VIOLATION &&
    "constraint" in driverError &&
    driverError.constraint === constraint
  );
}
