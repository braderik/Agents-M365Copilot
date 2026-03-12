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
export async function runQuery(
  client: DynamicsClient,
  entitySet: string,
  options: QueryOptions,
): Promise<{ type: "text"; text: string }> {
  try {
    const result = await client.queryEntity(entitySet, options);
    return formatResult(result);
  } catch (err) {
    return { type: "text", text: `Error querying ${entitySet}: ${DynamicsClient.formatError(err)}` };
  }
}

/**
 * Formats an EntityQueryResult as a pretty-printed JSON text block.
 */
export function formatResult(result: EntityQueryResult): { type: "text"; text: string } {
  const summary = {
    entitySet: result.entitySet,
    returnedCount: result.data.length,
    totalCount: result.count,
    hasMore: !!result.nextLink,
    records: result.data,
  };
  return { type: "text", text: JSON.stringify(summary, null, 2) };
}

/**
 * Converts a comma-separated field list string to an array (or passes through arrays).
 */
export function parseSelect(select?: string | string[]): string | undefined {
  if (!select) return undefined;
  if (Array.isArray(select)) return select.join(",");
  return select;
}

/**
 * Builds a simple equality filter expression for a single company.
 */
export function companyFilter(dataAreaId?: string, extra?: string): string | undefined {
  const parts: string[] = [];
  if (dataAreaId) parts.push(`DataAreaId eq '${dataAreaId}'`);
  if (extra) parts.push(extra);
  return parts.length ? parts.join(" and ") : undefined;
}

/**
 * Merges two OData filter expressions with 'and'.
 */
export function mergeFilters(...filters: (string | undefined)[]): string | undefined {
  const valid = filters.filter(Boolean) as string[];
  if (!valid.length) return undefined;
  return valid.map((f) => `(${f})`).join(" and ");
}
