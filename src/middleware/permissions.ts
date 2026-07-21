import { UserRole } from '@prisma/client';

// Define a type for the user object, assuming it has these properties from the session
export type AuthUser = {
  id: string;
  role: UserRole;
  tenantId: string;
  branchId?: string | null;
};

// Define resources
export const RESOURCES = {
  STOCK: 'STOCK',
  SALE: 'SALE',
  USER: 'USER',
  BRANCH: 'BRANCH',
  CATEGORY: 'CATEGORY',
  SUPPLIER: 'SUPPLIER',
  REPORTS: 'REPORTS',
  SETTINGS: 'SETTINGS',
  AUDIT: 'AUDIT',
  CUSTOMER: 'CUSTOMER',
  PAYMENT: 'PAYMENT',
  PRODUCT: 'PRODUCT',
  PRESCRIPTION: 'PRESCRIPTION',
  FINANCIAL_REPORTS: 'FINANCIAL_REPORTS',
} as const;

export type Resource = typeof RESOURCES[keyof typeof RESOURCES];

// Define actions
export const ACTIONS = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ADJUST: 'ADJUST', // For stock
  REFUND: 'REFUND', // For sales
  ASSIGN_ROLE: 'ASSIGN_ROLE', // For users
  VIEW_ALL: 'VIEW_ALL', // To view across all branches in a tenant
  MAKE_PAYMENT: 'MAKE_PAYMENT',
  ALLOW_CREDIT: 'ALLOW_CREDIT',
  REQUEST_CREATE: 'REQUEST_CREATE', // For stock requests
  MANAGE: 'MANAGE', // For stock requests approval/rejection
} as const;

export type Action = typeof ACTIONS[keyof typeof ACTIONS];

// Define the context for a resource being accessed
export type ResourceContext = {
  tenantId?: string | null;
  branchId?: string | null;
  ownerId?: string | null;
  resourceId?: string | null;
};

// Type for a permission check function
type PermissionCheck = (user: AuthUser, context: ResourceContext) => boolean;

// --- Permission Definitions ---

// Helper functions for common checks
const isSuperAdmin = (user: AuthUser) => user.role === UserRole.SUPER_ADMIN;
const isSameTenant = (user: AuthUser, context: ResourceContext) => user.tenantId === context.tenantId;
const isSameBranch = (user: AuthUser, context: ResourceContext) => !!user.branchId && user.branchId === context.branchId;
const isOwner = (user: AuthUser, context: ResourceContext) => user.id === context.ownerId;

