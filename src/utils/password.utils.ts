import * as bcrypt from "bcryptjs";

export class PasswordUtils {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hash password
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async compare(
    candidatePassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }

  /**
   * Check if password is already hashed
   */
  static isHashed(password: string): boolean {
    return password.startsWith("$2a$") || password.startsWith("$2b$");
  }
}