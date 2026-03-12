/**
 * MCP Tools – Accounts Receivable
 *
 * Exposed tools:
 *  - ar_query_customers        : Search customers
 *  - ar_get_customer           : Get single customer details
 *  - ar_query_invoices         : Query customer invoices
 *  - ar_query_open_transactions: Open (unpaid) customer transactions
 *  - ar_query_aging            : Customer aging analysis
 *  - ar_query_collections      : Collections activities / cases
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";

const QueryCustomersSchema = z.object({
  accountNumber: z.string().optional(),
  name: z.string().optional(),
  groupId: z.string().optional(),
  creditLimitMin: z.number().optional().describe("Minimum credit limit"),
  creditLimitMax: z.number().optional().describe("Maximum credit limit"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const GetCustomerSchema = z.object({
  accountNumber: z.string(),
  dataAreaId: z.string().optional(),
});

const QueryARInvoicesSchema = z.object({
  customerAccount: z.string().optional(),
  invoiceId: z.string().optional(),
  status: z.string().optional().describe("Open, Paid, Cancelled"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.number().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const QueryOpenTransactionsSchema = z.object({
  customerAccount: z.string().optional(),
  dueDateBefore: z.string().optional().describe("Show transactions due before this date (ISO 8601)"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
});

const QueryAgingSchema = z.object({
  customerAccount: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
});

const QueryCollectionsSchema = z.object({
  customerAccount: z.string().optional(),
  caseStatus: z.string().optional().describe("Collection case status"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(100),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const accountsReceivableTools: Tool[] = [
  {
    name: "ar_query_customers",
    description: "Search Dynamics 365 F&O customers by account, name, group, or credit limit.",
    inputSchema: {
      type: "object",
      properties: {
        accountNumber: { type: "string", description: "Customer account number (partial match)" },
        name: { type: "string", description: "Customer name (partial match)" },
        groupId: { type: "string", description: "Customer group ID" },
        creditLimitMin: { type: "number", description: "Minimum credit limit" },
        creditLimitMax: { type: "number", description: "Maximum credit limit" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string" },
      },
    },
  },
  {
    name: "ar_get_customer",
    description: "Get full details for a single Dynamics 365 F&O customer.",
    inputSchema: {
      type: "object",
      required: ["accountNumber"],
      properties: {
        accountNumber: { type: "string" },
        dataAreaId: { type: "string" },
      },
    },
  },
  {
    name: "ar_query_invoices",
    description: "Query customer invoices in Dynamics 365 F&O with filtering by customer, status, and dates.",
    inputSchema: {
      type: "object",
      properties: {
        customerAccount: { type: "string" },
        invoiceId: { type: "string" },
        status: { type: "string", description: "Open, Paid, Cancelled" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        amountMin: { type: "number", description: "Minimum invoice amount" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string" },
      },
    },
  },
  {
    name: "ar_query_open_transactions",
    description: "List open (unpaid) customer transactions in Dynamics 365 F&O, optionally filtering by due date.",
    inputSchema: {
      type: "object",
      properties: {
        customerAccount: { type: "string" },
        dueDateBefore: { type: "string", description: "ISO date – show overdue items before this date" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "ar_query_aging",
    description: "Get customer aging analysis from Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        customerAccount: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "ar_query_collections",
    description: "Query collections cases and activities for customers in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        customerAccount: { type: "string" },
        caseStatus: { type: "string", description: "Collection case status" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 100)" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleAccountsReceivableTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "ar_query_customers": {
      const a = QueryCustomersSchema.parse(args);
      const filters: string[] = [];
      if (a.accountNumber) filters.push(`contains(CustomerAccountNumber,'${a.accountNumber}')`);
      if (a.name) filters.push(`contains(CustomerName,'${a.name}')`);
      if (a.groupId) filters.push(`CustomerGroupId eq '${a.groupId}'`);
      if (a.creditLimitMin !== undefined) filters.push(`CreditLimit ge ${a.creditLimitMin}`);
      if (a.creditLimitMax !== undefined) filters.push(`CreditLimit le ${a.creditLimitMax}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "CustomersV3", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ar_get_customer": {
      const a = GetCustomerSchema.parse(args);
      try {
        const key: Record<string, string> = { CustomerAccountNumber: a.accountNumber };
        if (a.dataAreaId) key.dataAreaId = a.dataAreaId;
        const result = await client.getByKey("CustomersV3", key);
        return { type: "text", text: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "ar_query_invoices": {
      const a = QueryARInvoicesSchema.parse(args);
      const filters: string[] = [];
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.invoiceId) filters.push(`contains(InvoiceId,'${a.invoiceId}')`);
      if (a.status) filters.push(`DocumentStatus eq '${a.status}'`);
      if (a.dateFrom) filters.push(`InvoiceDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`InvoiceDate le ${a.dateTo}`);
      if (a.amountMin !== undefined) filters.push(`InvoiceAmount ge ${a.amountMin}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "SalesInvoiceHeadersV2", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ar_query_open_transactions": {
      const a = QueryOpenTransactionsSchema.parse(args);
      const filters: string[] = ["TransactionStatus eq 'Open'"];
      if (a.customerAccount) filters.push(`AccountDisplayValue eq '${a.customerAccount}'`);
      if (a.dueDateBefore) filters.push(`DueDate le ${a.dueDateBefore}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "CustInvoiceJourBiEntities", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ar_query_aging": {
      const a = QueryAgingSchema.parse(args);
      const filters: string[] = [];
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "CustomerAgingReportLines", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ar_query_collections": {
      const a = QueryCollectionsSchema.parse(args);
      const filters: string[] = [];
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.caseStatus) filters.push(`CaseStatus eq '${a.caseStatus}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "CollectionCases", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    default:
      return { type: "text", text: `Unknown AR tool: ${name}` };
  }
}
