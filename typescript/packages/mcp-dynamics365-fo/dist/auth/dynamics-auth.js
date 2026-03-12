/**
 * Azure AD authentication for Dynamics 365 Finance & Operations
 *
 * Supports:
 *  - Client credentials (service-to-service, recommended for MCP servers)
 *  - Managed Identity (when running in Azure)
 *  - Device code flow (interactive dev/testing)
 *  - Certificate-based authentication
 */
import { ClientSecretCredential, ManagedIdentityCredential, DeviceCodeCredential, ClientCertificateCredential, ChainedTokenCredential, } from "@azure/identity";
const TOKEN_CACHE_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
/**
 * Manages OAuth 2.0 token acquisition and caching for D365 F&O.
 */
export class DynamicsAuthProvider {
    credential;
    scopes;
    cachedToken = null;
    constructor(config, options = {}) {
        const { mode = "clientSecret" } = options;
        // Derive the resource scope from the base URL
        const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl;
        this.scopes = [`${baseUrl}/.default`];
        switch (mode) {
            case "managedIdentity":
                this.credential = new ManagedIdentityCredential(config.clientId);
                break;
            case "deviceCode":
                this.credential = new DeviceCodeCredential({
                    tenantId: config.tenantId,
                    clientId: config.clientId,
                    userPromptCallback: (info) => {
                        console.error(`[D365 Auth] ${info.message}`);
                    },
                });
                break;
            case "certificate":
                if (!options.certOptions?.certificatePath) {
                    throw new Error("Certificate path required for certificate auth mode");
                }
                this.credential = new ClientCertificateCredential(config.tenantId, config.clientId, options.certOptions.certificatePath, options.certOptions.certificatePassword
                    ? { sendCertificateChain: true }
                    : undefined);
                break;
            case "clientSecret":
            default:
                // Try chained: client secret + managed identity fallback
                this.credential = new ChainedTokenCredential(new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret), new ManagedIdentityCredential());
                break;
        }
    }
    /**
     * Returns a valid Bearer token, using the in-memory cache when possible.
     */
    async getBearerToken() {
        const now = Date.now();
        if (this.cachedToken &&
            this.cachedToken.expiresOnTimestamp - TOKEN_CACHE_BUFFER_MS > now) {
            return this.cachedToken.token;
        }
        const token = await this.credential.getToken(this.scopes);
        if (!token) {
            throw new Error("[D365 Auth] Failed to acquire access token");
        }
        this.cachedToken = token;
        return token.token;
    }
    /** Force-clears the cached token (useful after 401 responses). */
    invalidateCache() {
        this.cachedToken = null;
    }
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
export function createAuthProviderFromEnv() {
    const tenantId = requireEnv("D365_TENANT_ID");
    const clientId = requireEnv("D365_CLIENT_ID");
    const clientSecret = process.env.D365_CLIENT_SECRET ?? "";
    const baseUrl = requireEnv("D365_BASE_URL");
    const defaultCompany = process.env.D365_DEFAULT_COMPANY;
    const config = {
        tenantId,
        clientId,
        clientSecret,
        baseUrl,
        defaultCompany,
        timeoutMs: parseInt(process.env.D365_TIMEOUT_MS ?? "30000", 10),
        maxRetries: parseInt(process.env.D365_MAX_RETRIES ?? "3", 10),
    };
    const mode = process.env.D365_AUTH_MODE ?? "clientSecret";
    const authOptions = {
        mode,
        certOptions: mode === "certificate"
            ? {
                certificatePath: requireEnv("D365_CERT_PATH"),
                certificatePassword: process.env.D365_CERT_PASSWORD,
            }
            : undefined,
    };
    return { provider: new DynamicsAuthProvider(config, authOptions), config };
}
function requireEnv(name) {
    const val = process.env[name];
    if (!val)
        throw new Error(`Missing required environment variable: ${name}`);
    return val;
}
//# sourceMappingURL=dynamics-auth.js.map