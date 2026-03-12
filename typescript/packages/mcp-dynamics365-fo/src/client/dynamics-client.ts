/**
 * Dynamics 365 Finance & Operations OData v4 client
 *
 * Features:
 *  - Automatic Bearer token injection
 *  - Full OData query builder ($filter, $select, $expand, $orderby, $top, $skip, $count)
 *  - Automatic pagination (fetchAll)
 *  - Batch requests (OData $batch)
 *  - Retry with exponential back-off on 429 / 5xx
 *  - Cross-company queries
 *  - Entity metadata discovery
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import type {
  D365Config,
  ODataResponse,
  QueryOptions,
  EntityQueryResult,
  BatchQueryOptions,
} from "../types/dynamics-types.js";
import type { DynamicsAuthProvider } from "../auth/dynamics-auth.js";

/** Maximum records a single OData page may return from F&O */
const MAX_PAGE_SIZE = 10_000;
/** Default page size when $top is not specified */
const DEFAULT_PAGE_SIZE = 1_000;
/** Absolute safety cap for fetchAll to prevent runaway queries */
const FETCH_ALL_MAX_RECORDS = 100_000;

export class DynamicsClient {
  private readonly http: AxiosInstance;
  private readonly config: D365Config;
  private readonly auth: DynamicsAuthProvider;

  constructor(config: D365Config, auth: DynamicsAuthProvider) {
    this.config = config;
    this.auth = auth;

    const baseURL = `${config.baseUrl.replace(/\/$/, "")}/data/`;

    this.http = axios.create({
      baseURL,
      timeout: config.timeoutMs ?? 30_000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
    });

    // Attach token before each request
    this.http.interceptors.request.use(async (req) => {
      const token = await this.auth.getBearerToken();
      req.headers.Authorization = `Bearer ${token}`;
      return req;
    });

    // On 401, invalidate token cache and retry once
    this.http.interceptors.response.use(undefined, async (error: AxiosError) => {
      if (error.response?.status === 401 && !(error.config as AxiosRequestConfig & { _retry?: boolean })._retry) {
        this.auth.invalidateCache();
        const retryConfig = error.config as AxiosRequestConfig & { _retry?: boolean };
        retryConfig._retry = true;
        const token = await this.auth.getBearerToken();
        if (retryConfig.headers) {
          retryConfig.headers.Authorization = `Bearer ${token}`;
        }
        return this.http.request(retryConfig);
      }
      return Promise.reject(error);
    });

    // Exponential back-off retry on transient errors & rate limits
    axiosRetry(this.http, {
      retries: config.maxRetries ?? 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429 ||
        (error.response?.status !== undefined && error.response.status >= 500),
    });
  }

  // ─── Core query ─────────────────────────────────────────────────────────────

  /**
   * Queries an OData entity set with full query option support.
   * Returns up to `options.top` records (default DEFAULT_PAGE_SIZE).
   */
  async query<T = Record<string, unknown>>(
    entitySet: string,
    options: QueryOptions = {},
  ): Promise<ODataResponse<T>> {
    const url = this.buildUrl(entitySet, options);
    const { data } = await this.http.get<ODataResponse<T>>(url);
    return data;
  }

