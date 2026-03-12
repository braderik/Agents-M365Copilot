/**
 * MCP Tools – Project Management & Accounting
 *
 * Exposed tools:
 *  - proj_query_projects      : Search projects
 *  - proj_get_project         : Get full project details
 *  - proj_query_transactions  : Project cost/revenue transactions
 *  - proj_query_timesheets    : Timesheet entries
 *  - proj_query_expenses      : Project expense reports
 *  - proj_query_contracts     : Project contracts
 *  - proj_query_wbs           : Work breakdown structure tasks
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const projectsTools: Tool[];
export declare function handleProjectsTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=projects.d.ts.map