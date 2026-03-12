#!/usr/bin/env node
/**
 * MCP CoPilot Agent – Dynamics 365 Finance & Operations
 * ======================================================
 *
 * A robust Model Context Protocol (MCP) server that plugs into
 * Dynamics 365 F&O and exposes its data to any MCP-compatible
 * Copilot client (Claude, GitHub Copilot, VS Code, etc.).
 *
 * Modules covered:
 *  • General Ledger / Finance (chart of accounts, journals, trial balance, budget)
 *  • Accounts Payable (vendors, invoices, payments, aging)
 *  • Accounts Receivable (customers, invoices, aging, collections)
 *  • Inventory (items, on-hand, warehouses, movements, transfer orders)
 *  • Procurement (POs, requisitions, RFQs, receipts, vendor catalog)
 *  • Sales (sales orders, quotations, price lists)
 *  • Human Resources (workers, departments, positions, leave, compensation)
 *  • Project Management (projects, transactions, timesheets, expenses)
 *  • Advanced / Generic (query any entity, batch queries, auto-pagination)
 *
 * Transport: stdio (default) or SSE via D365_TRANSPORT=sse
 */
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, ListResourceTemplatesRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createAuthProviderFromEnv } from "./auth/dynamics-auth.js";
import { DynamicsClient } from "./client/dynamics-client.js";
// Tools
import { generalLedgerTools, handleGeneralLedgerTool } from "./tools/general-ledger.js";
import { accountsPayableTools, handleAccountsPayableTool } from "./tools/accounts-payable.js";
import { accountsReceivableTools, handleAccountsReceivableTool } from "./tools/accounts-receivable.js";
import { inventoryTools, handleInventoryTool } from "./tools/inventory.js";
import { procurementTools, handleProcurementTool } from "./tools/procurement.js";
import { salesTools, handleSalesTool } from "./tools/sales.js";
import { humanResourcesTools, handleHumanResourcesTool } from "./tools/human-resources.js";
import { projectsTools, handleProjectsTool } from "./tools/projects.js";
import { advancedQueryTools, handleAdvancedQueryTool } from "./tools/advanced-query.js";
// Resources & Prompts
import { staticResources, resourceTemplates, readResource } from "./resources/d365-resources.js";
import { d365Prompts, getPrompt } from "./prompts/d365-prompts.js";
// ─── Bootstrap ───────────────────────────────────────────────────────────────
const { provider: authProvider, config: d365Config } = createAuthProviderFromEnv();
const d365Client = new DynamicsClient(d365Config, authProvider);
// ─── All tools registry ───────────────────────────────────────────────────────
const ALL_TOOLS = [
    ...generalLedgerTools,
    ...accountsPayableTools,
    ...accountsReceivableTools,
    ...inventoryTools,
    ...procurementTools,
    ...salesTools,
    ...humanResourcesTools,
    ...projectsTools,
    ...advancedQueryTools,
];
/** Map tool name prefix → handler function */
const TOOL_HANDLERS = {
    gl_: handleGeneralLedgerTool,
    ap_: handleAccountsPayableTool,
    ar_: handleAccountsReceivableTool,
    inv_: handleInventoryTool,
    proc_: handleProcurementTool,
    sales_: handleSalesTool,
    hr_: handleHumanResourcesTool,
    proj_: handleProjectsTool,
    d365_: handleAdvancedQueryTool,
};
function routeTool(name) {
    for (const [prefix, handler] of Object.entries(TOOL_HANDLERS)) {
        if (name.startsWith(prefix))
            return handler;
    }
    return async () => ({ type: "text", text: `Unknown tool: ${name}` });
}
// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server({
    name: "mcp-dynamics365-fo",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
        resources: { subscribe: false },
        prompts: {},
        logging: {},
    },
});
// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const handler = routeTool(name);
    const result = await handler(name, args, d365Client);
    return {
        content: [result],
        isError: result.text.startsWith("Error"),
    };
});
// ── Resource handlers ─────────────────────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: staticResources,
}));
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates,
}));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return readResource(uri, d365Client, d365Config.baseUrl);
});
// ── Prompt handlers ───────────────────────────────────────────────────────────
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: d365Prompts,
}));
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    return getPrompt(name, args);
});
// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    server.onerror = (error) => {
        console.error("[MCP D365] Server error:", error);
    };
    process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
    });
    await server.connect(transport);
    console.error(`[MCP D365] Dynamics 365 F&O MCP server started\n` +
        `  Instance : ${d365Config.baseUrl}\n` +
        `  Company  : ${d365Config.defaultCompany ?? "(all)"}\n` +
        `  Tools    : ${ALL_TOOLS.length}\n` +
        `  Resources: ${staticResources.length}\n` +
        `  Prompts  : ${d365Prompts.length}`);
}
main().catch((err) => {
    console.error("[MCP D365] Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map