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
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const accountsPayableTools: Tool[];
export declare function handleAccountsPayableTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=accounts-payable.d.ts.map