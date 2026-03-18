/** Data required to persist a new user. Passed from AuthService → UsersService. */
export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}
