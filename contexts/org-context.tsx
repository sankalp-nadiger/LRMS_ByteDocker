"use client";

import { createContext, useContext, ReactNode } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";

type OrgContextType = {
  organization: any;
  membership: any;
  user: any;
  isLoaded: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
};

const OrgContext = createContext<OrgContextType | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { organization, membership, isLoaded } = useOrganization();
  const { user } = useUser();

  const role = membership?.role ?? null;

  const value: OrgContextType = {
    organization,
    membership,
    user,
    isLoaded,
    isOwner: role === "org:owner",
    isAdmin: role === "org:admin",
    isMember: role === "org:member",
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within an OrgProvider");
  return ctx;
}
