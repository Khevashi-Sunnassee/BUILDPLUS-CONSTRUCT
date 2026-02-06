import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Factory as FactoryIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Factory } from "@shared/schema";
import { ADMIN_ROUTES, USER_ROUTES, PRODUCTION_ROUTES, DRAFTING_ROUTES } from "@shared/api-routes";

interface UserSettings {
  selectedFactoryIds: string[];
  defaultFactoryId: string | null;
}

export function UserSettingsPopover() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [defaultFactoryId, setDefaultFactoryId] = useState<string | null>(null);

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  useEffect(() => {
    if (settings?.selectedFactoryIds) {
      setSelectedIds(settings.selectedFactoryIds);
    }
    if (settings?.defaultFactoryId !== undefined) {
      setDefaultFactoryId(settings.defaultFactoryId);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { selectedFactoryIds: string[]; defaultFactoryId: string | null }) => {
      return apiRequest("PUT", USER_ROUTES.SETTINGS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      toast({
        title: "Settings saved",
        description: "Your factory view preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  const handleToggleFactory = (factoryId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(factoryId)) {
        return prev.filter((id) => id !== factoryId);
      }
      return [...prev, factoryId];
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(factories.map((f) => f.id));
  };

  const handleSelectNone = () => {
    setSelectedIds([]);
  };

  const handleSave = () => {
    let finalSelectedIds = selectedIds;
    if (defaultFactoryId && !finalSelectedIds.includes(defaultFactoryId) && finalSelectedIds.length > 0) {
      finalSelectedIds = [...finalSelectedIds, defaultFactoryId];
      setSelectedIds(finalSelectedIds);
    }
    updateSettingsMutation.mutate({ selectedFactoryIds: finalSelectedIds, defaultFactoryId });
    setOpen(false);
  };

  const activeFactories = factories.filter((f) => f.isActive);
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === 0 || selectedCount === activeFactories.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          data-testid="button-user-settings"
          className="relative"
        >
          <Settings2 className="h-5 w-5" />
          {!allSelected && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FactoryIcon className="h-5 w-5" />
            <h4 className="font-medium">Factory View Settings</h4>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Default Factory</Label>
            <Select
              value={defaultFactoryId || "none"}
              onValueChange={(val) => setDefaultFactoryId(val === "none" ? null : val)}
            >
              <SelectTrigger data-testid="select-default-factory">
                <SelectValue placeholder="Select default factory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default</SelectItem>
                {activeFactories.map((factory) => (
                  <SelectItem key={factory.id} value={factory.id}>
                    {factory.name} ({factory.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-selects this factory on production schedule and other pages.
            </p>
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm font-medium">Factory View Filter</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Select which factories to show across production slots, drafting program, and other views. 
            Leave all unchecked to show all factories.
          </p>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              data-testid="button-select-all-factories"
            >
              All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectNone}
              data-testid="button-select-none-factories"
            >
              None
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {activeFactories.map((factory) => (
              <div key={factory.id} className="flex items-center gap-2">
                <Checkbox
                  id={`factory-${factory.id}`}
                  checked={selectedIds.includes(factory.id)}
                  onCheckedChange={() => handleToggleFactory(factory.id)}
                  data-testid={`checkbox-factory-${factory.id}`}
                />
                <Label 
                  htmlFor={`factory-${factory.id}`} 
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: factory.color ? `${factory.color}20` : undefined,
                      borderColor: factory.color || undefined,
                      color: factory.color || undefined,
                    }}
                  >
                    {factory.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">({factory.code})</span>
                </Label>
              </div>
            ))}
            {activeFactories.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No factories configured.</p>
            )}
          </div>

          <Button 
            onClick={handleSave} 
            className="w-full"
            disabled={updateSettingsMutation.isPending}
            data-testid="button-save-factory-settings"
          >
            {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
