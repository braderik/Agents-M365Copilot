/**
 * Shared helpers for MCP tool implementations.
 */
import { DynamicsClient } from "../client/dynamics-client.js";
import type { QueryOptions, EntityQueryResult } from "../types/dynamics-types.js";
/**
 * Standard wrapper: runs a D365 query and serialises the result as an MCP
 * text content block. Catches all errors and returns them as text so the LLM
 * can reason about the failure.
 */
export declare function runQuery(client: DynamicsClient, entitySet: string, options: QueryOptions): Promise<{
    type: "text";
    text: string;
}>;
/**
 * Formats an EntityQueryResult as a pretty-printed JSON text block.
 */
export declare function formatResult(result: EntityQueryResult): {
    type: "text";
    text: string;
};
/**
 * Converts a comma-separated field list string to an array (or passes through arrays).
 */
export declare function parseSelect(select?: string | string[]): string | undefined;
/**
 * Builds a simple equality filter expression for a single company.
 */
export declare function companyFilter(dataAreaId?: string, extra?: string): string | undefined;
/**
 * Merges two OData filter expressions with 'and'.
 */
export declare function mergeFilters(...filters: (string | undefined)[]): string | undefined;
//# sourceMappingURL=tool-helpers.d.ts.map