# Session Chat Summary
**Date:** 2026-03-16
**Repository:** `Agents-M365Copilot`
**Active Branch:** `claude/mcp-copilot-dynamics365-cwFNa`
**Project:** MCP CoPilot Agent – Dynamics 365 Finance & Operations

---

## 1. Project Overview

The session was focused on the **`mcp-dynamics365-fo`** package located at:

```
typescript/packages/mcp-dynamics365-fo/
```

This is a **Model Context Protocol (MCP)** server written in **TypeScript** that bridges any MCP-compatible Copilot client (e.g. Microsoft Copilot Studio, Claude Desktop, GitHub Copilot, VS Code) to **Dynamics 365 Finance & Operations** via the OData v4 REST API.

### Key Capabilities of the MCP Server

| Feature | Detail |
|---|---|
| **41 MCP Tools** | Covers GL, AP, AR, Inventory, Procurement, Sales, HR, Projects |
| **Generic Query Engine** | Query ANY F&O entity with OData (`$filter`, `$select`, `$expand`, `$orderby`, `$top`, `$skip`) |
| **Auto-pagination** | `d365_fetch_all` follows `@odata.nextLink` transparently |
| **Batch Requests** | `d365_batch_query` runs up to 20 queries per HTTP round-trip |
| **Azure AD Auth** | Client Secret, Managed Identity, Device Code, Certificate |
| **Token Caching** | In-memory with automatic pre-expiry refresh |
| **Retry Logic** | Exponential back-off on 429 / 5xx / network errors |
| **8 MCP Resources** | Connection info, entity list, companies, currencies, fiscal calendars |
| **8 Pre-built Prompts** | Financial summary, AR collections, inventory health, procurement spend, etc. |
| **Cross-company queries** | Query all legal entities with `crossCompany: true` |

---

## 2. Source Architecture

```
mcp-dynamics365-fo/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio transport)
│   ├── auth/
│   │   └── dynamics-auth.ts        # Azure AD OAuth2 token provider (all auth modes)
│   ├── client/
│   │   └── dynamics-client.ts      # OData v4 HTTP client (retry, pagination, batch)
│   ├── tools/
│   │   ├── general-ledger.ts       # GL: accounts, journals, trial balance, budget
│   │   ├── accounts-payable.ts     # AP: vendors, invoices, payments, aging
│   │   ├── accounts-receivable.ts  # AR: customers, invoices, aging, collections
│   │   ├── inventory.ts            # Inventory: items, on-hand, warehouses, movements
│   │   ├── procurement.ts          # Procurement: POs, requisitions, RFQs, receipts
│   │   ├── sales.ts                # Sales: orders, quotations, price lists
│   │   ├── human-resources.ts      # HR: workers, departments, positions, leave
│   │   ├── projects.ts             # PM: projects, transactions, timesheets, expenses
│   │   └── advanced-query.ts       # Generic: query any entity, batch, fetch-all
│   ├── resources/
│   │   └── d365-resources.ts       # MCP Resources
│   ├── prompts/
│   │   └── d365-prompts.ts         # Pre-built analysis prompts
│   ├── types/
│   │   └── dynamics-types.ts       # TypeScript type definitions
│   └── utils/
│       └── tool-helpers.ts         # Shared helpers
├── .env.example
├── Dockerfile                      # Added for Azure Container Apps deployment
├── package.json
└── tsconfig.json
```

---

## 3. Git Commit History (Session Scope)

The following commits were made on branch `claude/mcp-copilot-dynamics365-cwFNa` during or before this session:

| Commit | Message |
|---|---|
| `f8eac81` | Add Dockerfile for Azure Container Apps deployment |
| `40cbd88` | fix: address all 4 Qodo code review bugs |
| `0515d19` | feat: upgrade MCP D365 agent to v2 with CRUD, actions, metadata cache, SSE |
| `a2e0fc9` | feat: add MCP CoPilot agent for Dynamics 365 Finance & Operations |

---

## 4. Deployment Topic – The Core Discussion

