/**
 * MCP Tools – Metadata Discovery & Entity Schema
 *
 * Exposed tools:
 *  - d365_search_entities      : Search entity sets by name/pattern with SQLite FTS
 *  - d365_get_entity_schema    : Get entity schema (keys, fields, navigations, actions)
 *  - d365_search_actions       : Search available OData actions
 *  - d365_get_entity_sample    : Fetch 3 sample records to learn entity structure
 *  - d365_get_label            : Resolve a D365 label ID (@SYS12345) to text
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
import { MetadataCache } from "../cache/metadata-cache.js";
export declare const metadataTools: Tool[];
export declare function handleMetadataTool(name: string, args: Record<string, unknown>, client: DynamicsClient, cache: MetadataCache): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=metadata.d.ts.map