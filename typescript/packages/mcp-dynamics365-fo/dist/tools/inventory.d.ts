/**
 * MCP Tools – Inventory Management
 *
 * Exposed tools:
 *  - inv_query_items           : Search released products / items
 *  - inv_get_item              : Get single item details
 *  - inv_query_onhand          : On-hand inventory by item / warehouse / site
 *  - inv_query_warehouses      : List warehouses and sites
 *  - inv_query_movements       : Inventory transactions / movements
 *  - inv_query_transfer_orders : Warehouse transfer orders
 *  - inv_query_item_prices     : Item purchase / sales prices
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const inventoryTools: Tool[];
export declare function handleInventoryTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=inventory.d.ts.map