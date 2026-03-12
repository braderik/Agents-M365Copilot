/**
 * MCP Resources – Static and Dynamic Dynamics 365 F&O resources
 *
 * Resources surface read-only data that Copilot clients can subscribe to
 * or read as context (e.g. entity schemas, company list, current user).
 */

import type { Resource, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { DynamicsClient } from "../client/dynamics-client.js";

const BASE_URI = "d365://";

/** Static resource definitions (listed in resources/list). */
export const staticResources: Resource[] = [
  {
    uri: `${BASE_URI}info`,
    name: "D365 Connection Info",
    description: "Current Dynamics 365 F&O connection status and base URL",
    mimeType: "application/json",
  },
  {
    uri: `${BASE_URI}entities`,
    name: "Available Entity Sets",
    description: "All OData entity sets exposed by this D365 F&O instance",
    mimeType: "application/json",
  },
  {
    uri: `${BASE_URI}companies`,
    name: "Legal Entities / Companies",
    description: "All legal entities (companies / DataAreaIds) in this D365 environment",
    mimeType: "application/json",
  },
  {
    uri: `${BASE_URI}currencies`,
    name: "Currencies",
    description: "All currencies configured in D365 F&O",
    mimeType: "application/json",
  },
  {
    uri: `${BASE_URI}fiscal-calendars`,
    name: "Fiscal Calendars",
    description: "Fiscal calendars and periods defined in D365 F&O",
    mimeType: "application/json",
  },
  {
    uri: `${BASE_URI}financial-dimensions`,
    name: "Financial Dimensions",
    description: "Financial dimension attributes (Department, CostCenter, etc.) in D365 F&O",
    mimeType: "application/json",
  },
];

/** Resource template for per-entity schema lookup. */
export const resourceTemplates = [
  {
    uriTemplate: `${BASE_URI}entity/{entitySet}`,
    name: "Entity Set Info",
    description: "Sample records and field names for a specific D365 F&O entity set",
    mimeType: "application/json",
  },
];

/**
 * Reads a resource by URI and returns its content.
 */
export async function readResource(
  uri: string,
  client: DynamicsClient,
  baseUrl: string,
): Promise<ReadResourceResult> {
  // Static resources
  if (uri === `${BASE_URI}info`) {
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          baseUrl,
          odataEndpoint: `${baseUrl}/data/`,
          status: "connected",
          serverTime: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  if (uri === `${BASE_URI}entities`) {
    const entities = await client.getEntitySets();
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ count: entities.length, entities: entities.sort() }, null, 2),
      }],
    };
  }

  if (uri === `${BASE_URI}companies`) {
    const result = await client.query("Companies", { top: 200, crossCompany: true });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result.value, null, 2),
      }],
    };
  }

  if (uri === `${BASE_URI}currencies`) {
    const result = await client.query("Currencies", { top: 300 });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result.value, null, 2),
      }],
    };
  }

  if (uri === `${BASE_URI}fiscal-calendars`) {
    const result = await client.query("FiscalCalendars", { top: 50 });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result.value, null, 2),
      }],
    };
  }

  if (uri === `${BASE_URI}financial-dimensions`) {
    const result = await client.query("LedgerFinancialTagPurposes", {
      top: 100,
      crossCompany: true,
    });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result.value, null, 2),
      }],
    };
  }

  // Dynamic entity template: d365://entity/{entitySet}
  const entityMatch = uri.match(/^d365:\/\/entity\/(.+)$/);
  if (entityMatch) {
    const entitySet = entityMatch[1];
    const result = await client.query(entitySet, { top: 3, crossCompany: true });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          entitySet,
          sampleRecordCount: result.value.length,
          fields: result.value[0] ? Object.keys(result.value[0]) : [],
          sampleRecords: result.value,
        }, null, 2),
      }],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}
