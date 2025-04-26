import { Suspense } from "react" // Import Suspense
import Link from "next/link"

import { ModeToggle } from "@/components/mode-toggle"
import { ResetPasswordForm } from "@/components/reset-password-form" // Import the new client component

// No "use client" here - this is now a Server Component

export default function ResetPasswordPage() {
  // Removed useState, useEffect, useRouter, useSearchParams, useToast, form logic, onSubmit

  return (
    <div className="container relative flex min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ModeToggle />
      </div>
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-rose-100 dark:bg-rose-950" />
        <div className="relative z-20 flex items-center text-lg font-medium text-rose-950 dark:text-white">
          <Link href="/" className="flex items-center">
            Comfy Journal
          </Link>
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg text-rose-950 dark:text-white">
              "A fresh start with a new password. Your journal is waiting for you."
            </p>
            <footer className="text-sm text-rose-900 dark:text-rose-200">Comfy Journal Team</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        {/* Wrap the client component in Suspense */}
        <Suspense fallback={<div className="flex justify-center items-center h-full">Loading form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
