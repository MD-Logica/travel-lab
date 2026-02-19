import { useState, useEffect } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Loader2, Check, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-2">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-1">
          {check.met ? (
            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
          ) : (
            <X className="w-3 h-3 text-muted-foreground/50" />
          )}
          <span className={`text-xs ${check.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground/50"}`}>
            {check.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SetPasswordPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: tokenValid, isLoading: validating } = useQuery<{ valid: boolean }>({
    queryKey: ["/api/auth/validate-reset-token", token],
    queryFn: async () => {
      const res = await fetch(`/api/auth/validate-reset-token/${token}`);
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const watchPassword = form.watch("password");

  const mutation = useMutation({
    mutationFn: async (data: ResetForm) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to reset password");
    },
  });

  function onSubmit(data: ResetForm) {
    setError("");
    mutation.mutate(data);
  }

  if (validating) {
    return (
      <AuthLayout>
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </AuthLayout>
    );
  }

  if (!token || (tokenValid && !tokenValid.valid)) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl tracking-tight" data-testid="text-invalid-token-heading">
              Invalid reset link
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
          <Button asChild>
            <Link href="/forgot-password" data-testid="link-request-new-reset">
              Request new link
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl tracking-tight" data-testid="text-reset-success-heading">
              Password updated
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
          </div>
          <Button asChild>
            <Link href="/login" data-testid="link-back-to-login">
              Sign in
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-set-password-heading">
            Set new password
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="text-sm text-destructive bg-destructive/8 rounded-md px-4 py-3" data-testid="text-reset-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                className="h-11 pr-10"
                data-testid="input-password"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={watchPassword} />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              className="h-11"
              data-testid="input-confirm-password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-medium text-[15px] transition-transform active:scale-[0.98]"
            disabled={mutation.isPending}
            data-testid="button-reset-submit"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Reset password"
            )}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
