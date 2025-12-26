import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  progress?: number;
}

interface StepVisualizerProps {
  steps: PipelineStep[];
  className?: string;
}

const stepIcons = {
  pending: Circle,
  running: Loader2,
  done: Check,
  failed: AlertCircle,
};

const stepColors = {
  pending: "text-muted-foreground",
  running: "text-primary",
  done: "text-green-500",
  failed: "text-destructive",
};

const stepBgColors = {
  pending: "bg-muted",
  running: "bg-primary/10",
  done: "bg-green-500/10",
  failed: "bg-destructive/10",
};

export function StepVisualizer({ steps, className }: StepVisualizerProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="step-visualizer">
      <AnimatePresence mode="popLayout">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.status];
          const isActive = step.status === "running";
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                stepBgColors[step.status]
              )}
              data-testid={`step-${step.id}`}
            >
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                step.status === "done" ? "bg-green-500" : 
                step.status === "failed" ? "bg-destructive" :
                step.status === "running" ? "bg-primary" : "bg-muted-foreground/20"
              )}>
                <Icon 
                  className={cn(
                    "w-4 h-4",
                    step.status === "done" || step.status === "failed" || step.status === "running" 
                      ? "text-white" 
                      : "text-muted-foreground",
                    isActive && "animate-spin"
                  )} 
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  stepColors[step.status]
                )}>
                  {step.label}
                </p>
                
                {isActive && step.progress !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-1"
                  >
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${step.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>
              
              {step.status === "done" && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-green-600 font-medium"
                >
                  Complete
                </motion.span>
              )}
              
              {step.status === "failed" && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-destructive font-medium"
                >
                  Failed
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const DEFAULT_PIPELINE_STEPS: PipelineStep[] = [
  { id: "prepare", label: "Preparing", status: "pending" },
  { id: "theme", label: "Finding theme", status: "pending" },
  { id: "entities", label: "Extracting characters and places", status: "pending" },
  { id: "planning", label: "Planning cards", status: "pending" },
  { id: "drafting", label: "Drafting", status: "pending" },
  { id: "qa", label: "Quality check", status: "pending" },
];

export function mapPipelineStageToSteps(currentStage: number, stageStatuses: Record<string, string>): PipelineStep[] {
  const statusMap: Record<string, StepStatus> = {
    pending: "pending",
    running: "running", 
    done: "done",
    failed: "failed",
  };
  
  return [
    { id: "prepare", label: "Preparing", status: statusMap[stageStatuses.stage0] || "pending" },
    { id: "theme", label: "Finding theme", status: statusMap[stageStatuses.stage1] || "pending" },
    { id: "entities", label: "Extracting characters and places", status: statusMap[stageStatuses.stage2] || "pending" },
    { id: "planning", label: "Planning cards", status: statusMap[stageStatuses.stage3] || "pending" },
    { id: "drafting", label: "Drafting", status: statusMap[stageStatuses.stage4] || "pending" },
    { id: "qa", label: "Quality check", status: statusMap[stageStatuses.stage5] || "pending" },
  ];
}
