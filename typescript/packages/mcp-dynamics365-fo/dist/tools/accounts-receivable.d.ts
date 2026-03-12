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
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const accountsReceivableTools: Tool[];
export declare function handleAccountsReceivableTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=accounts-receivable.d.ts.map