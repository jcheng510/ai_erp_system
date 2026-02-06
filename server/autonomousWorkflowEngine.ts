import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import {
  supplyChainWorkflows,
  workflowRuns,
  workflowSteps,
  workflowApprovalQueue,
  autonomousDecisions,
  supplyChainEvents,
  workflowMetrics,
  approvalThresholds,
  exceptionRules,
  exceptionLog,
  supplierPerformance,
  workflowNotifications,
  users,
} from "../drizzle/schema";
import { eq, and, lt, lte, gte, desc, asc, sql, isNull, or, inArray } from "drizzle-orm";
import { sendEmail, isEmailConfigured, formatEmailHtml } from "./_core/email";

// ============================================
// AUTONOMOUS WORKFLOW ENGINE
// Core orchestration for supply chain automation
// with retry, concurrency, circuit breaker,
// batch AI, and workflow resumption
// ============================================

export interface WorkflowContext {
  workflowId: number;
  runId: number;
  config: Record<string, any>;
  inputData: Record<string, any>;
  stepResults: Map<number, any>;
  decisions: any[];
  exceptions: any[];
  tokensUsed: number;
  resumeFromStep?: number;
}

export interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
  aiResponse?: any;
  confidence?: number;
  tokensUsed?: number;
  createdEntities?: Array<{ type: string; id: number }>;
  modifiedEntities?: Array<{ type: string; id: number }>;
  requiresApproval?: boolean;
  approvalData?: any;
}

export interface WorkflowResult {
  success: boolean;
  runId: number;
  status: string;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  totalValue?: number;
  outputData?: any;
  error?: string;
  pendingApprovals?: number;
}

// ============================================
// CIRCUIT BREAKER
// Protects against cascading LLM failures
// ============================================

type CircuitState = "closed" | "open" | "half_open";

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private halfOpenAttempts = 0;

  constructor(
    failureThreshold = 5,
    resetTimeoutMs = 60_000,
    halfOpenMaxAttempts = 2
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
  }

  canExecute(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = "half_open";
        this.halfOpenAttempts = 0;
        console.log("[CircuitBreaker] Transitioning to half-open state");
        return true;
      }
      return false;
    }
    // half_open: allow limited attempts
    return this.halfOpenAttempts < this.halfOpenMaxAttempts;
  }

  recordSuccess(): void {
    if (this.state === "half_open") {
      this.state = "closed";
      this.failureCount = 0;
      console.log("[CircuitBreaker] Circuit closed (recovered)");
    }
    this.failureCount = Math.max(0, this.failureCount - 1);
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "half_open") {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.state = "open";
        console.log("[CircuitBreaker] Circuit re-opened after half-open failures");
      }
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
      console.log(`[CircuitBreaker] Circuit opened after ${this.failureCount} failures`);
    }
  }

  getState(): { state: CircuitState; failureCount: number; lastFailure: number } {
    return { state: this.state, failureCount: this.failureCount, lastFailure: this.lastFailureTime };
  }
}

// ============================================
// CONCURRENCY CONTROLLER
// Prevents duplicate runs of the same workflow
// ============================================

class ConcurrencyController {
  private activeRuns = new Map<number, Set<number>>(); // workflowId -> Set<runId>

  acquire(workflowId: number, maxConcurrent: number, runId: number): boolean {
    const active = this.activeRuns.get(workflowId) || new Set();
    if (active.size >= maxConcurrent) {
      return false;
    }
    active.add(runId);
    this.activeRuns.set(workflowId, active);
    return true;
  }

  release(workflowId: number, runId: number): void {
    const active = this.activeRuns.get(workflowId);
    if (active) {
      active.delete(runId);
      if (active.size === 0) {
        this.activeRuns.delete(workflowId);
      }
    }
  }

  getActiveCount(workflowId: number): number {
    return this.activeRuns.get(workflowId)?.size || 0;
  }

  getTotalActive(): number {
    let total = 0;
    for (const [, runs] of Array.from(this.activeRuns)) {
      total += runs.size;
    }
    return total;
  }
}

// ============================================
// WORKFLOW EXECUTION ENGINE
// ============================================

export class WorkflowEngine {
  private db: any;
  private isInitialized = false;
  private circuitBreaker = new CircuitBreaker();
  private concurrency = new ConcurrencyController();

  async initialize(): Promise<void> {
    this.db = await getDb();
    if (this.db) {
      this.isInitialized = true;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error("WorkflowEngine not initialized. Call initialize() first.");
    }
  }

  // ============================================
  // WORKFLOW EXECUTION WITH RETRY
  // ============================================

