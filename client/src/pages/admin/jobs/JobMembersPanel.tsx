import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserPlus, X, Mail, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

interface JobMember {
  id: string;
  jobId: string;
  userId: string;
  invitedBy: string | null;
  invitedAt: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

interface JobMembersPanelProps {
  jobId: string;
  users: UserType[] | undefined;
}

export function JobMembersPanel({ jobId, users }: JobMembersPanelProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: members, isLoading } = useQuery<JobMember[]>({
    queryKey: ["/api/admin/jobs", jobId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/jobs/${jobId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/jobs/${jobId}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs", jobId, "members"] });
      setSelectedUserId("");
      toast({ title: "Member added", description: "User has been added to this job and an invitation email has been sent." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to add member";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/jobs/${jobId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs", jobId, "members"] });
      toast({ title: "Member removed", description: "User has been removed from this job." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    },
  });

  const memberUserIds = new Set(members?.map((m) => m.userId) || []);
  const availableUsers = (users || []).filter(
    (u) => !memberUserIds.has(u.id) && u.role !== "ADMIN"
  );

  const handleAddMember = () => {
    if (!selectedUserId) return;
    addMemberMutation.mutate(selectedUserId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Add User</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger data-testid="select-add-member">
              <SelectValue placeholder="Select a user to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">No available users</div>
              ) : (
                availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id} data-testid={`member-option-${user.id}`}>
                    {user.name || user.email} ({user.role})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={handleAddMember}
          disabled={!selectedUserId || addMemberMutation.isPending}
          data-testid="button-add-member"
        >
          {addMemberMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Add Member
        </Button>
      </div>

      {(!members || members.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mb-2" />
          <p className="text-sm">No members added yet</p>
          <p className="text-xs">Add users to give them access to this job's documents</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} data-testid={`member-row-${member.userId}`}>
                <TableCell className="font-medium">{member.userName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{member.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.userRole}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(member.invitedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMemberMutation.mutate(member.userId)}
                    disabled={removeMemberMutation.isPending}
                    data-testid={`button-remove-member-${member.userId}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-muted-foreground">
        Admins and Managers always have access to all jobs. Adding members here controls document access for other users.
      </p>
    </div>
  );
}