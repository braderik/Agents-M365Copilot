/**
 * MCP Tools – Sales & Marketing
 *
 * Exposed tools:
 *  - sales_query_orders       : Search sales orders
 *  - sales_get_order          : Get SO with lines
 *  - sales_query_order_lines  : Search across SO lines
 *  - sales_query_quotations   : Sales quotations
 *  - sales_query_invoices     : Posted sales invoices (via AR)
 *  - sales_query_price_lists  : Sales price/discount trade agreements
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";

const QuerySOSchema = z.object({
  orderNumber: z.string().optional(),
  customerAccount: z.string().optional(),
  status: z.string().optional().describe("Backorder, Delivered, Invoiced, Cancelled"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.number().optional(),
  salesPersonnel: z.string().optional().describe("Sales personnel number"),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
  expand: z.string().optional(),
});

const GetSOSchema = z.object({
  orderNumber: z.string(),
  dataAreaId: z.string().optional(),
  includeLines: z.boolean().default(true),
});

const QuerySOLinesSchema = z.object({
  orderNumber: z.string().optional(),
  itemNumber: z.string().optional(),
  status: z.string().optional(),
  shipDateFrom: z.string().optional(),
  shipDateTo: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(5000).default(200),
  select: z.string().optional(),
});

const QueryQuotationsSchema = z.object({
  quotationId: z.string().optional(),
  customerAccount: z.string().optional(),
  status: z.string().optional().describe("Created, Sent, Confirmed, Lost, Cancelled"),
  expiryDateBefore: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(100),
});

const QueryPriceListsSchema = z.object({
  customerAccount: z.string().optional(),
  itemNumber: z.string().optional(),
  priceGroupId: z.string().optional(),
  dateFrom: z.string().optional(),
  dataAreaId: z.string().optional(),
  top: z.number().int().min(1).max(2000).default(200),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const salesTools: Tool[] = [
  {
    name: "sales_query_orders",
    description:
      "Search Dynamics 365 F&O sales orders by number, customer, status, date range, and amount.",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        customerAccount: { type: "string" },
        status: { type: "string", description: "Backorder, Delivered, Invoiced, Cancelled" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        amountMin: { type: "number" },
        salesPersonnel: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string" },
        expand: { type: "string", description: "OData $expand" },
      },
    },
  },
  {
    name: "sales_get_order",
    description: "Get full details of a Dynamics 365 F&O sales order including lines.",
    inputSchema: {
      type: "object",
      required: ["orderNumber"],
      properties: {
        orderNumber: { type: "string" },
        dataAreaId: { type: "string" },
        includeLines: { type: "boolean", description: "Include order lines (default true)" },
      },
    },
  },
  {
    name: "sales_query_order_lines",
    description: "Query individual sales order lines across Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        itemNumber: { type: "string" },
        status: { type: "string" },
        shipDateFrom: { type: "string" },
        shipDateTo: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
        select: { type: "string" },
      },
    },
  },
  {
    name: "sales_query_quotations",
    description: "Search sales quotations in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        quotationId: { type: "string" },
        customerAccount: { type: "string" },
        status: { type: "string", description: "Created, Sent, Confirmed, Lost, Cancelled" },
        expiryDateBefore: { type: "string", description: "Show quotations expiring before this date" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 100)" },
      },
    },
  },
  {
    name: "sales_query_price_lists",
    description: "Query sales price and discount trade agreements in Dynamics 365 F&O.",
    inputSchema: {
      type: "object",
      properties: {
        customerAccount: { type: "string" },
        itemNumber: { type: "string" },
        priceGroupId: { type: "string" },
        dateFrom: { type: "string" },
        dataAreaId: { type: "string" },
        top: { type: "number", description: "Max records (default 200)" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSalesTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "sales_query_orders": {
      const a = QuerySOSchema.parse(args);
      const filters: string[] = [];
      if (a.orderNumber) filters.push(`contains(SalesOrderNumber,'${a.orderNumber}')`);
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.status) filters.push(`SalesOrderStatus eq '${a.status}'`);
      if (a.dateFrom) filters.push(`CreatedDateTime ge ${a.dateFrom}`);
      if (a.dateTo) filters.push(`CreatedDateTime le ${a.dateTo}`);
      if (a.amountMin !== undefined) filters.push(`OrderTotalAmount ge ${a.amountMin}`);
      if (a.salesPersonnel) filters.push(`SalesPersonnelNumber eq '${a.salesPersonnel}'`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "SalesOrderHeadersV2", {
        filter: mergeFilters(...filters),
        select: a.select,
        expand: a.expand,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "sales_get_order": {
      const a = GetSOSchema.parse(args);
      try {
        const key: Record<string, string> = { SalesOrderNumber: a.orderNumber };
        if (a.dataAreaId) key.dataAreaId = a.dataAreaId;
        const expand = a.includeLines ? "SalesOrderLines" : undefined;
        const result = await client.getByKey("SalesOrderHeadersV2", key, { expand });
        return { type: "text", text: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "sales_query_order_lines": {
      const a = QuerySOLinesSchema.parse(args);
      const filters: string[] = [];
      if (a.orderNumber) filters.push(`SalesOrderNumber eq '${a.orderNumber}'`);
      if (a.itemNumber) filters.push(`ItemNumber eq '${a.itemNumber}'`);
      if (a.status) filters.push(`SalesOrderLineStatus eq '${a.status}'`);
      if (a.shipDateFrom) filters.push(`RequestedShippingDate ge ${a.shipDateFrom}`);
      if (a.shipDateTo) filters.push(`RequestedShippingDate le ${a.shipDateTo}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "SalesOrderLines", {
        filter: mergeFilters(...filters),
        select: a.select,
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "sales_query_quotations": {
      const a = QueryQuotationsSchema.parse(args);
      const filters: string[] = [];
      if (a.quotationId) filters.push(`QuotationId eq '${a.quotationId}'`);
      if (a.customerAccount) filters.push(`CustomerAccountNumber eq '${a.customerAccount}'`);
      if (a.status) filters.push(`QuotationStatus eq '${a.status}'`);
      if (a.expiryDateBefore) filters.push(`ExpiryDate le ${a.expiryDateBefore}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "SalesQuotationHeadersV2", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    case "sales_query_price_lists": {
      const a = QueryPriceListsSchema.parse(args);
      const filters: string[] = [];
      if (a.customerAccount) filters.push(`AccountNumber eq '${a.customerAccount}'`);
      if (a.itemNumber) filters.push(`ItemNumber eq '${a.itemNumber}'`);
      if (a.priceGroupId) filters.push(`PriceDiscGroupCode eq '${a.priceGroupId}'`);
      if (a.dateFrom) filters.push(`FromDate ge ${a.dateFrom}`);
      if (a.dataAreaId) filters.push(`DataAreaId eq '${a.dataAreaId}'`);
      return runQuery(client, "SalesPriceAgreements", {
        filter: mergeFilters(...filters),
        top: a.top,
        crossCompany: !a.dataAreaId,
      });
    }

    default:
      return { type: "text", text: `Unknown sales tool: ${name}` };
  }
}
