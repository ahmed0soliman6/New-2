import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, clinicId } from '../services/supabase';
import type { AuthUser } from '../services/auth';
import {
  Role,
  Permission,
  ScreenAction,
  CustomPermissionsMap,
  normalizeRole,
  hasPermission as checkHasPermission,
  canAccessRoute as checkCanAccessRoute,
  assertPermission as checkAssertPermission,
  checkScreenPermission,
  getDefaultRolePermissions,
  ALL_SYSTEM_SCREENS,
} from '../permissions';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  allowedScreens?: string[];
  customPermissions?: CustomPermissionsMap;
}

interface AuthContextValue {
  currentUser: AuthUser | null;
  userProfile: UserProfile | null;
  role: Role;
  allowedScreens: string[];
  customPermissions: CustomPermissionsMap;
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  canAccess: (screenId: string) => boolean;
  canPerform: (screenId: string, action: ScreenAction) => boolean;
  canView: (screenId: string) => boolean;
  canCreate: (screenId: string) => boolean;
  canUpdate: (screenId: string) => boolean;
  canDelete: (screenId: string) => boolean;
  assertPermission: (permission: Permission, actionDescription?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const handleSessionUser = async (sbUser: any | null) => {
      if (!isMounted) return;

      if (!sbUser) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const meta = (sbUser.user_metadata || {}) as Record<string, any>;
      const authUser: AuthUser = Object.assign(sbUser, {
        uid: sbUser.id,
        displayName: typeof meta.displayName === 'string' ? meta.displayName : null,
      });
      setCurrentUser(authUser);

      // Optimistic hydration from localStorage if available
      const cacheKey = `soli_cached_profile_${sbUser.id}`;
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cachedProfile = JSON.parse(cachedRaw) as UserProfile;
          if (cachedProfile && cachedProfile.uid === sbUser.id && cachedProfile.active !== false) {
            setUserProfile(cachedProfile);
            setLoading(false);
          }
        }
      } catch {}

      try {
        const { data: member, error } = await supabase
          .from('clinic_members')
          .select('role, is_active, permissions')
          .eq('clinic_id', clinicId)
          .eq('user_id', sbUser.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error || !member) {
          try {
            localStorage.removeItem(cacheKey);
          } catch {}
          console.warn('[AuthContext] User membership not found in clinic_members for UID:', sbUser.id);
          await supabase.auth.signOut();
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        const isActive = member.is_active !== false;
        if (!isActive) {
          try {
            localStorage.removeItem(cacheKey);
          } catch {}
          alert('تم تعطيل حسابك من قِبل إدارة العيادة. يرجى التواصل مع الإدارة.');
          await supabase.auth.signOut();
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        const permsObj =
          member.permissions && typeof member.permissions === 'object'
            ? (member.permissions as Record<string, any>)
            : {};

        const parsedRole = normalizeRole(member.role);
        const rawAllowedScreens = permsObj.allowedScreens;
        const customScreens = Array.isArray(rawAllowedScreens)
          ? (rawAllowedScreens as string[])
          : undefined;
        const rawCustomPermissions = permsObj.customPermissions;
        const customPermissions =
          rawCustomPermissions && typeof rawCustomPermissions === 'object'
            ? (rawCustomPermissions as CustomPermissionsMap)
            : undefined;

        const usernameFromEmail = sbUser.email ? String(sbUser.email).split('@')[0] : 'user';
        const resolvedUsername =
          (typeof permsObj.username === 'string' && permsObj.username) ||
          (typeof meta.username === 'string' && meta.username) ||
          usernameFromEmail;

        const resolvedDisplayName =
          (typeof permsObj.displayName === 'string' && permsObj.displayName) ||
          (typeof meta.displayName === 'string' && meta.displayName) ||
          resolvedUsername ||
          'مستخدم';

        const nextProfile: UserProfile = {
          uid: sbUser.id,
          username: resolvedUsername,
          displayName: resolvedDisplayName,
          email: sbUser.email || '',
          role: parsedRole,
          active: true,
          allowedScreens: customScreens,
          customPermissions,
        };

        setUserProfile(nextProfile);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nextProfile));
        } catch {}
      } catch (err) {
        console.warn('[AuthContext] Error fetching profile from Supabase:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial session check
    void supabase.auth.getSession().then(({ data }) => {
      void handleSessionUser(data.session?.user ?? null);
    });

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSessionUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const activeRole: Role = userProfile?.role || 'secretary';
  const effectiveCustomPermissions: CustomPermissionsMap =
    userProfile?.customPermissions || getDefaultRolePermissions(activeRole);

  const effectiveAllowedScreens: string[] =
    userProfile?.allowedScreens && userProfile.allowedScreens.length > 0
      ? userProfile.allowedScreens
      : Object.keys(effectiveCustomPermissions).filter(
          (k) => effectiveCustomPermissions[k]?.view
        );

  const hasPermission = (permission: Permission) => {
    return checkHasPermission(
      activeRole,
      permission,
      userProfile?.customPermissions,
      userProfile?.allowedScreens
    );
  };

  const canAccess = (screenId: string) => {
    return checkCanAccessRoute(
      activeRole,
      screenId,
      userProfile?.allowedScreens,
      userProfile?.customPermissions
    );
  };

  const canPerform = (screenId: string, action: ScreenAction) => {
    return checkScreenPermission(
      activeRole,
      screenId,
      action,
      userProfile?.customPermissions,
      userProfile?.allowedScreens
    );
  };

  const canView = (screenId: string) => canPerform(screenId, 'view');
  const canCreate = (screenId: string) => canPerform(screenId, 'create');
  const canUpdate = (screenId: string) => canPerform(screenId, 'update');
  const canDelete = (screenId: string) => canPerform(screenId, 'delete');

  const assertPermission = (permission: Permission, actionDescription?: string) => {
    checkAssertPermission(activeRole, permission, actionDescription, userProfile?.customPermissions);
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserProfile(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role: activeRole,
        allowedScreens: effectiveAllowedScreens,
        customPermissions: effectiveCustomPermissions,
        loading,
        hasPermission,
        canAccess,
        canPerform,
        canView,
        canCreate,
        canUpdate,
        canDelete,
        assertPermission,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('[useAuth] called outside of AuthProvider. Using fallback admin context.');
    const adminPerms = getDefaultRolePermissions('admin');
    return {
      currentUser: null,
      userProfile: {
        uid: 'default-admin',
        username: 'admin',
        displayName: 'د. حازم القاضي',
        email: 'admin@soliclinic.com',
        role: 'admin',
        active: true,
        customPermissions: adminPerms,
      },
      role: 'admin',
      allowedScreens: ALL_SYSTEM_SCREENS.map((s) => s.id),
      customPermissions: adminPerms,
      loading: false,
      hasPermission: () => true,
      canAccess: () => true,
      canPerform: () => true,
      canView: () => true,
      canCreate: () => true,
      canUpdate: () => true,
      canDelete: () => true,
      assertPermission: () => {},
      logout: async () => {},
    };
  }
  return context;
};

export const usePermissions = useAuth;
