/** Wrong email or password. Only this failure is answered with its message; anything else is a server error whose details stay in the logs. */
export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid credentials") {
    super(message);
  }
}

/** Signup refused because the email is registered; safe to show the client. */
export class EmailTakenError extends Error {
  constructor() {
    super("Email already exists");
  }
}