// Permissions structure: Role -> Resource -> Action -> Check
const permissions: Record<UserRole, Partial<Record<Resource, Partial<Record<Action, PermissionCheck>>>>> = {
  [UserRole.SUPER_ADMIN]: {
    // Super admin has all permissions implicitly
  },
  [UserRole.ADMIN]: {
    [RESOURCES.STOCK]: {
      [ACTIONS.VIEW]: isSameTenant,
      [ACTIONS.CREATE]: isSameTenant,
      [ACTIONS.UPDATE]: isSameTenant,
      [ACTIONS.DELETE]: isSameTenant,
      [ACTIONS.ADJUST]: isSameTenant,
      [ACTIONS.MANAGE]: isSameTenant,
    },
    [RESOURCES.PRODUCT]: {
      [ACTIONS.VIEW]: isSameTenant,
      [ACTIONS.CREATE]: isSameTenant,
      [ACTIONS.UPDATE]: isSameTenant,
      [ACTIONS.DELETE]: isSameTenant,
    },
    [RESOURCES.SALE]: {
      [ACTIONS.VIEW]: isSameTenant,
      [ACTIONS.CREATE]: isSameTenant,
      [ACTIONS.UPDATE]: isSameTenant,
      [ACTIONS.REFUND]: isSameTenant,
      [ACTIONS.ALLOW_CREDIT]: isSameTenant,
    },
    [RESOURCES.USER]: {
      [ACTIONS.VIEW]: isSameTenant,
      [ACTIONS.VIEW_ALL]: isSameTenant,
      [ACTIONS.CREATE]: isSameTenant,
      [ACTIONS.UPDATE]: isSameTenant,
      [ACTIONS.DELETE]: isSameTenant,
    },
    [RESOURCES.BRANCH]: {
      [ACTIONS.VIEW]: isSameTenant,
      [ACTIONS.CREATE]: isSameTenant,
      [ACTIONS.UPDATE]: isSameTenant,
    },
    [RESOURCES.SUPPLIER]: {
        [ACTIONS.VIEW]: isSameTenant,
        [ACTIONS.CREATE]: isSameTenant,
        [ACTIONS.UPDATE]: isSameTenant,
        [ACTIONS.DELETE]: isSameTenant,
    },
    [RESOURCES.CATEGORY]: {
        [ACTIONS.VIEW]: isSameTenant,
        [ACTIONS.CREATE]: isSameTenant,
        [ACTIONS.UPDATE]: isSameTenant,
        [ACTIONS.DELETE]: isSameTenant,
    },
    [RESOURCES.FINANCIAL_REPORTS]: {
        [ACTIONS.VIEW]: isSameTenant,
    },
    [RESOURCES.REPORTS]: {
        [ACTIONS.VIEW]: isSameTenant,
    },
    [RESOURCES.CUSTOMER]: {
        [ACTIONS.VIEW]: isSameTenant,
        [ACTIONS.CREATE]: isSameTenant,
        [ACTIONS.UPDATE]: isSameTenant,
        [ACTIONS.DELETE]: isSameTenant,
    },
    [RESOURCES.PAYMENT]: {
        [ACTIONS.VIEW]: isSameTenant,
        [ACTIONS.MAKE_PAYMENT]: isSameTenant,
    },
    [RESOURCES.SETTINGS]: {
        [ACTIONS.VIEW]: isSameTenant,
        [ACTIONS.UPDATE]: isSameTenant,
        [ACTIONS.DELETE]: isSameTenant,
        [ACTIONS.CREATE]: isSameTenant,
    },
  },
  [UserRole.BRANCH_MANAGER]: {
    [RESOURCES.STOCK]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.UPDATE]: isSameBranch,
      [ACTIONS.DELETE]: isSameBranch,
      [ACTIONS.ADJUST]: isSameBranch,
      [ACTIONS.MANAGE]: isSameBranch,
    },
    [RESOURCES.SALE]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.UPDATE]: isSameBranch,
      [ACTIONS.REFUND]: isSameBranch,
      [ACTIONS.ALLOW_CREDIT]: isSameBranch,
    },
    [RESOURCES.USER]: { // Can only manage users in their own branch
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
    },
    [RESOURCES.CUSTOMER]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.UPDATE]: isSameBranch,
    },
    [RESOURCES.PAYMENT]: {
        [ACTIONS.VIEW]: isSameBranch,
        [ACTIONS.MAKE_PAYMENT]: isSameBranch,
    },
    [RESOURCES.REPORTS]: {
        [ACTIONS.VIEW]: isSameBranch,
    },
    [RESOURCES.FINANCIAL_REPORTS]: {
        [ACTIONS.VIEW]: isSameBranch,
    }
  },
  [UserRole.PHARMACIST]: {
    [RESOURCES.STOCK]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.ADJUST]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.MANAGE]: isSameBranch,
    },
    [RESOURCES.SALE]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
    },
    [RESOURCES.PRESCRIPTION]: {
        [ACTIONS.VIEW]: isSameBranch,
        [ACTIONS.CREATE]: isSameBranch,
        [ACTIONS.UPDATE]: isSameBranch,
    }
  },
  [UserRole.INVENTORY_CLERK]: {
    [RESOURCES.STOCK]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.UPDATE]: isSameBranch,
      [ACTIONS.ADJUST]: isSameBranch,
      [ACTIONS.MANAGE]: isSameBranch,
    },
  },
  [UserRole.CASHIER]: {
    [RESOURCES.STOCK]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.REQUEST_CREATE]: isSameBranch,
    },
    [RESOURCES.SALE]: {
      [ACTIONS.VIEW]: isSameBranch,
      [ACTIONS.CREATE]: isSameBranch,
      [ACTIONS.ALLOW_CREDIT]: isSameBranch,
    },
    [RESOURCES.CUSTOMER]: {
        [ACTIONS.VIEW]: isSameBranch,
        [ACTIONS.CREATE]: isSameBranch,
    },
    [RESOURCES.PRODUCT]: {
        [ACTIONS.VIEW]: isSameBranch,
    },
    [RESOURCES.PAYMENT]: {
        [ACTIONS.VIEW]: isSameBranch,
        [ACTIONS.MAKE_PAYMENT]: isSameBranch,
    }
  },
};

/**
 * Checks if a user can perform a given action on a resource.
 * This is the main authorization function for backend use.
 * @param action The action being performed
 * @param resource The resource being accessed
 * @param userRole The role of the user
 * @param user The user object from session
 * @param context The context of the resource being accessed
 * @returns {boolean} True if authorized, false otherwise.
 */
export function authorize(
  action: Action,
  resource: Resource,
  userRole: UserRole,
  user: AuthUser,
  context: ResourceContext
): boolean {
  // Super Admins can do anything
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  const rolePermissions = permissions[userRole];
  if (!rolePermissions) {
    return false; // Role has no permissions defined
  }

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false; // No permissions for this resource
  }

  const permissionCheck = resourcePermissions[action];
  if (!permissionCheck) {
    return false; // No permission for this action
  }

  return permissionCheck(user, context);
}


/**
 * Checks if a user can perform a given action on a resource.
 * This is intended for frontend use via hooks.
 * @param action The action being performed
 * @param resource The resource being accessed
 * @param user The user object from session
 * @param context The context of the resource being accessed
 * @returns {boolean} True if authorized, false otherwise.
 */
export function canUserPerform(
    action: Action,
    resource: Resource,
    user: AuthUser,
    context?: ResourceContext
): boolean {
    if (!user) return false;

    const fullContext: ResourceContext = {
        tenantId: user.tenantId,
        branchId: user.branchId,
        ...context,
    };

    return authorize(action, resource, user.role, user, fullContext);
}
