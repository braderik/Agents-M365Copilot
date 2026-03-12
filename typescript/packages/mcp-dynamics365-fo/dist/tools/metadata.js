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
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
const SearchEntitiesSchema = z.object({
    pattern: z.string().default("").describe("Search pattern (partial name match). Leave empty to list all."),
    category: z.string().optional().describe("Entity category filter: Master, Transaction, Reference, Document, Configuration, Parameters"),
    top: z.number().int().min(1).max(500).default(50),
});
const GetEntitySchemaSchema = z.object({
    entitySet: z.string().describe("Exact OData entity set name, e.g. CustomersV3"),
    includeNavigations: z.boolean().default(true),
});
const SearchActionsSchema = z.object({
    pattern: z.string().default("").describe("Action name pattern"),
    entitySet: z.string().optional().describe("Filter to actions bound to this entity set"),
    top: z.number().int().min(1).max(200).default(50),
});
const GetEntitySampleSchema = z.object({
    entitySet: z.string().describe("OData entity set name"),
    dataAreaId: z.string().optional().describe("Legal entity to filter to"),
    sampleSize: z.number().int().min(1).max(10).default(3),
});
const GetLabelSchema = z.object({
    labelId: z.string().describe("Label ID in @SYS12345 format"),
    language: z.string().default("en-US").describe("Language code (default en-US)"),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const metadataTools = [
    {
        name: "d365_search_entities",
        description: "Search and discover Dynamics 365 F&O OData entity sets by name pattern. " +
            "Uses local SQLite full-text search (FTS) cache for fast results. " +
            "Returns entity names, labels, and categories. Use this to find the correct entity name before querying.",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Partial name to search for (e.g. 'Sales', 'Customer', 'Invoice')" },
                category: {
                    type: "string",
                    description: "Entity category: Master, Transaction, Reference, Document, Configuration, Parameters",
                },
                top: { type: "number", description: "Max results to return (default 50)" },
            },
        },
    },
    {
        name: "d365_get_entity_schema",
        description: "Get the full OData schema for a Dynamics 365 F&O entity set, including " +
            "key fields (with types), all properties, navigation properties, and available actions. " +
            "Use this to understand an entity's structure before querying or writing data.",
        inputSchema: {
            type: "object",
            required: ["entitySet"],
            properties: {
                entitySet: { type: "string", description: "Exact OData entity set name (e.g. CustomersV3)" },
                includeNavigations: { type: "boolean", description: "Include navigation properties (default true)" },
            },
        },
    },
    {
        name: "d365_search_actions",
        description: "Search available OData actions and functions in the Dynamics 365 F&O instance. " +
            "Returns action names, binding entity (if bound), and parameters.",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Action name pattern (e.g. 'Confirm', 'Post', 'Cancel')" },
                entitySet: { type: "string", description: "Filter to actions bound to a specific entity set" },
                top: { type: "number", description: "Max results (default 50)" },
            },
        },
    },
    {
        name: "d365_get_entity_sample",
        description: "Fetch a small sample of records from a Dynamics 365 F&O entity set (default 3 records). " +
            "Use this to discover field names, data formats, and values for an unfamiliar entity.",
        inputSchema: {
            type: "object",
            required: ["entitySet"],
            properties: {
                entitySet: { type: "string", description: "OData entity set name" },
                dataAreaId: { type: "string", description: "Legal entity to filter to" },
                sampleSize: { type: "number", description: "Number of sample records (1-10, default 3)" },
            },
        },
    },
    {
        name: "d365_get_label",
        description: "Resolve a Dynamics 365 F&O label ID (in @SYS12345 format) to its human-readable text. " +
            "Labels are used for field names and descriptions throughout D365.",
        inputSchema: {
            type: "object",
            required: ["labelId"],
            properties: {
                labelId: { type: "string", description: "Label ID, e.g. @SYS13342 or SYS13342" },
                language: { type: "string", description: "Language code (default en-US)" },
            },
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleMetadataTool(name, args, client, cache) {
    switch (name) {
        case "d365_search_entities": {
            const a = SearchEntitiesSchema.parse(args);
            try {
                // Try cache first, fall back to live entity list
                const cached = await cache.searchEntities(a.pattern, a.category, a.top);
                if (cached.length > 0) {
                    return {
                        type: "text",
                        text: JSON.stringify({ source: "cache", count: cached.length, entities: cached }, null, 2),
                    };
                }
                // Fall back to live OData service document
                const allEntities = await client.getEntitySets();
                const filtered = allEntities
                    .filter((e) => !a.pattern || e.toLowerCase().includes(a.pattern.toLowerCase()))
                    .slice(0, a.top);
                // Seed cache in background
                void cache.seedEntityList(allEntities);
                return {
                    type: "text",
                    text: JSON.stringify({ source: "live", count: filtered.length, entities: filtered }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error searching entities: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_get_entity_schema": {
            const a = GetEntitySchemaSchema.parse(args);
            try {
                // Try metadata cache
                const cached = await cache.getEntitySchema(a.entitySet);
                if (cached) {
                    return { type: "text", text: JSON.stringify({ source: "cache", schema: cached }, null, 2) };
                }
                // Parse $metadata XML for this entity
                const schema = await parseEntitySchemaFromMetadata(client, a.entitySet, a.includeNavigations);
                if (schema) {
                    await cache.saveEntitySchema(a.entitySet, schema);
                }
                return {
                    type: "text",
                    text: JSON.stringify({ source: "live", schema: schema ?? { entitySet: a.entitySet, note: "Schema not found" } }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error getting schema for ${a.entitySet}: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_search_actions": {
            const a = SearchActionsSchema.parse(args);
            try {
                const actions = await cache.searchActions(a.pattern, a.entitySet, a.top);
                return { type: "text", text: JSON.stringify({ count: actions.length, actions }, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error searching actions: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_get_entity_sample": {
            const a = GetEntitySampleSchema.parse(args);
            try {
                const result = await client.query(a.entitySet, {
                    top: a.sampleSize,
                    crossCompany: !a.dataAreaId,
                    dataAreaId: a.dataAreaId,
                });
                const sample = result.value;
                return {
                    type: "text",
                    text: JSON.stringify({
                        entitySet: a.entitySet,
                        sampleCount: sample.length,
                        fields: sample[0] ? Object.keys(sample[0]) : [],
                        records: sample,
                    }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error fetching sample for ${a.entitySet}: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_get_label": {
            const a = GetLabelSchema.parse(args);
            const labelId = a.labelId.replace(/^@/, "");
            try {
                const text = await cache.getLabel(labelId, a.language);
                return {
                    type: "text",
                    text: JSON.stringify({ labelId, language: a.language, text: text ?? `(label ${labelId} not found)` }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error resolving label: ${DynamicsClient.formatError(err)}` };
            }
        }
        default:
            return { type: "text", text: `Unknown metadata tool: ${name}` };
    }
}
// ─── Metadata XML parser (minimal) ───────────────────────────────────────────
/**
 * Parses the OData $metadata XML to extract schema info for one entity.
 * This is a simplified heuristic parser – not a full XML DOM parser.
 */
async function parseEntitySchemaFromMetadata(client, entitySet, includeNavigations) {
    try {
        const xml = await client.getMetadata();
        // Find EntitySet entry
        const entitySetMatch = xml.match(new RegExp(`<EntitySet[^>]+Name="${entitySet}"[^>]+EntityType="([^"]+)"`, "i"));
        if (!entitySetMatch)
            return null;
        const entityTypeFull = entitySetMatch[1];
        const entityTypeName = entityTypeFull.split(".").pop() ?? entityTypeFull;
        // Find EntityType definition
        const entityTypeRegex = new RegExp(`<EntityType[^>]+Name="${entityTypeName}"[\\s\\S]*?</EntityType>`, "i");
        const entityTypeMatch = xml.match(entityTypeRegex);
        if (!entityTypeMatch)
            return null;
        const entityTypeXml = entityTypeMatch[0];
        // Extract keys
        const keyNames = [];
        const keyRef = [...entityTypeXml.matchAll(/<PropertyRef Name="([^"]+)"/gi)];
        keyRef.forEach((m) => keyNames.push(m[1]));
        // Extract properties
        const properties = [];
        const propMatches = [...entityTypeXml.matchAll(/<Property[^/]*Name="([^"]+)"[^/]*Type="([^"]+)"([^/]*)/gi)];
        propMatches.forEach((m) => {
            properties.push({
                name: m[1],
                type: m[2].replace("Edm.", "").replace("Microsoft.Dynamics.DataEntities.", ""),
                nullable: !m[3].includes('Nullable="false"'),
                isKey: keyNames.includes(m[1]),
            });
        });
        // Extract navigation properties
        const navProps = [];
        if (includeNavigations) {
            const navMatches = [...entityTypeXml.matchAll(/<NavigationProperty[^/]*Name="([^"]+)"/gi)];
            navMatches.forEach((m) => navProps.push(m[1]));
        }
        // Extract bound actions
        const actions = [];
        const actionMatches = [...xml.matchAll(new RegExp(`<Action[^>]+Name="([^"]+)"[\\s\\S]*?<Parameter[^>]+Type="${entityTypeFull}"`, "gi"))];
        actionMatches.forEach((m) => actions.push(m[1]));
        return {
            entitySet,
            entityType: entityTypeName,
            keys: properties.filter((p) => p.isKey),
            properties: properties.filter((p) => !p.isKey),
            navigationProperties: navProps,
            actions,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=metadata.js.map