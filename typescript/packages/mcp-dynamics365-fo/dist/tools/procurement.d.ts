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
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const procurementTools: Tool[];
export declare function handleProcurementTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=procurement.d.ts.map