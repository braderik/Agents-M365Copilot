/**
 * MCP Tools – Human Resources
 *
 * Exposed tools:
 *  - hr_query_workers         : Search employees / contractors
 *  - hr_get_worker            : Get single worker details
 *  - hr_query_departments     : List departments
 *  - hr_query_positions       : List positions and assignments
 *  - hr_query_jobs            : List job definitions
 *  - hr_query_leave_balances  : Employee leave / absence balances
 *  - hr_query_compensation    : Compensation plans and bands
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DynamicsClient } from "../client/dynamics-client.js";
export declare const humanResourcesTools: Tool[];
export declare function handleHumanResourcesTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=human-resources.d.ts.map