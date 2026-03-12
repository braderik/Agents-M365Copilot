# MCP CoPilot Agent – Dynamics 365 Finance & Operations

A robust **Model Context Protocol (MCP)** server that connects any MCP-compatible Copilot client (Claude Desktop, GitHub Copilot, VS Code, etc.) to **Dynamics 365 Finance & Operations** via its OData v4 REST API.

## Features

| Capability | Details |
|---|---|
| **41 MCP Tools** | Covers GL, AP, AR, Inventory, Procurement, Sales, HR, Projects |
| **Generic Query Engine** | Query ANY F&O entity with full OData ($filter, $select, $expand, $orderby, $top, $skip) |
| **Auto-pagination** | `d365_fetch_all` transparently follows `@odata.nextLink` pages |
| **Batch Requests** | `d365_batch_query` runs up to 20 queries in one HTTP round-trip |
| **Azure AD Auth** | Supports Client Secret, Managed Identity, Device Code, Certificate |
| **Token caching** | In-memory token cache with automatic pre-expiry refresh |
| **Retry logic** | Exponential back-off on 429 / 5xx / network errors |
| **8 MCP Resources** | Connection info, entity list, companies, currencies, fiscal calendars |
| **8 Pre-built Prompts** | Financial summary, AR collections, inventory health, procurement spend, etc. |
| **Cross-company queries** | Query across all legal entities with `crossCompany: true` |

---

## Architecture

```
mcp-dynamics365-fo/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio transport)
│   ├── auth/
│   │   └── dynamics-auth.ts        # Azure AD OAuth2 token provider (all auth modes)
│   ├── client/
│   │   └── dynamics-client.ts      # OData v4 HTTP client with retry, pagination, batch
│   ├── tools/
│   │   ├── general-ledger.ts       # GL: accounts, journals, trial balance, budget
│   │   ├── accounts-payable.ts     # AP: vendors, invoices, payments, aging
│   │   ├── accounts-receivable.ts  # AR: customers, invoices, aging, collections
│   │   ├── inventory.ts            # Inv: items, on-hand, warehouses, movements
│   │   ├── procurement.ts          # Proc: POs, requisitions, RFQs, receipts
│   │   ├── sales.ts                # Sales: orders, quotations, price lists
│   │   ├── human-resources.ts      # HR: workers, departments, positions, leave
│   │   ├── projects.ts             # PM: projects, transactions, timesheets, expenses
│   │   └── advanced-query.ts       # Generic: query any entity, batch, fetch-all
│   ├── resources/
│   │   └── d365-resources.ts       # MCP Resources (connection info, entity list, etc.)
│   ├── prompts/
│   │   └── d365-prompts.ts         # Pre-built analysis prompts
│   ├── types/
│   │   └── dynamics-types.ts       # TypeScript type definitions
│   └── utils/
│       └── tool-helpers.ts         # Shared helpers (runQuery, formatResult, mergeFilters)
├── .env.example                    # Environment variable template
├── package.json
└── tsconfig.json
```

---

## Prerequisites

### 1. Azure AD App Registration

1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: `D365-MCP-CoPilot-Agent`
3. Supported account types: **Single tenant**
4. No redirect URI needed (service-to-service)
5. After creation, go to **API Permissions** → **Add a permission**:
   - **Dynamics 365 Finance & Operations** → **Delegated or Application permissions**
   - Add: `user_impersonation` (or application-level permissions)
6. **Grant admin consent**
7. Go to **Certificates & Secrets** → **New client secret** → copy the value

### 2. D365 F&O Application User

1. In D365 F&O, go to **System administration** → **Users** → **Users**
2. Click **New** → Create an application user
3. Set **User ID**, **Application ID** (= your Azure AD client ID)
4. Assign to a **Security role** (e.g. System Administrator, or a custom read-only role)

---

## Installation

```bash
cd typescript/packages/mcp-dynamics365-fo
npm install
npm run build
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `D365_TENANT_ID` | Azure AD tenant ID (GUID) |
| `D365_CLIENT_ID` | App registration client ID (GUID) |
| `D365_CLIENT_SECRET` | Client secret value |
| `D365_BASE_URL` | D365 F&O base URL, e.g. `https://myorg.operations.dynamics.com` |

Optional:

| Variable | Default | Description |
|---|---|---|
| `D365_DEFAULT_COMPANY` | (all) | Default legal entity, e.g. `USMF` |
| `D365_AUTH_MODE` | `clientSecret` | `clientSecret \| managedIdentity \| deviceCode \| certificate` |
| `D365_TIMEOUT_MS` | `30000` | HTTP timeout in ms |
| `D365_MAX_RETRIES` | `3` | Max retry attempts |

---

## Usage

### Run as stdio MCP server

```bash
npm start
```

Or during development:

```bash
npm run dev
```

