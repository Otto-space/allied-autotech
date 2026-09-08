import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  AnomalyListQuery,
  AnomalyUpdateInput,
  AuditListQuery,
  OperationalJobsQuery,
  OperationalRetryInput,
} from "./audit.schemas.js";
import { auditOperationsService, type AuditOperationsService } from "./audit.service.js";

const validated = <T>(response: Response, location: "body" | "params" | "query") =>
  response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});

export class AuditController {
  constructor(private readonly service: AuditOperationsService = auditOperationsService) {}
  list = async (req: Request, res: Response) =>
    res.status(200).json(successResponse("Audit events retrieved", req.id, await this.service.audit(actor(req), validated<AuditListQuery>(res, "query"))));
  jobs = async (req: Request, res: Response) =>
    res.status(200).json(successResponse("Operational jobs retrieved", req.id, await this.service.jobs(actor(req), validated<OperationalJobsQuery>(res, "query"))));
  status = async (req: Request, res: Response) =>
    res.status(200).json(successResponse("Operational status retrieved", req.id, await this.service.status(actor(req))));
  retry = async (req: Request, res: Response) => {
    const params = validated<{ source: "outbox" | "webhook"; jobId: string }>(res, "params");
    res.status(200).json(successResponse("Operational retry requested", req.id, await this.service.retryJob(actor(req), params.source, params.jobId, validated<OperationalRetryInput>(res, "body"), context(req))));
  };
  anomalies = async (req: Request, res: Response) =>
    res.status(200).json(successResponse("Payment anomalies retrieved", req.id, await this.service.anomalies(actor(req), validated<AnomalyListQuery>(res, "query"))));
  updateAnomaly = async (req: Request, res: Response) =>
    res.status(200).json(successResponse("Payment anomaly updated", req.id, await this.service.updateAnomaly(actor(req), validated<{ anomalyId: string }>(res, "params").anomalyId, validated<AnomalyUpdateInput>(res, "body"), context(req))));
}
