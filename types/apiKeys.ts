export type ApiKeyScope = 'global' | 'org';
export type ApiKeyPermissions = 'read' | 'write';
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKey {
  id: string;
  key_id: string;
  name: string;
  scope: ApiKeyScope;
  organization_id: string | null;
  permissions: ApiKeyPermissions;
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyAuditLog {
  id: string;
  api_key_id: string;
  actor_id: string | null;
  action: string;
  before_snapshot: Record<string, any> | null;
  after_snapshot: Record<string, any> | null;
  created_at: string;
}

export interface ApiKeyContext {
  apiKeyId: string;
  scope: ApiKeyScope;
  organizationId: string | null;
  permissions: ApiKeyPermissions;
}

export interface CreateApiKeyRequest {
  name: string;
  scope: ApiKeyScope;
  organization_id?: string | null;
  permissions: ApiKeyPermissions;
  expires_at?: string | null;
  description?: string | null;
  key_prefix?: string | null; // Optional custom prefix (e.g., "prod", "webhook") - will result in sk_live_prod_abc12345
}

export interface CreateApiKeyResponse {
  api_key: string; // Full key value (shown only once)
  key: ApiKey; // Key metadata
}

