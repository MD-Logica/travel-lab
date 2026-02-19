import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ForgotForm) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: () => {
      setSent(true);
    },
  });

  function onSubmit(data: ForgotForm) {
    mutation.mutate(data);
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl tracking-tight" data-testid="text-forgot-success-heading">
              Check your inbox
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              We've sent a password reset link to your email. It will expire in one hour.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-2"
            data-testid="link-back-to-login"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-forgot-heading">
            Reset password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

          <Button
            type="submit"
            className="w-full h-11 font-medium text-[15px] transition-transform active:scale-[0.98]"
            disabled={mutation.isPending}
            data-testid="button-forgot-submit"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-2"
          data-testid="link-back-to-login"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
