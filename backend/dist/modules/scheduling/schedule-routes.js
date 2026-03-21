import { Router } from "express";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { asyncHandler, requestContextMiddleware } from "../../core/middleware.js";
import { getScheduleViewApi } from "./schedule.service.js";
export const scheduleRouter = Router();
scheduleRouter.use(requestContextMiddleware);
scheduleRouter.get("/", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const q = req.query;
    const view = q.view === "day" || q.view === "week" || q.view === "month" ? q.view : "week";
    const date = typeof q.date === "string" ? q.date.slice(0, 10) : "";
    if (!date) {
        res.status(400).json({
            data: null,
            meta: null,
            errors: [{ code: "VALIDATION", message: "date is required", field: "date" }],
        });
        return;
    }
    const resourceType = q.resource_type === "personnel" ||
        q.resource_type === "truck" ||
        q.resource_type === "event"
        ? q.resource_type
        : "event";
    const statusCsv = typeof q.status === "string" ? q.status : undefined;
    const status = statusCsv?.split(",").map((s) => s.trim()).filter(Boolean);
    const { data, meta } = await getScheduleViewApi({
        tenantId: ctx.tenantId,
        view,
        date,
        resourceType,
        eventId: typeof q.event_id === "string" ? q.event_id : undefined,
        departmentId: typeof q.department_id === "string" ? q.department_id : undefined,
        personnelId: typeof q.personnel_id === "string" ? q.personnel_id : undefined,
        truckId: typeof q.truck_id === "string" ? q.truck_id : undefined,
        status: status?.length ? status : undefined,
    });
    res.status(200).json(ok(data, meta));
}));
