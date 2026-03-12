#!/usr/bin/env node
/**
 * MCP CoPilot Agent – Dynamics 365 Finance & Operations
 * ======================================================
 *
 * A robust Model Context Protocol (MCP) server that plugs into
 * Dynamics 365 F&O and exposes its data to any MCP-compatible
 * Copilot client (Claude, GitHub Copilot, VS Code, etc.).
 *
 * Modules covered:
 *  • General Ledger / Finance (chart of accounts, journals, trial balance, budget)
 *  • Accounts Payable (vendors, invoices, payments, aging)
 *  • Accounts Receivable (customers, invoices, aging, collections)
 *  • Inventory (items, on-hand, warehouses, movements, transfer orders)
 *  • Procurement (POs, requisitions, RFQs, receipts, vendor catalog)
 *  • Sales (sales orders, quotations, price lists)
 *  • Human Resources (workers, departments, positions, leave, compensation)
 *  • Project Management (projects, transactions, timesheets, expenses)
 *  • Advanced / Generic (query any entity, batch queries, auto-pagination)
 *
 * Transport: stdio (default) or SSE via D365_TRANSPORT=sse
 */
import "dotenv/config";
//# sourceMappingURL=index.d.ts.map