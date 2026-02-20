import { TabsContent } from "@/components/ui/tabs";
import AdminFactoriesPage from "../factories";

export function FactoriesTab() {
  return (
    <TabsContent value="factories" className="space-y-6">
      <AdminFactoriesPage embedded={true} />
    </TabsContent>
  );
}
