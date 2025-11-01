"use client"

import { ReactNode } from "react"
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <>
      <ClerkLoading>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          {children}
        </SignedIn>
        <SignedOut>
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow-md max-w-md border">
              <h2 className="text-2xl font-bold">Authentication Required</h2>
              <p className="text-muted-foreground">Please sign in to access this page</p>
              <Button 
                onClick={() => router.push("/sign-in")}
                className="w-full"
              >
                Sign In
              </Button>
            </div>
          </div>
        </SignedOut>
      </ClerkLoaded>
    </>
  )
}