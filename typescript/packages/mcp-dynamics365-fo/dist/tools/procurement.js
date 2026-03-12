/**
 * MCP Tools – Procurement & Supply Chain
 *
 * Exposed tools:
 *  - proc_query_purchase_orders       : Search purchase orders
 *  - proc_get_purchase_order          : Get PO header + lines
 *  - proc_query_po_lines              : Search across PO lines
 *  - proc_query_requisitions          : Purchase requisitions
 *  - proc_query_rfqs                  : Request for quotations
 *  - proc_query_vendor_catalog        : Vendor catalog items
 *  - proc_query_receipts              : Product receipts (GRNs)
 */
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";
const QueryPOSchema = z.object({
    poNumber: z.string().optional().describe("Purchase order number (partial match)"),
    vendorAccount: z.string().optional(),
    status: z.string().optional().describe("PO status: Draft, Confirmed, Received, Invoiced, Cancelled"),
    dateFrom: z.string().optional().describe("Document date from"),
    dateTo: z.string().optional().describe("Document date to"),
    amountMin: z.number().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(5000).default(200),
    select: z.string().optional(),
    expand: z.string().optional().describe("OData $expand, e.g. PurchaseOrderLines"),
});
const GetPOSchema = z.object({
    poNumber: z.string().describe("Exact purchase order number"),
    dataAreaId: z.string().optional(),
    includeLines: z.boolean().default(true).describe("Include order lines in response"),
});
const QueryPOLinesSchema = z.object({
    poNumber: z.string().optional(),
    itemNumber: z.string().optional(),
    status: z.string().optional(),
    deliveryDateFrom: z.string().optional(),
    deliveryDateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(5000).default(200),
    select: z.string().optional(),
});
const QueryRequisitionsSchema = z.object({
    requisitionNumber: z.string().optional(),
    status: z.string().optional().describe("Draft, InReview, Approved, Cancelled"),
    requesterName: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(100),
});
const QueryRFQsSchema = z.object({
    rfqNumber: z.string().optional(),
    vendorAccount: z.string().optional(),
    status: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(1000).default(100),
});
const QueryVendorCatalogSchema = z.object({
    vendorAccount: z.string().optional(),
    itemNumber: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(200),
});
const QueryReceiptsSchema = z.object({
    poNumber: z.string().optional(),
    receiptNumber: z.string().optional(),
    itemNumber: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(100),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const procurementTools = [
    {
        name: "proc_query_purchase_orders",
        description: "Search Dynamics 365 F&O purchase orders by number, vendor, status, date, and amount.",
        inputSchema: {
            type: "object",
            properties: {
                poNumber: { type: "string", description: "PO number (partial match)" },
                vendorAccount: { type: "string" },
                status: { type: "string", description: "Draft, Confirmed, Received, Invoiced, Cancelled" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                amountMin: { type: "number" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
                select: { type: "string" },
                expand: { type: "string", description: "OData $expand (e.g. PurchaseOrderLines)" },
            },
        },
    },
    {
        name: "proc_get_purchase_order",
        description: "Get full details of a Dynamics 365 F&O purchase order including lines.",
        inputSchema: {
            type: "object",
            required: ["poNumber"],
            properties: {
                poNumber: { type: "string" },
                dataAreaId: { type: "string" },
                includeLines: { type: "boolean", description: "Include order lines (default true)" },
            },
        },
    },
    {
        name: "proc_query_po_lines",
        description: "Query purchase order lines across all POs in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                poNumber: { type: "string" },
                itemNumber: { type: "string" },
                status: { type: "string" },
                deliveryDateFrom: { type: "string" },
                deliveryDateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
                select: { type: "string" },
            },
        },
    },
    {
        name: "proc_query_requisitions",
        description: "Query purchase requisitions in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                requisitionNumber: { type: "string" },
                status: { type: "string", description: "Draft, InReview, Approved, Cancelled" },
                requesterName: { type: "string" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "proc_query_rfqs",
        description: "Query request for quotations (RFQs) in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                rfqNumber: { type: "string" },
                vendorAccount: { type: "string" },
                status: { type: "string" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "proc_query_vendor_catalog",
        description: "Query vendor catalog items / approved vendor lists in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                vendorAccount: { type: "string" },
                itemNumber: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
            },
        },
    },
    {
        name: "proc_query_receipts",
        description: "Query product receipts (goods received notes) in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                poNumber: { type: "string" },
                receiptNumber: { type: "string" },
                itemNumber: { type: "string" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleProcurementTool(name, args, client) {
    switch (name) {
        case "proc_query_purchase_orders": {
            const a = QueryPOSchema.parse(args);
            const filters = [];
            if (a.poNumber)
                filters.push(`contains(PurchaseOrderNumber,'${a.poNumber}')`);
            if (a.vendorAccount)
                filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
            if (a.status)
                filters.push(`PurchaseOrderStatus eq '${a.status}'`);
            if (a.dateFrom)
                filters.push(`DocumentDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`DocumentDate le ${a.dateTo}`);
            if (a.amountMin !== undefined)
                filters.push(`TotalInvoiceAmount ge ${a.amountMin}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "PurchaseOrderHeaders", {
                filter: mergeFilters(...filters),
                select: a.select,
                expand: a.expand,
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "proc_get_purchase_order": {
            const a = GetPOSchema.parse(args);
            try {
                const key = { PurchaseOrderNumber: a.poNumber };
                if (a.dataAreaId)
                    key.DataAreaId = a.dataAreaId;
                const expand = a.includeLines ? "PurchaseOrderLines" : undefined;
                const result = await client.getByKey("PurchaseOrderHeaders", key, { expand });
                return { type: "text", text: JSON.stringify(result, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "proc_query_po_lines": {
            const a = QueryPOLinesSchema.parse(args);
            const filters = [];
            if (a.poNumber)
                filters.push(`PurchaseOrderNumber eq '${a.poNumber}'`);
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.status)
                filters.push(`PurchaseOrderLineStatus eq '${a.status}'`);
            if (a.deliveryDateFrom)
                filters.push(`ConfirmedDeliveryDate ge ${a.deliveryDateFrom}`);
            if (a.deliveryDateTo)
                filters.push(`ConfirmedDeliveryDate le ${a.deliveryDateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "PurchaseOrderLines", {
                filter: mergeFilters(...filters),
                select: a.select,
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "proc_query_requisitions": {
            const a = QueryRequisitionsSchema.parse(args);
            const filters = [];
            if (a.requisitionNumber)
                filters.push(`RequisitionNumber eq '${a.requisitionNumber}'`);
            if (a.status)
                filters.push(`RequisitionStatus eq '${a.status}'`);
            if (a.requesterName)
                filters.push(`contains(RequestingWorkerName,'${a.requesterName}')`);
            if (a.dateFrom)
                filters.push(`RequestDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`RequestDate le ${a.dateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "PurchaseRequisitionHeaders", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "proc_query_rfqs": {
            const a = QueryRFQsSchema.parse(args);
            const filters = [];
            if (a.rfqNumber)
                filters.push(`RFQNumber eq '${a.rfqNumber}'`);
            if (a.vendorAccount)
                filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
            if (a.status)
                filters.push(`RFQStatus eq '${a.status}'`);
            if (a.dateFrom)
                filters.push(`RFQDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`RFQDate le ${a.dateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "PurchRFQCaseHeaders", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "proc_query_vendor_catalog": {
            const a = QueryVendorCatalogSchema.parse(args);
            const filters = [];
            if (a.vendorAccount)
                filters.push(`VendorAccountNumber eq '${a.vendorAccount}'`);
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "VendorCatalogItems", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "proc_query_receipts": {
            const a = QueryReceiptsSchema.parse(args);
            const filters = [];
            if (a.poNumber)
                filters.push(`PurchaseOrderNumber eq '${a.poNumber}'`);
            if (a.receiptNumber)
                filters.push(`ProductReceiptNumber eq '${a.receiptNumber}'`);
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.dateFrom)
                filters.push(`ProductReceiptDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`ProductReceiptDate le ${a.dateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "VendorProductReceiptHeaders", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        default:
            return { type: "text", text: `Unknown procurement tool: ${name}` };
    }
}
//# sourceMappingURL=procurement.js.map