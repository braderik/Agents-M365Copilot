/**
 * Dynamics 365 Finance & Operations type definitions
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export interface D365Config {
  /** Azure AD tenant ID */
  tenantId: string;
  /** Azure AD app registration client ID */
  clientId: string;
  /** Azure AD app registration client secret */
  clientSecret: string;
  /** D365 F&O base URL, e.g. https://myorg.operations.dynamics.com */
  baseUrl: string;
  /** Optional: legal entity / company, e.g. USMF */
  defaultCompany?: string;
  /** Request timeout in ms (default 30000) */
  timeoutMs?: number;
  /** Max retries on transient errors (default 3) */
  maxRetries?: number;
  /** Path to SQLite metadata cache directory */
  metadataCacheDir?: string;
  /** Port to run SSE transport on (optional) */
  ssePort?: number;
}

// ─── OData primitives ─────────────────────────────────────────────────────────

export interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

export interface QueryOptions {
  /** OData $filter expression */
  filter?: string;
  /** OData $select fields (comma-separated or array) */
  select?: string | string[];
  /** OData $expand navigations */
  expand?: string | string[];
  /** OData $orderby */
  orderBy?: string;
  /** OData $top – number of records to return (max 10000) */
  top?: number;
  /** OData $skip – records to skip for pagination */
  skip?: number;
  /** Cross-company query */
  crossCompany?: boolean;
  /** Legal entity override */
  dataAreaId?: string;
  /** OData $search – full-text search */
  search?: string;
}

export interface BatchQueryOptions extends QueryOptions {
  /** Entity set name, e.g. "SalesOrderHeadersV2" */
  entitySet: string;
}

// ─── OData type mapping ───────────────────────────────────────────────────────

export type ODataKeyType = "string" | "int32" | "int64" | "decimal" | "guid" | "boolean" | "date" | "datetime";

export interface EntityKeyField {
  name: string;
  type: ODataKeyType;
}

// ─── CRUD operation types ─────────────────────────────────────────────────────

export interface CreateEntityArgs {
  entitySet: string;
  data: Record<string, unknown>;
  returnEntity?: boolean;
}

export interface UpdateEntityArgs {
  entitySet: string;
  key: string | Record<string, string>;
  data: Record<string, unknown>;
  method?: "PATCH" | "PUT";
}

export interface DeleteEntityArgs {
  entitySet: string;
  key: string | Record<string, string>;
}

export interface CallActionArgs {
  actionName: string;
  parameters?: Record<string, unknown>;
  entitySet?: string;
  entityKey?: string | Record<string, string>;
}

export interface CallJsonServiceArgs {
  servicePath: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}

// ─── Entity query result ──────────────────────────────────────────────────────

export interface EntityQueryResult {
  entitySet: string;
  count: number;
  data: Record<string, unknown>[];
  nextLink?: string;
}

// ─── Metadata types ───────────────────────────────────────────────────────────

export interface EntitySetInfo {
  name: string;
  entityType?: string;
  kind: "EntitySet" | "Singleton" | "FunctionImport" | "ActionImport";
}

export interface EntityProperty {
  name: string;
  type: string;
  nullable: boolean;
  isKey: boolean;
  isMandatory?: boolean;
  allowEdit?: boolean;
  isReadOnly?: boolean;
  isDimension?: boolean;
  label?: string;
}

export interface EntitySchema {
  entitySet: string;
  entityType: string;
  isReadOnly: boolean;
  keys: EntityProperty[];
  properties: EntityProperty[];
  navigationProperties: string[];
  actions: string[];
  label?: string;
  description?: string;
}

export interface ActionInfo {
  name: string;
  fullName: string;
  isBound: boolean;
  boundEntitySet?: string;
  parameters: { name: string; type: string }[];
  returnType?: string;
}

// ─── Generic query args ───────────────────────────────────────────────────────

export interface QueryEntityArgs {
  entitySet: string;
  filter?: string;
  select?: string;
  expand?: string;
  orderBy?: string;
  top?: number;
  skip?: number;
  crossCompany?: boolean;
  dataAreaId?: string;
  search?: string;
}

export interface GetByKeyArgs {
  entitySet: string;
  key: string | Record<string, string>;
  select?: string;
  expand?: string;
}

export interface BatchRequestArgs {
  requests: BatchQueryOptions[];
}

// ─── Report args ──────────────────────────────────────────────────────────────

export interface DownloadReportArgs {
  reportName: string;
  parameters?: Record<string, string>;
  format?: "PDF" | "Excel" | "Word";
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface D365Error {
  error: {
    code: string;
    message: string;
    innerError?: unknown;
  };
}
