import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Building2, CheckCircle2, AlertCircle, UserPlus } from "lucide-react";
import { INVITATION_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const registrationSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const logoSrc = logoData?.logoBase64 || null;

  const { data: inviteData, isLoading: validating, error: validateError } = useQuery<{
    valid: boolean;
    email: string;
    companyName: string;
    role: string;
    userType: string;
  }>({
    queryKey: [INVITATION_ROUTES.VALIDATE(token)],
    enabled: !!token,
    retry: false,
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      const res = await fetch(INVITATION_ROUTES.REGISTER(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(errData.error || "Registration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setRegistered(true);
      toast({
        title: "Account created",
        description: "Your account has been set up. You can now sign in.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Registration failed",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    registerMutation.mutate(data);
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="main" aria-label="Register">
        <div className="flex flex-col items-center gap-4" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (validateError || !inviteData?.valid) {
    const errorMessage = validateError instanceof Error ? validateError.message : "This invitation link is invalid or has expired.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="main" aria-label="Register">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 mb-4 flex items-center justify-center">
              {logoSrc && <img src={logoSrc} alt="Company Logo" className="h-16 object-contain" />}
            </div>
          </div>
          <Card data-testid="card-invitation-invalid">
            <CardContent className="p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Invalid Invitation</h2>
              <p className="text-muted-foreground" role="alert" aria-live="assertive">{errorMessage}</p>
              <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-go-to-login">
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="main" aria-label="Register">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 mb-4 flex items-center justify-center">
              {logoSrc && <img src={logoSrc} alt="Company Logo" className="h-16 object-contain" />}
            </div>
          </div>
          <Card data-testid="card-registration-success">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h2 className="text-xl font-semibold">Account Created</h2>
              <p className="text-muted-foreground">
                Your account has been set up for <strong>{inviteData.companyName}</strong>. You can now sign in with your email and password.
              </p>
              <Button onClick={() => setLocation("/login")} data-testid="button-go-to-login-after-register">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background" role="main" aria-label="Register">
      <div className="w-full max-w-md mx-auto p-4 py-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 mb-4 flex items-center justify-center" data-testid="img-register-logo">
            {logoSrc && <img src={logoSrc} alt="Company Logo" className="h-16 object-contain" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set Up Your Account</h1>
          <p className="text-muted-foreground mt-1">Complete your profile to get started</p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Registration
            </CardTitle>
            <CardDescription>
              Joining <strong>{inviteData.companyName}</strong> as {inviteData.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-label="Registration form">
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground" data-testid="text-invite-info">
                  <p>Company: <strong className="text-foreground">{inviteData.companyName}</strong></p>
                  <p>Email: <strong className="text-foreground">{inviteData.email}</strong></p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          autoComplete="name"
                          aria-required="true"
                          data-testid="input-register-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="Enter your phone number"
                          autoComplete="tel"
                          aria-required="true"
                          data-testid="input-register-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your address"
                          autoComplete="street-address"
                          aria-required="true"
                          data-testid="input-register-address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a password (min 6 characters)"
                            autoComplete="new-password"
                            aria-required="true"
                            data-testid="input-register-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-register-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            autoComplete="new-password"
                            aria-required="true"
                            data-testid="input-register-confirm-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            data-testid="button-toggle-register-confirm-password"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register-submit"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline" data-testid="link-go-to-login">
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
