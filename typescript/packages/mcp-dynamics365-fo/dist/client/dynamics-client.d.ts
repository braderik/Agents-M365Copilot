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
import type { D365Config, ODataResponse, QueryOptions, EntityQueryResult, BatchQueryOptions } from "../types/dynamics-types.js";
import type { DynamicsAuthProvider } from "../auth/dynamics-auth.js";
export declare class DynamicsClient {
    private readonly http;
    private readonly config;
    private readonly auth;
    constructor(config: D365Config, auth: DynamicsAuthProvider);
    /**
     * Queries an OData entity set with full query option support.
     * Returns up to `options.top` records (default DEFAULT_PAGE_SIZE).
     */
    query<T = Record<string, unknown>>(entitySet: string, options?: QueryOptions): Promise<ODataResponse<T>>;
    /**
     * Fetches ALL pages for a query, up to FETCH_ALL_MAX_RECORDS.
     * Uses server-driven paging (@odata.nextLink).
     */
    fetchAll<T = Record<string, unknown>>(entitySet: string, options?: QueryOptions): Promise<T[]>;
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
    getByKey<T = Record<string, unknown>>(entitySet: string, key: string | Record<string, string>, options?: Pick<QueryOptions, "select" | "expand">): Promise<T>;
    /**
     * Counts records matching a filter without fetching them.
     */
    count(entitySet: string, filter?: string): Promise<number>;
    /**
     * Generic entity query returning a structured result (for MCP tool responses).
     */
    queryEntity(entitySet: string, options?: QueryOptions): Promise<EntityQueryResult>;
    /**
     * Returns the OData $metadata document (XML) for entity discovery.
     */
    getMetadata(): Promise<string>;
    /**
     * Returns a list of entity set names available in the service.
     */
    getEntitySets(): Promise<string[]>;
    /**
     * Executes multiple queries in a single HTTP round-trip using OData $batch.
     * Returns an array of EntityQueryResult, one per request.
     */
    batchQuery(requests: BatchQueryOptions[]): Promise<EntityQueryResult[]>;
    private buildUrl;
    private parseBatchResponse;
    /**
     * Formats an OData error into a human-readable string for MCP tool responses.
     */
    static formatError(error: unknown): string;
}
//# sourceMappingURL=dynamics-client.d.ts.map