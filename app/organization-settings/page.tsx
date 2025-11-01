"use client";
import { useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OrganizationProfile } from "@clerk/nextjs";

export default function OrganizationSettings() {
  const { membership } = useOrganization();
  const router = useRouter();

  useEffect(() => {
    if (membership && membership.role !== "org:admin" && membership.role !== "owner") {
      router.push("/"); // redirect to home if not owner/admin
    }
  }, [membership, router]);

  return (
    <div className="min-h-screen flex justify-center p-4">
      <OrganizationProfile />
    </div>
  );
}
