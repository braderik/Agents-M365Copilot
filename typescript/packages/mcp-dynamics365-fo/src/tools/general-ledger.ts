/**
 * MCP Tools – General Ledger & Finance
 *
 * Exposed tools:
 *  - gl_query_accounts         : Search chart of accounts
 *  - gl_query_journal_entries  : Query posted journal entries / vouchers
 *  - gl_query_trial_balance    : Retrieve trial balance by period
 *  - gl_query_budget           : Query budget register entries
 *  - gl_query_financial_dims   : List financial dimension values
 *  - gl_query_fiscal_calendars : List fiscal calendars / periods
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const QueryAccountsSchema = z.object({
  accountId: z.string().optional().describe("Partial main account ID to search for"),
  accountType: z.string().optional().describe("Account type filter (e.g. Balance, Profit, Loss, Total)"),
  dataAreaId: z.string().optional().describe("Legal entity / company ID (e.g. USMF)"),
  top: z.number().int().min(1).max(5000).default(200).describe("Max records to return"),
  select: z.string().optional().describe("Comma-separated field list"),
});

const QueryJournalEntriesSchema = z.object({
  voucherNumber: z.string().optional().describe("Voucher number to look up"),
  journalBatchNumber: z.string().optional().describe("Journal batch number filter"),
  dateFrom: z.string().optional().describe("ISO date – start of transaction date range"),
  dateTo: z.string().optional().describe("ISO date – end of transaction date range"),
  accountId: z.string().optional().describe("Main account ID filter"),
  dataAreaId: z.string().optional().describe("Legal entity / company ID"),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const QueryTrialBalanceSchema = z.object({
  periodStart: z.string().optional().describe("ISO date – start of balance period"),
  periodEnd: z.string().optional().describe("ISO date – end of balance period"),
  mainAccountId: z.string().optional().describe("Filter to specific main account"),
  dataAreaId: z.string().optional().describe("Legal entity / company ID"),
  top: z.number().int().min(1).max(5000).default(500),
});

const QueryBudgetSchema = z.object({
  budgetModelId: z.string().optional().describe("Budget model ID"),
  fiscalYear: z.string().optional().describe("Fiscal year, e.g. 2024"),
  mainAccountId: z.string().optional().describe("Filter to a specific account"),
  dataAreaId: z.string().optional().describe("Legal entity / company ID"),
  top: z.number().int().min(1).max(5000).default(200),
});

const QueryFinancialDimsSchema = z.object({
  dimensionName: z.string().optional().describe("Name of the dimension attribute (e.g. Department, CostCenter)"),
  dataAreaId: z.string().optional().describe("Legal entity / company ID"),
  top: z.number().int().min(1).max(2000).default(200),
});

const QueryFiscalCalendarsSchema = z.object({
  calendarId: z.string().optional().describe("Fiscal calendar ID"),
  top: z.number().int().min(1).max(200).default(50),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const generalLedgerTools: Tool[] = [
  {
    name: "gl_query_accounts",
    description:
      "Search the Dynamics 365 F&O chart of accounts. Returns main account IDs, names, types, and status.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "Partial main account ID to search for" },
        accountType: { type: "string", description: "Account type (Balance, Profit, Loss, Total, Asset, Liability)" },
        dataAreaId: { type: "string", description: "Legal entity / company ID (e.g. USMF)" },
        top: { type: "number", description: "Max records to return (1-5000, default 200)" },
        select: { type: "string", description: "Comma-separated fields to return" },
      },
    },
  },
  {
    name: "gl_query_journal_entries",
    description:
      "Query posted general ledger journal entries (vouchers) in Dynamics 365 F&O by date range, account, voucher or batch number.",
    inputSchema: {
      type: "object",
      properties: {
        voucherNumber: { type: "string", description: "Specific voucher number" },
        journalBatchNumber: { type: "string", description: "Journal batch number" },
        dateFrom: { type: "string", description: "Start date (ISO 8601)" },
        dateTo: { type: "string", description: "End date (ISO 8601)" },
        accountId: { type: "string", description: "Main account ID" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string", description: "Comma-separated fields" },
      },
    },
  },
  {
    name: "gl_query_trial_balance",
    description:
      "Retrieve the trial balance from Dynamics 365 F&O, optionally filtered by period dates and account.",
    inputSchema: {
      type: "object",
      properties: {
        periodStart: { type: "string", description: "Period start date (ISO 8601)" },
        periodEnd: { type: "string", description: "Period end date (ISO 8601)" },
        mainAccountId: { type: "string", description: "Specific main account" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
        top: { type: "number", description: "Max records (default 500)" },
      },
    },
  },
  {
    name: "gl_query_budget",
    description:
      "Query budget register entries in Dynamics 365 F&O by model, fiscal year, and account.",
    inputSchema: {
      type: "object",
      properties: {
        budgetModelId: { type: "string", description: "Budget model ID" },
        fiscalYear: { type: "string", description: "Fiscal year (e.g. 2024)" },
        mainAccountId: { type: "string", description: "Main account ID" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "gl_query_financial_dims",
    description:
      "List financial dimension attribute values in Dynamics 365 F&O (e.g. Department, CostCenter, Project).",
    inputSchema: {
      type: "object",
      properties: {
        dimensionName: { type: "string", description: "Dimension attribute name (e.g. Department)" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "gl_query_fiscal_calendars",
    description: "List fiscal calendars and their periods defined in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Fiscal calendar ID" },
        top: { type: "number", description: "Max records (default 50)" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGeneralLedgerTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "gl_query_accounts": {
      const a = QueryAccountsSchema.parse(args);
      const filters: string[] = [];
      if (a.accountId) filters.push(`contains(MainAccountId,'${a.accountId}')`);
      if (a.accountType) filters.push(`Type eq '${a.accountType}'`);
      return runQuery(client, "MainAccounts", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "gl_query_journal_entries": {
      const a = QueryJournalEntriesSchema.parse(args);
      const filters: string[] = [];
      if (a.voucherNumber) filters.push(`Voucher eq '${a.voucherNumber}'`);
      if (a.journalBatchNumber) filters.push(`JournalBatchNumber eq '${a.journalBatchNumber}'`);
      if (a.dateFrom) filters.push(`TransactionDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`TransactionDate le ${a.dateTo}`);
      if (a.accountId) filters.push(`AccountDisplayValue eq '${a.accountId}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "GeneralJournalAccountEntries", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "gl_query_trial_balance": {
      const a = QueryTrialBalanceSchema.parse(args);
      const filters: string[] = [];
      if (a.periodStart) filters.push(`FromDate ge ${a.periodStart}`);
      if (a.periodEnd) filters.push(`ToDate le ${a.periodEnd}`);
      if (a.mainAccountId) filters.push(`MainAccountId eq '${a.mainAccountId}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "LedgerTrialBalances", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "gl_query_budget": {
      const a = QueryBudgetSchema.parse(args);
      const filters: string[] = [];
      if (a.budgetModelId) filters.push(`BudgetModelId eq '${a.budgetModelId}'`);
      if (a.mainAccountId) filters.push(`MainAccountId eq '${a.mainAccountId}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "BudgetRegisterEntries", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "gl_query_financial_dims": {
      const a = QueryFinancialDimsSchema.parse(args);
      const filters: string[] = [];
      if (a.dimensionName) filters.push(`Name eq '${a.dimensionName}'`);
      return runQuery(client, "DimensionAttributeValues", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: true,
      });
    }

    case "gl_query_fiscal_calendars": {
      const a = QueryFiscalCalendarsSchema.parse(args);
      const filters: string[] = [];
      if (a.calendarId) filters.push(`FiscalCalendar eq '${a.calendarId}'`);
      return runQuery(client, "FiscalCalendars", {
        filter: mergeFilters(...filters),
        top: a.top,
      });
    }

    default:
      return { type: "text", text: `Unknown GL tool: ${name}` };
  }
}
