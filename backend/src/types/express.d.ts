export {};

import type {
  AuthenticatedActor,
  AuthenticatedSession,
} from "../common/contracts/actor.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      actor?: AuthenticatedActor;
      authSession?: AuthenticatedSession;
    }

    interface Locals {
      requestId: string;
      validated?: Readonly<Record<string, unknown>>;
    }
  }
}