### Claude Desktop integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dynamics365-fo": {
      "command": "node",
      "args": ["/path/to/mcp-dynamics365-fo/dist/index.js"],
      "env": {
        "D365_TENANT_ID": "your-tenant-id",
        "D365_CLIENT_ID": "your-client-id",
        "D365_CLIENT_SECRET": "your-secret",
        "D365_BASE_URL": "https://your-org.operations.dynamics.com",
        "D365_DEFAULT_COMPANY": "USMF"
      }
    }
  }
}
```

### VS Code MCP extension

```json
{
  "mcp.servers": {
    "d365fo": {
      "command": "node",
      "args": ["${workspaceFolder}/typescript/packages/mcp-dynamics365-fo/dist/index.js"],
      "env": { "..." : "..." }
    }
  }
}
```

---

## Tool Reference

### General Ledger (prefix: `gl_`)

| Tool | Description |
|---|---|
| `gl_query_accounts` | Search chart of accounts |
| `gl_query_journal_entries` | Query posted GL journals / vouchers |
| `gl_query_trial_balance` | Retrieve trial balance by period |
| `gl_query_budget` | Query budget register entries |
| `gl_query_financial_dims` | List financial dimension values |
| `gl_query_fiscal_calendars` | List fiscal calendars and periods |

### Accounts Payable (prefix: `ap_`)

| Tool | Description |
|---|---|
| `ap_query_vendors` | Search vendors by account, name, group |
| `ap_get_vendor` | Get single vendor details |
| `ap_query_invoices` | Query vendor invoices (open/posted/paid) |
| `ap_query_payments` | Query vendor payment transactions |
| `ap_query_aging` | Vendor aging analysis |

### Accounts Receivable (prefix: `ar_`)

| Tool | Description |
|---|---|
| `ar_query_customers` | Search customers |
| `ar_get_customer` | Get single customer details |
| `ar_query_invoices` | Query customer invoices |
| `ar_query_open_transactions` | Open / unpaid customer transactions |
| `ar_query_aging` | Customer aging analysis |
| `ar_query_collections` | Collections cases and activities |

### Inventory (prefix: `inv_`)

| Tool | Description |
|---|---|
| `inv_query_items` | Search released products / items |
| `inv_get_item` | Get single item details |
| `inv_query_onhand` | On-hand quantities by item / warehouse |
| `inv_query_warehouses` | List warehouses and sites |
| `inv_query_movements` | Inventory transactions / movements |
| `inv_query_transfer_orders` | Warehouse transfer orders |
| `inv_query_item_prices` | Item purchase / sales prices |

### Procurement (prefix: `proc_`)

| Tool | Description |
|---|---|
| `proc_query_purchase_orders` | Search purchase orders |
| `proc_get_purchase_order` | Get PO header + lines |
| `proc_query_po_lines` | Search across PO lines |
| `proc_query_requisitions` | Purchase requisitions |
| `proc_query_rfqs` | Request for quotations |
| `proc_query_vendor_catalog` | Vendor catalog items |
| `proc_query_receipts` | Product receipts (GRNs) |

### Sales (prefix: `sales_`)

| Tool | Description |
|---|---|
| `sales_query_orders` | Search sales orders |
| `sales_get_order` | Get SO with lines |
| `sales_query_order_lines` | Search across SO lines |
| `sales_query_quotations` | Sales quotations |
| `sales_query_price_lists` | Trade agreements / price lists |

### Human Resources (prefix: `hr_`)

| Tool | Description |
|---|---|
| `hr_query_workers` | Search employees and contractors |
| `hr_get_worker` | Get single worker details |
| `hr_query_departments` | List departments |
| `hr_query_positions` | Positions and assignments |
| `hr_query_jobs` | Job definitions |
| `hr_query_leave_balances` | Employee leave / absence balances |
| `hr_query_compensation` | Compensation plans |

### Project Management (prefix: `proj_`)

| Tool | Description |
|---|---|
| `proj_query_projects` | Search projects |
| `proj_get_project` | Full project details |
| `proj_query_transactions` | Project cost / revenue transactions |
| `proj_query_timesheets` | Timesheet entries |
| `proj_query_expenses` | Project expense reports |
| `proj_query_contracts` | Project contracts |
| `proj_query_wbs` | Work breakdown structure tasks |

### Advanced / Generic (prefix: `d365_`)

| Tool | Description |
|---|---|
| `d365_query_entity` | Query **any** OData entity with full filter support |
| `d365_get_entity_by_key` | Fetch single record by OData key (simple or composite) |
| `d365_list_entities` | Discover all available entity sets |
| `d365_count_records` | Count records matching a filter |
| `d365_batch_query` | Run up to 20 queries in one HTTP round-trip |
| `d365_fetch_all` | Auto-paginate and fetch all records (up to 50k) |

---

## Pre-built Prompts

| Prompt | Description |
|---|---|
| `financial-summary` | Executive financial summary for a period |
| `vendor-payment-analysis` | AP invoices, payments, and overdue items |
| `inventory-health-check` | Stockouts, overstock, and replenishment status |
| `sales-pipeline-review` | Open orders, quotations, and revenue pipeline |
| `procurement-spend-analysis` | Spend by vendor and category |
| `project-profitability` | Project cost vs revenue vs budget |
| `ar-collections-review` | Aging, overdue invoices, collection priorities |
| `headcount-summary` | Workforce breakdown, open positions |

---

## Security Considerations

- Store credentials in environment variables, never in source code
- Use **Managed Identity** when running in Azure (no secrets needed)
- Apply the **principle of least privilege** — create a dedicated D365 application user with read-only roles
- Rotate client secrets regularly (recommended: every 90 days)
- Consider IP allowlisting in your D365 F&O environment for the MCP server

---

## D365 F&O OData API Notes

- Base endpoint: `https://{your-org}.operations.dynamics.com/data/`
- Authentication: `Bearer` token from Azure AD
- Max page size: 10,000 records per request
- Cross-company queries: append `?cross-company=true`
- Compound keys: use `EntitySet(Key1='val1',Key2='val2')` format

---

## License

MIT – See [LICENSE](../../../../LICENSE)
