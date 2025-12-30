/**
 * Workflow Entity - Domain model for orchestrated workflows
 */

import { Guard } from '../shared/guards';
import { WorkflowStatus, WorkflowStep, CommandStatus } from '../shared/types';

export interface WorkflowProps {
    id: string;
    name: string;
    steps: WorkflowStep[];
    metadata?: Record<string, unknown>;
}

export class Workflow {
    public readonly id: string;
    public readonly name: string;
    public readonly steps: WorkflowStep[];
    public readonly metadata: Record<string, unknown>;
    public readonly createdAt: Date;

    private _status: WorkflowStatus;
    private _currentStepIndex: number;
    private _startedAt?: Date;
    private _completedAt?: Date;
    private _error?: string;

    constructor(props: WorkflowProps) {
        Guard.stringNotEmpty(props.id, 'id');
        Guard.stringNotEmpty(props.name, 'name');
        Guard.arrayNotEmpty(props.steps, 'steps');

        this.id = props.id;
        this.name = props.name;
        this.steps = props.steps;
        this.metadata = props.metadata || {};
        this.createdAt = new Date();

        this._status = WorkflowStatus.CREATED;
        this._currentStepIndex = 0;
    }

    get status(): WorkflowStatus {
        return this._status;
    }

    get currentStepIndex(): number {
        return this._currentStepIndex;
    }

    get currentStep(): WorkflowStep | undefined {
        return this.steps[this._currentStepIndex];
    }

    get startedAt(): Date | undefined {
        return this._startedAt;
    }

    get completedAt(): Date | undefined {
        return this._completedAt;
    }

    get error(): string | undefined {
        return this._error;
    }

    get progress(): number {
        const completedSteps = this.steps.filter(
            s => s.status === CommandStatus.COMPLETED
        ).length;
        return Math.round((completedSteps / this.steps.length) * 100);
    }

    public start(): void {
        if (this._status !== WorkflowStatus.CREATED) {
            throw new Error('Workflow can only be started from CREATED status');
        }
        this._status = WorkflowStatus.RUNNING;
        this._startedAt = new Date();
    }

    public completeCurrentStep(result?: unknown): void {
        if (!this.currentStep) return;

        this.currentStep.status = CommandStatus.COMPLETED;
        this.currentStep.result = result;

        if (this._currentStepIndex < this.steps.length - 1) {
            this._currentStepIndex++;
        } else {
            this.complete();
        }
    }

    public failCurrentStep(error: string): void {
        if (!this.currentStep) return;

        this.currentStep.status = CommandStatus.FAILED;
        this.fail(error);
    }

    public pause(): void {
        if (this._status === WorkflowStatus.RUNNING) {
            this._status = WorkflowStatus.PAUSED;
        }
    }

    public resume(): void {
        if (this._status === WorkflowStatus.PAUSED) {
            this._status = WorkflowStatus.RUNNING;
        }
    }

    public cancel(): void {
        this._status = WorkflowStatus.CANCELLED;
        this._completedAt = new Date();
    }

    private complete(): void {
        this._status = WorkflowStatus.COMPLETED;
        this._completedAt = new Date();
    }

    private fail(error: string): void {
        this._status = WorkflowStatus.FAILED;
        this._error = error;
        this._completedAt = new Date();
    }

    public getNextExecutableSteps(): WorkflowStep[] {
        return this.steps.filter(step => {
            if (step.status !== CommandStatus.PENDING) return false;

            // Check if all dependencies are completed
            if (step.dependsOn && step.dependsOn.length > 0) {
                return step.dependsOn.every(depId => {
                    const depStep = this.steps.find(s => s.stepId === depId);
                    return depStep?.status === CommandStatus.COMPLETED;
                });
            }

            return true;
        });
    }

    public toSnapshot(): WorkflowSnapshot {
        return {
            id: this.id,
            name: this.name,
            steps: this.steps,
            metadata: this.metadata,
            status: this._status,
            currentStepIndex: this._currentStepIndex,
            progress: this.progress,
            createdAt: this.createdAt,
            startedAt: this._startedAt,
            completedAt: this._completedAt,
            error: this._error
        };
    }
}

export interface WorkflowSnapshot {
    id: string;
    name: string;
    steps: WorkflowStep[];
    metadata: Record<string, unknown>;
    status: WorkflowStatus;
    currentStepIndex: number;
    progress: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}
