import { users, passwordResetTokens, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, gt, isNull } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUserWithPassword(email: string, firstName: string, lastName: string, passwordHash: string): Promise<User>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  createResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidResetToken(token: string): Promise<{ userId: string } | undefined>;
  markResetTokenUsed(token: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUserWithPassword(email: string, firstName: string, lastName: string, passwordHash: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email, firstName, lastName, passwordHash })
      .returning();
    return user;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async createResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getValidResetToken(token: string): Promise<{ userId: string } | undefined> {
    const [result] = await db
      .select({ userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      );
    return result;
  }

  async markResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }
}

export const authStorage = new AuthStorage();
