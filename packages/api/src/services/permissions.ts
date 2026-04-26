export type ApiKeyRole = 'admin' | 'developer' | 'viewer';

const ROLE_PERMISSIONS: Record<ApiKeyRole, { canRead: boolean; canWrite: boolean; canDelete: boolean; canManageKeys: boolean }> = {
  admin: { canRead: true, canWrite: true, canDelete: true, canManageKeys: true },
  developer: { canRead: true, canWrite: true, canDelete: false, canManageKeys: false },
  viewer: { canRead: true, canWrite: false, canDelete: false, canManageKeys: false },
};

export function getRolePermissions(role: string) {
  return ROLE_PERMISSIONS[(role as ApiKeyRole)] ?? ROLE_PERMISSIONS.viewer;
}

export function canPerform(role: string, action: 'read' | 'write' | 'delete' | 'manageKeys'): boolean {
  const perms = getRolePermissions(role);
  switch (action) {
    case 'read': return perms.canRead;
    case 'write': return perms.canWrite;
    case 'delete': return perms.canDelete;
    case 'manageKeys': return perms.canManageKeys;
  }
}