### 4a. Goal
Deploy the MCP server so it is accessible over the internet with a public HTTPS endpoint, which is required for **Microsoft Copilot Studio** to connect to it via SSE (Server-Sent Events).

The SSE endpoint format expected by Copilot Studio:
```
https://<server-host>/sse
```

The server listens on:
```
D365_SSE_PORT=8080  (default)
```

### 4b. Problem – Azure Subscription Barrier
The user stated:
> _"I need a subscription to do that from the Measure website though"_

This meant the user does **not** have access to an Azure subscription (or it requires procurement approval through a corporate/billing portal), blocking the originally discussed Azure deployment path (e.g., Azure Container Apps, Azure App Service, or Azure Portal-based deployment).

---

## 5. Proposed Solution – GitHub Codespaces (Zero-Cost, Browser-Based)

Because the user could not use Azure, the recommended alternative was **GitHub Codespaces**, which provides:

- Runs **entirely in the browser** — no local install required
- A **built-in public HTTPS port-forwarding URL** (e.g. `https://xxxx-8080.app.github.dev`)
- **Free tier** included with GitHub: 60 hours/month for personal accounts
- No credit card or Azure subscription needed

### Step-by-Step Instructions Provided

#### Step 1 – Open Codespaces
Navigate to the GitHub repo → click **Code** → **Codespaces** tab → **Create codespace on main**

#### Step 2 – Configure environment
In the Codespace terminal:
```bash
cd typescript/packages/mcp-dynamics365-fo
cp .env.example .env
nano .env
```

Fill in the following required variables:
```env
D365_TENANT_ID=<your-azure-ad-tenant-id>
D365_CLIENT_ID=<your-app-registration-client-id>
D365_CLIENT_SECRET=<your-client-secret>
D365_BASE_URL=https://udedev4b.operations.dynamics.com
D365_DEFAULT_COMPANY=USMF
D365_SSE_PORT=8080
```

#### Step 3 – Build and start the server
```bash
npm install && npm run build && npm start
```

#### Step 4 – Expose the port publicly
In the Codespace UI:
- Open the **Ports** tab (bottom panel)
- Find port `8080`
- Right-click → **Port Visibility** → **Public**
- Copy the forwarded public URL (format: `https://xxxx-8080.app.github.dev`)

#### Step 5 – Register with Copilot Studio
In Microsoft Copilot Studio, configure the MCP connector:
```
Server URL: https://xxxx-8080.app.github.dev/sse
```

### Limitation Noted
> The Codespace must be **running** whenever Copilot Studio makes requests. For a production environment with 24/7 availability, Azure hosting is still the right long-term solution.

---

## 6. Environment Variables Reference

### Required

| Variable | Description |
|---|---|
| `D365_TENANT_ID` | Azure AD tenant ID (GUID) |
| `D365_CLIENT_ID` | App registration client ID (GUID) |
| `D365_CLIENT_SECRET` | Client secret value |
| `D365_BASE_URL` | D365 F&O base URL, e.g. `https://myorg.operations.dynamics.com` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `D365_DEFAULT_COMPANY` | (all) | Default legal entity, e.g. `USMF` |
| `D365_AUTH_MODE` | `clientSecret` | `clientSecret | managedIdentity | deviceCode | certificate` |
| `D365_TIMEOUT_MS` | `30000` | HTTP timeout in ms |
| `D365_MAX_RETRIES` | `3` | Max retry attempts |
| `D365_SSE_PORT` | `8080` | Port for SSE transport |

---

## 7. Azure AD Setup Requirements (Prerequisite)

Even with Codespaces, Azure AD credentials are still needed:

### App Registration
1. Azure Portal → Azure Active Directory → App registrations → New registration
2. Name: `D365-MCP-CoPilot-Agent`
3. Supported account types: **Single tenant**
4. API Permissions → Dynamics 365 Finance & Operations → `user_impersonation`
5. Grant admin consent
6. Certificates & Secrets → New client secret → copy value

### D365 F&O Application User
1. D365 F&O → System administration → Users
2. Create application user with Client ID matching the app registration
3. Assign appropriate security role (read-only recommended for MCP)

