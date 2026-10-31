import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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
  getDefaultAllowedScreens,
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
  currentUser: FirebaseUser | null;
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setCurrentUser(fbUser);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!fbUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      if (!db) {
        // Fallback without Firestore
        setUserProfile({
          uid: fbUser.uid,
          username: fbUser.email?.split('@')[0] || 'user',
          displayName: fbUser.displayName || 'مستخدم',
          email: fbUser.email || '',
          role: 'admin',
          active: true,
          customPermissions: getDefaultRolePermissions('admin'),
          allowedScreens: ALL_SYSTEM_SCREENS.map((s) => s.id),
        });
        setLoading(false);
        return;
      }

      // Instant optimistic hydration from localStorage if available to avoid blocking first open
      const cacheKey = `soli_cached_profile_${fbUser.uid}`;
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cachedProfile = JSON.parse(cachedRaw) as UserProfile;
          if (cachedProfile && cachedProfile.uid === fbUser.uid && cachedProfile.active !== false) {
            setUserProfile(cachedProfile);
            setLoading(false);
          }
        }
      } catch {}

      // Listen in real-time to user's profile in Firestore
      const userDocRef = doc(db, 'users', fbUser.uid);
      unsubscribeDoc = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const isActive = data.active !== false;

            // Instant enforcement: if account is disabled, sign out immediately
            if (!isActive) {
              try { localStorage.removeItem(cacheKey); } catch {}
              alert('تم تعطيل حسابك من قِبل إدارة العيادة. يرجى التواصل مع الإدارة.');
              void signOut(auth);
              setUserProfile(null);
              setLoading(false);
              return;
            }

            const rawRole = data.role;
            const parsedRole = normalizeRole(rawRole);
            const rawAllowedScreens = data.allowedScreens;
            const customScreens = Array.isArray(rawAllowedScreens)
              ? (rawAllowedScreens as string[])
              : undefined;
            const rawCustomPermissions = data.customPermissions;
            const customPermissions =
              rawCustomPermissions && typeof rawCustomPermissions === 'object'
                ? (rawCustomPermissions as CustomPermissionsMap)
                : undefined;

            const nextProfile: UserProfile = {
              uid: fbUser.uid,
              username: data.username || fbUser.email?.split('@')[0] || 'user',
              displayName: data.displayName || data.username || 'مستخدم',
              email: data.email || fbUser.email || '',
              role: parsedRole,
              active: true,
              allowedScreens: customScreens,
              customPermissions,
            };
            setUserProfile(nextProfile);
            try { localStorage.setItem(cacheKey, JSON.stringify(nextProfile)); } catch {}
          } else {
            // User document does not exist in Firestore users collection
            try { localStorage.removeItem(cacheKey); } catch {}
            console.warn('[AuthContext] User document not found in Firestore for UID:', fbUser.uid);
            void signOut(auth);
            setUserProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('[AuthContext] Error fetching profile:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
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
    if (auth) {
      await signOut(auth);
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

