import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Compass, Globe, Shield, ArrowRight, MapPin, Star } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const heroImages = [
  "/images/hero-santorini.png",
  "/images/hero-maldives.png",
  "/images/hero-kyoto.png",
];

const features = [
  {
    icon: Compass,
    title: "Itinerary Design",
    description: "Craft bespoke travel experiences with an elegant planning interface built for discerning advisors.",
  },
  {
    icon: Globe,
    title: "Client Management",
    description: "Organize your client portfolio with profiles, preferences, and trip histories in one refined workspace.",
  },
  {
    icon: Shield,
    title: "Agency Platform",
    description: "Multi-tenant architecture keeps every agency's data secure, private, and beautifully organized.",
  },
];

const destinations = [
  { name: "Santorini", country: "Greece", image: "/images/hero-santorini.png" },
  { name: "Maldives", country: "Indian Ocean", image: "/images/hero-maldives.png" },
  { name: "Kyoto", country: "Japan", image: "/images/hero-kyoto.png" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-xl tracking-tight" data-testid="text-logo">Travel Lab</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground transition-colors duration-200" data-testid="link-features">Features</a>
            <a href="#destinations" className="text-sm text-muted-foreground transition-colors duration-200" data-testid="link-destinations">Destinations</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors duration-200" data-testid="link-pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <a href="/api/login" data-testid="button-login">Sign In</a>
            </Button>
            <Button asChild>
              <a href="/api/login" data-testid="button-get-started">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <motion.div
                custom={0}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/50 text-xs text-muted-foreground mb-6"
              >
                <Star className="w-3 h-3 text-primary" strokeWidth={1.5} />
                <span>Built for luxury travel agencies</span>
              </motion.div>

              <motion.h1
                custom={1}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.08] tracking-tight mb-6"
              >
                Where travel
                <br />
                becomes <span className="italic text-primary/90">art</span>
              </motion.h1>

              <motion.p
                custom={2}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="text-lg text-muted-foreground leading-relaxed max-w-md mb-8"
              >
                The all-in-one platform for travel advisors who craft extraordinary journeys. Manage clients, design itineraries, and grow your agency.
              </motion.p>

              <motion.div
                custom={3}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="flex flex-wrap items-center gap-3"
              >
                <Button size="lg" asChild>
                  <a href="/api/login" data-testid="button-hero-cta">
                    Start Your Free Trial
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#features" data-testid="button-learn-more">Learn More</a>
                </Button>
              </motion.div>

              <motion.div
                custom={4}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="flex items-center gap-6 mt-8 text-xs text-muted-foreground"
              >
                <span>14-day free trial</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span>No credit card required</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative hidden lg:block"
            >
              <div className="relative aspect-[4/3] rounded-md overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                <img
                  src={heroImages[0]}
                  alt="Luxury travel destination"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Featured Destination</p>
                  <p className="font-serif text-2xl">Santorini, Greece</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Platform</p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">Everything your agency needs</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A refined suite of tools designed to elevate your travel advisory practice.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group p-6 rounded-md border border-border/50 bg-card/50 hover-elevate"
                data-testid={`card-feature-${i}`}
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="destinations" className="py-20 md:py-28 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Inspiration</p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">Curated destinations</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              From Mediterranean sunsets to Asian serenity, plan trips to the world's most extraordinary places.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            {destinations.map((dest, i) => (
              <motion.div
                key={dest.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative aspect-[3/4] rounded-md overflow-hidden"
                data-testid={`card-destination-${i}`}
              >
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-xs uppercase tracking-widest opacity-70 mb-1">{dest.country}</p>
                  <p className="font-serif text-xl">{dest.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Pricing</p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">Simple, transparent plans</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Start free and scale as your agency grows.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Trial", price: "Free", period: "14 days", advisors: "3 advisors", clients: "50 clients", trips: "20 trips" },
              { name: "Pro", price: "$49", period: "/month", advisors: "10 advisors", clients: "500 clients", trips: "Unlimited trips", featured: true },
              { name: "Enterprise", price: "Custom", period: "", advisors: "Unlimited", clients: "Unlimited", trips: "Unlimited", enterprise: true },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`p-6 rounded-md border ${plan.featured ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-card/50'}`}
                data-testid={`card-pricing-${plan.name.toLowerCase()}`}
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-serif text-3xl">{plan.price}</span>
                  {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                </div>
                <div className="space-y-2 mb-6">
                  {[plan.advisors, plan.clients, plan.trips].map((feature, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground">{feature}</p>
                  ))}
                </div>
                <Button
                  variant={plan.featured ? "default" : "outline"}
                  className="w-full"
                  asChild
                >
                  <a href="/api/login" data-testid={`button-pricing-${plan.name.toLowerCase()}`}>
                    {plan.enterprise ? "Contact Us" : "Get Started"}
                  </a>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-sm">Travel Lab</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Travel Lab. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