---

## 8. MCP Tool Categories

### General Ledger (`gl_` prefix)
`gl_query_accounts`, `gl_query_journal_entries`, `gl_query_trial_balance`, `gl_query_budget`, `gl_query_financial_dims`, `gl_query_fiscal_calendars`

### Accounts Payable (`ap_` prefix)
`ap_query_vendors`, `ap_get_vendor`, `ap_query_invoices`, `ap_query_payments`, `ap_query_aging`

### Accounts Receivable (`ar_` prefix)
`ar_query_customers`, `ar_get_customer`, `ar_query_invoices`, `ar_query_open_transactions`, `ar_query_aging`, `ar_query_collections`

### Inventory (`inv_` prefix)
`inv_query_items`, `inv_get_item`, `inv_query_onhand`, `inv_query_warehouses`, `inv_query_movements`, `inv_query_transfer_orders`, `inv_query_item_prices`

### Procurement (`proc_` prefix)
`proc_query_purchase_orders`, `proc_get_purchase_order`, `proc_query_po_lines`, `proc_query_requisitions`, `proc_query_rfqs`, `proc_query_vendor_catalog`, `proc_query_receipts`

### Sales (`sales_` prefix)
`sales_query_orders`, `sales_get_order`, `sales_query_order_lines`, `sales_query_quotations`, `sales_query_price_lists`

### Human Resources (`hr_` prefix)
`hr_query_workers`, `hr_get_worker`, `hr_query_departments`, `hr_query_positions`, `hr_query_jobs`, `hr_query_leave_balances`, `hr_query_compensation`

### Project Management (`proj_` prefix)
`proj_query_projects`, `proj_get_project`, `proj_query_transactions`, `proj_query_timesheets`, `proj_query_expenses`, `proj_query_contracts`, `proj_query_wbs`

### Advanced / Generic (`d365_` prefix)
`d365_query_entity`, `d365_get_entity_by_key`, `d365_list_entities`, `d365_count_records`, `d365_batch_query`, `d365_fetch_all`

---

## 9. Pre-built Prompts

| Prompt | Purpose |
|---|---|
| `financial-summary` | Executive financial summary for a period |
| `vendor-payment-analysis` | AP invoices, payments, overdue items |
| `inventory-health-check` | Stockouts, overstock, replenishment |
| `sales-pipeline-review` | Open orders, quotations, revenue pipeline |
| `procurement-spend-analysis` | Spend by vendor and category |
| `project-profitability` | Project cost vs revenue vs budget |
| `ar-collections-review` | Aging, overdue invoices, collection priorities |
| `headcount-summary` | Workforce breakdown, open positions |

---

## 10. Security Notes

- Credentials must be stored in environment variables — never hardcoded
- Use **Managed Identity** when running in Azure (eliminates secrets entirely)
- Apply **principle of least privilege** — dedicated D365 app user with read-only roles
- Rotate client secrets every 90 days
- Consider IP allowlisting in D365 F&O for the MCP server host

---

## 11. Next Steps / Open Items

| # | Item | Status |
|---|---|---|
| 1 | User to verify GitHub access from work PC browser | Pending user confirmation |
| 2 | Deploy via GitHub Codespaces as immediate workaround | Instructions provided |
| 3 | Long-term: obtain Azure subscription for production deployment | Blocked (subscription required) |
| 4 | Connect Copilot Studio to the public SSE URL | Pending deployment |

---

## 12. Deployment Comparison

| Method | Cost | Setup | Availability | Best For |
|---|---|---|---|---|
| **GitHub Codespaces** | Free (60h/mo) | Browser only | Manual (while open) | Development / testing |
| **Azure Container Apps** | Pay-per-use | Azure subscription | 24/7 | Production |
| **Azure App Service** | Pay-per-use | Azure subscription | 24/7 | Production |
| **Railway / Render** | Free tier available | GitHub connect | 24/7 (sleep on free) | Low-cost production |

---

*Summary generated on 2026-03-16 for session on branch `claude/mcp-copilot-dynamics365-cwFNa`*
