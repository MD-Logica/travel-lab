import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Minus, ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const plans = [
  {
    name: "Trial",
    price: "Free",
    period: "14 days",
    description: "Everything in Pro, with limits — explore the full platform risk-free.",
    cta: "Start free trial",
    href: "/signup",
    features: [
      "Up to 3 advisors",
      "Up to 50 clients",
      "Up to 20 trips",
      "Full itinerary builder",
      "Client portal access",
    ],
  },
  {
    name: "Pro",
    price: "[PRICE]",
    period: "/month",
    description: "For growing agencies that need room to scale.",
    cta: "Start with Pro",
    href: "/signup?plan=pro",
    featured: true,
    features: [
      "Up to 10 advisors",
      "Up to 500 clients",
      "Unlimited trips",
      "PDF & calendar export",
      "Client portal access",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large agencies with dedicated needs.",
    cta: "Contact us",
    href: "mailto:hello@travellab.app",
    enterprise: true,
    features: [
      "Unlimited advisors",
      "Unlimited clients",
      "Unlimited trips",
      "Custom branding / white-label",
      "Dedicated onboarding",
      "SLA + dedicated support",
    ],
  },
];

const comparisonFeatures = [
  { name: "Advisors", trial: "Up to 3", pro: "Up to 10", enterprise: "Unlimited" },
  { name: "Clients", trial: "Up to 50", pro: "Up to 500", enterprise: "Unlimited" },
  { name: "Trips", trial: "Up to 20", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "PDF Export", trial: true, pro: true, enterprise: true },
  { name: "Calendar Export", trial: true, pro: true, enterprise: true },
  { name: "Client Portal", trial: true, pro: true, enterprise: true },
  { name: "Team Roles", trial: true, pro: true, enterprise: true },
  { name: "White-label Branding", trial: false, pro: false, enterprise: true },
  { name: "Dedicated Onboarding", trial: false, pro: false, enterprise: true },
  { name: "Support", trial: "Community", pro: "Priority", enterprise: "Dedicated" },
];

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, absolutely. There are no lock-in contracts. You can cancel your subscription at any time and you'll retain access until the end of your billing period.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "When your 14-day trial ends, you'll be prompted to choose a plan. Your data is safe — nothing is deleted. You simply won't be able to create new trips or clients until you upgrade.",
  },
  {
    question: "Can I white-label this for my agency brand?",
    answer:
      "White-label branding is available on the Enterprise plan. This includes custom colors, your agency logo, and a branded client portal experience.",
  },
  {
    question: "Do my clients need to pay anything?",
    answer:
      "No. Client portal access is completely free for your clients. They receive a beautiful, read-only view of their itinerary at no cost.",
  },
  {
    question: "Can I import my existing client data?",
    answer:
      "Yes. You can import clients via CSV upload (coming soon). Our team can also assist Enterprise customers with data migration from other platforms.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Every agency's data is fully isolated with strict multi-tenant architecture. We use industry-standard encryption and never share your data with third parties.",
  },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-4 h-4 text-primary mx-auto" strokeWidth={2} />
    ) : (
      <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" strokeWidth={2} />
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav variant="solid" />

      <section className="relative pt-32 pb-4 overflow-hidden" data-testid="section-pricing-hero">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.p
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-xs uppercase tracking-[0.3em] text-primary mb-4"
          >
            Pricing
          </motion.p>
          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4"
            data-testid="text-pricing-headline"
          >
            Simple, transparent pricing.
          </motion.h1>
          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-lg text-muted-foreground max-w-md mx-auto"
            data-testid="text-pricing-subheading"
          >
            Start free. Upgrade when you're ready.
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20" data-testid="section-plan-cards">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                custom={i + 3}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className={`relative ${plan.featured ? "md:-mt-4 md:mb-[-16px]" : ""}`}
              >
                <Card
                  className={`h-full flex flex-col ${
                    plan.featured
                      ? "border-primary/40 ring-1 ring-primary/20"
                      : ""
                  }`}
                  data-testid={`card-plan-${plan.name.toLowerCase()}`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="text-[10px] uppercase tracking-wider" data-testid="badge-most-popular">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col flex-1">
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="font-serif text-4xl">{plan.price}</span>
                      {plan.period && (
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      {plan.description}
                    </p>

                    <div className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" strokeWidth={2} />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link
                        href={plan.href}
                        data-testid={`button-plan-${plan.name.toLowerCase()}`}
                      >
                        {plan.cta}
                        {!plan.enterprise && <ArrowRight className="w-4 h-4 ml-1" />}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20" data-testid="section-comparison">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-serif text-2xl md:text-3xl tracking-tight mb-2">
              Compare plans
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know, side by side.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-comparison">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-sm font-medium p-4 w-[40%]">Feature</th>
                        <th className="text-center text-sm font-medium p-4 w-[20%]">Trial</th>
                        <th className="text-center text-sm font-medium p-4 w-[20%] bg-primary/5">
                          Pro
                        </th>
                        <th className="text-center text-sm font-medium p-4 w-[20%]">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((row, i) => (
                        <tr
                          key={row.name}
                          className={i < comparisonFeatures.length - 1 ? "border-b border-border/30" : ""}
                          data-testid={`row-comparison-${row.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <td className="text-sm p-4">{row.name}</td>
                          <td className="text-center p-4">
                            <ComparisonCell value={row.trial} />
                          </td>
                          <td className="text-center p-4 bg-primary/5">
                            <ComparisonCell value={row.pro} />
                          </td>
                          <td className="text-center p-4">
                            <ComparisonCell value={row.enterprise} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20" data-testid="section-faq">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-serif text-2xl md:text-3xl tracking-tight mb-2">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Everything else you might want to know.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border/40 rounded-md px-4"
                  data-testid={`faq-item-${i}`}
                >
                  <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-card/40 border-t border-border/30">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-serif text-2xl md:text-3xl tracking-tight mb-3">
              Start planning extraordinary journeys today.
            </h2>
            <p className="text-muted-foreground mb-8">
              No credit card required. Full access for 14 days.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup" data-testid="button-pricing-bottom-cta">
                Start your free trial
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <span className="font-serif text-sm tracking-wide uppercase text-muted-foreground">
              Travel Lab
            </span>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign up
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/30">
            <p className="text-xs text-muted-foreground/60">
              &copy; {new Date().getFullYear()} Travel Lab. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
