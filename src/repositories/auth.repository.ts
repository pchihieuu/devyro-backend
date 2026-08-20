import { AppDataSource } from "../config/database.config";
import { User } from "../entities/User.entity";
import { PasswordResetToken } from "../entities/Passwordresettoken.entity";

const AUTH_USER_SELECT = [
  "id",
  "name",
  "email",
  "password",
  "avatar",
  "role",
  "resume",
] as const;

export class AuthRepository {
  private userRepo = AppDataSource.getRepository(User);
  private resetTokenRepo = AppDataSource.getRepository(PasswordResetToken);

  findUserByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }
  findUserByEmailForLogin(email: string) {
    return this.userRepo.findOne({
      where: { email },
      select: [...AUTH_USER_SELECT],
    });
  }
  findUserById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }
  createUser(data: Partial<User>) {
    return this.userRepo.save(this.userRepo.create(data));
  }
  saveUser(user: User) {
    return this.userRepo.save(user);
  }

  createResetToken(data: Partial<PasswordResetToken>) {
    return this.resetTokenRepo.save(this.resetTokenRepo.create(data));
  }
  invalidateExistingResetTokens(userId: string) {
    return this.resetTokenRepo.update(
      { userId, isUsed: false },
      { isUsed: true }
    );
  }
  findResetTokenByHash(hashedToken: string) {
    return this.resetTokenRepo.findOne({
      where: { token: hashedToken },
      relations: ["user"],
    });
  }
  saveResetToken(token: PasswordResetToken) {
    return this.resetTokenRepo.save(token);
  }
  deleteExpiredResetTokens() {
    return this.resetTokenRepo
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now OR isUsed = :isUsed", {
        now: new Date(),
        isUsed: true,
      })
      .execute();
  }
}

export const authRepository = new AuthRepository();
