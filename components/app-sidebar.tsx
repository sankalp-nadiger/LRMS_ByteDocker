"use client"

import { Building2, FolderKanban, Home, Layers, MapPin, Users, BookOpen, Sprout, Clock, HomeIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

const menuItems = [
  // {
  //   title: "Dashboard",
  //   url: "/land-master",
  //   icon: MapPin,
  // },
   {
    title: "Dashboard",
    url: "/",
    icon: HomeIcon,
  },
  {
    title: "Land Master",
    url: "/land-master",
    icon: MapPin,
  },
  // {
  //   title: "Slab Management",
  //   url: "/slab-management",
  //   icon: Layers,
  // },
  // {
  //   title: "Panipatrak Registry",
  //   url: "/panipatrak",
  //   icon: Sprout,
  // },
   
  // {
  //   title: "Land Notice (Nondh)",
  //   icon: FileText,
  //   items: [
  //     {
  //       title: "Land Notice Entry",
  //       url: "/land-notice/entry",
  //     },
  //     {
  //       title: "Land Notice Details",
  //       url: "/land-notice/details",
  //     },
  //   ],
  // },
  {
    title: "Passbook Ledger",
    url: "/passbook",
    icon: BookOpen,
  },
  {
    title: "Brokers",
    url: "/brokers",
    icon: Users,
  },
  {
    title: "Timeline Logs",
    url: "/timeline",
    icon: Clock,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban, // visually represents grouped land records
  },
  // {
  //   title: "Reports & Queries",
  //   url: "/reports",
  //   icon: Search,
  // },
]

export function AppSidebar() {
  const pathname = usePathname()

  // Close sidebar on mobile when pathname changes
  useEffect(() => {
    const closeMobileSidebar = () => {
      const isMobile = window.innerWidth < 1024
      if (isMobile) {
        // Try multiple methods to close the sidebar
        
        // Method 1: Using data attributes (most common)
        const sidebar = document.querySelector('[data-sidebar="sidebar"]') as HTMLElement;
        if (sidebar) {
          sidebar.setAttribute('data-state', 'closed')
        }
        
        // Method 2: Using CSS classes
        const sidebarOverlay = document.querySelector('.sheet-overlay, [data-sheet-overlay]') as HTMLElement;
        if (sidebarOverlay) {
          sidebarOverlay.click()
        }
        
        // Method 3: Dispatch escape key event to close modal/sheet
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      }
    }

    closeMobileSidebar()
  }, [pathname])

  return (
    <Sidebar className="border-r">
      {/* Hidden title for accessibility - required for mobile sheet */}
      <span className="sr-only">Navigation Menu</span>
      
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="font-bold text-lg">LRMS</h1>
            <p className="text-xs text-muted-foreground">Land Record Management</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    <Collapsible defaultOpen={pathname.startsWith("/land-notice")}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="w-full">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url!}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}