/**
 * MCP Tools – CRUD Operations & OData Actions
 *
 * Exposed tools:
 *  - d365_create_record        : Create a new entity record
 *  - d365_update_record        : Update an existing record (PATCH or PUT)
 *  - d365_delete_record        : Delete a record by key
 *  - d365_call_action          : Execute an OData bound or unbound action
 *  - d365_call_json_service    : Call a D365 JSON service API endpoint
 *  - d365_test_connection      : Test connectivity + measure latency
 *  - d365_get_environment_info : Get D365 F&O environment metadata
 */
import { z } from "zod";
import { DynamicsClient } from "../client/dynamics-client.js";
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const CreateRecordSchema = z.object({
    entitySet: z.string().describe("OData entity set name, e.g. SalesOrderHeadersV2"),
    data: z.record(z.unknown()).describe("Entity data as a JSON object"),
    returnEntity: z.boolean().default(false).describe("If true, returns the created record in the response"),
});
const UpdateRecordSchema = z.object({
    entitySet: z.string().describe("OData entity set name"),
    key: z.union([
        z.string().describe("Simple string key value"),
        z.record(z.string()).describe("Composite key as {field: value} pairs"),
    ]).describe("Entity key – string for simple keys, object for composite keys"),
    data: z.record(z.unknown()).describe("Fields to update as a JSON object"),
    method: z.enum(["PATCH", "PUT"]).default("PATCH").describe("PATCH = partial update (default). PUT = full replacement."),
});
const DeleteRecordSchema = z.object({
    entitySet: z.string().describe("OData entity set name"),
    key: z.union([
        z.string().describe("Simple string key value"),
        z.record(z.string()).describe("Composite key as {field: value} pairs"),
    ]).describe("Entity key"),
});
const CallActionSchema = z.object({
    actionName: z.string().describe("OData action name. Can include namespace (e.g. Microsoft.Dynamics.DataEntities.ConfirmOrder) " +
        "or just the short name (e.g. ConfirmOrder). Namespace is auto-prefixed if omitted."),
    parameters: z.record(z.unknown()).optional().describe("Action parameters as a JSON object"),
    entitySet: z.string().optional().describe("Entity set for bound actions (e.g. SalesOrderHeadersV2)"),
    entityKey: z.union([
        z.string(),
        z.record(z.string()),
    ]).optional().describe("Entity key for bound actions"),
});
const CallJsonServiceSchema = z.object({
    servicePath: z.string().describe("Relative service path, e.g. api/services/SalesService/SalesOrderService/createSalesOrder"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
    body: z.record(z.unknown()).optional().describe("Request body (for POST/PUT/PATCH)"),
});
// ─── Tool definitions ─────────────────────────────────────────────────────────
export const crudActionTools = [
    {
        name: "d365_create_record",
        description: "Create a new record in any Dynamics 365 F&O entity set. " +
            "Returns the created record if returnEntity is true, otherwise returns a success message.",
        inputSchema: {
            type: "object",
            required: ["entitySet", "data"],
            properties: {
                entitySet: { type: "string", description: "OData entity set name (e.g. SalesOrderHeadersV2)" },
                data: {
                    type: "object",
                    description: "Entity field values as a JSON object",
                    additionalProperties: true,
                },
                returnEntity: {
                    type: "boolean",
                    description: "Return the created record in the response (default false)",
                },
            },
        },
    },
    {
        name: "d365_update_record",
        description: "Update an existing Dynamics 365 F&O record. " +
            "PATCH performs a partial update (only the specified fields). " +
            "PUT replaces the entire record. Supports simple and composite keys.",
        inputSchema: {
            type: "object",
            required: ["entitySet", "key", "data"],
            properties: {
                entitySet: { type: "string" },
                key: {
                    description: "Record key – string for simple keys, object with {field: value} for composite keys",
                    oneOf: [
                        { type: "string" },
                        { type: "object", additionalProperties: { type: "string" } },
                    ],
                },
                data: {
                    type: "object",
                    description: "Fields to update",
                    additionalProperties: true,
                },
                method: {
                    type: "string",
                    enum: ["PATCH", "PUT"],
                    description: "PATCH = partial update (default), PUT = full replacement",
                },
            },
        },
    },
    {
        name: "d365_delete_record",
        description: "Delete a record from a Dynamics 365 F&O entity set by its key. " +
            "Supports simple and composite (multi-field) keys.",
        inputSchema: {
            type: "object",
            required: ["entitySet", "key"],
            properties: {
                entitySet: { type: "string" },
                key: {
                    description: "Record key",
                    oneOf: [
                        { type: "string" },
                        { type: "object", additionalProperties: { type: "string" } },
                    ],
                },
            },
        },
    },
    {
        name: "d365_call_action",
        description: "Execute a Dynamics 365 F&O OData action or function. " +
            "Supports both unbound actions (system-wide) and bound actions (on a specific entity record). " +
            "Examples: ConfirmOrder (bound to SalesOrderHeadersV2), GetApplicationVersion (unbound).",
        inputSchema: {
            type: "object",
            required: ["actionName"],
            properties: {
                actionName: {
                    type: "string",
                    description: "Action name, e.g. 'ConfirmOrder' or 'Microsoft.Dynamics.DataEntities.ConfirmOrder'",
                },
                parameters: {
                    type: "object",
                    description: "Action parameters",
                    additionalProperties: true,
                },
                entitySet: {
                    type: "string",
                    description: "Entity set for bound actions (e.g. SalesOrderHeadersV2)",
                },
                entityKey: {
                    description: "Entity key for bound actions",
                    oneOf: [
                        { type: "string" },
                        { type: "object", additionalProperties: { type: "string" } },
                    ],
                },
            },
        },
    },
    {
        name: "d365_call_json_service",
        description: "Call a Dynamics 365 F&O JSON service API endpoint. " +
            "Used for custom services exposed via the D365 service framework " +
            "at /api/services/{ServiceGroup}/{Service}/{Operation}.",
        inputSchema: {
            type: "object",
            required: ["servicePath"],
            properties: {
                servicePath: {
                    type: "string",
                    description: "Relative path, e.g. api/services/SalesService/SalesOrderService/createSalesOrder",
                },
                method: {
                    type: "string",
                    enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
                    description: "HTTP method (default POST)",
                },
                body: {
                    type: "object",
                    description: "Request body",
                    additionalProperties: true,
                },
            },
        },
    },
    {
        name: "d365_test_connection",
        description: "Test connectivity to the Dynamics 365 F&O instance and return latency and status.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "d365_get_environment_info",
        description: "Get D365 F&O environment details including base URL, OData endpoint, default company, and connection status.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
];
// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleCrudActionTool(name, args, client, config) {
    switch (name) {
        case "d365_create_record": {
            const a = CreateRecordSchema.parse(args);
            try {
                const result = await client.create({
                    entitySet: a.entitySet,
                    data: a.data,
                    returnEntity: a.returnEntity,
                });
                const msg = a.returnEntity
                    ? JSON.stringify(result, null, 2)
                    : JSON.stringify({ success: true, entitySet: a.entitySet, message: "Record created successfully." }, null, 2);
                return { type: "text", text: msg };
            }
            catch (err) {
                return { type: "text", text: `Error creating record in ${a.entitySet}: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_update_record": {
            const a = UpdateRecordSchema.parse(args);
            try {
                await client.update({
                    entitySet: a.entitySet,
                    key: a.key,
                    data: a.data,
                    method: a.method,
                });
                return {
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        entitySet: a.entitySet,
                        method: a.method,
                        message: "Record updated successfully.",
                    }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error updating record: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_delete_record": {
            const a = DeleteRecordSchema.parse(args);
            try {
                await client.delete(a.entitySet, a.key);
                return {
                    type: "text",
                    text: JSON.stringify({ success: true, entitySet: a.entitySet, message: "Record deleted successfully." }, null, 2),
                };
            }
            catch (err) {
                return { type: "text", text: `Error deleting record: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_call_action": {
            const a = CallActionSchema.parse(args);
            try {
                const result = await client.callAction({
                    actionName: a.actionName,
                    parameters: a.parameters,
                    entitySet: a.entitySet,
                    entityKey: a.entityKey,
                });
                return { type: "text", text: JSON.stringify(result ?? { success: true }, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error calling action '${a.actionName}': ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_call_json_service": {
            const a = CallJsonServiceSchema.parse(args);
            try {
                const result = await client.callJsonService({
                    servicePath: a.servicePath,
                    method: a.method,
                    body: a.body,
                });
                return { type: "text", text: JSON.stringify(result, null, 2) };
            }
            catch (err) {
                return { type: "text", text: `Error calling JSON service: ${DynamicsClient.formatError(err)}` };
            }
        }
        case "d365_test_connection": {
            const result = await client.testConnection();
            return { type: "text", text: JSON.stringify(result, null, 2) };
        }
        case "d365_get_environment_info": {
            const connResult = await client.testConnection();
            return {
                type: "text",
                text: JSON.stringify({
                    instanceUrl: config.baseUrl,
                    odataEndpoint: `${config.baseUrl.replace(/\/$/, "")}/data/`,
                    defaultCompany: config.defaultCompany ?? "(all companies)",
                    connected: connResult.ok,
                    latencyMs: connResult.latencyMs,
                    error: connResult.error,
                    serverTime: new Date().toISOString(),
                }, null, 2),
            };
        }
        default:
            return { type: "text", text: `Unknown CRUD/action tool: ${name}` };
    }
}
//# sourceMappingURL=crud-actions.js.map