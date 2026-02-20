import {
  ClipboardCheck, CheckCircle2, AlertTriangle, SkipForward, Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { statusLabel } from "./types";
import type { OnboardingTabProps } from "./types";

export function OnboardingTab({ onboardings, onboardingsLoading, employments, onStartOnboarding, onUpdateTask }: OnboardingTabProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold" data-testid="text-onboarding-title">Onboarding</h2>
        <Button onClick={onStartOnboarding} data-testid="button-start-onboarding">
          <Play className="h-4 w-4 mr-2" />
          Start Onboarding
        </Button>
      </div>
      {onboardingsLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !onboardings || onboardings.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-onboarding">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No onboarding records yet</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        onboardings.map((ob: any) => {
          const totalTasks = ob.tasks?.length || 0;
          const completedTasks = ob.tasks?.filter((t: any) => t.status === "complete").length || 0;
          const progressValue = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const employment = employments?.find((e) => e.id === ob.employmentId);
          return (
            <Card key={ob.id} data-testid={`card-onboarding-${ob.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-base">
                  {employment?.positionTitle || "Employment"}{" "}
                  {employment?.startDate ? `(${employment.startDate})` : ""}
                </CardTitle>
                <Badge
                  variant={
                    ob.status === "not_started" ? "secondary"
                    : ob.status === "blocked" ? "destructive"
                    : ob.status === "ready_to_start" ? "outline"
                    : ob.status === "complete" ? "default"
                    : ob.status === "withdrawn" ? "secondary"
                    : "default"
                  }
                  className={ob.status === "complete" ? "bg-green-600 text-white" : ""}
                  data-testid={`badge-onboarding-status-${ob.id}`}
                >
                  {statusLabel(ob.status || "not_started")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Progress</span>
                    <span data-testid={`text-onboarding-progress-${ob.id}`}>{completedTasks} / {totalTasks} tasks</span>
                  </div>
                  <Progress value={progressValue} data-testid={`progress-onboarding-${ob.id}`} />
                </div>
                {totalTasks > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ob.tasks.map((task: any) => (
                        <TableRow key={task.id} data-testid={`row-onboarding-task-${task.id}`}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                task.owner === "employee" ? "secondary"
                                : task.owner === "supervisor" ? "outline"
                                : task.owner === "hr" ? "default"
                                : "secondary"
                              }
                              data-testid={`badge-task-owner-${task.id}`}
                            >
                              {statusLabel(task.owner || "employee")}
                            </Badge>
                          </TableCell>
                          <TableCell>{task.dueDate || "-"}</TableCell>
                          <TableCell>
                            {task.status === "complete" ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-task-status-${task.id}`}>
                                  Complete
                                </Badge>
                                {task.completedAt && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    {new Date(task.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant={
                                  task.status === "pending" ? "secondary"
                                  : task.status === "in_progress" ? "default"
                                  : task.status === "blocked" ? "destructive"
                                  : task.status === "skipped" ? "outline"
                                  : "secondary"
                                }
                                data-testid={`badge-task-status-${task.id}`}
                              >
                                {statusLabel(task.status || "pending")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {task.status !== "complete" && task.status !== "skipped" && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onUpdateTask({ onboardingId: ob.id, taskId: task.id, data: { status: "complete" } })}
                                  data-testid={`button-complete-task-${task.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onUpdateTask({ onboardingId: ob.id, taskId: task.id, data: { status: "blocked" } })}
                                  data-testid={`button-block-task-${task.id}`}
                                >
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onUpdateTask({ onboardingId: ob.id, taskId: task.id, data: { status: "skipped" } })}
                                  data-testid={`button-skip-task-${task.id}`}
                                >
                                  <SkipForward className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
