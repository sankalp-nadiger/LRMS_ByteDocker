import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TopNavbar } from "@/components/top-navbar"
import { Toaster } from "@/components/ui/toaster"
import { LRMSProvider } from "@/contexts/lrms-context"
import { ClerkProvider } from '@clerk/nextjs'
import { OrgProvider } from "@/contexts/org-context";
import { UserProvider } from "@/contexts/user-context";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LRMS - Land Record Management System",
  description: "Professional ERP system for land record management",
  icons: {
    icon: '/Logo.png',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{ variables: { colorPrimary: "#6c47ff" } }}
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html lang="en">
        <body className={inter.className}>
          <OrgProvider>
            <UserProvider>
              <LRMSProvider>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                      <TopNavbar />
                      <main className="flex-1 p-6 bg-gray-50">{children}</main>
                    </div>
                  </div>
                  <Toaster />
                </SidebarProvider>
              </LRMSProvider>
            </UserProvider>
          </OrgProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}