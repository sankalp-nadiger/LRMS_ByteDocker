"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { UserButton, useOrganization } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Users } from "lucide-react";
import { useUserRole } from "@/contexts/user-context";
import { NotificationsMenu } from "@/components/notifications-menu";

export function TopNavbar() {
  const { membership } = useOrganization();
  const { role, isAdmin } = useUserRole();
  const isOwner = membership?.role === "org:admin" || membership?.role === "owner";
  const isManager = role === "manager";

  return (
    <header className="flex h-12 sm:h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <SidebarTrigger className="h-8 w-8 sm:h-auto sm:w-auto" />
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
        <div className="sm:hidden">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <SignedIn>
          {/* Show notifications menu for all users */}
          <NotificationsMenu />
          
          {/* Show owner-specific dropdown */}
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" /> Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/organization-settings">
                    Manage Organization
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Show admin-specific dropdown */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" /> Users
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/user-management">
                    Manage Users
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clerk user button */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 sm:h-10 sm:w-10",
              },
            }}
          />
        </SignedIn>

        <SignedOut>
          <Button asChild variant="outline" size="sm" className="text-sm">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </SignedOut>
      </div>
    </header>
  );
}
