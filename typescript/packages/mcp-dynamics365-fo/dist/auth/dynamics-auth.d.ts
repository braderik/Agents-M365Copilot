/**
 * Azure AD authentication for Dynamics 365 Finance & Operations
 *
 * Supports:
 *  - Client credentials (service-to-service, recommended for MCP servers)
 *  - Managed Identity (when running in Azure)
 *  - Device code flow (interactive dev/testing)
 *  - Certificate-based authentication
 */
import type { D365Config } from "../types/dynamics-types.js";
export type AuthMode = "clientSecret" | "managedIdentity" | "deviceCode" | "certificate";
export interface CertAuthOptions {
    certificatePath: string;
    certificatePassword?: string;
}
export interface AuthOptions {
    mode?: AuthMode;
    certOptions?: CertAuthOptions;
}
/**
 * Manages OAuth 2.0 token acquisition and caching for D365 F&O.
 */
export declare class DynamicsAuthProvider {
    private readonly credential;
    private readonly scopes;
    private cachedToken;
    constructor(config: D365Config, options?: AuthOptions);
    /**
     * Returns a valid Bearer token, using the in-memory cache when possible.
     */
    getBearerToken(): Promise<string>;
    /** Force-clears the cached token (useful after 401 responses). */
    invalidateCache(): void;
}
/**
 * Factory: builds a DynamicsAuthProvider from environment variables.
 *
 * Required env vars:
 *   D365_TENANT_ID, D365_CLIENT_ID, D365_CLIENT_SECRET, D365_BASE_URL
 *
 * Optional:
 *   D365_AUTH_MODE  (clientSecret | managedIdentity | deviceCode | certificate)
 *   D365_CERT_PATH, D365_CERT_PASSWORD
 */
export declare function createAuthProviderFromEnv(): {
    provider: DynamicsAuthProvider;
    config: D365Config;
};
//# sourceMappingURL=dynamics-auth.d.ts.map