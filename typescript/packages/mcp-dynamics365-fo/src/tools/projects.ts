/**
 * MCP Tools – Project Management & Accounting
 *
 * Exposed tools:
 *  - proj_query_projects      : Search projects
 *  - proj_get_project         : Get full project details
 *  - proj_query_transactions  : Project cost/revenue transactions
 *  - proj_query_timesheets    : Timesheet entries
 *  - proj_query_expenses      : Project expense reports
 *  - proj_query_contracts     : Project contracts
 *  - proj_query_wbs           : Work breakdown structure tasks
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";

const QueryProjectsSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().optional().describe("Project name (partial match)"),
  projectType: z.string().optional().describe("Time, Material, FixedPrice, Investment, Cost, Internal"),
  status: z.string().optional().describe("InProcess, Finished, Created, OnHold, Cancelled"),
  customerAccount: z.string().optional(),
  managerId: z.string().optional().describe("Project manager personnel number"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(100),
  select: z.string().optional(),
});

const GetProjectSchema = z.object({
  projectId: z.string(),
  dataAreaId: z.string().optional(),
});

const QueryTransactionsSchema = z.object({
  projectId: z.string().optional(),
  transactionType: z.string().optional().describe("Hour, Expense, Item, Fee, OnAccount"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  workerId: z.string().optional(),
  categoryId: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
});

const QueryTimesheetsSchema = z.object({
  projectId: z.string().optional(),
  workerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional().describe("Draft, Submitted, Approved, Rejected"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(200),
});

const QueryExpensesSchema = z.object({
  projectId: z.string().optional(),
  workerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(200),
});

const QueryContractsSchema = z.object({
  contractId: z.string().optional(),
  customerAccount: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(1000).default(100),
});

const QueryWBSSchema = z.object({
  projectId: z.string(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(200),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const projectsTools: Tool[] = [
  {
    name: "proj_query_projects",
    description: "Search Dynamics 365 F&O projects by ID, name, type, status, and customer.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        name: { type: "string" },
        projectType: { type: "string", description: "Time, Material, FixedPrice, Investment, Cost, Internal" },
        status: { type: "string", description: "InProcess, Finished, Created, OnHold, Cancelled" },
        customerAccount: { type: "string" },
        managerId: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 100)" },
        select: { type: "string" },
      },
    },
  },
  {
    name: "proj_get_project",
    description: "Get full details for a Dynamics 365 F&O project by project ID.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string" },
        dataAreaId: { type: "string" },
      },
    },
  },
  {
    name: "proj_query_transactions",
    description: "Query project cost and revenue transactions in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        transactionType: { type: "string", description: "Hour, Expense, Item, Fee, OnAccount" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        workerId: { type: "string" },
        categoryId: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "proj_query_timesheets",
    description: "Query project timesheet entries in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        workerId: { type: "string" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        status: { type: "string", description: "Draft, Submitted, Approved, Rejected" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "proj_query_expenses",
    description: "Query project expense reports in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        workerId: { type: "string" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        status: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "proj_query_contracts",
    description: "Query project contracts in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string" },
        customerAccount: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 100)" },
      },
    },
  },
  {
    name: "proj_query_wbs",
    description: "Query work breakdown structure (WBS) tasks for a Dynamics 365 F&O project.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleProjectsTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "proj_query_projects": {
      const a = QueryProjectsSchema.parse(args);
      const filters: string[] = [];
      if (a.projectId) filters.push(`contains(ProjectId,'${a.projectId}')`);
      if (a.name) filters.push(`contains(Name,'${a.name}')`);
      if (a.projectType) filters.push(`ProjectType eq '${a.projectType}'`);
      if (a.status) filters.push(`ProjectStatus eq '${a.status}'`);
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.managerId) filters.push(`ProjectManagerPersonnelNumber eq '${a.managerId}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "Projects", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "proj_get_project": {
      const a = GetProjectSchema.parse(args);
      try {
        const key: Record<string, string> = { ProjectId: a.projectId };
        if (a.dataAreaId) key.dataAreaId = a.dataAreaId;
        const result = await client.getByKey("Projects", key);
        return { type: "text", text: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "proj_query_transactions": {
      const a = QueryTransactionsSchema.parse(args);
      const filters: string[] = [];
      if (a.projectId) filters.push(`ProjectId eq '${a.projectId}'`);
      if (a.transactionType) filters.push(`TransactionType eq '${a.transactionType}'`);
      if (a.dateFrom) filters.push(`TransactionDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`TransactionDate le ${a.dateTo}`);
      if (a.workerId) filters.push(`WorkerPersonnelNumber eq '${a.workerId}'`);
      if (a.categoryId) filters.push(`CategoryId eq '${a.categoryId}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "ProjectTransactionDetailsEntity", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "proj_query_timesheets": {
      const a = QueryTimesheetsSchema.parse(args);
      const filters: string[] = [];
      if (a.projectId) filters.push(`ProjectId eq '${a.projectId}'`);
      if (a.workerId) filters.push(`WorkerPersonnelNumber eq '${a.workerId}'`);
      if (a.dateFrom) filters.push(`TimesheetDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`TimesheetDate le ${a.dateTo}`);
      if (a.status) filters.push(`ApprovalStatus eq '${a.status}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "TSTimesheetLines", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "proj_query_expenses": {
      const a = QueryExpensesSchema.parse(args);
      const filters: string[] = [];
      if (a.projectId) filters.push(`ProjectId eq '${a.projectId}'`);
      if (a.workerId) filters.push(`WorkerPersonnelNumber eq '${a.workerId}'`);
      if (a.dateFrom) filters.push(`ExpenseDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`ExpenseDate le ${a.dateTo}`);
      if (a.status) filters.push(`ApprovalStatus eq '${a.status}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "TrvExpenseLines", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "proj_query_contracts": {
      const a = QueryContractsSchema.parse(args);
      const filters: string[] = [];
      if (a.contractId) filters.push(`ContractId eq '${a.contractId}'`);
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "ProjectContractHeaders", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "proj_query_wbs": {
      const a = QueryWBSSchema.parse(args);
      const filters: string[] = [`ProjectId eq '${a.projectId}'`];
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "ProjectWorkBreakdownStructureActivity", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    default:
      return { type: "text", text: `Unknown projects tool: ${name}` };
  }
}
