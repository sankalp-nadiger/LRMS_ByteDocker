"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const pathMap: Record<string, string> = {
  "/": "Dashboard",
  "/land-master": "Land Master",
  "/slab-management": "Slab Management",
  "/panipatrak": "Panipatrak Registry",
  "/land-notice": "Land Notice",
  "/land-notice/entry": "Land Notice Entry",
  "/land-notice/details": "Land Notice Details",
  "/passbook": "Passbook Ledger",
  "/reports": "Reports & Queries",
  "/brokers": "Brokers",
  "/brokers/new": "Add Broker",
  "/brokers/update": "Update",
}

// UUID pattern to filter out dynamic IDs
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Breadcrumbs() {
  const pathname = usePathname()
  const pathSegments = pathname
    .split("/")
    .filter(Boolean)
    .filter(segment => !UUID_PATTERN.test(segment)) // Filter out UUIDs

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.map((segment, index) => {
          const path = "/" + pathSegments.slice(0, index + 1).join("/")
          const isLast = index === pathSegments.length - 1
          const title = pathMap[path] || segment.charAt(0).toUpperCase() + segment.slice(1)

          return (
            <div key={path} className="flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={path}>{title}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}