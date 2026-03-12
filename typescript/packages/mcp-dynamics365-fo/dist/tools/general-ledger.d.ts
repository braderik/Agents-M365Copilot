/**
 * MCP Tools – General Ledger & Finance
 *
 * Exposed tools:
 *  - gl_query_accounts         : Search chart of accounts
 *  - gl_query_journal_entries  : Query posted journal entries / vouchers
 *  - gl_query_trial_balance    : Retrieve trial balance by period
 *  - gl_query_budget           : Query budget register entries
 *  - gl_query_financial_dims   : List financial dimension values
 *  - gl_query_fiscal_calendars : List fiscal calendars / periods
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { DynamicsClient } from "../client/dynamics-client.js";
export declare const generalLedgerTools: Tool[];
export declare function handleGeneralLedgerTool(name: string, args: Record<string, unknown>, client: DynamicsClient): Promise<{
    type: "text";
    text: string;
}>;
//# sourceMappingURL=general-ledger.d.ts.map