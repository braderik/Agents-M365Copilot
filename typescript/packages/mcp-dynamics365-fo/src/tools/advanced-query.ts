/**
 * MCP Tools – Advanced / Generic Query Capabilities
 *
 * Exposed tools:
 *  - d365_query_entity        : Execute any OData query against any D365 F&O entity
 *  - d365_get_entity_by_key   : Fetch single record by OData key
 *  - d365_list_entities       : Discover available entity sets
 *  - d365_count_records       : Count records matching a filter
 *  - d365_batch_query         : Run multiple entity queries in one request
 *  - d365_fetch_all           : Fetch all pages for a query (auto-pagination)
 *  - d365_execute_report      : Retrieve SSRS / financial reports
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
import { formatResult } from "../utils/tool-helpers.js";

const QueryEntitySchema = z.object({
  entitySet: z.string().describe("OData entity set name, e.g. SalesOrderHeaders"),
  filter: z.string().optional().describe("OData $filter expression"),
  select: z.string().optional().describe("Comma-separated fields to return"),
  expand: z.string().optional().describe("OData $expand navigations"),
  orderBy: z.string().optional().describe("OData $orderby expression"),
  top: z.number().int().min(1).max(10000).default(100).describe("Max records to return (1-10000)"),
  skip: z.number().int().min(0).default(0).describe("Records to skip for pagination"),
  crossCompany: z.boolean().default(false).describe("Query across all companies"),
  dataAreaId: z.string().optional().describe("Legal entity / company filter"),
});

const GetByKeySchema = z.object({
  entitySet: z.string().describe("OData entity set name"),
  key: z.union([
    z.string().describe("Simple string key value"),
    z.record(z.string()).describe("Composite key as object {field: value}"),
  ]),
  select: z.string().optional(),
  expand: z.string().optional(),
});

const CountRecordsSchema = z.object({
  entitySet: z.string(),
  filter: z.string().optional(),
  crossCompany: z.boolean().default(false),
});

const BatchQuerySchema = z.object({
  requests: z.array(z.object({
    entitySet: z.string(),
    filter: z.string().optional(),
    select: z.string().optional(),
    top: z.number().int().min(1).max(1000).default(100),
    crossCompany: z.boolean().default(false),
  })).min(1).max(20).describe("Array of 1-20 query requests"),
});

const FetchAllSchema = z.object({
  entitySet: z.string(),
  filter: z.string().optional(),
  select: z.string().optional(),
  orderBy: z.string().optional(),
  maxRecords: z.number().int().min(1).max(50000).default(5000),
  crossCompany: z.boolean().default(false),
  dataAreaId: z.string().optional(),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const advancedQueryTools: Tool[] = [
  {
    name: "d365_query_entity",
    description:
      "Execute a flexible OData query against ANY Dynamics 365 F&O entity set. " +
      "Supports $filter, $select, $expand, $orderby, $top, $skip, and cross-company queries. " +
      "Use this for entities not covered by specialized tools.",
    inputSchema: {
      type: "object",
      required: ["entitySet"],
      properties: {
        entitySet: { type: "string", description: "OData entity set name (e.g. SalesOrderHeaders, Customers, MainAccounts)" },
        filter: { type: "string", description: "OData $filter expression (e.g. \"CustomerAccountNumber eq 'USMF-000001'\")" },
        select: { type: "string", description: "Comma-separated fields to return" },
        expand: { type: "string", description: "OData $expand navigations (e.g. SalesOrderLines)" },
        orderBy: { type: "string", description: "OData $orderby expression (e.g. 'DocumentDate desc')" },
        top: { type: "number", description: "Max records to return (1-10000, default 100)" },
        skip: { type: "number", description: "Records to skip for manual pagination" },
        crossCompany: { type: "boolean", description: "Query across all legal entities" },
        dataAreaId: { type: "string", description: "Restrict to specific legal entity" },
      },
    },
  },
  {
    name: "d365_get_entity_by_key",
    description:
      "Fetch a single Dynamics 365 F&O record by its OData key. " +
      "Supports simple string keys and composite keys (multiple fields).",
    inputSchema: {
      type: "object",
      required: ["entitySet", "key"],
      properties: {
        entitySet: { type: "string", description: "OData entity set name" },
        key: {
          description: "String key value OR object with field:value pairs for composite keys",
          oneOf: [
            { type: "string" },
            { type: "object", additionalProperties: { type: "string" } },
          ],
        },
        select: { type: "string", description: "Comma-separated fields" },
        expand: { type: "string", description: "OData $expand navigations" },
      },
    },
  },
  {
    name: "d365_list_entities",
    description:
      "Discover all available OData entity sets in the Dynamics 365 F&O instance. " +
      "Use this to explore what data is available before querying.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "d365_count_records",
    description: "Count records matching a filter in any Dynamics 365 F&O entity set without fetching the data.",
    inputSchema: {
      type: "object",
      required: ["entitySet"],
      properties: {
        entitySet: { type: "string" },
        filter: { type: "string", description: "OData $filter expression" },
        crossCompany: { type: "boolean" },
      },
    },
  },
  {
    name: "d365_batch_query",
    description:
      "Execute up to 20 Dynamics 365 F&O entity queries in a single HTTP round-trip. " +
      "Efficient for dashboards or reports that need multiple entity counts/lists.",
    inputSchema: {
      type: "object",
      required: ["requests"],
      properties: {
        requests: {
          type: "array",
          description: "Array of query requests (max 20)",
          items: {
            type: "object",
            required: ["entitySet"],
            properties: {
              entitySet: { type: "string" },
              filter: { type: "string" },
              select: { type: "string" },
              top: { type: "number" },
              crossCompany: { type: "boolean" },
            },
          },
        },
      },
    },
  },
  {
    name: "d365_fetch_all",
    description:
      "Fetch ALL pages of a Dynamics 365 F&O OData query using automatic server-driven pagination. " +
      "Use for exports or aggregations. Hard-capped at maxRecords (default 5000, max 50000).",
    inputSchema: {
      type: "object",
      required: ["entitySet"],
      properties: {
        entitySet: { type: "string" },
        filter: { type: "string" },
        select: { type: "string" },
        orderBy: { type: "string" },
        maxRecords: { type: "number", description: "Max total records to fetch (default 5000, max 50000)" },
        crossCompany: { type: "boolean" },
        dataAreaId: { type: "string" },
      },
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleAdvancedQueryTool(
  name: string,
  args: Record<string, unknown>,
  client: DynamicsClient,
): Promise<{ type: "text"; text: string }> {
  switch (name) {
    case "d365_query_entity": {
      const a = QueryEntitySchema.parse(args);
      try {
        const result = await client.queryEntity(a.entitySet, {
          filter: a.filter,
          select: a.select,
          expand: a.expand,
          orderBy: a.orderBy,
          top: a.top,
          skip: a.skip,
          crossCompany: a.crossCompany,
          dataAreaId: a.dataAreaId,
        });
        return formatResult(result);
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "d365_get_entity_by_key": {
      const a = GetByKeySchema.parse(args);
      try {
        const result = await client.getByKey(
          a.entitySet,
          a.key as string | Record<string, string>,
          { select: a.select, expand: a.expand },
        );
        return { type: "text", text: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "d365_list_entities": {
      try {
        const entities = await client.getEntitySets();
        return {
          type: "text",
          text: JSON.stringify(
            { entityCount: entities.length, entities: entities.sort() },
            null,
            2,
          ),
        };
      } catch (err) {
        return { type: "text", text: `Error listing entities: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "d365_count_records": {
      const a = CountRecordsSchema.parse(args);
      try {
        const count = await client.count(a.entitySet, a.filter);
        return {
          type: "text",
          text: JSON.stringify({ entitySet: a.entitySet, filter: a.filter ?? "(none)", count }, null, 2),
        };
      } catch (err) {
        return { type: "text", text: `Error counting: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "d365_batch_query": {
      const a = BatchQuerySchema.parse(args);
      try {
        const results = await client.batchQuery(
          a.requests.map((r) => ({
            entitySet: r.entitySet,
            filter: r.filter,
            select: r.select,
            top: r.top,
            crossCompany: r.crossCompany,
          })),
        );
        return { type: "text", text: JSON.stringify(results, null, 2) };
      } catch (err) {
        return { type: "text", text: `Error in batch query: ${DynamicsClient.formatError(err)}` };
      }
    }

    case "d365_fetch_all": {
      const a = FetchAllSchema.parse(args);
      try {
        const records = await client.fetchAll(a.entitySet, {
          filter: a.filter,
          select: a.select,
          orderBy: a.orderBy,
          top: a.maxRecords,
          crossCompany: a.crossCompany,
          dataAreaId: a.dataAreaId,
        });
        return {
          type: "text",
          text: JSON.stringify(
            { entitySet: a.entitySet, totalFetched: records.length, records },
            null,
            2,
          ),
        };
      } catch (err) {
        return { type: "text", text: `Error in fetchAll: ${DynamicsClient.formatError(err)}` };
      }
    }

    default:
      return { type: "text", text: `Unknown advanced query tool: ${name}` };
  }
}
