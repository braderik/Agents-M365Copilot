#!/usr/bin/env node
/**
 * MCP CoPilot Agent – Dynamics 365 Finance & Operations
 * ======================================================
 *
 * Transport: stdio (default) or SSE (set D365_SSE_PORT=<port>)
 *
 * 56 MCP tools spanning:
 *  • General Ledger / Finance
 *  • Accounts Payable
 *  • Accounts Receivable
 *  • Inventory Management
 *  • Procurement & Supply Chain
 *  • Sales & Marketing
 *  • Human Resources
 *  • Project Management
 *  • CRUD operations (create / update / delete)
 *  • OData Actions & JSON Services
 *  • Metadata discovery (entity search, schema, FTS, labels)
 *  • SRS Report downloads
 *  • Advanced generic queries (batch, fetch-all, count)
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createAuthProviderFromEnv } from "./auth/dynamics-auth.js";
import { DynamicsClient } from "./client/dynamics-client.js";
import { MetadataCache } from "./cache/metadata-cache.js";

// ── Tool modules ──────────────────────────────────────────────────────────────
import { generalLedgerTools, handleGeneralLedgerTool } from "./tools/general-ledger.js";
import { accountsPayableTools, handleAccountsPayableTool } from "./tools/accounts-payable.js";
import { accountsReceivableTools, handleAccountsReceivableTool } from "./tools/accounts-receivable.js";
import { inventoryTools, handleInventoryTool } from "./tools/inventory.js";
import { procurementTools, handleProcurementTool } from "./tools/procurement.js";
import { salesTools, handleSalesTool } from "./tools/sales.js";
import { humanResourcesTools, handleHumanResourcesTool } from "./tools/human-resources.js";
import { projectsTools, handleProjectsTool } from "./tools/projects.js";
import { advancedQueryTools, handleAdvancedQueryTool } from "./tools/advanced-query.js";
import { crudActionTools, handleCrudActionTool } from "./tools/crud-actions.js";
import { metadataTools, handleMetadataTool } from "./tools/metadata.js";
import { reportTools, handleReportTool } from "./tools/reports.js";

// ── Resources & Prompts ───────────────────────────────────────────────────────
import { staticResources, resourceTemplates, readResource } from "./resources/d365-resources.js";
import { d365Prompts, getPrompt } from "./prompts/d365-prompts.js";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const { provider: authProvider, config: d365Config } = createAuthProviderFromEnv();
const d365Client = new DynamicsClient(d365Config, authProvider);
const metaCache = new MetadataCache(d365Config.metadataCacheDir);

// Async warm-up: seed entity list in background (non-blocking)
void (async () => {
  try {
    const entities = await d365Client.getEntitySets();
    metaCache.seedEntityList(entities);
    console.error(`[MCP D365] Metadata cache seeded with ${entities.length} entities.`);
  } catch {
    // Not critical – tools work without cache
  }
})();

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
  ...crudActionTools,
  ...metadataTools,
  ...reportTools,
  ...advancedQueryTools,
];

// ─── Tool routing ─────────────────────────────────────────────────────────────

type ToolHandler = (
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: any,
) => Promise<{ type: "text"; text: string }>;

function routeTool(name: string): ToolHandler {
  if (name.startsWith("gl_")) return handleGeneralLedgerTool;
  if (name.startsWith("ap_")) return handleAccountsPayableTool;
  if (name.startsWith("ar_")) return handleAccountsReceivableTool;
  if (name.startsWith("inv_")) return handleInventoryTool;
  if (name.startsWith("proc_")) return handleProcurementTool;
  if (name.startsWith("sales_")) return handleSalesTool;
  if (name.startsWith("hr_")) return handleHumanResourcesTool;
  if (name.startsWith("proj_")) return handleProjectsTool;
  if (name.startsWith("d365_download_") || name === "d365_download_report") return handleReportTool;
  return async () => ({ type: "text", text: `Unknown tool: ${name}` });
}

/** Route tools that need extra context (config, cache) */
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ type: "text"; text: string }> {
  // CRUD + actions + connection tools
  if (
    name === "d365_create_record" ||
    name === "d365_update_record" ||
    name === "d365_delete_record" ||
    name === "d365_call_action" ||
    name === "d365_call_json_service" ||
    name === "d365_test_connection" ||
    name === "d365_get_environment_info"
  ) {
    return handleCrudActionTool(name, args, d365Client, {
      baseUrl: d365Config.baseUrl,
      defaultCompany: d365Config.defaultCompany,
    });
  }

  // Metadata tools (need cache)
  if (
    name === "d365_search_entities" ||
    name === "d365_get_entity_schema" ||
    name === "d365_search_actions" ||
    name === "d365_get_entity_sample" ||
    name === "d365_get_label"
  ) {
    return handleMetadataTool(name, args, d365Client, metaCache);
  }

  // Advanced generic query tools
  if (
    name === "d365_query_entity" ||
    name === "d365_get_entity_by_key" ||
    name === "d365_list_entities" ||
    name === "d365_count_records" ||
    name === "d365_batch_query" ||
    name === "d365_fetch_all"
  ) {
    return handleAdvancedQueryTool(name, args, d365Client);
  }

  // Report tools
  if (name.startsWith("d365_download_")) {
    return handleReportTool(name, args, d365Client);
  }

  // Domain-specific tools
  return routeTool(name)(name, args, d365Client);
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "mcp-dynamics365-fo", version: "2.0.0" },
  {
    capabilities: {
      tools: {},
      resources: { subscribe: false },
      prompts: {},
      logging: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const result = await dispatchTool(name, args as Record<string, unknown>);
  return {
    content: [result],
    isError: result.text.startsWith("Error"),
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: staticResources }));
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates }));
server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
  readResource(request.params.uri, d365Client, d365Config.baseUrl),
);

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: d365Prompts }));
server.setRequestHandler(GetPromptRequestSchema, async (request) =>
  getPrompt(request.params.name, (request.params.arguments ?? {}) as Record<string, string>),
);

