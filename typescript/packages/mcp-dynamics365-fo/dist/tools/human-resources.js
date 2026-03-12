/**
 * MCP Tools – Human Resources
 *
 * Exposed tools:
 *  - hr_query_workers         : Search employees / contractors
 *  - hr_get_worker            : Get single worker details
 *  - hr_query_departments     : List departments
 *  - hr_query_positions       : List positions and assignments
 *  - hr_query_jobs            : List job definitions
 *  - hr_query_leave_balances  : Employee leave / absence balances
 *  - hr_query_compensation    : Compensation plans and bands
 */
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";
const QueryWorkersSchema = z.object({
    personnelNumber: z.string().optional(),
    name: z.string().optional().describe("Worker name (partial match)"),
    workerType: z.enum(["Employee", "Contractor"]).optional(),
    departmentId: z.string().optional(),
    companyId: z.string().optional(),
    isActive: z.boolean().optional(),
    top: z.number().int().min(1).max(5000).default(200),
    select: z.string().optional(),
});
const GetWorkerSchema = z.object({
    personnelNumber: z.string(),
    companyId: z.string().optional(),
});
const QueryDepartmentsSchema = z.object({
    departmentNumber: z.string().optional(),
    name: z.string().optional(),
    top: z.number().int().min(1).max(1000).default(100),
});
const QueryPositionsSchema = z.object({
    positionId: z.string().optional(),
    departmentId: z.string().optional(),
    jobId: z.string().optional(),
    isVacant: z.boolean().optional().describe("Only show vacant positions"),
    top: z.number().int().min(1).max(2000).default(200),
});
const QueryJobsSchema = z.object({
    jobId: z.string().optional(),
    title: z.string().optional().describe("Job title (partial match)"),
    top: z.number().int().min(1).max(1000).default(100),
});
const QueryLeaveBalancesSchema = z.object({
    personnelNumber: z.string().optional(),
    leaveType: z.string().optional().describe("Leave type code"),
    companyId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(200),
});
const QueryCompensationSchema = z.object({
    personnelNumber: z.string().optional(),
    planId: z.string().optional().describe("Compensation plan ID"),
    companyId: z.string().optional(),
    top: z.number().int().min(1).max(1000).default(100),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const humanResourcesTools = [
    {
        name: "hr_query_workers",
        description: "Search Dynamics 365 F&O workers (employees and contractors).",
        inputSchema: {
            type: "object",
            properties: {
                personnelNumber: { type: "string" },
                name: { type: "string", description: "Worker name (partial match)" },
                workerType: { type: "string", description: "Employee or Contractor" },
                departmentId: { type: "string" },
                companyId: { type: "string" },
                isActive: { type: "boolean", description: "Filter by active employment" },
                top: { type: "number", description: "Max records (default 200)" },
                select: { type: "string" },
            },
        },
    },
    {
        name: "hr_get_worker",
        description: "Get full details for a single worker by personnel number.",
        inputSchema: {
            type: "object",
            required: ["personnelNumber"],
            properties: {
                personnelNumber: { type: "string" },
                companyId: { type: "string" },
            },
        },
    },
    {
        name: "hr_query_departments",
        description: "List organizational departments in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                departmentNumber: { type: "string" },
                name: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "hr_query_positions",
        description: "Query positions and their assignments in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                positionId: { type: "string" },
                departmentId: { type: "string" },
                jobId: { type: "string" },
                isVacant: { type: "boolean", description: "Show only vacant positions" },
                top: { type: "number", description: "Max records (default 200)" },
            },
        },
    },
    {
        name: "hr_query_jobs",
        description: "List job definitions in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                jobId: { type: "string" },
                title: { type: "string", description: "Job title (partial match)" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "hr_query_leave_balances",
        description: "Query employee leave and absence balances from Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                personnelNumber: { type: "string" },
                leaveType: { type: "string", description: "Leave type code" },
                companyId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
            },
        },
    },
    {
        name: "hr_query_compensation",
        description: "Query employee compensation plans and fixed pay in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                personnelNumber: { type: "string" },
                planId: { type: "string", description: "Compensation plan ID" },
                companyId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleHumanResourcesTool(name, args, client) {
    switch (name) {
        case "hr_query_workers": {
            const a = QueryWorkersSchema.parse(args);
            const filters = [];
            if (a.personnelNumber)
                filters.push(`contains(PersonnelNumber,'${a.personnelNumber}')`);
            if (a.name)
                filters.push(`contains(Name,'${a.name}')`);
            if (a.workerType)
                filters.push(`WorkerType eq '${a.workerType}'`);
            if (a.departmentId)
                filters.push(`PrimaryDepartmentId eq '${a.departmentId}'`);
            if (a.companyId)
                filters.push(`CompanyId eq '${a.companyId}'`);
            if (a.isActive === true)
                filters.push(`EmploymentEndDate eq null or EmploymentEndDate ge ${new Date().toISOString().split("T")[0]}`);
            return runQuery(client, "Workers", {
                filter: mergeFilters(...filters),
                select: a.select,
                top: a.top,
                crossCompany: !a.companyId,
            });
        }
        case "hr_get_worker": {
            const a = GetWorkerSchema.parse(args);
            try {
                const result = await client.getByKey("Workers", a.personnelNumber);
                return { type: "text", text: JSON.stringify(result, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "hr_query_departments": {
            const a = QueryDepartmentsSchema.parse(args);
            const filters = [];
            if (a.departmentNumber)
                filters.push(`DepartmentNumber eq '${a.departmentNumber}'`);
            if (a.name)
                filters.push(`contains(Name,'${a.name}')`);
            return runQuery(client, "OMOperatingUnits", {
                filter: mergeFilters(...filters, `OperatingUnitType eq 'Department'`),
                top: a.top,
                crossCompany: true,
            });
        }
        case "hr_query_positions": {
            const a = QueryPositionsSchema.parse(args);
            const filters = [];
            if (a.positionId)
                filters.push(`PositionId eq '${a.positionId}'`);
            if (a.departmentId)
                filters.push(`DepartmentNumber eq '${a.departmentId}'`);
            if (a.jobId)
                filters.push(`JobId eq '${a.jobId}'`);
            if (a.isVacant === true)
                filters.push(`WorkerAssignedPersonnelNumber eq null`);
            return runQuery(client, "HcmPositions", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: true,
            });
        }
        case "hr_query_jobs": {
            const a = QueryJobsSchema.parse(args);
            const filters = [];
            if (a.jobId)
                filters.push(`JobId eq '${a.jobId}'`);
            if (a.title)
                filters.push(`contains(JobDescription,'${a.title}')`);
            return runQuery(client, "HcmJobs", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: true,
            });
        }
        case "hr_query_leave_balances": {
            const a = QueryLeaveBalancesSchema.parse(args);
            const filters = [];
            if (a.personnelNumber)
                filters.push(`PersonnelNumber eq '${a.personnelNumber}'`);
            if (a.leaveType)
                filters.push(`LeaveTypeId eq '${a.leaveType}'`);
            if (a.companyId)
                filters.push(`DataAreaId eq '${a.companyId}'`);
            return runQuery(client, "LeaveBalances", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.companyId,
            });
        }
        case "hr_query_compensation": {
            const a = QueryCompensationSchema.parse(args);
            const filters = [];
            if (a.personnelNumber)
                filters.push(`PersonnelNumber eq '${a.personnelNumber}'`);
            if (a.planId)
                filters.push(`CompensationPlanId eq '${a.planId}'`);
            if (a.companyId)
                filters.push(`DataAreaId eq '${a.companyId}'`);
            return runQuery(client, "FixedCompensationEmployees", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.companyId,
            });
        }
        default:
            return { type: "text", text: `Unknown HR tool: ${name}` };
    }
}
//# sourceMappingURL=human-resources.js.map