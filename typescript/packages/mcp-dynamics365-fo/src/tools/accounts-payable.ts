/**
 * MCP Tools – Accounts Payable
 *
 * Exposed tools:
 *  - ap_query_vendors          : Search vendors
 *  - ap_get_vendor             : Get single vendor by account number
 *  - ap_query_invoices         : Query vendor invoices (open/posted)
 *  - ap_query_payments         : Query vendor payments
 *  - ap_query_aging            : Vendor aging summary
 *  - ap_query_1099             : 1099 transaction data
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";

const QueryVendorsSchema = z.object({
  accountNumber: z.string().optional().describe("Vendor account number (partial match)"),
  name: z.string().optional().describe("Vendor name (partial match)"),
  groupId: z.string().optional().describe("Vendor group ID"),
  onHold: z.boolean().optional().describe("Filter by on-hold status"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const GetVendorSchema = z.object({
  accountNumber: z.string().describe("Exact vendor account number"),
  dataAreaId: z.string().optional(),
});

const QueryInvoicesSchema = z.object({
  vendorAccount: z.string().optional().describe("Vendor account number filter"),
  invoiceNumber: z.string().optional().describe("Invoice number (partial match)"),
  status: z.string().optional().describe("Invoice status: Open, Posted, Paid"),
  dateFrom: z.string().optional().describe("Invoice date from (ISO 8601)"),
  dateTo: z.string().optional().describe("Invoice date to (ISO 8601)"),
  dueDateFrom: z.string().optional().describe("Due date from (ISO 8601)"),
  dueDateTo: z.string().optional().describe("Due date to (ISO 8601)"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const QueryPaymentsSchema = z.object({
  vendorAccount: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  paymentMethod: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
});

const QueryAgingSchema = z.object({
  vendorAccount: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const accountsPayableTools: Tool[] = [
  {
    name: "ap_query_vendors",
    description: "Search Dynamics 365 F&O vendors by account number, name, group, or on-hold status.",
    inputSchema: {
      type: "object",
      properties: {
        accountNumber: { type: "string", description: "Vendor account number (partial match)" },
        name: { type: "string", description: "Vendor name (partial match)" },
        groupId: { type: "string", description: "Vendor group ID" },
        onHold: { type: "boolean", description: "Filter by on-hold status" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string", description: "Comma-separated fields" },
      },
    },
  },
  {
    name: "ap_get_vendor",
    description: "Get detailed information for a single Dynamics 365 F&O vendor by account number.",
    inputSchema: {
      type: "object",
      required: ["accountNumber"],
      properties: {
        accountNumber: { type: "string", description: "Exact vendor account number" },
        dataAreaId: { type: "string", description: "Legal entity / company ID" },
      },
    },
  },
  {
    name: "ap_query_invoices",
    description:
      "Query vendor invoices in Dynamics 365 F&O. Supports filtering by vendor, status, date range, and due date.",
    inputSchema: {
      type: "object",
      properties: {
        vendorAccount: { type: "string", description: "Vendor account number" },
        invoiceNumber: { type: "string", description: "Invoice number" },
        status: { type: "string", description: "Invoice status (Open, Posted, Paid)" },
        dateFrom: { type: "string", description: "Invoice date from (ISO 8601)" },
        dateTo: { type: "string", description: "Invoice date to (ISO 8601)" },
        dueDateFrom: { type: "string", description: "Due date from" },
        dueDateTo: { type: "string", description: "Due date to" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string" },
      },
    },
  },
  {
    name: "ap_query_payments",
    description: "Query vendor payment transactions in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        vendorAccount: { type: "string" },
        dateFrom: { type: "string", description: "Payment date from" },
        dateTo: { type: "string", description: "Payment date to" },
        paymentMethod: { type: "string", description: "Payment method name" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
  {
    name: "ap_query_aging",
    description: "Get vendor aging analysis data from Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        vendorAccount: { type: "string", description: "Filter to specific vendor" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleAccountsPayableTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "ap_query_vendors": {
      const a = QueryVendorsSchema.parse(args);
      const filters: string[] = [];
      if (a.accountNumber) filters.push(`contains(VendorAccountNumber,'${a.accountNumber}')`);
      if (a.name) filters.push(`contains(VendorName,'${a.name}')`);
      if (a.groupId) filters.push(`VendorGroupId eq '${a.groupId}'`);
      if (a.onHold !== undefined) filters.push(`OnHoldStatus ne 'NoHold'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "Vendors", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ap_get_vendor": {
      const a = GetVendorSchema.parse(args);
      try {
        const key: Record<string, string> = { VendorAccountNumber: a.accountNumber };
        if (a.dataAreaId) key.DataAreaId = a.dataAreaId;
        const result = await client.getByKey("Vendors", key);
        return { type: "text", text: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "ap_query_invoices": {
      const a = QueryInvoicesSchema.parse(args);
      const filters: string[] = [];
      if (a.vendorAccount) filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
      if (a.invoiceNumber) filters.push(`contains(InvoiceNumber,'${a.invoiceNumber}')`);
      if (a.status) filters.push(`InvoiceStatus eq '${a.status}'`);
      if (a.dateFrom) filters.push(`InvoiceDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`InvoiceDate le ${a.dateTo}`);
      if (a.dueDateFrom) filters.push(`DueDate ge ${a.dueDateFrom}`);
      if (a.dueDateTo) filters.push(`DueDate le ${a.dueDateTo}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "VendorInvoiceHeaders", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ap_query_payments": {
      const a = QueryPaymentsSchema.parse(args);
      const filters: string[] = [];
      if (a.vendorAccount) filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
      if (a.dateFrom) filters.push(`PaymentDate ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`PaymentDate le ${a.dateTo}`);
      if (a.paymentMethod) filters.push(`PaymentMethod eq '${a.paymentMethod}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "VendorPaymentJournalLines", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "ap_query_aging": {
      const a = QueryAgingSchema.parse(args);
      const filters: string[] = [];
      if (a.vendorAccount) filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "VendorAgingReportLines", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    default:
      return { type: "text", text: `Unknown AP tool: ${name}` };
  }
}
