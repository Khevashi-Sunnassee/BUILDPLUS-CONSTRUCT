import { Building2, BookOpen, Shield } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDocumentTitle } from "@/hooks/use-document-title";
import AdminCompaniesPage from "./admin/companies";
import AdminHelpPage from "./admin/help";

export default function SuperAdminPage() {
  useDocumentTitle("Super Admin");

  return (
    <div className="space-y-6" role="main" aria-label="Super Admin">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-super-admin-title">
            Super Admin
          </h1>
        </div>
        <p className="text-muted-foreground">
          Platform-wide configuration and management
        </p>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-super-admin">
          <TabsTrigger value="companies" data-testid="tab-super-companies">
            <Building2 className="h-4 w-4 mr-1.5" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="help" data-testid="tab-super-help">
            <BookOpen className="h-4 w-4 mr-1.5" />
            Help Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-6">
          <AdminCompaniesPage embedded={true} />
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <AdminHelpPage embedded={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
