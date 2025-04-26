"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Menu, Search, User, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const routes = [
    {
      href: "/dashboard",
      label: "Home",
      icon: Home,
      active: pathname === "/dashboard",
    },
    {
      href: "/dashboard/search",
      label: "Search",
      icon: Search,
      active: pathname === "/dashboard/search",
    },
    {
      href: "/dashboard/mood",
      label: "Mood Tracker",
      icon: () => <span className="flex h-4 w-4 items-center justify-center">😊</span>,
      active: pathname === "/dashboard/mood",
    },
    {
      href: "/dashboard/profile",
      label: "Profile",
      icon: User,
      active: pathname === "/dashboard/profile",
    },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="font-semibold">Comfy Journal</div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <nav className="mt-4 flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-2">
            {routes.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    route.active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <route.icon className="h-4 w-4" />
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t pt-4">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full justify-start">
                Log out
              </Button>
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
