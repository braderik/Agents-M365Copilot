/**
 * SQLite-backed metadata cache for Dynamics 365 F&O entity schemas, actions, and labels.
 *
 * Uses better-sqlite3 (synchronous SQLite) with FTS5 full-text search for fast entity discovery.
 *
 * Schema:
 *   entities      – entity set names, categories, labels
 *   entity_schema – full JSON schema per entity (keys, properties, navigations, actions)
 *   actions       – OData action definitions
 *   labels        – label ID → text (per language)
 */
export interface CachedEntity {
    name: string;
    label?: string;
    category?: string;
    isReadOnly?: boolean;
}
export interface CachedAction {
    name: string;
    isBound: boolean;
    boundEntitySet?: string;
    parameters?: string;
    returnType?: string;
}
export declare class MetadataCache {
    private readonly db;
    constructor(cacheDir?: string);
    private initSchema;
    /** Seed the entity list from the OData service document. */
    seedEntityList(entityNames: string[]): void;
    /** Search entities using FTS5. */
    searchEntities(pattern: string, category?: string, top?: number): CachedEntity[];
    getEntitySchema(entitySet: string): Record<string, unknown> | null;
    saveEntitySchema(entitySet: string, schema: Record<string, unknown>): void;
    searchActions(pattern: string, boundEntitySet?: string, top?: number): CachedAction[];
    saveAction(action: CachedAction): void;
    getLabel(labelId: string, language?: string): string | null;
    saveLabel(labelId: string, text: string, language?: string): void;
    getStats(): Record<string, number>;
    close(): void;
}
//# sourceMappingURL=metadata-cache.d.ts.map