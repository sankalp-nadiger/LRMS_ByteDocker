"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useUser, useSession } from "@clerk/nextjs";

type UserRole = "admin" | "manager" | "executioner" | "reviewer";

interface UserContextType {
  role: UserRole | null;
  setRole: (role: UserRole) => void;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { session } = useSession();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const initializeRole = async () => {
      if (isLoaded && user && session) {
        try {
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          const userEmail = user.primaryEmailAddress?.emailAddress;
          
          // Check if user is admin
          const isUserAdmin = adminEmail && userEmail && adminEmail.toLowerCase() === userEmail.toLowerCase();
          setIsAdmin(!!isUserAdmin);
          
          if (isUserAdmin) {
            setRole('admin');
            return;
          }

          // Get user role from metadata
          const userRole = (user.publicMetadata as any)?.role;

          console.log('[Role Check] Auth State:', {
            sessionId: session.id,
            authStatus: session.status,
            userEmail,
            role: userRole,
            isAdmin: isUserAdmin,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              metadata: user.publicMetadata
            }
          });

          if (!isUserAdmin && userRole) {
            console.log(`[Role Check] Setting user role: ${userRole}`);
            setRole(userRole as UserRole);
          }
     
        } catch (error) {
          console.error('[Role Check] Error:', error);
        }
      }
    };

    initializeRole();
  }, [user, isLoaded, session]);

  return (
    <UserContext.Provider value={{ role, setRole, isAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserRole = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserRole must be used within a UserProvider");
  }
  return context;
};