import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SETTINGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroImage from "@/assets/images/hero-construction.png";
import {
  BarChart3,
  ClipboardCheck,
  Truck,
  Shield,
  Smartphone,
  FileText,
  ArrowRight,
  Building2,
  Users,
  Clock,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";

const features = [
  {
    id: "kpi",
    icon: BarChart3,
    title: "KPI Dashboard",
    description:
      "Real-time production metrics, financial insights, and performance tracking across all your projects.",
  },
  {
    id: "quality",
    icon: ClipboardCheck,
    title: "Quality Management",
    description:
      "Digital checklists, panel tracking through 14 production stages, and approval workflows.",
  },
  {
    id: "logistics",
    icon: Truck,
    title: "Logistics & Delivery",
    description:
      "Load list management, delivery tracking, and real-time logistics coordination.",
  },
  {
    id: "documents",
    icon: FileText,
    title: "Document Control",
    description:
      "Version-controlled document register, bundles, and AI-powered document analysis.",
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Mobile Ready",
    description:
      "Full mobile experience with QR scanning, photo capture, and on-site data entry.",
  },
  {
    id: "security",
    icon: Shield,
    title: "Enterprise Security",
    description:
      "Role-based access control, audit logging, and secure session management.",
  },
];

const stats = [
  { id: "stages", value: "14", label: "Production Stages" },
  { id: "fields", value: "50+", label: "Asset Fields" },
  { id: "categories", value: "40+", label: "Asset Categories" },
  { id: "tracking", value: "24/7", label: "Real-time Tracking" },
];

export default function LandingPage() {
  useDocumentTitle("Welcome");
  const [, setLocation] = useLocation();

  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  useEffect(() => {
    document.title = "BuildPlus Ai - Construction Performance Management";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "The complete platform for precast concrete production management. Track panels, manage logistics, and drive performance with AI-powered insights."
    );

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", "BuildPlus Ai - Build Smarter. Deliver Faster.");

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute(
      "content",
      "The complete platform for precast concrete production management. Track panels, manage logistics, and drive performance with AI-powered insights."
    );

    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement("meta");
      ogType.setAttribute("property", "og:type");
      document.head.appendChild(ogType);
    }
    ogType.setAttribute("content", "website");
  }, []);

  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3 h-8" data-testid="text-brand-logo">
              {logoData?.logoBase64 && (
                <img src={logoData.logoBase64} alt="Company Logo" className="h-8 w-auto object-contain" data-testid="img-brand-logo" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/login")}
                data-testid="button-header-login"
              >
                Login
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative pt-16 overflow-hidden" role="main">
        <div className="absolute inset-0 mt-16">
          <img
            src={heroImage}
            alt="Modern construction site"
            className="w-full h-full object-cover"
            data-testid="img-hero-background"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-white/10 backdrop-blur-sm px-3 py-1.5 text-sm text-white/90 mb-6" data-testid="text-hero-tagline">
              <Clock className="h-3.5 w-3.5" />
              Construction Performance Management
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight" data-testid="text-hero-heading">
              Build Smarter.<br />
              Deliver Faster.
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-xl leading-relaxed" data-testid="text-hero-description">
              The complete platform for precast concrete production management.
              Track panels, manage logistics, and drive performance with
              AI-powered insights.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={() => setLocation("/login")}
                data-testid="button-hero-login"
              >
                Login to Your Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.id}
              className="p-5 text-center"
              data-testid={`card-stat-${stat.id}`}
            >
              <div className="text-2xl sm:text-3xl font-bold text-primary" data-testid={`text-stat-value-${stat.id}`}>
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1" data-testid={`text-stat-label-${stat.id}`}>
                {stat.label}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight" data-testid="text-features-heading">
            Everything You Need to Manage Production
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description">
            From drafting schedules to delivery tracking, our platform gives your
            team the tools to stay on time and on budget.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.id}
              className="p-6 hover-elevate"
              data-testid={`card-feature-${feature.id}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground" data-testid={`text-feature-title-${feature.id}`}>
                  {feature.title}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-feature-desc-${feature.id}`}>
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight" data-testid="text-cta-heading">
                Ready to get started?
              </h2>
              <p className="mt-2 text-muted-foreground" data-testid="text-cta-description">
                Log in to access your production management dashboard.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setLocation("/login")}
              data-testid="button-cta-login"
            >
              <Users className="mr-2 h-4 w-4" />
              Login
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 h-6" data-testid="text-footer-brand">
              {logoData?.logoBase64 && (
                <img src={logoData.logoBase64} alt="Company Logo" className="h-6 w-auto object-contain" />
              )}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-footer-url">
              BuildPlus Ai
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
