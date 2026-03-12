/**
 * Dynamics 365 Finance & Operations OData v4 client
 *
 * Features:
 *  - Automatic Bearer token injection with in-memory cache
 *  - Full OData query builder ($filter, $select, $expand, $orderby, $top, $skip, $count, $search)
 *  - Automatic cross-company detection: appends cross-company=true when dataAreaId is present
 *  - Type-aware OData key encoding (string→quoted, int64→plain, guid→guid'...', etc.)
 *  - Full CRUD: GET, POST (create), PATCH/PUT (update), DELETE
 *  - OData bound/unbound action execution (POST .../Microsoft.Dynamics.DataEntities.{Action})
 *  - JSON Service API calls (/api/services/...)
 *  - Automatic pagination (fetchAll)
 *  - OData $batch requests
 *  - Retry with exponential back-off on 429 / 5xx
 *  - Entity metadata / $metadata document
 *  - Connection health check
 */

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import axiosRetry from "axios-retry";
import type {
  D365Config,
  ODataResponse,
  QueryOptions,
  EntityQueryResult,
  BatchQueryOptions,
  CreateEntityArgs,
  UpdateEntityArgs,
  DeleteEntityArgs,
  CallActionArgs,
  CallJsonServiceArgs,
} from "../types/dynamics-types.js";
import type { DynamicsAuthProvider } from "../auth/dynamics-auth.js";

const MAX_PAGE_SIZE = 10_000;
const DEFAULT_PAGE_SIZE = 1_000;
const FETCH_ALL_MAX_RECORDS = 100_000;

/** D365 OData action namespace prefix */
const D365_NAMESPACE = "Microsoft.Dynamics.DataEntities";

// ─── OData key encoding ───────────────────────────────────────────────────────

/**
 * Encodes an OData key segment from a string or composite object.
 *
 * Rules (D365 F&O specific):
 *  - String values → 'URL-encoded-value'
 *  - Numeric values → plain number
 *  - dataAreaId is always a string
 *
 * Auto-detects cross-company need when dataAreaId appears in a composite key.
 */
function encodeODataKey(key: string | Record<string, string>): { segment: string; needsCrossCompany: boolean } {
  if (typeof key === "string") {
    // Simple string key – always quoted
    return { segment: `'${encodeURIComponent(key)}'`, needsCrossCompany: false };
  }

  // Composite key
  const parts = Object.entries(key).map(([field, value]) => {
    const v = String(value);
    // Detect numeric values (Int32/Int64) – don't quote them
    if (/^-?\d+$/.test(v)) {
      return `${field}=${v}`;
    }
    // Everything else (strings, dates, guids) – quote
    return `${field}='${encodeURIComponent(v)}'`;
  });

  const hasDataAreaId = "dataAreaId" in key || "DataAreaId" in key;
  return { segment: parts.join(","), needsCrossCompany: hasDataAreaId };
}

/**
 * Checks whether a filter expression references dataAreaId,
 * which triggers cross-company mode in D365 F&O.
 */
