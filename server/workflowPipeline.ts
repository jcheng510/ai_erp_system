import { getDb } from "./db";
import { getWorkflowEngine } from "./autonomousWorkflowEngine";
import {
  supplyChainWorkflows,
  workflowRuns,
  supplyChainEvents,
} from "../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { WorkflowResult } from "./autonomousWorkflowEngine";

// ============================================
// WORKFLOW PIPELINE ENGINE
// DAG-based orchestration for multi-stage
// supply chain automation
// ============================================

export interface PipelineStage {
  workflowType: string;
  dependsOn: string[];           // workflow types this stage depends on
  canRunParallelWith?: string[];  // stages that can run concurrently
  forwardOutputAs?: string;       // key name to pass output to next stage
  condition?: (prevResults: Map<string, WorkflowResult>) => boolean;
}

export interface PipelineDefinition {
  name: string;
  description: string;
  stages: PipelineStage[];
}

export interface PipelineRunResult {
  pipelineId: string;
  success: boolean;
  stagesCompleted: number;
  stagesTotal: number;
  stageResults: Map<string, WorkflowResult>;
  failedStage?: string;
  duration: number;
  awaitingApproval: string[];
}

// ============================================
// PREDEFINED SUPPLY CHAIN PIPELINES
// ============================================

export const SUPPLY_CHAIN_PIPELINES: Record<string, PipelineDefinition> = {
  // Full plan-to-produce pipeline
  plan_to_produce: {
    name: "Plan-to-Produce",
    description: "End-to-end planning: forecast → production plan → MRP → work orders → scheduling",
    stages: [
      { workflowType: "demand_forecasting", dependsOn: [], forwardOutputAs: "forecasts" },
      { workflowType: "production_planning", dependsOn: ["demand_forecasting"], forwardOutputAs: "plans" },
      { workflowType: "material_requirements", dependsOn: ["production_planning"], forwardOutputAs: "requirements" },
      { workflowType: "work_order_generation", dependsOn: ["production_planning"], forwardOutputAs: "workOrders" },
      { workflowType: "production_scheduling", dependsOn: ["work_order_generation"] },
    ],
  },

  // Procure-to-pay pipeline
  procure_to_pay: {
    name: "Procure-to-Pay",
    description: "MRP → procurement → invoice matching → payment",
    stages: [
      { workflowType: "material_requirements", dependsOn: [], forwardOutputAs: "requirements" },
      { workflowType: "procurement", dependsOn: ["material_requirements"], forwardOutputAs: "purchaseOrders" },
      { workflowType: "invoice_matching", dependsOn: ["procurement"], forwardOutputAs: "matchedInvoices" },
      { workflowType: "payment_processing", dependsOn: ["invoice_matching"] },
    ],
  },

  // Order-to-cash pipeline
  order_to_cash: {
    name: "Order-to-Cash",
    description: "Order fulfillment → shipping → tracking",
    stages: [
      { workflowType: "order_fulfillment", dependsOn: [], forwardOutputAs: "fulfilledOrders" },
      { workflowType: "freight_procurement", dependsOn: ["order_fulfillment"], canRunParallelWith: ["shipment_tracking"] },
      { workflowType: "shipment_tracking", dependsOn: ["order_fulfillment"] },
    ],
  },

  // Inventory optimization pipeline
  inventory_optimization: {
    name: "Inventory Optimization",
    description: "Reorder check → transfers → optimization analysis",
    stages: [
      { workflowType: "inventory_reorder", dependsOn: [], canRunParallelWith: ["inventory_transfer"] },
      { workflowType: "inventory_transfer", dependsOn: [] },
      { workflowType: "inventory_optimization", dependsOn: ["inventory_reorder", "inventory_transfer"] },
    ],
  },

  // Daily operations pipeline
  daily_operations: {
    name: "Daily Operations",
    description: "Complete daily cycle: forecast → plan → fulfill → track → reconcile",
    stages: [
      { workflowType: "demand_forecasting", dependsOn: [], forwardOutputAs: "forecasts" },
      { workflowType: "production_planning", dependsOn: ["demand_forecasting"], forwardOutputAs: "plans" },
      { workflowType: "inventory_reorder", dependsOn: [], canRunParallelWith: ["demand_forecasting"] },
      { workflowType: "order_fulfillment", dependsOn: [], canRunParallelWith: ["demand_forecasting"] },
      { workflowType: "shipment_tracking", dependsOn: [], canRunParallelWith: ["demand_forecasting"] },
      { workflowType: "material_requirements", dependsOn: ["production_planning"] },
      { workflowType: "work_order_generation", dependsOn: ["production_planning"] },
      { workflowType: "production_scheduling", dependsOn: ["work_order_generation"] },
      { workflowType: "invoice_matching", dependsOn: [], canRunParallelWith: ["demand_forecasting"] },
      { workflowType: "exception_handling", dependsOn: [] },
    ],
  },
};

