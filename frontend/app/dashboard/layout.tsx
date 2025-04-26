"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Home, LogOut, Search, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ModeToggle } from "@/components/mode-toggle"
import { Suspense } from "react"
import { MobileNav } from "@/components/mobile-nav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <MobileNav />
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl">Comfy Journal</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/notifications">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Link>
            </Button>
            <ModeToggle />
            <Link href="/dashboard/profile">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg" alt="User" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>
      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
          <div className="h-full py-6 pr-6 lg:py-8">
            <nav className="flex flex-col space-y-2">
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === "/dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
              <Link
                href="/dashboard/search"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === "/dashboard/search" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
              <Link
                href="/dashboard/mood"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === "/dashboard/mood" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span className="h-4 w-4 flex items-center justify-center">😊</span>
                Mood Tracker
              </Link>
              <Link
                href="/dashboard/profile"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === "/dashboard/profile" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <div className="mt-auto pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </aside>
        <main className="flex w-full flex-col overflow-hidden py-6 lg:py-8">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
