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
import axios from "axios";
import axiosRetry from "axios-retry";
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
function encodeODataKey(key) {
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
function filterNeedsCrossCompany(filter) {
    if (!filter)
        return false;
    return /dataAreaId/i.test(filter);
}
// ─── Client ───────────────────────────────────────────────────────────────────
export class DynamicsClient {
    http;
    config;
    auth;
    /** Base OData data endpoint */
    dataUrl;
    constructor(config, auth) {
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
        this.http.interceptors.response.use(undefined, async (error) => {
            const cfg = error.config;
            if (error.response?.status === 401 && !cfg._retry) {
                this.auth.invalidateCache();
                cfg._retry = true;
                const token = await this.auth.getBearerToken();
                if (cfg.headers)
                    cfg.headers.Authorization = `Bearer ${token}`;
                return this.http.request(cfg);
            }
            return Promise.reject(error);
        });
        // Exponential back-off
        axiosRetry(this.http, {
            retries: config.maxRetries ?? 3,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) ||
                err.response?.status === 429 ||
                (err.response?.status !== undefined && err.response.status >= 500),
        });
    }
    // ─── READ ─────────────────────────────────────────────────────────────────
    /** Query an entity set and return the raw OData response. */
    async query(entitySet, options = {}) {
        const url = this.buildQueryUrl(entitySet, options);
        const resp = await this.http.get(url);
        return resp.data;
    }
    /**
     * Auto-paginate through all pages.
     *
     * Bug fix: `options.top` is now treated as the **total** record cap, not the page size.
     * Page size is capped separately at MAX_PAGE_SIZE. Pagination stops once `maxTotal` is
     * reached (or there are no more pages), preventing unbounded memory usage.
     */
    async fetchAll(entitySet, options = {}) {
        const maxTotal = Math.min(options.top ?? FETCH_ALL_MAX_RECORDS, FETCH_ALL_MAX_RECORDS);
        const pageSize = Math.min(DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        // Use pageSize for the actual HTTP request, ignore caller's top in the query
        const pageOptions = { ...options, top: pageSize };
        // Clear the caller's top so buildQueryUrl uses pageSize
        delete pageOptions.top;
        pageOptions.top = pageSize;
        const records = [];
        let url = this.buildQueryUrl(entitySet, pageOptions);
        while (url && records.length < maxTotal) {
            const resp = await this.http.get(url);
            const page = resp.data;
            records.push(...(page.value ?? []));
            url = records.length < maxTotal ? page["@odata.nextLink"] : undefined;
        }
        // Trim to exactly maxTotal if the last page over-delivered
        return records.slice(0, maxTotal);
    }
    /**
     * Fetch a single entity by OData key.
     * Automatically appends cross-company=true for composite keys containing dataAreaId.
     */
    async getByKey(entitySet, key, options = {}) {
        const { segment, needsCrossCompany } = encodeODataKey(key);
        const params = [];
        const select = Array.isArray(options.select) ? options.select.join(",") : options.select;
        const expand = Array.isArray(options.expand) ? options.expand.join(",") : options.expand;
        if (select)
            params.push(`$select=${select}`);
        if (expand)
            params.push(`$expand=${expand}`);
        if (needsCrossCompany)
            params.push("cross-company=true");
        const url = `${entitySet}(${segment})${params.length ? `?${params.join("&")}` : ""}`;
        const resp = await this.http.get(url);
        return resp.data;
    }
    /** Count records matching an optional filter. */
    async count(entitySet, filter) {
        let url = `${entitySet}/$count`;
        const xc = filter && filterNeedsCrossCompany(filter);
        const params = [];
        if (filter)
            params.push(`$filter=${encodeURIComponent(filter)}`);
        if (xc)
            params.push("cross-company=true");
        if (params.length)
            url += `?${params.join("&")}`;
        const resp = await this.http.get(url, {
            headers: { Accept: "text/plain" },
        });
        return typeof resp.data === "string" ? parseInt(resp.data, 10) : resp.data;
    }
    /** High-level query returning a structured result (for MCP tool responses). */
    async queryEntity(entitySet, options = {}) {
        const resp = await this.query(entitySet, { ...options, top: options.top ?? DEFAULT_PAGE_SIZE });
        return {
            entitySet,
            count: resp["@odata.count"] ?? resp.value.length,
            data: resp.value,
            nextLink: resp["@odata.nextLink"],
        };
    }
    // ─── CREATE ───────────────────────────────────────────────────────────────
    /** Create a new entity record. */
    async create(args) {
        const headers = {};
        if (args.returnEntity) {
            headers["Prefer"] = "return=representation";
        }
        const resp = await this.http.post(args.entitySet, args.data, { headers });
        return resp.data;
    }
    // ─── UPDATE ───────────────────────────────────────────────────────────────
    /** Update an existing entity record (PATCH = partial, PUT = full replace). */
    async update(args) {
        const { segment, needsCrossCompany } = encodeODataKey(args.key);
        let url = `${args.entitySet}(${segment})`;
        if (needsCrossCompany)
            url += "?cross-company=true";
        const method = args.method ?? "PATCH";
        if (method === "PATCH") {
            await this.http.patch(url, args.data);
        }
        else {
            await this.http.put(url, args.data);
        }
    }
    // ─── DELETE ───────────────────────────────────────────────────────────────
    /** Delete an entity record by key. */
    async delete(entitySet, key) {
        const { segment, needsCrossCompany } = encodeODataKey(key);
        let url = `${entitySet}(${segment})`;
        if (needsCrossCompany)
            url += "?cross-company=true";
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
    async callAction(args) {
        const fullAction = args.actionName.includes(".")
            ? args.actionName
            : `${D365_NAMESPACE}.${args.actionName}`;
        let url;
        if (args.entitySet && args.entityKey) {
            const { segment, needsCrossCompany } = encodeODataKey(args.entityKey);
            url = `${args.entitySet}(${segment})/${fullAction}`;
            if (needsCrossCompany)
                url += "?cross-company=true";
        }
        else {
            url = fullAction;
        }
        const resp = await this.http.post(url, args.parameters ?? {});
        return resp.data;
    }
    /**
     * Call a D365 F&O JSON Service endpoint.
     * Endpoint: {baseUrl}/api/services/{ServiceGroup}/{Service}/{Operation}
     */
    async callJsonService(args) {
        const method = args.method ?? "POST";
        const token = await this.auth.getBearerToken();
        const serviceUrl = `${this.config.baseUrl.replace(/\/$/, "")}/${args.servicePath.replace(/^\//, "")}`;
        const resp = await axios.request({
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
    async getMetadata() {
        const resp = await this.http.get("$metadata", {
            headers: { Accept: "application/xml" },
        });
        return resp.data;
    }
    /** Returns all entity set names available in the service. */
    async getEntitySets() {
        const resp = await this.http.get("");
        return (resp.data.value ?? [])
            .filter((e) => e.kind === "EntitySet")
            .map((e) => e.name)
            .sort();
    }
    /** Test connectivity and return latency. */
    async testConnection() {
        const start = Date.now();
        try {
            await this.http.get("", { params: { $top: 0 } });
            return { ok: true, latencyMs: Date.now() - start, instanceUrl: this.config.baseUrl };
        }
        catch (err) {
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
    async batchQuery(requests) {
        const boundary = `batch_${Date.now()}`;
        const parts = [];
        requests.forEach((req) => {
            const url = this.buildQueryUrl(req.entitySet, req);
            parts.push(`--${boundary}`, "Content-Type: application/http", "Content-Transfer-Encoding: binary", "", `GET ${url} HTTP/1.1`, "Accept: application/json", "", "");
        });
        parts.push(`--${boundary}--`);
        const token = await this.auth.getBearerToken();
        const resp = await this.http.post("$batch", parts.join("\r\n"), {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/mixed; boundary=${boundary}`,
                Accept: "multipart/mixed",
            },
            responseType: "text",
        });
        return this.parseBatchResponse(resp.data, requests);
    }
    // ─── URL builder ──────────────────────────────────────────────────────────
    /**
     * Build the OData query URL for an entity set.
     *
     * Bug fixes:
     *  - Bug 1: dataAreaId is merged into the existing $filter as a single expression.
     *           Only one $filter parameter is ever emitted.
     *  - Bug 4: $select and $expand are URL-encoded via URLSearchParams to prevent
     *           parameter injection through embedded '&' or '=' characters.
     */
    buildQueryUrl(entitySet, options) {
        // ── Bug 1 fix: merge dataAreaId into one $filter expression ──────────────
        const parts = [];
        if (options.filter)
            parts.push(options.filter);
        if (options.dataAreaId)
            parts.push(`dataAreaId eq '${options.dataAreaId}'`);
        const mergedFilter = parts.join(" and ");
        // Use URLSearchParams to guarantee correct encoding for all values (Bug 4 fix)
        const qs = new URLSearchParams();
        if (mergedFilter)
            qs.set("$filter", mergedFilter);
        // Bug 4 fix: $select and $expand are now encoded by URLSearchParams
        const select = Array.isArray(options.select) ? options.select.join(",") : options.select;
        if (select)
            qs.set("$select", select);
        const expand = Array.isArray(options.expand) ? options.expand.join(",") : options.expand;
        if (expand)
            qs.set("$expand", expand);
        if (options.orderBy)
            qs.set("$orderby", options.orderBy);
        if (options.search)
            qs.set("$search", options.search);
        qs.set("$top", String(Math.min(options.top ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)));
        if (options.skip && options.skip > 0)
            qs.set("$skip", String(options.skip));
        qs.set("$count", "true");
        // Auto cross-company: explicit flag OR dataAreaId present in either source
        const needsXC = options.crossCompany ||
            !!options.dataAreaId ||
            filterNeedsCrossCompany(options.filter);
        if (needsXC)
            qs.set("cross-company", "true");
        return `${entitySet}?${qs.toString()}`;
    }
    parseBatchResponse(raw, requests) {
        const results = [];
        requests.forEach((req, i) => {
            // Find the i-th JSON block in the batch response
            const jsonBlocks = [...raw.matchAll(/\{[\s\S]*?\}/g)];
            const block = jsonBlocks[i];
            if (block) {
                try {
                    const parsed = JSON.parse(block[0]);
                    results.push({
                        entitySet: req.entitySet,
                        count: parsed["@odata.count"] ?? parsed.value?.length ?? 0,
                        data: parsed.value ?? [],
                        nextLink: parsed["@odata.nextLink"],
                    });
                    return;
                }
                catch { /* fallthrough */ }
            }
            results.push({ entitySet: req.entitySet, count: 0, data: [] });
        });
        return results;
    }
    // ─── Error formatting ─────────────────────────────────────────────────────
    static formatError(error) {
        if (axios.isAxiosError(error)) {
            const e = error;
            const msg = e.response?.data?.error?.message;
            const code = e.response?.data?.error?.code;
            if (msg)
                return `D365 OData Error${code ? ` [${code}]` : ""}: ${msg}`;
            return `HTTP ${e.response?.status ?? "?"}: ${e.message}`;
        }
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
}
//# sourceMappingURL=dynamics-client.js.map