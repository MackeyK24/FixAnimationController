import * as BABYLON from 'babylonjs';
import { Parameter, ParameterType, AnimationFrameCache, RootMotion } from './types';
import { MachineState } from './MachineState';
import { BlendTree, BlendTreeType } from './BlendTree';

/**
 * Represents a single animation layer with its own state machine
 */
export class AnimationLayer {
    private currentState: MachineState | null = null;
    private targetState: MachineState | null = null;
    private transitionTime: number = 0;
    private transitionDuration: number = 0;
    private layerWeight: number = 1;
    private avatarMask: AvatarMask | null = null;

    constructor(
        private metadata: any,
        private stateMap: Map<string, MachineState>,
        private parameters: Map<string, Parameter>,
        private animationGroups: BABYLON.AnimationGroup[],
        private frameCache: Map<string, AnimationFrameCache>
    ) {
        this.initialize();
    }

    /**
     * Initializes the layer from metadata
     */
    private initialize(): void {
        // Set initial state
        if (this.metadata.entry) {
            const initialState = this.stateMap.get(this.metadata.entry);
            if (initialState) {
                this.currentState = initialState;
                this.currentState.enter();
            }
        }

        // Initialize avatar mask if specified
        if (this.metadata.avatarMask) {
            this.avatarMask = new AvatarMask(this.metadata.avatarMask);
        }

        // Set layer weight
        this.layerWeight = this.metadata.defaultWeight ?? 1;
    }

    /**
     * Updates the layer's animation state
     */
    public update(deltaTime: number): void {
        // Update current transition if any
        if (this.targetState) {
            this.updateTransition(deltaTime);
            
            // Update both states during transition with avatar mask
            if (this.currentState) {
                const currentWeight = this.layerWeight * (1 - this.transitionTime / this.transitionDuration);
                this.currentState.update(
                    deltaTime,
                    this.avatarMask?.includedBones,
                    currentWeight,
                    this.metadata.additive ?? false
                );
            }
            if (this.targetState) {
                const targetWeight = this.layerWeight * (this.transitionTime / this.transitionDuration);
                this.targetState.update(
                    deltaTime,
                    this.avatarMask?.includedBones,
                    targetWeight,
                    this.metadata.additive ?? false
                );
            }
        }
        // Otherwise check for new transitions
        else if (this.currentState) {
            this.checkTransitions();
            // Update current state with avatar mask and layer weight
            this.currentState.update(
                deltaTime,
                this.avatarMask?.includedBones,
                this.layerWeight,
                this.metadata.additive ?? false
            );
        }
    }

    /**
     * Sets the target state for transition
     */
    public setState(state: MachineState): void {
        if (state === this.currentState) return;

        this.targetState = state;
        this.transitionTime = 0;
        this.transitionDuration = 0.25; // Default duration, should come from metadata
    }

    /**
     * Sets the layer weight for blending
     */
    public setWeight(weight: number): void {
        this.layerWeight = Math.max(0, Math.min(1, weight));
    }

    /**
     * Updates the current transition progress
     */
    private updateTransition(deltaTime: number): void {
        if (!this.targetState) return;

        this.transitionTime += deltaTime;
        const t = Math.min(1, this.transitionTime / this.transitionDuration);

        if (t >= 1) {
            // Transition complete
            if (this.currentState) {
                this.currentState.exit();
            }
            this.currentState = this.targetState;
            this.currentState.enter();
            this.targetState = null;
            this.transitionTime = 0;
        }
    }

    /**
     * Checks for possible transitions from current state
     */
    private checkTransitions(): void {
        if (!this.currentState) return;

        // Check normal transitions
        for (const transition of this.currentState.getTransitions()) {
            if (this.evaluateTransition(transition)) {
                const targetState = this.stateMap.get(transition.destination);
                if (targetState) {
                    this.setState(targetState);
                    break;
                }
            }
        }

        // Check ANY state transitions if no normal transition was taken
        if (!this.targetState) {
            for (const state of this.stateMap.values()) {
                const anyTransitions = state.getAnyStateTransitions();
                for (const transition of anyTransitions) {
                    if (this.evaluateTransition(transition)) {
                        const targetState = this.stateMap.get(transition.destination);
                        if (targetState) {
                            this.setState(targetState);
                            break;
                        }
                    }
                }
                if (this.targetState) break;
            }
        }
    }

    /**
     * Evaluates if a transition should be taken
     */
    private evaluateTransition(transition: any): boolean {
        if (!transition.conditions) return true;

        for (const condition of transition.conditions) {
            const param = this.parameters.get(condition.parameter);
            if (!param) continue;

            const paramValue = param.getValue();
            const threshold = condition.threshold;

            switch (condition.mode) {
                case 0: // Equals
                    if (paramValue !== threshold) return false;
                    break;
                case 1: // Greater
                    if (typeof paramValue === 'number' && paramValue <= threshold) return false;
                    break;
                case 2: // Less
                    if (typeof paramValue === 'number' && paramValue >= threshold) return false;
                    break;
                // Add other condition modes as needed
            }
        }

        return true;
    }

    /**
     * Extracts root motion from the current state
     */
    public extractRootMotion(): RootMotion | null {
        if (!this.currentState) return null;

        const rootMotion: RootMotion = {
            position: new BABYLON.Vector3(),
            rotation: new BABYLON.Quaternion()
        };

        // Get root motion from current state
        const currentMotion = this.currentState.extractRootMotion();
        if (currentMotion) {
            const currentWeight = this.targetState ? (1 - this.transitionTime / this.transitionDuration) : 1;
            rootMotion.position.addInPlace(currentMotion.position.scale(currentWeight * this.layerWeight));
            BABYLON.Quaternion.SlerpToRef(
                BABYLON.Quaternion.Identity(),
                currentMotion.rotation,
                currentWeight * this.layerWeight,
                rootMotion.rotation
            );
        }

        // Add root motion from target state during transition
        if (this.targetState) {
            const targetMotion = this.targetState.extractRootMotion();
            if (targetMotion) {
                const targetWeight = this.transitionTime / this.transitionDuration;
                rootMotion.position.addInPlace(targetMotion.position.scale(targetWeight * this.layerWeight));
                const targetRotation = new BABYLON.Quaternion();
                BABYLON.Quaternion.SlerpToRef(
                    BABYLON.Quaternion.Identity(),
                    targetMotion.rotation,
                    targetWeight * this.layerWeight,
                    targetRotation
                );
                rootMotion.rotation.multiplyInPlace(targetRotation);
            }
        }

        return rootMotion;
    }
}

/**
 * Represents an avatar mask for selective bone animation
 */
class AvatarMask {
    public includedBones: Set<string> = new Set();
    private boneWeights: Map<string, number> = new Map();

    constructor(metadata: any) {
        this.initialize(metadata);
    }

    private initialize(metadata: any): void {
        if (metadata.transformPaths) {
            for (const path of metadata.transformPaths) {
                this.includedBones.add(path);
                this.boneWeights.set(path, 1);
            }
        }
    }

    public isIncluded(bonePath: string): boolean {
        return this.includedBones.has(bonePath);
    }

    public getWeight(bonePath: string): number {
        return this.boneWeights.get(bonePath) ?? 0;
    }
}

// Types moved to types.ts
