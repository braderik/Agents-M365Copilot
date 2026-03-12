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
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const crudActionTools: Tool[];
export declare function handleCrudActionTool(name: string, args: Record<string, unknown>, client: DynamicsClient, config: {
    baseUrl: string;
    defaultCompany?: string;
}): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=crud-actions.d.ts.map