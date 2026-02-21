import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TrialBanner } from "@/components/trial-banner";
import { NotificationBell } from "@/components/notification-bell";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import PricingPage from "@/pages/pricing";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import TripsPage from "@/pages/trips";
import TripDetailPage from "@/pages/trip-detail";
import TripNewPage from "@/pages/trip-new";
import TripEditPage from "@/pages/trip-edit";
import TripViewPage from "@/pages/trip-view";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import SettingsPage from "@/pages/settings";
import AnalyticsPage from "@/pages/analytics";
import MessagesPage from "@/pages/messages";
import TemplatesPage from "@/pages/templates";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import SetPasswordPage from "@/pages/auth/set-password";
import type { Profile } from "@shared/schema";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/set-password"];
const ALWAYS_PUBLIC_ROUTES = ["/pricing"];

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/dashboard/messages" component={MessagesPage} />
      <Route path="/dashboard/analytics" component={AnalyticsPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/trips" component={TripsPage} />
      <Route path="/trips/new" component={TripNewPage} />
      <Route path="/trips/:id/edit" component={TripEditPage} />
      <Route path="/trips/:id" component={TripDetailPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:id" component={ClientDetailPage} />
      <Route path="/templates" component={TemplatesPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const isMobile = useIsMobile();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full">
        <OfflineBanner />
        <TrialBanner />
        <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-sm" data-testid="text-mobile-app-name">Travel Lab</span>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-hidden flex flex-col pb-14">
          <AuthenticatedRoutes />
        </main>
        <MobileTabBar />
        <PwaInstallPrompt />
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <OfflineBanner />
          <TrialBanner />
          <header className="flex items-center justify-between gap-3 p-3 border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-hidden flex flex-col">
            <AuthenticatedRoutes />
          </main>
        </div>
      </div>
      <PwaInstallPrompt />
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!user,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (ALWAYS_PUBLIC_ROUTES.some(r => location.startsWith(r))) {
    return (
      <Switch>
        <Route path="/pricing" component={PricingPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (AUTH_ROUTES.some(r => location.startsWith(r))) {
    if (user) {
      navigate("/dashboard", { replace: true });
      return null;
    }
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/set-password" component={SetPasswordPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (location.startsWith("/trip/") && !location.startsWith("/trips")) {
    return (
      <Switch>
        <Route path="/trip/:id" component={TripViewPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (!user) {
    if (location === "/" || location === "") {
      return <LandingPage />;
    }
    navigate("/login", { replace: true });
    return null;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    if (location !== "/onboarding") {
      navigate("/onboarding", { replace: true });
      return null;
    }
    return <OnboardingPage />;
  }

  if (location === "/" || location === "" || location === "/onboarding") {
    navigate("/dashboard", { replace: true });
    return null;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
