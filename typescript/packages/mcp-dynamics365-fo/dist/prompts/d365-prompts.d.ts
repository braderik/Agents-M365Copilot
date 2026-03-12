/**
 * MCP Prompts – Pre-built Dynamics 365 F&O analysis prompts
 *
 * These are reusable prompt templates that guide Copilot users through
 * common F&O analysis workflows.
 */
import type { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
export declare const d365Prompts: Prompt[];
/**
 * Returns the filled prompt messages for a named prompt.
 */
export declare function getPrompt(name: string, args?: Record<string, string>): GetPromptResult;
//# sourceMappingURL=d365-prompts.d.ts.map