// ============================================
// PIPELINE EXECUTOR
// ============================================

export class PipelineExecutor {
  private db: any;

  async initialize(): Promise<void> {
    this.db = await getDb();
  }

  /**
   * Execute a complete pipeline using topological ordering.
   * Stages with satisfied dependencies run in parallel.
   */
  async executePipeline(
    pipelineId: string,
    inputData: Record<string, any> = {},
    userId?: number
  ): Promise<PipelineRunResult> {
    if (!this.db) await this.initialize();

    const pipeline = SUPPLY_CHAIN_PIPELINES[pipelineId];
    if (!pipeline) {
      return {
        pipelineId,
        success: false,
        stagesCompleted: 0,
        stagesTotal: 0,
        stageResults: new Map(),
        failedStage: "unknown_pipeline",
        duration: 0,
        awaitingApproval: [],
      };
    }

    console.log(`[Pipeline] Starting pipeline: ${pipeline.name} (${pipeline.stages.length} stages)`);
    const startTime = Date.now();

    // Topologically sort and group stages into execution waves
    const waves = this.buildExecutionWaves(pipeline.stages);
    const stageResults = new Map<string, WorkflowResult>();
    const awaitingApproval: string[] = [];
    let stagesCompleted = 0;
    let failedStage: string | undefined;

    // Emit pipeline start event
    const engine = await getWorkflowEngine();
    await engine.emitEvent(
      "workflow_completed",
      "info",
      "pipeline",
      "pipeline",
      0,
      { pipelineId, pipelineName: pipeline.name, action: "started", stages: pipeline.stages.length }
    );

    for (const wave of waves) {
      console.log(`[Pipeline] Executing wave: [${wave.map(s => s.workflowType).join(", ")}]`);

      // Evaluate conditions and build input for each stage in the wave
      const executableStages = wave.filter(stage => {
        if (stage.condition && !stage.condition(stageResults)) {
          console.log(`[Pipeline] Skipping ${stage.workflowType}: condition not met`);
          stagesCompleted++;
          return false;
        }
        return true;
      });

      // Execute all stages in this wave concurrently
      const wavePromises = executableStages.map(async (stage) => {
        // Gather input from dependent stages
        const stageInput: Record<string, any> = { ...inputData };
        for (const dep of stage.dependsOn) {
          const depResult = stageResults.get(dep);
          if (depResult?.outputData) {
            const depStage = pipeline.stages.find(s => s.workflowType === dep);
            const key = depStage?.forwardOutputAs || dep;
            stageInput[key] = depResult.outputData;
          }
        }

        try {
          const result = await this.executeStage(stage.workflowType, stageInput, userId);
          return { workflowType: stage.workflowType, result };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return {
            workflowType: stage.workflowType,
            result: {
              success: false,
              runId: 0,
              status: "failed",
              itemsProcessed: 0,
              itemsSucceeded: 0,
              itemsFailed: 0,
              error: errorMsg,
            } as WorkflowResult,
          };
        }
      });

      const waveResults = await Promise.all(wavePromises);

      for (const { workflowType, result } of waveResults) {
        stageResults.set(workflowType, result);

        if (result.status === "awaiting_approval") {
          awaitingApproval.push(workflowType);
          stagesCompleted++;
        } else if (result.success) {
          stagesCompleted++;
        } else {
          failedStage = workflowType;
          console.log(`[Pipeline] Stage failed: ${workflowType} - ${result.error}`);
          // Continue pipeline even if a non-critical stage fails
          stagesCompleted++;
        }
      }

      // If any critical stage in this wave hard-failed, stop the pipeline
      const criticalFailure = waveResults.find(
        r => !r.result.success && r.result.status !== "awaiting_approval"
      );
      if (criticalFailure) {
        // Check if downstream stages depend on the failed stage
        const failedType = criticalFailure.workflowType;
        const dependentStages = pipeline.stages.filter(s => s.dependsOn.includes(failedType));
        if (dependentStages.length > 0) {
          console.log(`[Pipeline] Halting pipeline: ${failedType} failed with dependent stages`);
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    const success = !failedStage || awaitingApproval.length > 0;

    // Emit pipeline completion event
    await engine.emitEvent(
      success ? "workflow_completed" : "workflow_failed",
      success ? "info" : "error",
      "pipeline",
      "pipeline",
      0,
      {
        pipelineId,
        pipelineName: pipeline.name,
        action: "completed",
        stagesCompleted,
        stagesTotal: pipeline.stages.length,
        duration,
        awaitingApproval,
      }
    );

    console.log(`[Pipeline] ${pipeline.name} completed: ${stagesCompleted}/${pipeline.stages.length} stages, ${duration}ms`);

    return {
      pipelineId,
      success,
      stagesCompleted,
      stagesTotal: pipeline.stages.length,
      stageResults,
      failedStage,
      duration,
      awaitingApproval,
    };
  }

  /**
   * Build execution waves from stages using topological sort.
   * Each wave contains stages whose dependencies are all in prior waves.
   */
  private buildExecutionWaves(stages: PipelineStage[]): PipelineStage[][] {
    const waves: PipelineStage[][] = [];
    const completed = new Set<string>();
    const remaining = [...stages];

    while (remaining.length > 0) {
      const wave: PipelineStage[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const stage = remaining[i];
        const depsMetOrParallel =
          stage.dependsOn.length === 0 ||
          stage.dependsOn.every(dep => completed.has(dep));

        if (depsMetOrParallel) {
          wave.push(stage);
          remaining.splice(i, 1);
        }
      }

      if (wave.length === 0) {
        // Circular dependency or unresolvable - push remaining as final wave
        console.warn("[Pipeline] Unresolvable dependencies detected, forcing execution");
        waves.push(remaining.splice(0));
        break;
      }

      waves.push(wave);
      for (const s of wave) {
        completed.add(s.workflowType);
      }
    }

    return waves;
  }

  /**
   * Execute a single workflow stage by looking up the workflow by type.
   */
  private async executeStage(
    workflowType: string,
    inputData: Record<string, any>,
    userId?: number
  ): Promise<WorkflowResult> {
    if (!this.db) await this.initialize();

    // Find workflow definition by type
    const [workflow] = await this.db
      .select()
      .from(supplyChainWorkflows)
      .where(
        and(
          eq(supplyChainWorkflows.workflowType, workflowType as any),
          eq(supplyChainWorkflows.isActive, true)
        )
      );

    if (!workflow) {
      return {
        success: false,
        runId: 0,
        status: "failed",
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        error: `No active workflow of type: ${workflowType}`,
      };
    }

    const engine = await getWorkflowEngine();
    return engine.startWorkflow(workflow.id, "dependency", inputData, userId);
  }

  /**
   * Get the execution plan for a pipeline without running it.
   */
  getExecutionPlan(pipelineId: string): { waves: string[][]; totalStages: number } | null {
    const pipeline = SUPPLY_CHAIN_PIPELINES[pipelineId];
    if (!pipeline) return null;

    const waves = this.buildExecutionWaves(pipeline.stages);
    return {
      waves: waves.map(w => w.map(s => s.workflowType)),
      totalStages: pipeline.stages.length,
    };
  }

  /**
   * List all available pipelines with their definitions.
   */
  listPipelines(): Array<{
    id: string;
    name: string;
    description: string;
    stageCount: number;
    stages: string[];
  }> {
    return Object.entries(SUPPLY_CHAIN_PIPELINES).map(([id, pipeline]) => ({
      id,
      name: pipeline.name,
      description: pipeline.description,
      stageCount: pipeline.stages.length,
      stages: pipeline.stages.map(s => s.workflowType),
    }));
  }
}

// Singleton
let pipelineExecutor: PipelineExecutor | null = null;

export async function getPipelineExecutor(): Promise<PipelineExecutor> {
  if (!pipelineExecutor) {
    pipelineExecutor = new PipelineExecutor();
    await pipelineExecutor.initialize();
  }
  return pipelineExecutor;
}