  /**
   * Fetches ALL pages for a query, up to FETCH_ALL_MAX_RECORDS.
   * Uses server-driven paging (@odata.nextLink).
   */
  async fetchAll<T = Record<string, unknown>>(
    entitySet: string,
    options: QueryOptions = {},
  ): Promise<T[]> {
    const records: T[] = [];
    const pageOptions: QueryOptions = {
      ...options,
      top: Math.min(options.top ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    };

    let url: string | undefined = this.buildUrl(entitySet, pageOptions);

    while (url && records.length < FETCH_ALL_MAX_RECORDS) {
      // eslint-disable-next-line no-await-in-loop
      const axiosResp: import("axios").AxiosResponse<ODataResponse<T>> = await this.http.get(url);
      const page: ODataResponse<T> = axiosResp.data;
      records.push(...(page.value ?? []));
      url = page["@odata.nextLink"];
    }

    return records;
  }

  /**
   * Fetches a single entity by its OData key (string or composite object).
   *
   * @example
   * // Simple key
   * await client.getByKey("Customers", "USMF-000001")
   *
   * @example
   * // Composite key
   * await client.getByKey("SalesOrderLines", { SalesOrderNumber: "SO001", LineNumber: "1" })
   */
  async getByKey<T = Record<string, unknown>>(
    entitySet: string,
    key: string | Record<string, string>,
    options: Pick<QueryOptions, "select" | "expand"> = {},
  ): Promise<T> {
    const keySegment =
      typeof key === "string"
        ? `'${encodeURIComponent(key)}'`
        : Object.entries(key)
            .map(([k, v]) => `${k}='${encodeURIComponent(v)}'`)
            .join(",");

    let url = `${entitySet}(${keySegment})`;
    const params: string[] = [];

    if (options.select) {
      const s = Array.isArray(options.select) ? options.select.join(",") : options.select;
      params.push(`$select=${s}`);
    }
    if (options.expand) {
      const e = Array.isArray(options.expand) ? options.expand.join(",") : options.expand;
      params.push(`$expand=${e}`);
    }
    if (params.length) url += `?${params.join("&")}`;

    const { data } = await this.http.get<T>(url);
    return data;
  }

  /**
   * Counts records matching a filter without fetching them.
   */
  async count(entitySet: string, filter?: string): Promise<number> {
    let url = `${entitySet}/$count`;
    if (filter) url += `?$filter=${encodeURIComponent(filter)}`;
    const { data } = await this.http.get<number>(url, {
      headers: { Accept: "text/plain" },
    });
    return typeof data === "string" ? parseInt(data, 10) : data;
  }

  /**
   * Generic entity query returning a structured result (for MCP tool responses).
   */
  async queryEntity(
    entitySet: string,
    options: QueryOptions = {},
  ): Promise<EntityQueryResult> {
    const response = await this.query(entitySet, { ...options, top: options.top ?? DEFAULT_PAGE_SIZE });
    return {
      entitySet,
      count: response["@odata.count"] ?? response.value.length,
      data: response.value as Record<string, unknown>[],
      nextLink: response["@odata.nextLink"],
    };
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────

  /**
   * Returns the OData $metadata document (XML) for entity discovery.
   */
  async getMetadata(): Promise<string> {
    const { data } = await this.http.get<string>("$metadata", {
      headers: { Accept: "application/xml" },
    });
    return data;
  }

  /**
   * Returns a list of entity set names available in the service.
   */
  async getEntitySets(): Promise<string[]> {
    const { data } = await this.http.get<{ value: { name: string; kind: string; url: string }[] }>("");
    return (data.value ?? []).filter((e) => e.kind === "EntitySet").map((e) => e.name);
  }

  // ─── OData $batch ────────────────────────────────────────────────────────────

  /**
   * Executes multiple queries in a single HTTP round-trip using OData $batch.
   * Returns an array of EntityQueryResult, one per request.
   */
  async batchQuery(requests: BatchQueryOptions[]): Promise<EntityQueryResult[]> {
    const batchBoundary = `batch_${Date.now()}`;
    const parts: string[] = [];

    requests.forEach((req, i) => {
      const url = this.buildUrl(req.entitySet, req);
      parts.push(
        `--${batchBoundary}`,
        "Content-Type: application/http",
        "Content-Transfer-Encoding: binary",
        "",
        `GET ${url} HTTP/1.1`,
        "Accept: application/json",
        "",
        "",
      );
      void i; // silence unused
    });
    parts.push(`--${batchBoundary}--`);

    const body = parts.join("\r\n");
    const token = await this.auth.getBearerToken();

    const { data: rawBatch } = await this.http.post<string>("$batch", body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/mixed; boundary=${batchBoundary}`,
        Accept: "multipart/mixed",
      },
      responseType: "text",
    });

    // Parse batch response parts
    return this.parseBatchResponse(rawBatch, requests);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private buildUrl(entitySet: string, options: QueryOptions): string {
    const params: string[] = [];

    if (options.filter) params.push(`$filter=${encodeURIComponent(options.filter)}`);

    const select = Array.isArray(options.select)
      ? options.select.join(",")
      : options.select;
    if (select) params.push(`$select=${select}`);

    const expand = Array.isArray(options.expand)
      ? options.expand.join(",")
      : options.expand;
    if (expand) params.push(`$expand=${expand}`);

    if (options.orderBy) params.push(`$orderby=${encodeURIComponent(options.orderBy)}`);

    const top = Math.min(options.top ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    params.push(`$top=${top}`);

    if (options.skip && options.skip > 0) params.push(`$skip=${options.skip}`);

    // Always request inline count
    params.push("$count=true");

    if (options.crossCompany) params.push("cross-company=true");
    if (options.dataAreaId) params.push(`$filter=DataAreaId eq '${options.dataAreaId}'`);

    return `${entitySet}?${params.join("&")}`;
  }

  private parseBatchResponse(
    raw: string,
    requests: BatchQueryOptions[],
  ): EntityQueryResult[] {
    const results: EntityQueryResult[] = [];
    // Split by HTTP/1.1 response blocks
    const responseParts = raw.split(/--batchresponse_[^-\r\n]+/);

    requests.forEach((req, i) => {
      const part = responseParts[i + 1] ?? "";
      // Find JSON body in the part
      const jsonStart = part.indexOf("{");
      const jsonEnd = part.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const parsed = JSON.parse(part.slice(jsonStart, jsonEnd + 1)) as ODataResponse<Record<string, unknown>>;
          results.push({
            entitySet: req.entitySet,
            count: parsed["@odata.count"] ?? parsed.value?.length ?? 0,
            data: parsed.value ?? [],
            nextLink: parsed["@odata.nextLink"],
          });
          return;
        } catch {
          // fallthrough to empty result
        }
      }

      results.push({ entitySet: req.entitySet, count: 0, data: [] });
    });

    return results;
  }

  /**
   * Formats an OData error into a human-readable string for MCP tool responses.
   */
  static formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const e = error as AxiosError<{ error?: { message?: string; code?: string } }>;
      const d365Msg = e.response?.data?.error?.message;
      const d365Code = e.response?.data?.error?.code;
      if (d365Msg) return `D365 Error ${d365Code ?? ""}: ${d365Msg}`;
      return `HTTP ${e.response?.status ?? "?"}: ${e.message}`;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
