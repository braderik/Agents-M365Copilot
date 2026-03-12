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
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { runQuery, mergeFilters } from "../utils/tool-helpers.js";
const QueryItemsSchema = z.object({
    itemNumber: z.string().optional().describe("Item number (partial match)"),
    productName: z.string().optional().describe("Product name (partial match)"),
    itemType: z.string().optional().describe("Item type (Item, Service, BOM)"),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(5000).default(200),
    select: z.string().optional(),
});
const GetItemSchema = z.object({
    itemNumber: z.string(),
    dataAreaId: z.string().optional(),
});
const QueryOnHandSchema = z.object({
    itemNumber: z.string().optional(),
    warehouseId: z.string().optional(),
    siteId: z.string().optional(),
    minQty: z.number().optional().describe("Only return records with available qty >= this value"),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(5000).default(500),
});
const QueryWarehousesSchema = z.object({
    warehouseId: z.string().optional(),
    siteId: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(1000).default(100),
});
const QueryMovementsSchema = z.object({
    itemNumber: z.string().optional(),
    warehouseId: z.string().optional(),
    transType: z.string().optional().describe("Transaction type (e.g. Purchase, Sales, Transfer, Counting)"),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(5000).default(200),
});
const QueryTransferOrdersSchema = z.object({
    transferOrderNumber: z.string().optional(),
    fromWarehouse: z.string().optional(),
    toWarehouse: z.string().optional(),
    status: z.string().optional().describe("Transfer order status"),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(100),
});
const QueryItemPricesSchema = z.object({
    itemNumber: z.string().optional(),
    priceType: z.string().optional().describe("Purchase or Sales"),
    dataAreaId: z.string().optional(),
    top: z.number().int().min(1).max(2000).default(200),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const inventoryTools = [
    {
        name: "inv_query_items",
        description: "Search released products / items in the Dynamics 365 F&O inventory.",
        inputSchema: {
            type: "object",
            properties: {
                itemNumber: { type: "string", description: "Item number (partial match)" },
                productName: { type: "string", description: "Product name (partial match)" },
                itemType: { type: "string", description: "Item, Service, or BOM" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
                select: { type: "string" },
            },
        },
    },
    {
        name: "inv_get_item",
        description: "Get detailed information for a single released product / item.",
        inputSchema: {
            type: "object",
            required: ["itemNumber"],
            properties: {
                itemNumber: { type: "string" },
                dataAreaId: { type: "string" },
            },
        },
    },
    {
        name: "inv_query_onhand",
        description: "Query on-hand inventory quantities in Dynamics 365 F&O by item, warehouse, and site.",
        inputSchema: {
            type: "object",
            properties: {
                itemNumber: { type: "string" },
                warehouseId: { type: "string" },
                siteId: { type: "string" },
                minQty: { type: "number", description: "Only return records with available qty >= this value" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 500)" },
            },
        },
    },
    {
        name: "inv_query_warehouses",
        description: "List warehouses and sites in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                warehouseId: { type: "string" },
                siteId: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "inv_query_movements",
        description: "Query inventory transactions (movements) in Dynamics 365 F&O by item, warehouse, type, and date.",
        inputSchema: {
            type: "object",
            properties: {
                itemNumber: { type: "string" },
                warehouseId: { type: "string" },
                transType: { type: "string", description: "Transaction type (Purchase, Sales, Transfer, Counting)" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
            },
        },
    },
    {
        name: "inv_query_transfer_orders",
        description: "Query inventory transfer orders between warehouses in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                transferOrderNumber: { type: "string" },
                fromWarehouse: { type: "string" },
                toWarehouse: { type: "string" },
                status: { type: "string", description: "Transfer order status" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 100)" },
            },
        },
    },
    {
        name: "inv_query_item_prices",
        description: "Query item purchase and sales prices / trade agreements in Dynamics 365 F&O.",
        inputSchema: {
            type: "object",
            properties: {
                itemNumber: { type: "string" },
                priceType: { type: "string", description: "Purchase or Sales" },
                dataAreaId: { type: "string" },
                top: { type: "number", description: "Max records (default 200)" },
            },
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleInventoryTool(name, args, client) {
    switch (name) {
        case "inv_query_items": {
            const a = QueryItemsSchema.parse(args);
            const filters = [];
            if (a.itemNumber)
                filters.push(`contains(ItemNumber,'${a.itemNumber}')`);
            if (a.productName)
                filters.push(`contains(SearchName,'${a.productName}')`);
            if (a.itemType)
                filters.push(`ItemType eq '${a.itemType}'`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "ReleasedProductsV2", {
                filter: mergeFilters(...filters),
                select: a.select,
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "inv_get_item": {
            const a = GetItemSchema.parse(args);
            try {
                const key = { ItemNumber: a.itemNumber };
                if (a.dataAreaId)
                    key.dataAreaId = a.dataAreaId;
                const result = await client.getByKey("ReleasedProductsV2", key);
                return { type: "text", text: JSON.stringify(result, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "inv_query_onhand": {
            const a = QueryOnHandSchema.parse(args);
            const filters = [];
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.warehouseId)
                filters.push(`InventWarehouseId eq '${a.warehouseId}'`);
            if (a.siteId)
                filters.push(`InventSiteId eq '${a.siteId}'`);
            if (a.minQty !== undefined)
                filters.push(`AvailablePhysicalQuantity ge ${a.minQty}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "InventoryOnHandV3", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "inv_query_warehouses": {
            const a = QueryWarehousesSchema.parse(args);
            const filters = [];
            if (a.warehouseId)
                filters.push(`WarehouseId eq '${a.warehouseId}'`);
            if (a.siteId)
                filters.push(`SiteId eq '${a.siteId}'`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "Warehouses", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "inv_query_movements": {
            const a = QueryMovementsSchema.parse(args);
            const filters = [];
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.warehouseId)
                filters.push(`InventWarehouseId eq '${a.warehouseId}'`);
            if (a.transType)
                filters.push(`TransType eq '${a.transType}'`);
            if (a.dateFrom)
                filters.push(`TransactionDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`TransactionDate le ${a.dateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "InventoryTransactionEntities", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "inv_query_transfer_orders": {
            const a = QueryTransferOrdersSchema.parse(args);
            const filters = [];
            if (a.transferOrderNumber)
                filters.push(`TransferId eq '${a.transferOrderNumber}'`);
            if (a.fromWarehouse)
                filters.push(`InventLocationIdFrom eq '${a.fromWarehouse}'`);
            if (a.toWarehouse)
                filters.push(`InventLocationIdTo eq '${a.toWarehouse}'`);
            if (a.status)
                filters.push(`TransferStatus eq '${a.status}'`);
            if (a.dateFrom)
                filters.push(`ShipDate ge ${a.dateFrom}`);
            if (a.dateTo)
                filters.push(`ShipDate le ${a.dateTo}`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "InventoryTransferOrderHeaders", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        case "inv_query_item_prices": {
            const a = QueryItemPricesSchema.parse(args);
            const filters = [];
            if (a.itemNumber)
                filters.push(`ItemNumber eq '${a.itemNumber}'`);
            if (a.priceType)
                filters.push(`PriceType eq '${a.priceType}'`);
            if (a.dataAreaId)
                filters.push(`DataAreaId eq '${a.dataAreaId}'`);
            return runQuery(client, "InventItemPrices", {
                filter: mergeFilters(...filters),
                top: a.top,
                crossCompany: !a.dataAreaId,
            });
        }
        default:
            return { type: "text", text: `Unknown inventory tool: ${name}` };
    }
}
//# sourceMappingURL=inventory.js.map