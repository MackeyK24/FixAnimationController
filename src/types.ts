import * as BABYLON from 'babylonjs';

/**
 * Parameter types supported by the animation controller
 */
export enum ParameterType {
    Float,
    Bool,
    Trigger,
    Int
}

/**
 * Represents an animation parameter
 */
export class Parameter {
    private currentValue: number | boolean = 0;
    private targetValue: number | boolean = 0;
    private smoothing: boolean = false;

    constructor(private metadata: any) {
        this.type = this.getTypeFromMetadata();
        this.currentValue = this.metadata.defaultValue ?? 0;
        this.targetValue = this.currentValue;
        this.smoothing = this.metadata.smoothing ?? false;
    }

    public readonly type: ParameterType;

    public setValue(value: number | boolean): void {
        if (this.smoothing && typeof value === 'number' && typeof this.currentValue === 'number') {
            this.targetValue = value;
        } else {
            this.currentValue = value;
            this.targetValue = value;
        }
    }

    public getValue(): number | boolean {
        return this.currentValue;
    }

    public update(deltaTime: number): void {
        if (this.smoothing && typeof this.targetValue === 'number' && typeof this.currentValue === 'number') {
            const diff = this.targetValue - this.currentValue;
            this.currentValue += diff * Math.min(1, deltaTime * 10);
        }
    }

    private getTypeFromMetadata(): ParameterType {
        switch (this.metadata.type?.toLowerCase()) {
            case 'float': return ParameterType.Float;
            case 'bool': return ParameterType.Bool;
            case 'trigger': return ParameterType.Trigger;
            case 'int': return ParameterType.Int;
            default: return ParameterType.Float;
        }
    }
}

/**
 * Cached animation frame data
 */
export interface AnimationFrameCache {
    matrices: Float32Array;
    timestamp: number;
}

/**
 * Root motion data extracted from animations
 */
export interface RootMotion {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
}
