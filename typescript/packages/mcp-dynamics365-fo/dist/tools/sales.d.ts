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
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const salesTools: Tool[];
export declare function handleSalesTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=sales.d.ts.map