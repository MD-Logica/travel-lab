import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

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

export default function SignupPage() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });

  const watchPassword = form.watch("password");

  const registerMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      const { confirmPassword, ...payload } = data;
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/onboarding");
    },
    onError: (err: Error) => {
      setError(err.message || "Registration failed");
    },
  });

  function onSubmit(data: SignupForm) {
    setError("");
    registerMutation.mutate(data);
  }

  return (
    <AuthLayout>
      <div className="space-y-7">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-signup-heading">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Start your 14-day free trial, no credit card required
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/8 rounded-md px-4 py-3" data-testid="text-signup-error">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First name
              </Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Jane"
                className="h-11"
                data-testid="input-first-name"
                {...form.register("firstName")}
              />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="Smith"
                className="h-11"
                data-testid="input-last-name"
                {...form.register("lastName")}
              />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.com"
              className="h-11"
              data-testid="input-email"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a password"
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
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm your password"
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
            disabled={registerMutation.isPending}
            data-testid="button-signup-submit"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline underline-offset-2 text-foreground font-medium"
            data-testid="link-login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
