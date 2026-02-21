import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, BookOpen, Shield, Database } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import AdminCompaniesPage from "./admin/companies";
import AdminHelpPage from "./admin/help";
import DataManagementPage from "./admin/data-management";

interface Company {
  id: string;
  name: string;
}

export default function SuperAdminPage() {
  useDocumentTitle("Super Admin");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

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
          <TabsTrigger value="data-management" data-testid="tab-super-data-management">
            <Database className="h-4 w-4 mr-1.5" />
            Data Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-6">
          <AdminCompaniesPage embedded={true} />
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <AdminHelpPage embedded={true} />
        </TabsContent>

        <TabsContent value="data-management" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Select Company
              </CardTitle>
              <CardDescription>
                Choose a company to view and manage its data records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-full max-w-md" data-testid="select-company-data-mgmt">
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id} data-testid={`option-company-${company.id}`}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedCompanyId ? (
            <DataManagementPage embedded={true} companyId={selectedCompanyId} key={selectedCompanyId} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Database className="h-10 w-10 mb-3" />
                <p className="text-sm">Select a company above to manage its data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
