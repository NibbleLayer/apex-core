import { describe, expect, it } from 'vitest';
import { getRolePermissions, canPerform, type ApiKeyRole } from '../../src/services/permissions.js';

describe('getRolePermissions', () => {
  it('returns full permissions for admin', () => {
    const perms = getRolePermissions('admin');
    expect(perms).toEqual({
      canRead: true,
      canWrite: true,
      canDelete: true,
      canManageKeys: true,
    });
  });

  it('returns read+write permissions for developer', () => {
    const perms = getRolePermissions('developer');
    expect(perms).toEqual({
      canRead: true,
      canWrite: true,
      canDelete: false,
      canManageKeys: false,
    });
  });

  it('returns read-only permissions for viewer', () => {
    const perms = getRolePermissions('viewer');
    expect(perms).toEqual({
      canRead: true,
      canWrite: false,
      canDelete: false,
      canManageKeys: false,
    });
  });

  it('defaults unknown role to viewer permissions', () => {
    const perms = getRolePermissions('unknown_role');
    expect(perms).toEqual({
      canRead: true,
      canWrite: false,
      canDelete: false,
      canManageKeys: false,
    });
  });

  it('defaults empty string role to viewer permissions', () => {
    const perms = getRolePermissions('');
    expect(perms).toEqual(getRolePermissions('viewer'));
  });
});

describe('canPerform', () => {
  const roles: ApiKeyRole[] = ['admin', 'developer', 'viewer'];

  it('allows admin all actions', () => {
    expect(canPerform('admin', 'read')).toBe(true);
    expect(canPerform('admin', 'write')).toBe(true);
    expect(canPerform('admin', 'delete')).toBe(true);
    expect(canPerform('admin', 'manageKeys')).toBe(true);
  });

  it('allows developer read and write but not delete or manageKeys', () => {
    expect(canPerform('developer', 'read')).toBe(true);
    expect(canPerform('developer', 'write')).toBe(true);
    expect(canPerform('developer', 'delete')).toBe(false);
    expect(canPerform('developer', 'manageKeys')).toBe(false);
  });

  it('allows viewer only read', () => {
    expect(canPerform('viewer', 'read')).toBe(true);
    expect(canPerform('viewer', 'write')).toBe(false);
    expect(canPerform('viewer', 'delete')).toBe(false);
    expect(canPerform('viewer', 'manageKeys')).toBe(false);
  });

  it('treats unknown role as viewer', () => {
    expect(canPerform('hacker', 'read')).toBe(true);
    expect(canPerform('hacker', 'write')).toBe(false);
    expect(canPerform('hacker', 'delete')).toBe(false);
    expect(canPerform('hacker', 'manageKeys')).toBe(false);
  });

  it('all roles can read', () => {
    for (const role of roles) {
      expect(canPerform(role, 'read')).toBe(true);
    }
  });

  it('only admin can delete', () => {
    for (const role of roles) {
      expect(canPerform(role, 'delete')).toBe(role === 'admin');
    }
  });

  it('only admin can manageKeys', () => {
    for (const role of roles) {
      expect(canPerform(role, 'manageKeys')).toBe(role === 'admin');
    }
  });
});
