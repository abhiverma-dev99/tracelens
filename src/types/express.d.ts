import type { Project, User } from "../generated/client.js";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "email" | "name" | "emailVerified">;
      project?: Pick<Project, "id" | "name" | "ingestKey" | "userId">;
    }
  }
}

export {};
