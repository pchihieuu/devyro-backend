import { ForbiddenError } from "./errors";

export function ensureRole(currentRole: string, requiredRole: string, message: string): void {
  if (currentRole !== requiredRole) {
    throw new ForbiddenError(message);
  }
}

export function ensureOwnership(ownerId: string, requesterId: string, message: string): void {
  if (ownerId !== requesterId) {
    throw new ForbiddenError(message);
  }
}