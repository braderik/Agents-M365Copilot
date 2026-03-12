/**
 * MCP Prompts – Pre-built Dynamics 365 F&O analysis prompts
 *
 * These are reusable prompt templates that guide Copilot users through
 * common F&O analysis workflows.
 */

import type { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export const d365Prompts: Prompt[] = [
  {
    name: "financial-summary",
    description: "Generate a financial summary report for a company and period",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID (e.g. USMF)", required: true },
      { name: "periodStart", description: "Period start date (ISO 8601)", required: true },
      { name: "periodEnd", description: "Period end date (ISO 8601)", required: true },
    ],
  },
  {
    name: "vendor-payment-analysis",
    description: "Analyze vendor payments and outstanding AP invoices",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "vendorAccount", description: "Specific vendor account (optional)", required: false },
      { name: "dueDateBefore", description: "Show overdue invoices before this date", required: false },
    ],
  },
  {
    name: "inventory-health-check",
    description: "Assess inventory levels, slow-moving items, and stockouts",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "warehouseId", description: "Specific warehouse (optional)", required: false },
    ],
  },
  {
    name: "sales-pipeline-review",
    description: "Review open sales orders, quotations, and revenue pipeline",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "salesPerson", description: "Sales personnel number (optional)", required: false },
    ],
  },
  {
    name: "procurement-spend-analysis",
    description: "Analyze procurement spend by vendor, category, and period",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "dateFrom", description: "Analysis period start", required: true },
      { name: "dateTo", description: "Analysis period end", required: true },
    ],
  },
  {
    name: "project-profitability",
    description: "Review project costs, revenues, and profitability",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "projectId", description: "Specific project ID (optional, omit for all)", required: false },
    ],
  },
  {
    name: "ar-collections-review",
    description: "Review accounts receivable aging and identify collection priorities",
    arguments: [
      { name: "dataAreaId", description: "Legal entity / company ID", required: true },
      { name: "overdueOnly", description: "Focus only on overdue items (true/false)", required: false },
    ],
  },
  {
    name: "headcount-summary",
    description: "Summarize workforce headcount, open positions, and department breakdown",
    arguments: [
      { name: "companyId", description: "Company ID", required: true },
    ],
  },
];

/**
 * Returns the filled prompt messages for a named prompt.
 */
export function getPrompt(name: string, args: Record<string, string> = {}): GetPromptResult {
  switch (name) {
    case "financial-summary":
      return {
        description: `Financial summary for ${args.dataAreaId ?? "company"} ${args.periodStart} – ${args.periodEnd}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please generate a comprehensive financial summary for legal entity **${args.dataAreaId}** for the period **${args.periodStart}** to **${args.periodEnd}**.

Include:
1. Trial balance overview (key account balances)
2. Revenue and expense summary (GL journal analysis)
3. Cash position (bank account balances)
4. Outstanding AP invoices and upcoming payments
5. Outstanding AR invoices and overdue amounts
6. Budget vs. actual comparison (if budget data available)

Use the available D365 F&O tools to retrieve this data and present a concise executive summary.`,
          },
        }],
      };

    case "vendor-payment-analysis":
      return {
        description: `AP payment analysis for ${args.dataAreaId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Analyze accounts payable and vendor payments for legal entity **${args.dataAreaId}**.
${args.vendorAccount ? `Focus on vendor: **${args.vendorAccount}**\n` : ""}
${args.dueDateBefore ? `Show invoices due before: **${args.dueDateBefore}**\n` : ""}

Please:
1. List all open vendor invoices${args.dueDateBefore ? ` due before ${args.dueDateBefore}` : ""}
2. Show total AP outstanding by vendor (top 10)
3. Identify invoices at risk of late payment
4. Review recent payments in the last 30 days
5. Highlight any vendors on hold

Use the ap_ tools to retrieve this information.`,
          },
        }],
      };

    case "inventory-health-check":
      return {
        description: `Inventory health check for ${args.dataAreaId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Perform an inventory health check for legal entity **${args.dataAreaId}**${args.warehouseId ? `, warehouse **${args.warehouseId}**` : ""}.

Please analyze:
1. Current on-hand inventory quantities by warehouse
2. Items with zero or negative available quantity (stockouts)
3. Items with high available quantity (potential overstock)
4. Open purchase orders for replenishment
5. Open transfer orders in progress
6. Recent inventory movements for anomalies

Use the inv_ and proc_ tools to retrieve this data.`,
          },
        }],
      };

    case "sales-pipeline-review":
      return {
        description: `Sales pipeline review for ${args.dataAreaId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review the sales pipeline for legal entity **${args.dataAreaId}**${args.salesPerson ? `, sales person **${args.salesPerson}**` : ""}.

Please provide:
1. Open sales orders by status (Backorder, Picking, Packing, Shipped)
2. Total value of the open order pipeline
3. Expiring quotations (next 30 days)
4. Orders with delayed shipping dates
5. Top 10 customers by open order value
6. Recently invoiced orders (last 30 days)

Use the sales_ and ar_ tools to retrieve this data.`,
          },
        }],
      };

    case "procurement-spend-analysis":
      return {
        description: `Procurement spend analysis ${args.dateFrom} – ${args.dateTo}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Analyze procurement spend for legal entity **${args.dataAreaId}** from **${args.dateFrom}** to **${args.dateTo}**.

Please provide:
1. Total PO value created in the period
2. Spend breakdown by top 10 vendors
3. POs awaiting confirmation or receipt
4. Purchase requisitions pending approval
5. Open RFQs in progress
6. Identify any single-vendor dependency risks

Use the proc_ tools to retrieve this information.`,
          },
        }],
      };

    case "project-profitability":
      return {
        description: `Project profitability review for ${args.dataAreaId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review project profitability for legal entity **${args.dataAreaId}**${args.projectId ? `, project **${args.projectId}**` : " (all active projects)"}.

Please analyze:
1. Project costs (hours, expenses, items) vs budget
2. Revenue recognized and billed
3. Projects at risk of overrunning budget
4. Timesheet utilization by worker
5. Unbilled time and expenses
6. Project completion status

Use the proj_ tools to retrieve this data.`,
          },
        }],
      };

    case "ar-collections-review":
      return {
        description: `AR collections review for ${args.dataAreaId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review accounts receivable and collections for legal entity **${args.dataAreaId}**.
${args.overdueOnly === "true" ? "Focus only on **overdue** items.\n" : ""}

Please provide:
1. Total AR outstanding by aging bucket (current, 30, 60, 90+ days)
2. Top 10 customers by outstanding balance
3. Customers exceeding their credit limit
4. Active collection cases and status
5. Invoices overdue by more than 60 days
6. Recent payment receipts

Use the ar_ tools to retrieve this data.`,
          },
        }],
      };

    case "headcount-summary":
      return {
        description: `Headcount summary for ${args.companyId}`,
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Provide a workforce headcount summary for company **${args.companyId}**.

Please include:
1. Total headcount by worker type (Employee vs Contractor)
2. Headcount breakdown by department
3. Open / vacant positions
4. New hires in the last 90 days
5. Terminations in the last 90 days
6. Leave balances summary

Use the hr_ tools to retrieve this information.`,
          },
        }],
      };

    default:
      return {
        description: name,
        messages: [{
          role: "user",
          content: { type: "text", text: `Run the '${name}' analysis.` },
        }],
      };
  }
}
