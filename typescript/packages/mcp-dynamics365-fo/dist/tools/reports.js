/**
 * MCP Tools – SRS / SSRS Report Downloads
 *
 * Exposed tools:
 *  - d365_download_customer_invoice    : Download posted customer invoice PDF
 *  - d365_download_sales_confirmation  : Download sales order confirmation PDF
 *  - d365_download_purchase_order      : Download PO document PDF
 *  - d365_download_free_text_invoice   : Download free text invoice PDF
 *  - d365_download_debit_credit_note   : Download debit/credit note PDF
 *  - d365_download_report              : Generic SRS report download
 */
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import path from "path";
import fs from "fs";
import os from "os";
const OUTPUT_DIR = path.join(os.homedir(), "d365-reports");
const DownloadCustomerInvoiceSchema = z.object({
    invoiceId: z.string().describe("Invoice ID (CustInvoiceJour.InvoiceId)"),
    dataAreaId: z.string().describe("Legal entity / company ID"),
    outputPath: z.string().optional().describe("Output file path (defaults to ~/d365-reports/)"),
});
const DownloadSalesConfirmationSchema = z.object({
    salesOrderNumber: z.string().describe("Sales order number"),
    dataAreaId: z.string().describe("Legal entity / company ID"),
    outputPath: z.string().optional(),
});
const DownloadPurchaseOrderSchema = z.object({
    purchaseOrderNumber: z.string().describe("Purchase order number"),
    dataAreaId: z.string().describe("Legal entity / company ID"),
    outputPath: z.string().optional(),
});
const DownloadFreeTextInvoiceSchema = z.object({
    invoiceId: z.string(),
    dataAreaId: z.string(),
    outputPath: z.string().optional(),
});
const DownloadDebitCreditNoteSchema = z.object({
    noteId: z.string().describe("Debit/credit note ID"),
    dataAreaId: z.string(),
    noteType: z.enum(["Debit", "Credit"]).default("Credit"),
    outputPath: z.string().optional(),
});
const DownloadReportSchema = z.object({
    reportName: z.string().describe("SSRS report name, e.g. SalesConfirmation.Report"),
    parameters: z.record(z.string()).optional().describe("Report parameters as {name: value} pairs"),
    format: z.enum(["PDF", "Excel", "Word"]).default("PDF"),
    outputPath: z.string().optional(),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const reportTools = [
    {
        name: "d365_download_customer_invoice",
        description: "Download a Dynamics 365 F&O customer invoice as a PDF document. " +
            "Saves the file and returns the output path.",
        inputSchema: {
            type: "object",
            required: ["invoiceId", "dataAreaId"],
            properties: {
                invoiceId: { type: "string", description: "Invoice ID" },
                dataAreaId: { type: "string", description: "Legal entity / company ID" },
                outputPath: { type: "string", description: "Output file path (optional)" },
            },
        },
    },
    {
        name: "d365_download_sales_confirmation",
        description: "Download a Dynamics 365 F&O sales order confirmation as PDF.",
        inputSchema: {
            type: "object",
            required: ["salesOrderNumber", "dataAreaId"],
            properties: {
                salesOrderNumber: { type: "string" },
                dataAreaId: { type: "string" },
                outputPath: { type: "string" },
            },
        },
    },
    {
        name: "d365_download_purchase_order",
        description: "Download a Dynamics 365 F&O purchase order document as PDF.",
        inputSchema: {
            type: "object",
            required: ["purchaseOrderNumber", "dataAreaId"],
            properties: {
                purchaseOrderNumber: { type: "string" },
                dataAreaId: { type: "string" },
                outputPath: { type: "string" },
            },
        },
    },
    {
        name: "d365_download_free_text_invoice",
        description: "Download a Dynamics 365 F&O free text invoice as PDF.",
        inputSchema: {
            type: "object",
            required: ["invoiceId", "dataAreaId"],
            properties: {
                invoiceId: { type: "string" },
                dataAreaId: { type: "string" },
                outputPath: { type: "string" },
            },
        },
    },
    {
        name: "d365_download_debit_credit_note",
        description: "Download a Dynamics 365 F&O debit or credit note as PDF.",
        inputSchema: {
            type: "object",
            required: ["noteId", "dataAreaId"],
            properties: {
                noteId: { type: "string" },
                dataAreaId: { type: "string" },
                noteType: { type: "string", enum: ["Debit", "Credit"], description: "Note type (default Credit)" },
                outputPath: { type: "string" },
            },
        },
    },
    {
        name: "d365_download_report",
        description: "Download any Dynamics 365 F&O SSRS report by name with custom parameters. " +
            "Returns the output file path.",
        inputSchema: {
            type: "object",
            required: ["reportName"],
            properties: {
                reportName: { type: "string", description: "Report name, e.g. SalesConfirmation.Report" },
                parameters: {
                    type: "object",
                    description: "Report parameters as {name: value}",
                    additionalProperties: { type: "string" },
                },
                format: { type: "string", enum: ["PDF", "Excel", "Word"], description: "Output format (default PDF)" },
                outputPath: { type: "string" },
            },
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleReportTool(name, args, client) {
    switch (name) {
        case "d365_download_customer_invoice": {
            const a = DownloadCustomerInvoiceSchema.parse(args);
            return downloadViaAction(client, "d365_download_customer_invoice", {
                reportName: "SalesInvoice.Report",
                parameters: { InvoiceId: a.invoiceId, DataAreaId: a.dataAreaId },
                outputPath: a.outputPath,
                defaultFilename: `invoice_${a.invoiceId}.pdf`,
            });
        }
        case "d365_download_sales_confirmation": {
            const a = DownloadSalesConfirmationSchema.parse(args);
            return downloadViaAction(client, "d365_download_sales_confirmation", {
                reportName: "SalesConfirmation.Report",
                parameters: { SalesId: a.salesOrderNumber, DataAreaId: a.dataAreaId },
                outputPath: a.outputPath,
                defaultFilename: `sales_confirmation_${a.salesOrderNumber}.pdf`,
            });
        }
        case "d365_download_purchase_order": {
            const a = DownloadPurchaseOrderSchema.parse(args);
            return downloadViaAction(client, "d365_download_purchase_order", {
                reportName: "PurchPurchaseOrder.Report",
                parameters: { PurchId: a.purchaseOrderNumber, DataAreaId: a.dataAreaId },
                outputPath: a.outputPath,
                defaultFilename: `purchase_order_${a.purchaseOrderNumber}.pdf`,
            });
        }
        case "d365_download_free_text_invoice": {
            const a = DownloadFreeTextInvoiceSchema.parse(args);
            return downloadViaAction(client, "d365_download_free_text_invoice", {
                reportName: "FreeTextInvoice.Report",
                parameters: { InvoiceId: a.invoiceId, DataAreaId: a.dataAreaId },
                outputPath: a.outputPath,
                defaultFilename: `free_text_invoice_${a.invoiceId}.pdf`,
            });
        }
        case "d365_download_debit_credit_note": {
            const a = DownloadDebitCreditNoteSchema.parse(args);
            const reportName = a.noteType === "Debit" ? "SalesDebitNote.Report" : "SalesCreditNote.Report";
            return downloadViaAction(client, "d365_download_debit_credit_note", {
                reportName,
                parameters: { NoteId: a.noteId, DataAreaId: a.dataAreaId },
                outputPath: a.outputPath,
                defaultFilename: `${a.noteType.toLowerCase()}_note_${a.noteId}.pdf`,
            });
        }
        case "d365_download_report": {
            const a = DownloadReportSchema.parse(args);
            return downloadViaAction(client, "d365_download_report", {
                reportName: a.reportName,
                parameters: a.parameters ?? {},
                format: a.format,
                outputPath: a.outputPath,
                defaultFilename: `${a.reportName.replace(/[^a-zA-Z0-9]/g, "_")}.${a.format.toLowerCase()}`,
            });
        }
        default:
            return { type: "text", text: `Unknown report tool: ${name}` };
    }
}
async function downloadViaAction(client, toolName, opts) {
    try {
        // D365 F&O exposes reports via the Document Management / SSRS Print service
        // POST /api/services/ERModelMappingService/IERModelMappingService/getEntityList
        // or via the SRSFramework service
        const reportParams = Object.entries(opts.parameters).map(([k, v]) => ({
            Name: k,
            Value: v,
        }));
        const result = await client.callJsonService({
            servicePath: "api/services/SrsFrameworkService/ISrsFrameworkService/getReportParameters",
            method: "POST",
            body: {
                reportName: opts.reportName,
                parameters: reportParams,
                format: opts.format ?? "PDF",
            },
        });
        if (!result || !result.fileContent) {
            return {
                type: "text",
                text: JSON.stringify({
                    note: "Report download requested. The D365 instance may require configuring the SRS Framework print service endpoint.",
                    tool: toolName,
                    reportName: opts.reportName,
                    parameters: opts.parameters,
                    format: opts.format ?? "PDF",
                    suggestion: "Use d365_call_json_service with the correct report service path for your D365 version.",
                }, null, 2),
            };
        }
        // Save the base64 file content
        const outputDir = opts.outputPath ? path.dirname(opts.outputPath) : OUTPUT_DIR;
        if (!fs.existsSync(outputDir))
            fs.mkdirSync(outputDir, { recursive: true });
        const filename = opts.outputPath ?? path.join(OUTPUT_DIR, result.fileName ?? opts.defaultFilename);
        const buffer = Buffer.from(result.fileContent, "base64");
        fs.writeFileSync(filename, buffer);
        return {
            type: "text",
            text: JSON.stringify({
                success: true,
                outputPath: filename,
                sizeBytes: buffer.length,
                reportName: opts.reportName,
            }, null, 2),
        };
    }
    catch (err) {
        return {
            type: "text",
            text: `Error downloading report '${opts.reportName}': ${DynamicsClient.formatError(err)}`,
        };
    }
}
//# sourceMappingURL=reports.js.map