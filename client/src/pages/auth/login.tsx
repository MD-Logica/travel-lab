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
import { Eye, EyeOff, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/dashboard");
    },
    onError: (err: Error) => {
      setError(err.message || "Invalid email or password");
    },
  });

  function onSubmit(data: LoginForm) {
    setError("");
    loginMutation.mutate(data);
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-login-heading">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your Travel Lab account
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="text-sm text-destructive bg-destructive/8 rounded-md px-4 py-3" data-testid="text-login-error">
              {error}
            </div>
          )}

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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline underline-offset-2 transition-colors"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
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
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-medium text-[15px] transition-transform active:scale-[0.98]"
            disabled={loginMutation.isPending}
            data-testid="button-login-submit"
          >
            {loginMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11"
          asChild
        >
          <a href="/api/login" data-testid="button-replit-login">
            Sign in with Replit
          </a>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          New to Travel Lab?{" "}
          <Link
            href="/signup"
            className="underline underline-offset-2 text-foreground font-medium"
            data-testid="link-signup"
          >
            Request access
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