// ─── Transport selection ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ssePort = process.env.D365_SSE_PORT ? parseInt(process.env.D365_SSE_PORT, 10) : undefined;

  server.onerror = (error) => console.error("[MCP D365] Server error:", error);
  process.on("SIGINT", async () => { await server.close(); process.exit(0); });

  if (ssePort) {
    // SSE transport – dynamically import to avoid bundling issues when SSE is not used
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    const { createServer } = await import("http");

    const httpServer = createServer((req, res) => {
      if (req.method === "GET" && req.url === "/sse") {
        const transport = new SSEServerTransport("/messages", res);
        server.connect(transport).catch((e) => console.error("[SSE] connect error:", e));
      } else if (req.method === "POST" && req.url === "/messages") {
        // SSEServerTransport handles this internally via the connected transport
        res.writeHead(404).end();
      } else {
        res.writeHead(404).end();
      }
    });

    httpServer.listen(ssePort, () => {
      console.error(`[MCP D365] SSE transport listening on http://localhost:${ssePort}/sse`);
    });
  } else {
    // Default: stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  const cacheStats = metaCache.getStats();
  console.error(
    `[MCP D365] Dynamics 365 F&O MCP server v2.0.0 started\n` +
    `  Instance : ${d365Config.baseUrl}\n` +
    `  Company  : ${d365Config.defaultCompany ?? "(all)"}\n` +
    `  Transport: ${ssePort ? `SSE :${ssePort}` : "stdio"}\n` +
    `  Tools    : ${ALL_TOOLS.length}\n` +
    `  Resources: ${staticResources.length}\n` +
    `  Prompts  : ${d365Prompts.length}\n` +
    `  Cache    : ${cacheStats.entityCount} entities, ${cacheStats.actionCount} actions, ${cacheStats.labelCount} labels`,
  );
}

main().catch((err) => {
  console.error("[MCP D365] Fatal error:", err);
  process.exit(1);
});
