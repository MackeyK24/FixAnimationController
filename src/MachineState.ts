import * as BABYLON from 'babylonjs';
import { BlendTree } from './BlendTree';
import { RootMotion } from './types';

/**
 * Represents a state in the animation state machine
 */
/**
 * Represents a state in the animation state machine
 * Supports both motion states and empty states
 */
export class MachineState {
    private transitions: any[] = [];
    private anyStateTransitions: any[] = [];
    private blendTree: BlendTree | null = null;
    private isPlaying: boolean = false;
    private currentTime: number = 0;
    private loopBlend: boolean = false;

    constructor(private metadata: any) {
        this.initialize();
    }

    /**
     * Initializes the state from metadata
     */
    private initialize(): void {
        // Set up transitions
        if (this.metadata.transitions) {
            this.transitions = this.metadata.transitions.filter((t: any) => !t.isAnyState);
            this.anyStateTransitions = this.metadata.transitions.filter((t: any) => t.isAnyState);
        }

        // Set up blend tree if this is a motion state
        if (this.metadata.motion) {
            this.blendTree = new BlendTree(this.metadata.motion);
        }

        // Set loop blend flag
        this.loopBlend = this.metadata.loopBlend ?? false;
    }

    /**
     * Called when entering this state
     */
    public enter(): void {
        this.isPlaying = true;
        this.currentTime = 0;
    }

    /**
     * Called when exiting this state
     */
    public exit(): void {
        this.isPlaying = false;
    }

    /**
     * Updates the state's animation
     */
    public update(deltaTime: number, avatarMask?: Set<string>, layerWeight: number = 1.0, additive: boolean = false): void {
        if (!this.isPlaying) return;

        // Update current time
        this.currentTime += deltaTime;

        // Update blend tree if exists
        if (this.blendTree) {
            this.blendTree.update(this.currentTime, avatarMask, layerWeight, additive);
        }
    }

    /**
     * Gets the state's transitions
     */
    public getTransitions(): any[] {
        return this.transitions;
    }

    public getAnyStateTransitions(): any[] {
        return this.anyStateTransitions;
    }

    /**
     * Gets whether this is an empty state
     */
    public isEmpty(): boolean {
        return !this.blendTree;
    }

    /**
     * Gets the blend tree if any
     */
    public getBlendTree(): BlendTree | null {
        return this.blendTree;
    }
}