  async startWorkflow(
    workflowId: number,
    triggeredBy: "schedule" | "event" | "threshold" | "manual" | "dependency",
    inputData: Record<string, any> = {},
    triggeredByUserId?: number
  ): Promise<WorkflowResult> {
    this.ensureInitialized();

    // Get workflow definition
    const [workflow] = await this.db
      .select()
      .from(supplyChainWorkflows)
      .where(eq(supplyChainWorkflows.id, workflowId));

    if (!workflow) {
      return { success: false, runId: 0, status: "failed", itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, error: "Workflow not found" };
    }

    if (!workflow.isActive) {
      return { success: false, runId: 0, status: "failed", itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, error: "Workflow is disabled" };
    }

    const maxRetries = workflow.retryAttempts || 3;
    const retryDelayMs = (workflow.retryDelayMinutes || 5) * 60_000;

    // Attempt execution with retry and exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.executeWorkflowAttempt(
        workflow,
        triggeredBy,
        inputData,
        triggeredByUserId,
        attempt,
        attempt > 1 ? undefined : undefined // parentRunId for retries
      );

      if (result.success || result.status === "awaiting_approval") {
        return result;
      }

      // Don't retry if it's a business-logic failure (not a transient error)
      const isTransient = result.error?.includes("LLM invoke failed") ||
        result.error?.includes("ECONNREFUSED") ||
        result.error?.includes("timeout") ||
        result.error?.includes("Circuit breaker");

      if (!isTransient || attempt === maxRetries) {
        // Move to dead letter queue
        await this.moveToDeadLetterQueue(result.runId, workflow, result.error || "Unknown error");
        return result;
      }

