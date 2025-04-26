"use client"

import { useState, useEffect } from "react" // Added useEffect
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation" // Added useRouter, useSearchParams
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ModeToggle } from "@/components/mode-toggle"
import { useToast } from "@/components/ui/use-toast" // Added useToast

const formSchema = z
  .object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // Added isLoading state
  const [token, setToken] = useState<string | null>(null) // State to hold the token
  const router = useRouter() // Added router
  const searchParams = useSearchParams() // Added searchParams
  const { toast } = useToast() // Added toast

  useEffect(() => {
    // Extract token from URL query parameters on component mount
    const resetToken = searchParams.get("token")
    if (resetToken) {
      setToken(resetToken)
    } else {
      // Handle case where token is missing
      toast({
        variant: "destructive",
        title: "Invalid Link",
        description: "Password reset token is missing or invalid.",
      })
      // Optionally redirect to login or forgot password page
      // router.push("/login");
    }
  }, [searchParams, toast, router])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password reset token is missing. Please request a new reset link.",
      })
      return
    }

    setIsLoading(true)
    try {
      // Only send the new password, not the confirmation
      const { password } = values

      const response = await fetch(`http://localhost:5000/api/v1/auth/resetPassword/${token}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }), // Send only the new password
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in.",
        })
        router.push("/login") // Redirect to login page
      } else {
        toast({
          variant: "destructive",
          title: "Password Reset Failed",
          description: data.message || "Could not reset password. The link may be invalid or expired.",
        })
      }
    } catch (error) {
      console.error("Reset password error:", error)
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: "An unexpected error occurred. Please try again later.",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Enter your new password below</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || !token}>
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </Form>
          <div className="text-center text-sm">
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
