export const JWT_SECRET = process.env.JWT_SECRET || "replace-me-with-a-long-random-string";

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set. Set JWT_SECRET in .env for secure token signing."
  );
}