      // Exponential backoff: delay * 2^(attempt-1)
      const backoffMs = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(`[WorkflowEngine] Retry ${attempt}/${maxRetries} for ${workflow.name} in ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    // Should not reach here, but safety return
    return { success: false, runId: 0, status: "failed", itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, error: "Max retries exceeded" };
  }

  private async executeWorkflowAttempt(
    workflow: typeof supplyChainWorkflows.$inferSelect,
    triggeredBy: "schedule" | "event" | "threshold" | "manual" | "dependency",
    inputData: Record<string, any>,
    triggeredByUserId: number | undefined,
    attempt: number,
    parentRunId?: number
  ): Promise<WorkflowResult> {
    // Generate run number
    const runNumber = `WF-${workflow.workflowType.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}`;

    // Create workflow run
    const [run] = await this.db
      .insert(workflowRuns)
      .values({
        workflowId: workflow.id,
        runNumber,
        status: "running",
        triggeredBy,
        triggerData: JSON.stringify({ triggeredAt: new Date().toISOString(), ...inputData }),
        triggeredByUserId,
        startedAt: new Date(),
        inputData: JSON.stringify(inputData),
        attemptNumber: attempt,
        parentRunId,
      })
      .$returningId();

    const runId = run.id;
    const startTime = Date.now();

    // Check concurrency limits
    const maxConcurrent = workflow.maxConcurrentRuns || 1;
    if (!this.concurrency.acquire(workflow.id, maxConcurrent, runId)) {
      await this.db
        .update(workflowRuns)
        .set({ status: "cancelled", errorMessage: "Concurrency limit reached" })
        .where(eq(workflowRuns.id, runId));
      return {
        success: false, runId, status: "cancelled",
        itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0,
        error: "Concurrency limit reached",
      };
    }

    console.log(`[WorkflowEngine] Starting ${workflow.name} (run ${runNumber}, attempt ${attempt})`);

    // Create workflow context
    const context: WorkflowContext = {
      workflowId: workflow.id,
      runId,
      config: workflow.executionConfig ? JSON.parse(workflow.executionConfig) : {},
      inputData,
      stepResults: new Map(),
      decisions: [],
      exceptions: [],
      tokensUsed: 0,
    };

    try {
      // Execute workflow based on type
      const result = await this.executeWorkflowByType(workflow, context);
      const durationMs = Date.now() - startTime;

      // Update workflow run with results
      await this.db
        .update(workflowRuns)
        .set({
          status: result.success ? "completed" : (result.pendingApprovals ? "awaiting_approval" : "failed"),
          completedAt: new Date(),
          durationMs,
          outputData: JSON.stringify(result.outputData),
          itemsProcessed: result.itemsProcessed,
          itemsSucceeded: result.itemsSucceeded,
          itemsFailed: result.itemsFailed,
          totalValue: result.totalValue?.toString(),
          errorMessage: result.error,
        })
        .where(eq(workflowRuns.id, runId));

      // Update workflow metadata
      await this.db
        .update(supplyChainWorkflows)
        .set({
          lastRunAt: new Date(),
          successCount: result.success ? sql`${supplyChainWorkflows.successCount} + 1` : supplyChainWorkflows.successCount,
          failureCount: result.success ? supplyChainWorkflows.failureCount : sql`${supplyChainWorkflows.failureCount} + 1`,
        })
        .where(eq(supplyChainWorkflows.id, workflow.id));

      // Record metrics
      await this.recordMetrics(
        workflow.id,
        result,
        durationMs,
        context.decisions.length,
        context.tokensUsed
      );

      // Emit completion event
      await this.emitEvent(
        result.success ? "workflow_completed" : "workflow_failed",
        result.success ? "info" : "error",
        "workflow",
        "workflow_run",
        runId,
        { workflowType: workflow.workflowType, ...result }
      );

      return { ...result, runId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;

      await this.db
        .update(workflowRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          durationMs,
          errorMessage,
          errorDetails: JSON.stringify({ stack: err instanceof Error ? err.stack : undefined }),
        })
        .where(eq(workflowRuns.id, runId));

      await this.db
        .update(supplyChainWorkflows)
        .set({ failureCount: sql`${supplyChainWorkflows.failureCount} + 1` })
        .where(eq(supplyChainWorkflows.id, workflow.id));

      return {
        success: false, runId, status: "failed",
        itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0,
        error: errorMessage,
      };
    } finally {
      this.concurrency.release(workflow.id, runId);
    }
  }

  // Route to appropriate workflow executor
  private async executeWorkflowByType(
    workflow: typeof supplyChainWorkflows.$inferSelect,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const { workflowProcessors } = await import("./workflowProcessors");

    const processorMap: Record<string, any> = {
      demand_forecasting: workflowProcessors.demandForecasting,
      production_planning: workflowProcessors.productionPlanning,
      material_requirements: workflowProcessors.materialRequirements,
      procurement: workflowProcessors.procurement,
      inventory_reorder: workflowProcessors.inventoryReorder,
      inventory_transfer: workflowProcessors.inventoryTransfer,
      inventory_optimization: workflowProcessors.inventoryOptimization,
      work_order_generation: workflowProcessors.workOrderGeneration,
      production_scheduling: workflowProcessors.productionScheduling,
      freight_procurement: workflowProcessors.freightProcurement,
      shipment_tracking: workflowProcessors.shipmentTracking,
      order_fulfillment: workflowProcessors.orderFulfillment,
      supplier_management: workflowProcessors.supplierManagement,
      quality_inspection: workflowProcessors.qualityInspection,
      invoice_matching: workflowProcessors.invoiceMatching,
      payment_processing: workflowProcessors.paymentProcessing,
      exception_handling: workflowProcessors.exceptionHandling,
    };

    const processor = processorMap[workflow.workflowType];
    if (!processor) {
      throw new Error(`Unknown workflow type: ${workflow.workflowType}`);
    }
    return processor.execute(this, context);
  }

  // ============================================
  // DEAD LETTER QUEUE
  // Failed workflows that exhausted retries
  // ============================================

  private async moveToDeadLetterQueue(
    runId: number,
    workflow: typeof supplyChainWorkflows.$inferSelect,
    error: string
  ): Promise<void> {
    this.ensureInitialized();

    // Mark the run as permanently failed
    await this.db
      .update(workflowRuns)
      .set({
        status: "failed",
        errorMessage: `[DLQ] ${error}`,
        errorDetails: JSON.stringify({
          deadLetterQueue: true,
          reason: "Max retries exhausted",
          workflowType: workflow.workflowType,
          timestamp: new Date().toISOString(),
        }),
      })
      .where(eq(workflowRuns.id, runId));

    // Send notification about the DLQ item
    await this.sendNotification(
      runId,
      "error",
      `Workflow Failed Permanently: ${workflow.name}`,
      `Workflow "${workflow.name}" failed after all retry attempts. Error: ${error}. Manual intervention required.`,
      ["admin", "ops"],
      true,
      `/autonomous/exceptions`
    );

    console.log(`[WorkflowEngine] Run ${runId} moved to dead letter queue: ${error}`);
  }

  // ============================================
  // WORKFLOW RESUMPTION AFTER APPROVAL
  // ============================================

  async resumeAfterApproval(
    runId: number,
    approved: boolean
  ): Promise<WorkflowResult | null> {
    this.ensureInitialized();

    const [run] = await this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId));

    if (!run || run.status !== "approved") {
      return null;
    }

    const [workflow] = await this.db
      .select()
      .from(supplyChainWorkflows)
      .where(eq(supplyChainWorkflows.id, run.workflowId));

    if (!workflow || !approved) {
      return null;
    }

    // Re-trigger the workflow with the original input + approval context
    const originalInput = run.inputData ? JSON.parse(run.inputData) : {};
    return this.startWorkflow(
      workflow.id,
      "dependency",
      { ...originalInput, resumedFromRun: runId, approvalGranted: true },
      run.approvedBy
    );
  }

  // ============================================
  // STEP MANAGEMENT
  // ============================================

  async recordStep(
    context: WorkflowContext,
    stepNumber: number,
    stepName: string,
    stepType: string,
    executor: () => Promise<StepResult>
  ): Promise<StepResult> {
    this.ensureInitialized();

    // Skip steps if resuming from a later step
    if (context.resumeFromStep && stepNumber < context.resumeFromStep) {
      return { success: true, data: { skipped: true } };
    }

    // Create step record
    const [step] = await this.db
      .insert(workflowSteps)
      .values({
        runId: context.runId,
        stepNumber,
        stepName,
        stepType,
        status: "running",
        startedAt: new Date(),
        inputData: JSON.stringify(context.inputData),
      })
      .$returningId();

    // Update run progress
    await this.db
      .update(workflowRuns)
      .set({
        currentStepName: stepName,
        completedSteps: stepNumber - 1,
      })
      .where(eq(workflowRuns.id, context.runId));

    const startTime = Date.now();

    try {
      const result = await executor();

      // Track tokens used
      if (result.tokensUsed) {
        context.tokensUsed += result.tokensUsed;
      }

      await this.db
        .update(workflowSteps)
        .set({
          status: result.success ? "completed" : "failed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          outputData: JSON.stringify(result.data),
          errorMessage: result.error,
          aiResponse: result.aiResponse ? JSON.stringify(result.aiResponse) : null,
          aiConfidence: result.confidence?.toString(),
          aiTokensUsed: result.tokensUsed,
          createdEntityType: result.createdEntities?.[0]?.type,
          createdEntityId: result.createdEntities?.[0]?.id,
          modifiedEntityType: result.modifiedEntities?.[0]?.type,
          modifiedEntityId: result.modifiedEntities?.[0]?.id,
        })
        .where(eq(workflowSteps.id, step.id));

      context.stepResults.set(stepNumber, result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.db
        .update(workflowSteps)
        .set({
          status: "failed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage,
        })
        .where(eq(workflowSteps.id, step.id));

      return { success: false, error: errorMessage };
    }
  }

  // ============================================
  // AI DECISION MAKING (with circuit breaker)
  // ============================================

  async makeAIDecision(
    context: WorkflowContext,
    decisionType: string,
    prompt: string,
    options: any[],
    responseSchema: any
  ): Promise<{ decision: any; reasoning: string; confidence: number }> {
    this.ensureInitialized();

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      const cbState = this.circuitBreaker.getState();
      throw new Error(
        `Circuit breaker is ${cbState.state}: LLM service unavailable (${cbState.failureCount} recent failures)`
      );
    }

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert supply chain AI making autonomous decisions for an ERP system.
You must analyze the data provided and make the best decision based on:
- Cost optimization
- Lead time efficiency
- Quality/reliability scores
- Risk minimization
- Business rules and constraints

Always provide clear reasoning for your decision.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "decision_response",
            strict: true,
            schema: responseSchema,
          },
        },
      });

      this.circuitBreaker.recordSuccess();

      const content = response.choices[0].message.content;
      const decision = JSON.parse(typeof content === "string" ? content : "{}");
      const tokensUsed = response.usage?.total_tokens || 0;
      context.tokensUsed += tokensUsed;

      // Log the decision
      await this.db.insert(autonomousDecisions).values({
        runId: context.runId,
        decisionType,
        decisionContext: prompt,
        optionsConsidered: JSON.stringify(options),
        chosenOption: JSON.stringify(decision.choice || decision),
        aiReasoning: decision.reasoning || "",
        confidence: (decision.confidence || 85).toString(),
      });

      context.decisions.push({
        type: decisionType,
        decision: decision.choice || decision,
        reasoning: decision.reasoning,
        confidence: decision.confidence || 85,
        tokensUsed,
      });

      return {
        decision: decision.choice || decision,
        reasoning: decision.reasoning || "",
        confidence: decision.confidence || 85,
      };
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  // ============================================
  // BATCH AI DECISION MAKING
  // Process multiple items in a single LLM call
  // ============================================

  async makeBatchAIDecision(
    context: WorkflowContext,
    decisionType: string,
    batchPrompt: string,
    items: Array<{ id: number | string; data: string }>,
    perItemSchema: any
  ): Promise<Array<{ itemId: number | string; decision: any; reasoning: string; confidence: number }>> {
    this.ensureInitialized();

    if (items.length === 0) return [];

    // Build a combined prompt for all items
    const itemDescriptions = items
      .map((item, idx) => `[Item ${idx + 1} (ID: ${item.id})]\n${item.data}`)
      .join("\n\n");

    const batchSchema = {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              ...perItemSchema.properties,
            },
            required: ["itemId", ...(perItemSchema.required || [])],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    };

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      throw new Error("Circuit breaker is open: LLM service unavailable");
    }

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert supply chain AI making autonomous decisions for an ERP system.
Process ALL items in the batch and provide individual decisions for each.
Always provide clear reasoning for each decision.`,
          },
          {
            role: "user",
            content: `${batchPrompt}\n\n${itemDescriptions}\n\nProvide a decision for EACH item listed above. Return the itemId exactly as shown.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "batch_decision_response",
            strict: true,
            schema: batchSchema,
          },
        },
      });

      this.circuitBreaker.recordSuccess();

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(typeof content === "string" ? content : '{"results":[]}');
      const tokensUsed = response.usage?.total_tokens || 0;
      context.tokensUsed += tokensUsed;

      const results = (parsed.results || []).map((r: any) => ({
        itemId: r.itemId,
        decision: r,
        reasoning: r.reasoning || "",
        confidence: r.confidence || 85,
      }));

      // Log as a single batch decision
      await this.db.insert(autonomousDecisions).values({
        runId: context.runId,
        decisionType,
        decisionContext: `[BATCH: ${items.length} items] ${batchPrompt}`,
        optionsConsidered: JSON.stringify(items.map(i => i.id)),
        chosenOption: JSON.stringify(results),
        aiReasoning: `Batch decision for ${items.length} items`,
        confidence: results.length > 0
          ? (results.reduce((sum: number, r: any) => sum + r.confidence, 0) / results.length).toString()
          : "0",
      });

      context.decisions.push({
        type: decisionType,
        decision: results,
        reasoning: `Batch: ${items.length} items processed`,
        confidence: results.length > 0
          ? results.reduce((sum: number, r: any) => sum + r.confidence, 0) / results.length
          : 0,
        tokensUsed,
      });

      return results;
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  // ============================================
  // APPROVAL MANAGEMENT
  // ============================================

  async checkApprovalRequired(
    entityType: string,
    amount: number
  ): Promise<{ required: boolean; autoApprove: boolean; level?: number; roles?: string[] }> {
    this.ensureInitialized();

    const [threshold] = await this.db
      .select()
      .from(approvalThresholds)
      .where(
        and(
          eq(approvalThresholds.entityType, entityType as any),
          eq(approvalThresholds.isActive, true)
        )
      );

    if (!threshold) {
      return { required: amount > 500, autoApprove: amount <= 500 };
    }

    const autoApproveMax = parseFloat(threshold.autoApproveMaxAmount || "0");
    const level1Max = parseFloat(threshold.level1MaxAmount || "0");
    const level2Max = parseFloat(threshold.level2MaxAmount || "0");
    const level3Max = parseFloat(threshold.level3MaxAmount || "0");

    if (amount <= autoApproveMax) {
      return { required: false, autoApprove: true };
    }

    if (amount <= level1Max) {
      return {
        required: true,
        autoApprove: false,
        level: 1,
        roles: threshold.level1Roles ? JSON.parse(threshold.level1Roles) : ["ops"],
      };
    }

    if (amount <= level2Max) {
      return {
        required: true,
        autoApprove: false,
        level: 2,
        roles: threshold.level2Roles ? JSON.parse(threshold.level2Roles) : ["admin"],
      };
    }

    if (amount <= level3Max) {
      return {
        required: true,
        autoApprove: false,
        level: 3,
        roles: threshold.level3Roles ? JSON.parse(threshold.level3Roles) : ["exec"],
      };
    }

    return {
      required: true,
      autoApprove: false,
      level: 4,
      roles: threshold.execRoles ? JSON.parse(threshold.execRoles) : ["exec"],
    };
  }

  async requestApproval(
    context: WorkflowContext,
    approvalType: string,
    title: string,
    description: string,
    amount: number,
    relatedEntityType: string,
    relatedEntityId: number,
    aiRecommendation: string,
    confidence: number
  ): Promise<{ approvalId: number; autoApproved: boolean }> {
    this.ensureInitialized();

    const approvalCheck = await this.checkApprovalRequired(approvalType, amount);

    if (approvalCheck.autoApprove) {
      const [approval] = await this.db
        .insert(workflowApprovalQueue)
        .values({
          runId: context.runId,
          approvalType: approvalType as any,
          title,
          description,
          monetaryValue: amount.toString(),
          contextData: JSON.stringify(context.inputData),
          aiRecommendation,
          aiConfidence: confidence.toString(),
          riskAssessment: confidence > 80 ? "low" : confidence > 60 ? "medium" : "high",
          relatedEntityType,
          relatedEntityId,
          status: "auto_approved",
          wasAutoApproved: true,
          autoApprovalReason: `Amount $${amount} is below auto-approve threshold`,
          resolvedAt: new Date(),
        })
        .$returningId();

      return { approvalId: approval.id, autoApproved: true };
    }

    // Require manual approval
    const escalateAt = new Date();
    escalateAt.setMinutes(escalateAt.getMinutes() + 60);

    const [approval] = await this.db
      .insert(workflowApprovalQueue)
      .values({
        runId: context.runId,
        approvalType: approvalType as any,
        title,
        description,
        monetaryValue: amount.toString(),
        contextData: JSON.stringify(context.inputData),
        aiRecommendation,
        aiConfidence: confidence.toString(),
        riskAssessment: confidence > 80 ? "low" : confidence > 60 ? "medium" : "high",
        relatedEntityType,
        relatedEntityId,
        status: "pending",
        assignedToRoles: JSON.stringify(approvalCheck.roles),
        escalateAt,
        escalationLevel: 0,
      })
      .$returningId();

    // Update run status
    await this.db
      .update(workflowRuns)
      .set({
        status: "awaiting_approval",
        approvalRequestedAt: new Date(),
      })
      .where(eq(workflowRuns.id, context.runId));

    // Send notification with actual email
    await this.sendNotification(
      context.runId,
      "approval_needed",
      title,
      `Approval required for ${approvalType}: ${description}. Amount: $${amount.toFixed(2)}`,
      approvalCheck.roles || [],
      true,
      `/approvals/${approval.id}`
    );

    return { approvalId: approval.id, autoApproved: false };
  }

  async processApproval(
    approvalId: number,
    approved: boolean,
    resolvedBy: number,
    notes?: string
  ): Promise<{ success: boolean; runResumed: boolean }> {
    this.ensureInitialized();

    const [approval] = await this.db
      .select()
      .from(workflowApprovalQueue)
      .where(eq(workflowApprovalQueue.id, approvalId));

    if (!approval) {
      return { success: false, runResumed: false };
    }

    await this.db
      .update(workflowApprovalQueue)
      .set({
        status: approved ? "approved" : "rejected",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      })
      .where(eq(workflowApprovalQueue.id, approvalId));

    // Update workflow run
    await this.db
      .update(workflowRuns)
      .set({
        status: approved ? "approved" : "rejected",
        approvedBy: approved ? resolvedBy : undefined,
        approvedAt: approved ? new Date() : undefined,
        rejectedBy: approved ? undefined : resolvedBy,
        rejectedAt: approved ? undefined : new Date(),
        rejectionReason: approved ? undefined : notes,
      })
      .where(eq(workflowRuns.id, approval.runId));

    // Resume workflow if approved
    let runResumed = false;
    if (approved) {
      const result = await this.resumeAfterApproval(approval.runId, true);
      runResumed = result !== null && result.success;
    }

    // Send notification about resolution
    await this.sendNotification(
      approval.runId,
      "approval_completed",
      `${approved ? "Approved" : "Rejected"}: ${approval.title}`,
      `The approval request has been ${approved ? "approved" : "rejected"} by the reviewer.${notes ? ` Notes: ${notes}` : ""}`,
      [],
      false
    );

    // Emit event for downstream event-triggered workflows
    await this.emitEvent(
      "approval_needed",
      "info",
      "workflow",
      "approval",
      approvalId,
      {
        approved,
        approvalType: approval.approvalType,
        runId: approval.runId,
        entityType: approval.relatedEntityType,
        entityId: approval.relatedEntityId,
      }
    );

    return { success: true, runResumed };
  }

  // ============================================
  // EXCEPTION HANDLING
  // ============================================

  async handleException(
    context: WorkflowContext,
    exceptionType: string,
    title: string,
    description: string,
    exceptionData: any,
    entityType?: string,
    entityId?: number
  ): Promise<{ handled: boolean; action: string; requiresHuman: boolean }> {
    this.ensureInitialized();

    // Find matching exception rule
    const rules = await this.db
      .select()
      .from(exceptionRules)
      .where(
        and(
          eq(exceptionRules.exceptionType, exceptionType as any),
          eq(exceptionRules.isActive, true)
        )
      )
      .orderBy(asc(exceptionRules.priority));

    const matchedRule = rules[0];

    // Log the exception
    const [exception] = await this.db
      .insert(exceptionLog)
      .values({
        runId: context.runId,
        ruleId: matchedRule?.id,
        exceptionType,
        severity: matchedRule ? "medium" : "high",
        title,
        description,
        exceptionData: JSON.stringify(exceptionData),
        entityType,
        entityId,
        status: "open",
      })
      .$returningId();

    context.exceptions.push({
      id: exception.id,
      type: exceptionType,
      title,
      handled: false,
    });

    if (!matchedRule) {
      await this.sendNotification(
        context.runId,
        "exception",
        `Exception: ${title}`,
        description,
        ["ops", "admin"],
        true,
        `/exceptions/${exception.id}`
      );
      return { handled: false, action: "routed_to_human", requiresHuman: true };
    }

    // Apply resolution strategy
    switch (matchedRule.resolutionStrategy) {
      case "auto_resolve": {
        const autoAction = matchedRule.autoResolutionAction
          ? JSON.parse(matchedRule.autoResolutionAction)
          : { action: "ignore" };

        await this.db
          .update(exceptionLog)
          .set({
            status: "resolved",
            resolutionType: "auto_resolved",
            resolutionAction: JSON.stringify(autoAction),
            resolvedAt: new Date(),
          })
          .where(eq(exceptionLog.id, exception.id));

        return { handled: true, action: autoAction.action, requiresHuman: false };
      }

      case "ai_decide": {
        if (!this.circuitBreaker.canExecute()) {
          // Fallback to human when circuit breaker is open
          await this.sendNotification(
            context.runId,
            "exception",
            `Action Required: ${title}`,
            `AI unavailable. ${description}`,
            matchedRule.notifyRoles ? JSON.parse(matchedRule.notifyRoles) : ["ops"],
            true,
            `/exceptions/${exception.id}`
          );
          return { handled: false, action: "routed_to_human", requiresHuman: true };
        }

        const aiDecision = await this.makeAIDecision(
          context,
          "exception_handling",
          `An exception occurred in the supply chain workflow:
Type: ${exceptionType}
Title: ${title}
Description: ${description}
Data: ${JSON.stringify(exceptionData)}

Decide the best resolution action from: accept_variance, reject_and_reorder, escalate, ignore, retry`,
          ["accept_variance", "reject_and_reorder", "escalate", "ignore", "retry"],
          {
            type: "object",
            properties: {
              choice: { type: "string" },
              reasoning: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["choice", "reasoning", "confidence"],
            additionalProperties: false,
          }
        );

        await this.db
          .update(exceptionLog)
          .set({
            status: aiDecision.confidence > 70 ? "resolved" : "in_progress",
            resolutionType: "ai_resolved",
            resolutionAction: JSON.stringify({ action: aiDecision.decision, reasoning: aiDecision.reasoning }),
            resolvedAt: aiDecision.confidence > 70 ? new Date() : null,
          })
          .where(eq(exceptionLog.id, exception.id));

        return {
          handled: aiDecision.confidence > 70,
          action: aiDecision.decision,
          requiresHuman: aiDecision.confidence <= 70,
        };
      }

      case "route_to_human":
        await this.sendNotification(
          context.runId,
          "exception",
          `Action Required: ${title}`,
          description,
          matchedRule.notifyRoles ? JSON.parse(matchedRule.notifyRoles) : ["ops"],
          true,
          `/exceptions/${exception.id}`
        );
        return { handled: false, action: "routed_to_human", requiresHuman: true };

      case "escalate":
        await this.db
          .update(exceptionLog)
          .set({
            status: "escalated",
            severity: "high",
            escalatedAt: new Date(),
          })
          .where(eq(exceptionLog.id, exception.id));

        await this.sendNotification(
          context.runId,
          "exception",
          `ESCALATED: ${title}`,
          `This exception has been automatically escalated: ${description}`,
          ["admin", "exec"],
          true,
          `/exceptions/${exception.id}`
        );
        return { handled: false, action: "escalated", requiresHuman: true };

      case "notify_and_continue":
        await this.sendNotification(
          context.runId,
          "warning",
          title,
          description,
          matchedRule.notifyRoles ? JSON.parse(matchedRule.notifyRoles) : ["ops"],
          false
        );

        await this.db
          .update(exceptionLog)
          .set({ status: "resolved", resolutionType: "auto_resolved" })
          .where(eq(exceptionLog.id, exception.id));

        return { handled: true, action: "notified_and_continued", requiresHuman: false };

      case "halt_workflow":
        await this.db
          .update(workflowRuns)
          .set({
            status: "failed",
            errorMessage: `Workflow halted due to exception: ${title}`,
          })
          .where(eq(workflowRuns.id, context.runId));

        return { handled: false, action: "workflow_halted", requiresHuman: true };

      default:
        return { handled: false, action: "unknown_strategy", requiresHuman: true };
    }
  }

  // ============================================
  // EVENT EMISSION
  // ============================================

  async emitEvent(
    eventType: string,
    severity: "info" | "warning" | "error" | "critical",
    sourceSystem: string,
    sourceEntityType: string,
    sourceEntityId: number,
    eventData: any
  ): Promise<number> {
    this.ensureInitialized();

    const [event] = await this.db
      .insert(supplyChainEvents)
      .values({
        eventType: eventType as any,
        severity,
        sourceSystem,
        sourceEntityType,
        sourceEntityId,
        eventData: JSON.stringify(eventData),
        summary: `${eventType}: ${sourceEntityType} #${sourceEntityId}`,
      })
      .$returningId();

    return event.id;
  }

  // ============================================
  // NOTIFICATIONS (with actual email dispatch)
  // ============================================

  async sendNotification(
    runId: number,
    notificationType: string,
    title: string,
    message: string,
    targetRoles: string[],
    sendEmailNotification: boolean,
    actionUrl?: string
  ): Promise<void> {
    this.ensureInitialized();

    await this.db.insert(workflowNotifications).values({
      runId,
      notificationType: notificationType as any,
      title,
      message,
      targetRoles: JSON.stringify(targetRoles),
      sendEmail: sendEmailNotification,
      sendInApp: true,
      actionUrl,
      actionLabel: actionUrl ? "View Details" : undefined,
    });

    // Actually send email notifications to users with matching roles
    if (sendEmailNotification && isEmailConfigured() && targetRoles.length > 0) {
      try {
        const targetUsers = await this.db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.role, targetRoles as any[]));

        for (const user of targetUsers) {
          if (user.email) {
            await sendEmail({
              to: user.email,
              subject: `[ERP Workflow] ${title}`,
              text: `${message}${actionUrl ? `\n\nView details: ${actionUrl}` : ""}`,
              html: formatEmailHtml(
                `${message}${actionUrl ? `\n\nView details: ${actionUrl}` : ""}`
              ),
            });
          }
        }
      } catch (err) {
        // Don't fail the workflow because of email errors
        console.error("[WorkflowEngine] Failed to send notification emails:", err);
      }
    }
  }

  // ============================================
  // METRICS
  // ============================================

  async recordMetrics(
    workflowId: number,
    runResult: WorkflowResult,
    durationMs: number,
    aiDecisions: number,
    tokensUsed: number
  ): Promise<void> {
    this.ensureInitialized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [existing] = await this.db
      .select()
      .from(workflowMetrics)
      .where(
        and(
          eq(workflowMetrics.workflowId, workflowId),
          eq(workflowMetrics.metricDate, today)
        )
      );

    if (existing) {
      await this.db
        .update(workflowMetrics)
        .set({
          totalRuns: sql`${workflowMetrics.totalRuns} + 1`,
          successfulRuns: runResult.success
            ? sql`${workflowMetrics.successfulRuns} + 1`
            : workflowMetrics.successfulRuns,
          failedRuns: runResult.success
            ? workflowMetrics.failedRuns
            : sql`${workflowMetrics.failedRuns} + 1`,
          itemsProcessed: sql`${workflowMetrics.itemsProcessed} + ${runResult.itemsProcessed}`,
          totalValueProcessed: runResult.totalValue
            ? sql`${workflowMetrics.totalValueProcessed} + ${runResult.totalValue}`
            : workflowMetrics.totalValueProcessed,
          aiDecisionCount: sql`${workflowMetrics.aiDecisionCount} + ${aiDecisions}`,
          totalTokensUsed: sql`${workflowMetrics.totalTokensUsed} + ${tokensUsed}`,
          // Estimate time saved: average of 15 min per manual workflow step
          estimatedTimeSavedMinutes: sql`${workflowMetrics.estimatedTimeSavedMinutes} + ${runResult.itemsProcessed * 15}`,
        })
        .where(eq(workflowMetrics.id, existing.id));
    } else {
      await this.db.insert(workflowMetrics).values({
        workflowId,
        metricDate: today,
        totalRuns: 1,
        successfulRuns: runResult.success ? 1 : 0,
        failedRuns: runResult.success ? 0 : 1,
        averageDurationMs: durationMs,
        itemsProcessed: runResult.itemsProcessed,
        totalValueProcessed: runResult.totalValue?.toString(),
        aiDecisionCount: aiDecisions,
        totalTokensUsed: tokensUsed,
        estimatedTimeSavedMinutes: runResult.itemsProcessed * 15,
      });
    }
  }

  // ============================================
  // DIAGNOSTICS
  // ============================================

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  getConcurrencyInfo() {
    return { totalActive: this.concurrency.getTotalActive() };
  }

  // ============================================
  // DATABASE ACCESS (for workflow processors)
  // ============================================

  getDb() {
    return this.db;
  }
}

// Singleton instance
let workflowEngineInstance: WorkflowEngine | null = null;

export async function getWorkflowEngine(): Promise<WorkflowEngine> {
  if (!workflowEngineInstance) {
    workflowEngineInstance = new WorkflowEngine();
    await workflowEngineInstance.initialize();
  }
  return workflowEngineInstance;
}
