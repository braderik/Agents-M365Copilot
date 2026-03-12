/**
 * MCP Resources – Static and Dynamic Dynamics 365 F&O resources
 *
 * Resources surface read-only data that Copilot clients can subscribe to
 * or read as context (e.g. entity schemas, company list, current user).
 */
import type { Resource, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { DynamicsClient } from "../client/dynamics-client.js";
/** Static resource definitions (listed in resources/list). */
export declare const staticResources: Resource[];
/** Resource template for per-entity schema lookup. */
export declare const resourceTemplates: {
    uriTemplate: string;
    name: string;
    description: string;
    mimeType: string;
}[];
/**
 * Reads a resource by URI and returns its content.
 */
export declare function readResource(uri: string, client: DynamicsClient, baseUrl: string): Promise<ReadResourceResult>;
//# sourceMappingURL=d365-resources.d.ts.map