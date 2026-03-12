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
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const advancedQueryTools: Tool[];
export declare function handleAdvancedQueryTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=advanced-query.d.ts.map