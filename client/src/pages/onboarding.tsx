import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const onboardingSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  agencyName: z.string().min(2, "Please enter your agency name"),
});

type OnboardingData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { fullName: "", agencyName: "" },
  });

  const onboardMutation = useMutation({
    mutationFn: async (data: OnboardingData) => {
      const res = await apiRequest("POST", "/api/onboarding", data);
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/dashboard";
    },
    onError: (error: Error) => {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
    },
  });

  const handleNext = async () => {
    if (step === 0) {
      const valid = await form.trigger("fullName");
      if (valid) setStep(1);
    } else {
      const valid = await form.trigger("agencyName");
      if (valid) {
        onboardMutation.mutate(form.getValues());
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-xl">Travel Lab</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-3" data-testid="text-onboarding-title">
            Set up your agency
          </h1>
          <p className="text-muted-foreground text-sm">
            Just a couple of details to get you started.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-8 justify-center">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-primary w-8' : 'bg-muted w-4'
              }`}
            />
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="mb-6">
                        <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Alexandra Chen"
                            className="h-11"
                            data-testid="input-full-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <FormField
                    control={form.control}
                    name="agencyName"
                    render={({ field }) => (
                      <FormItem className="mb-6">
                        <FormLabel className="text-sm font-medium">
                          <Building2 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" strokeWidth={1.5} />
                          Agency Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Wanderlust Travel Co."
                            className="h-11"
                            data-testid="input-agency-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              disabled={onboardMutation.isPending}
              data-testid="button-onboarding-next"
            >
              {onboardMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Creating your workspace...
                </span>
              ) : step === 0 ? (
                <span className="flex items-center gap-1">
                  Continue <ArrowRight className="w-4 h-4" />
                </span>
              ) : (
                "Create Agency"
              )}
            </Button>

            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="w-full mt-3 text-sm text-muted-foreground transition-colors duration-200 text-center"
                data-testid="button-onboarding-back"
              >
                Go back
              </button>
            )}
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
