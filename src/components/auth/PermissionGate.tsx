import React from 'react';
import { Permission, Role, ScreenAction, checkScreenPermission, hasPermission as checkHasPermission } from '../../permissions';
import { usePermissions } from '../../context/AuthContext';

export interface PermissionGateProps {
  permission?: Permission;
  screen?: string;
  action?: ScreenAction;
  role?: Role | string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Centrally gates buttons, panels, or actions based on system permissions.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  screen,
  action = 'view',
  role: overrideRole,
  fallback = null,
  children,
}) => {
  const { role: contextRole, userProfile } = usePermissions();
  const effectiveRole = overrideRole || contextRole;

  let allowed = false;

  if (screen) {
    const validAction: ScreenAction = action === 'create' || action === 'update' || action === 'delete' ? action : 'view';
    allowed = checkScreenPermission(
      effectiveRole,
      screen,
      validAction,
      userProfile?.customPermissions,
      userProfile?.allowedScreens
    );
  } else if (permission) {
    allowed = checkHasPermission(
      effectiveRole,
      permission,
      userProfile?.customPermissions,
      userProfile?.allowedScreens
    );
  } else {
    allowed = true;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

