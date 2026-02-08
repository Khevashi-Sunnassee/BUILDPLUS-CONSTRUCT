import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Building2 } from "lucide-react";
import { SETTINGS_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";

type LoginFormData = z.infer<typeof loginSchema>;

export default function MobileLoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const logoSrc = logoData?.logoBase64 || null;

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      setLocation("/mobile/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#070B12] text-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" as any }}>
        <div className="w-full max-w-[390px] mx-auto space-y-8">
          <div className="flex flex-col items-center gap-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="BuildPlusAI"
                className="h-14 object-contain"
                data-testid="img-mobile-login-logo"
              />
            ) : (
              <div className="flex items-center gap-2" data-testid="img-mobile-login-logo">
                <Building2 className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-white">
                  BuildPlus<span className="text-primary">AI</span>
                </span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-white" data-testid="text-login-title">
              Performance Management
            </h1>
            <p className="text-sm text-white/50">
              Sign in to continue
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70" htmlFor="mobile-email">
                Email
              </label>
              <input
                id="mobile-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                data-testid="input-mobile-email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70" htmlFor="mobile-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="mobile-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 pr-12 text-base text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  data-testid="input-mobile-password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-white/40"
                  data-testid="button-mobile-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-blue-600 text-base font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
              data-testid="button-mobile-login"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/30">
            Melbourne Time Zone (Australia/Melbourne)
          </p>
        </div>
      </div>
    </div>
  );
}
