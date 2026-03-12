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
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const reportTools: Tool[];
export declare function handleReportTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=reports.d.ts.map