function filterNeedsCrossCompany(filter?: string): boolean {
  if (!filter) return false;
  return /dataAreaId/i.test(filter);
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class DynamicsClient {
  private readonly http: AxiosInstance;
  private readonly config: D365Config;
  private readonly auth: DynamicsAuthProvider;
  /** Base OData data endpoint */
  readonly dataUrl: string;

  constructor(config: D365Config, auth: DynamicsAuthProvider) {
    this.config = config;
    this.auth = auth;
    this.dataUrl = `${config.baseUrl.replace(/\/$/, "")}/data/`;

    this.http = axios.create({
      baseURL: this.dataUrl,
      timeout: config.timeoutMs ?? 30_000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
    });

    // Inject Bearer token
    this.http.interceptors.request.use(async (req) => {
      const token = await this.auth.getBearerToken();
      req.headers.Authorization = `Bearer ${token}`;
      return req;
    });

    // 401 → invalidate cache and retry once
    this.http.interceptors.response.use(undefined, async (error: AxiosError) => {
      const cfg = error.config as AxiosRequestConfig & { _retry?: boolean };
      if (error.response?.status === 401 && !cfg._retry) {
        this.auth.invalidateCache();
        cfg._retry = true;
        const token = await this.auth.getBearerToken();
        if (cfg.headers) cfg.headers.Authorization = `Bearer ${token}`;
        return this.http.request(cfg);
      }
      return Promise.reject(error);
    });

    // Exponential back-off
    axiosRetry(this.http, {
      retries: config.maxRetries ?? 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        err.response?.status === 429 ||
        (err.response?.status !== undefined && err.response.status >= 500),
    });
  }

  // ─── READ ─────────────────────────────────────────────────────────────────

  /** Query an entity set and return the raw OData response. */
  async query<T = Record<string, unknown>>(
    entitySet: string,
    options: QueryOptions = {},
  ): Promise<ODataResponse<T>> {
    const url = this.buildQueryUrl(entitySet, options);
    const resp: AxiosResponse<ODataResponse<T>> = await this.http.get(url);
    return resp.data;
  }

  /** Auto-paginate through all pages up to FETCH_ALL_MAX_RECORDS. */
  async fetchAll<T = Record<string, unknown>>(
    entitySet: string,
    options: QueryOptions = {},
  ): Promise<T[]> {
    const records: T[] = [];
    const pageOptions: QueryOptions = {
      ...options,
      top: Math.min(options.top ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    };
    let url: string | undefined = this.buildQueryUrl(entitySet, pageOptions);

    while (url && records.length < FETCH_ALL_MAX_RECORDS) {
      const resp: AxiosResponse<ODataResponse<T>> = await this.http.get(url);
      const page: ODataResponse<T> = resp.data;
      records.push(...(page.value ?? []));
      url = page["@odata.nextLink"];
    }
    return records;
  }

  /**
   * Fetch a single entity by OData key.
   * Automatically appends cross-company=true for composite keys containing dataAreaId.
   */
  async getByKey<T = Record<string, unknown>>(
    entitySet: string,
    key: string | Record<string, string>,
    options: Pick<QueryOptions, "select" | "expand"> = {},
  ): Promise<T> {
    const { segment, needsCrossCompany } = encodeODataKey(key);
    const params: string[] = [];

    const select = Array.isArray(options.select) ? options.select.join(",") : options.select;
    const expand = Array.isArray(options.expand) ? options.expand.join(",") : options.expand;
    if (select) params.push(`$select=${select}`);
    if (expand) params.push(`$expand=${expand}`);
    if (needsCrossCompany) params.push("cross-company=true");

    const url = `${entitySet}(${segment})${params.length ? `?${params.join("&")}` : ""}`;
    const resp: AxiosResponse<T> = await this.http.get(url);
    return resp.data;
  }

  /** Count records matching an optional filter. */
  async count(entitySet: string, filter?: string): Promise<number> {
    let url = `${entitySet}/$count`;
    const xc = filter && filterNeedsCrossCompany(filter);
    const params: string[] = [];
    if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
    if (xc) params.push("cross-company=true");
    if (params.length) url += `?${params.join("&")}`;
    const resp: AxiosResponse<number | string> = await this.http.get(url, {
      headers: { Accept: "text/plain" },
    });
    return typeof resp.data === "string" ? parseInt(resp.data, 10) : resp.data;
  }

  /** High-level query returning a structured result (for MCP tool responses). */
  async queryEntity(entitySet: string, options: QueryOptions = {}): Promise<EntityQueryResult> {
    const resp = await this.query(entitySet, { ...options, top: options.top ?? DEFAULT_PAGE_SIZE });
    return {
      entitySet,
      count: resp["@odata.count"] ?? resp.value.length,
      data: resp.value as Record<string, unknown>[],
      nextLink: resp["@odata.nextLink"],
    };
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  /** Create a new entity record. */
  async create(args: CreateEntityArgs): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (args.returnEntity) {
      headers["Prefer"] = "return=representation";
    }
    const resp: AxiosResponse<Record<string, unknown>> = await this.http.post(
      args.entitySet,
      args.data,
      { headers },
    );
    return resp.data;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  /** Update an existing entity record (PATCH = partial, PUT = full replace). */
  async update(args: UpdateEntityArgs): Promise<void | Record<string, unknown>> {
    const { segment, needsCrossCompany } = encodeODataKey(args.key);
    let url = `${args.entitySet}(${segment})`;
    if (needsCrossCompany) url += "?cross-company=true";

    const method = args.method ?? "PATCH";
    if (method === "PATCH") {
      await this.http.patch(url, args.data);
    } else {
      await this.http.put(url, args.data);
    }
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  /** Delete an entity record by key. */
  async delete(entitySet: string, key: string | Record<string, string>): Promise<void> {
    const { segment, needsCrossCompany } = encodeODataKey(key);
    let url = `${entitySet}(${segment})`;
    if (needsCrossCompany) url += "?cross-company=true";
    await this.http.delete(url);
  }

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  /**
   * Execute an OData action or function.
   *
   * Bound action:   POST /data/{EntitySet}({key})/{D365_NAMESPACE}.{ActionName}
   * Unbound action: POST /data/{D365_NAMESPACE}.{ActionName}
   *
   * @example
   * // Confirm a sales order (bound action)
   * await client.callAction({
   *   actionName: "ConfirmOrder",
   *   entitySet: "SalesOrderHeadersV2",
   *   entityKey: { dataAreaId: "USMF", SalesOrderNumber: "SO-001" }
   * });
   *
   * @example
   * // Get application version (unbound action)
   * await client.callAction({ actionName: "GetApplicationVersion" });
   */
  async callAction(args: CallActionArgs): Promise<unknown> {
    const fullAction = args.actionName.includes(".")
      ? args.actionName
      : `${D365_NAMESPACE}.${args.actionName}`;

    let url: string;
    if (args.entitySet && args.entityKey) {
      const { segment, needsCrossCompany } = encodeODataKey(args.entityKey);
      url = `${args.entitySet}(${segment})/${fullAction}`;
      if (needsCrossCompany) url += "?cross-company=true";
    } else {
      url = fullAction;
    }

    const resp: AxiosResponse<unknown> = await this.http.post(url, args.parameters ?? {});
    return resp.data;
  }

  /**
   * Call a D365 F&O JSON Service endpoint.
   * Endpoint: {baseUrl}/api/services/{ServiceGroup}/{Service}/{Operation}
   */
  async callJsonService(args: CallJsonServiceArgs): Promise<unknown> {
    const method = args.method ?? "POST";
    const token = await this.auth.getBearerToken();
    const serviceUrl = `${this.config.baseUrl.replace(/\/$/, "")}/${args.servicePath.replace(/^\//, "")}`;

    const resp: AxiosResponse<unknown> = await axios.request({
      method,
      url: serviceUrl,
      data: args.body,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: this.config.timeoutMs ?? 30_000,
    });
    return resp.data;
  }

  // ─── METADATA ─────────────────────────────────────────────────────────────

  /** Returns the OData $metadata XML document. */
  async getMetadata(): Promise<string> {
    const resp: AxiosResponse<string> = await this.http.get("$metadata", {
      headers: { Accept: "application/xml" },
    });
    return resp.data;
  }

  /** Returns all entity set names available in the service. */
  async getEntitySets(): Promise<string[]> {
    const resp: AxiosResponse<{ value: { name: string; kind: string }[] }> =
      await this.http.get("");
    return (resp.data.value ?? [])
      .filter((e) => e.kind === "EntitySet")
      .map((e) => e.name)
      .sort();
  }

  /** Test connectivity and return latency. */
  async testConnection(): Promise<{ ok: boolean; latencyMs: number; instanceUrl: string; error?: string }> {
    const start = Date.now();
    try {
      await this.http.get("", { params: { $top: 0 } });
      return { ok: true, latencyMs: Date.now() - start, instanceUrl: this.config.baseUrl };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        instanceUrl: this.config.baseUrl,
        error: DynamicsClient.formatError(err),
      };
    }
  }

  // ─── BATCH ────────────────────────────────────────────────────────────────

  /** Execute multiple queries in a single OData $batch round-trip. */
  async batchQuery(requests: BatchQueryOptions[]): Promise<EntityQueryResult[]> {
    const boundary = `batch_${Date.now()}`;
    const parts: string[] = [];

    requests.forEach((req) => {
      const url = this.buildQueryUrl(req.entitySet, req);
      parts.push(
        `--${boundary}`,
        "Content-Type: application/http",
        "Content-Transfer-Encoding: binary",
        "",
        `GET ${url} HTTP/1.1`,
        "Accept: application/json",
        "",
        "",
      );
    });
    parts.push(`--${boundary}--`);

    const token = await this.auth.getBearerToken();
    const resp: AxiosResponse<string> = await this.http.post(
      "$batch",
      parts.join("\r\n"),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
          Accept: "multipart/mixed",
        },
        responseType: "text",
      },
    );
    return this.parseBatchResponse(resp.data, requests);
  }

  // ─── URL builder ──────────────────────────────────────────────────────────

  private buildQueryUrl(entitySet: string, options: QueryOptions): string {
    const params: string[] = [];

    const filter = options.filter;
    if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);

    const select = Array.isArray(options.select) ? options.select.join(",") : options.select;
    if (select) params.push(`$select=${select}`);

    const expand = Array.isArray(options.expand) ? options.expand.join(",") : options.expand;
    if (expand) params.push(`$expand=${expand}`);

    if (options.orderBy) params.push(`$orderby=${encodeURIComponent(options.orderBy)}`);
    if (options.search) params.push(`$search=${encodeURIComponent(options.search)}`);

    params.push(`$top=${Math.min(options.top ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)}`);
    if (options.skip && options.skip > 0) params.push(`$skip=${options.skip}`);
    params.push("$count=true");

    // Auto cross-company: explicit flag OR dataAreaId filter/param
    const needsXC =
      options.crossCompany ||
      !!options.dataAreaId ||
      filterNeedsCrossCompany(filter);

    if (needsXC) params.push("cross-company=true");

    return `${entitySet}?${params.join("&")}`;
  }

  private parseBatchResponse(raw: string, requests: BatchQueryOptions[]): EntityQueryResult[] {
    const results: EntityQueryResult[] = [];
    requests.forEach((req, i) => {
      // Find the i-th JSON block in the batch response
      const jsonBlocks = [...raw.matchAll(/\{[\s\S]*?\}/g)];
      const block = jsonBlocks[i];
      if (block) {
        try {
          const parsed = JSON.parse(block[0]) as ODataResponse<Record<string, unknown>>;
          results.push({
            entitySet: req.entitySet,
            count: parsed["@odata.count"] ?? parsed.value?.length ?? 0,
            data: parsed.value ?? [],
            nextLink: parsed["@odata.nextLink"],
          });
          return;
        } catch { /* fallthrough */ }
      }
      results.push({ entitySet: req.entitySet, count: 0, data: [] });
    });
    return results;
  }

  // ─── Error formatting ─────────────────────────────────────────────────────

  static formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const e = error as AxiosError<{ error?: { message?: string; code?: string } }>;
      const msg = e.response?.data?.error?.message;
      const code = e.response?.data?.error?.code;
      if (msg) return `D365 OData Error${code ? ` [${code}]` : ""}: ${msg}`;
      return `HTTP ${e.response?.status ?? "?"}: ${e.message}`;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
