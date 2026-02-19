import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing-nav";
import { ArrowRight, Check } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: "easeOut" } },
};

const features = [
  {
    label: "Itinerary Builder",
    title: "Build itineraries your clients will treasure.",
    description:
      "Design stunning day-by-day timelines with rich segment types, cover images, and personalized notes. Every itinerary becomes a keepsake your clients will return to long after they've unpacked.",
    image: "/images/feature-itinerary.png",
  },
  {
    label: "Client Portal",
    title: "A private travel portal, just for them.",
    description:
      "Give each client a beautiful, read-only view of their upcoming journey. They'll see every detail — flights, hotels, experiences — presented with the same care you put into planning it.",
    image: "/images/feature-portal.png",
  },
  {
    label: "Multi-Advisor Teams",
    title: "Built for agencies, not just solo advisors.",
    description:
      "Manage your team with flexible roles, shared client rosters, and org-wide visibility. Everyone stays aligned while maintaining their own client relationships.",
    image: "/images/feature-team.png",
  },
  {
    label: "Export & Share",
    title: "PDF itineraries. Calendar exports. One tap.",
    description:
      "Generate polished PDF documents your clients can print or save. Push trips straight to their calendar so every reservation and transfer is right where they need it.",
    image: "/images/feature-export.png",
  },
];

const logoPlaceholders = [
  "Wanderlust Co.",
  "Magellan Travel",
  "Azure Voyages",
  "Meridian Luxe",
  "Pinnacle Journeys",
  "Atlas & Co.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="relative min-h-[90vh] flex items-center overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src="/images/hero-editorial.png"
            alt="Luxury coastal destination"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-32 md:py-40 w-full">
          <div className="max-w-2xl">
            <motion.p
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="text-xs uppercase tracking-[0.3em] text-white/60 mb-6"
            >
              For luxury travel advisors
            </motion.p>

            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.1] tracking-tight text-white mb-6"
              data-testid="text-hero-headline"
            >
              The itinerary platform your clients will never forget.
            </motion.h1>

            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="text-lg md:text-xl text-white/70 leading-relaxed max-w-lg mb-10"
              data-testid="text-hero-subheading"
            >
              Design extraordinary travel experiences, manage your clients, and
              grow your agency — all in one refined workspace.
            </motion.p>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap items-center gap-4"
            >
              <Button size="lg" asChild>
                <Link href="/signup" data-testid="button-hero-cta">
                  Start free trial
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white"
                asChild
              >
                <a href="#features" data-testid="button-hero-secondary">
                  See a sample itinerary
                </a>
              </Button>
            </motion.div>

            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex items-center gap-6 mt-8 text-sm text-white/50"
            >
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                No credit card required
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-10 border-b border-border/40" data-testid="section-social-proof">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={fadeIn}
            className="text-center"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8">
              Trusted by luxury travel advisors in 12 countries
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {logoPlaceholders.map((name) => (
                <span
                  key={name}
                  className="text-sm font-serif text-muted-foreground/50 tracking-wide"
                  data-testid={`text-logo-${name.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  {name}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-28" data-testid="section-features">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-20"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Platform</p>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
              Everything your agency needs
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">
              A refined suite of tools designed to elevate your travel advisory practice.
            </p>
          </motion.div>

          <div className="space-y-24 md:space-y-32">
            {features.map((feature, i) => {
              const isEven = i % 2 === 0;
              return (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6 }}
                  className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
                    isEven ? "" : "md:[direction:rtl]"
                  }`}
                  data-testid={`feature-section-${i}`}
                >
                  <div className={isEven ? "" : "md:[direction:ltr]"}>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">
                      {feature.label}
                    </p>
                    <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl tracking-tight mb-4 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
                      {feature.description}
                    </p>
                  </div>
                  <div className={isEven ? "" : "md:[direction:ltr]"}>
                    <div className="relative rounded-md overflow-hidden ring-1 ring-border/30">
                      <img
                        src={feature.image}
                        alt={feature.label}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-card/40 border-t border-border/30" data-testid="section-cta">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
              Ready to elevate your practice?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Join hundreds of luxury travel advisors already using Travel Lab to delight their clients.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup" data-testid="button-cta-trial">
                  Start your free trial
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/pricing" data-testid="button-cta-pricing">
                  View pricing
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-10" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <span className="font-serif text-sm tracking-wide uppercase text-muted-foreground">
              Travel Lab
            </span>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-pricing">
                Pricing
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-login">
                Log in
              </Link>
              <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-signup">
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
