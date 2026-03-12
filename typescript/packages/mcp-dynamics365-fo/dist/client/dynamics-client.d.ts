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
import type { D365Config, ODataResponse, QueryOptions, EntityQueryResult, BatchQueryOptions, CreateEntityArgs, UpdateEntityArgs, CallActionArgs, CallJsonServiceArgs } from "../types/dynamics-types.js";
import type { DynamicsAuthProvider } from "../auth/dynamics-auth.js";
export declare class DynamicsClient {
    private readonly http;
    private readonly config;
    private readonly auth;
    /** Base OData data endpoint */
    readonly dataUrl: string;
    constructor(config: D365Config, auth: DynamicsAuthProvider);
    /** Query an entity set and return the raw OData response. */
    query<T = Record<string, unknown>>(entitySet: string, options?: QueryOptions): Promise<ODataResponse<T>>;
    /** Auto-paginate through all pages up to FETCH_ALL_MAX_RECORDS. */
    fetchAll<T = Record<string, unknown>>(entitySet: string, options?: QueryOptions): Promise<T[]>;
    /**
     * Fetch a single entity by OData key.
     * Automatically appends cross-company=true for composite keys containing dataAreaId.
     */
    getByKey<T = Record<string, unknown>>(entitySet: string, key: string | Record<string, string>, options?: Pick<QueryOptions, "select" | "expand">): Promise<T>;
    /** Count records matching an optional filter. */
    count(entitySet: string, filter?: string): Promise<number>;
    /** High-level query returning a structured result (for MCP tool responses). */
    queryEntity(entitySet: string, options?: QueryOptions): Promise<EntityQueryResult>;
    /** Create a new entity record. */
    create(args: CreateEntityArgs): Promise<Record<string, unknown>>;
    /** Update an existing entity record (PATCH = partial, PUT = full replace). */
    update(args: UpdateEntityArgs): Promise<void | Record<string, unknown>>;
    /** Delete an entity record by key. */
    delete(entitySet: string, key: string | Record<string, string>): Promise<void>;
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
    callAction(args: CallActionArgs): Promise<unknown>;
    /**
     * Call a D365 F&O JSON Service endpoint.
     * Endpoint: {baseUrl}/api/services/{ServiceGroup}/{Service}/{Operation}
     */
    callJsonService(args: CallJsonServiceArgs): Promise<unknown>;
    /** Returns the OData $metadata XML document. */
    getMetadata(): Promise<string>;
    /** Returns all entity set names available in the service. */
    getEntitySets(): Promise<string[]>;
    /** Test connectivity and return latency. */
    testConnection(): Promise<{
        ok: boolean;
        latencyMs: number;
        instanceUrl: string;
        error?: string;
    }>;
    /** Execute multiple queries in a single OData $batch round-trip. */
    batchQuery(requests: BatchQueryOptions[]): Promise<EntityQueryResult[]>;
    private buildQueryUrl;
    private parseBatchResponse;
    static formatError(error: unknown): string;
}
//# sourceMappingURL=dynamics-client.d.ts.map