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
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".mcp-d365fo-cache");
const DB_FILENAME = "metadata.sqlite";
export class MetadataCache {
    db;
    constructor(cacheDir) {
        const dir = cacheDir ?? DEFAULT_CACHE_DIR;
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        this.db = new Database(path.join(dir, DB_FILENAME));
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.initSchema();
    }
    // ─── Schema init ────────────────────────────────────────────────────────────
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        name        TEXT PRIMARY KEY,
        label       TEXT,
        category    TEXT,
        is_read_only INTEGER DEFAULT 0,
        updated_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts
        USING fts5(name, label, category, content='entities', content_rowid='rowid');

      CREATE TABLE IF NOT EXISTS entity_schema (
        entity_set  TEXT PRIMARY KEY,
        schema_json TEXT NOT NULL,
        updated_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS actions (
        name            TEXT NOT NULL,
        is_bound        INTEGER DEFAULT 0,
        bound_entity    TEXT,
        parameters_json TEXT,
        return_type     TEXT,
        PRIMARY KEY (name, bound_entity)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS actions_fts
        USING fts5(name, bound_entity, content='actions');

      CREATE TABLE IF NOT EXISTS labels (
        label_id    TEXT NOT NULL,
        language    TEXT NOT NULL DEFAULT 'en-US',
        label_text  TEXT,
        updated_at  TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (label_id, language)
      );
    `);
    }
    // ─── Entity list ─────────────────────────────────────────────────────────────
    /** Seed the entity list from the OData service document. */
    seedEntityList(entityNames) {
        const insert = this.db.prepare("INSERT OR IGNORE INTO entities (name) VALUES (?)");
        const insertAll = this.db.transaction((names) => {
            for (const n of names)
                insert.run(n);
        });
        insertAll(entityNames);
        // Rebuild FTS
        this.db.exec("INSERT INTO entities_fts(entities_fts) VALUES('rebuild')");
    }
    /** Search entities using FTS5. */
    searchEntities(pattern, category, top = 50) {
        if (!pattern && !category) {
            const rows = this.db
                .prepare("SELECT name, label, category, is_read_only FROM entities LIMIT ?")
                .all(top);
            return rows.map((r) => ({ name: r.name, label: r.label, category: r.category, isReadOnly: !!r.is_read_only }));
        }
        if (pattern) {
            // FTS5 search
            try {
                const ftsRows = this.db
                    .prepare("SELECT e.name, e.label, e.category, e.is_read_only FROM entities_fts fts JOIN entities e ON e.rowid = fts.rowid WHERE entities_fts MATCH ? LIMIT ?")
                    .all(`${pattern}*`, top);
                let results = ftsRows.map((r) => ({ name: r.name, label: r.label, category: r.category, isReadOnly: !!r.is_read_only }));
                if (category)
                    results = results.filter((r) => r.category?.toLowerCase() === category.toLowerCase());
                return results;
            }
            catch {
                // FTS not populated yet – fall back to LIKE
                const rows = this.db
                    .prepare("SELECT name, label, category, is_read_only FROM entities WHERE name LIKE ? LIMIT ?")
                    .all(`%${pattern}%`, top);
                return rows.map((r) => ({ name: r.name, label: r.label, category: r.category, isReadOnly: !!r.is_read_only }));
            }
        }
        const rows = this.db
            .prepare("SELECT name, label, category, is_read_only FROM entities WHERE category = ? LIMIT ?")
            .all(category, top);
        return rows.map((r) => ({ name: r.name, label: r.label, category: r.category, isReadOnly: !!r.is_read_only }));
    }
    // ─── Entity schema ───────────────────────────────────────────────────────────
    getEntitySchema(entitySet) {
        const row = this.db
            .prepare("SELECT schema_json FROM entity_schema WHERE entity_set = ?")
            .get(entitySet);
        if (!row)
            return null;
        try {
            return JSON.parse(row.schema_json);
        }
        catch {
            return null;
        }
    }
    saveEntitySchema(entitySet, schema) {
        this.db
            .prepare("INSERT OR REPLACE INTO entity_schema (entity_set, schema_json) VALUES (?, ?)")
            .run(entitySet, JSON.stringify(schema));
    }
    // ─── Actions ─────────────────────────────────────────────────────────────────
    searchActions(pattern, boundEntitySet, top = 50) {
        let rows;
        if (pattern) {
            rows = this.db
                .prepare("SELECT name, is_bound, bound_entity, parameters_json, return_type FROM actions WHERE name LIKE ? LIMIT ?")
                .all(`%${pattern}%`, top);
        }
        else if (boundEntitySet) {
            rows = this.db
                .prepare("SELECT name, is_bound, bound_entity, parameters_json, return_type FROM actions WHERE bound_entity = ? LIMIT ?")
                .all(boundEntitySet, top);
        }
        else {
            rows = this.db
                .prepare("SELECT name, is_bound, bound_entity, parameters_json, return_type FROM actions LIMIT ?")
                .all(top);
        }
        return rows.map((r) => ({
            name: r.name,
            isBound: !!r.is_bound,
            boundEntitySet: r.bound_entity || undefined,
            parameters: r.parameters_json || undefined,
            returnType: r.return_type || undefined,
        }));
    }
    saveAction(action) {
        this.db
            .prepare("INSERT OR REPLACE INTO actions (name, is_bound, bound_entity, parameters_json, return_type) VALUES (?, ?, ?, ?, ?)")
            .run(action.name, action.isBound ? 1 : 0, action.boundEntitySet ?? null, action.parameters ?? null, action.returnType ?? null);
    }
    // ─── Labels ──────────────────────────────────────────────────────────────────
    getLabel(labelId, language = "en-US") {
        const row = this.db
            .prepare("SELECT label_text FROM labels WHERE label_id = ? AND language = ?")
            .get(labelId, language);
        return row?.label_text ?? null;
    }
    saveLabel(labelId, text, language = "en-US") {
        this.db
            .prepare("INSERT OR REPLACE INTO labels (label_id, language, label_text) VALUES (?, ?, ?)")
            .run(labelId, language, text);
    }
    // ─── Stats ───────────────────────────────────────────────────────────────────
    getStats() {
        const entityCount = this.db.prepare("SELECT COUNT(*) as c FROM entities").get().c;
        const schemaCount = this.db.prepare("SELECT COUNT(*) as c FROM entity_schema").get().c;
        const actionCount = this.db.prepare("SELECT COUNT(*) as c FROM actions").get().c;
        const labelCount = this.db.prepare("SELECT COUNT(*) as c FROM labels").get().c;
        return { entityCount, schemaCount, actionCount, labelCount };
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=metadata-cache.js.map