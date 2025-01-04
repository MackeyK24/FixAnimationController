import * as BABYLON from 'babylonjs';
import { AnimationLayer } from './AnimationLayer';
import { MachineState } from './MachineState';
import { Parameter, ParameterType, AnimationFrameCache, RootMotion } from './types';

/**
 * Parameter types supported by the animation controller
 */
/**
 * Implements a Unity-style animation controller for Babylon.js with support for
 * blend trees, layers, and root motion.
 */
export class AnimationController {
    private layers: AnimationLayer[] = [];
    private parameters: Map<string, Parameter> = new Map();
    private stateMap: Map<string, MachineState> = new Map();
    private frameCache: Map<string, AnimationFrameCache> = new Map();
    private rootMotionEnabled: boolean = false;
    private initialized: boolean = false;

    /**
     * Creates a new AnimationController instance
     * @param animationGroups - The animation groups to use
     * @param metadata - The parsed animstate.json metadata
     */
    constructor(
        private animationGroups: BABYLON.AnimationGroup[],
        private metadata: any,
        private rootBone?: BABYLON.TransformNode
    ) {
        this.initialize();
    }

    /**
     * Initializes the animation controller from metadata
     */
    private initialize(): void {
        if (!this.metadata || !this.metadata.machine) {
            throw new Error("Invalid animation state machine metadata");
        }

        // Initialize parameters
        if (this.metadata.parameters) {
            for (const param of this.metadata.parameters) {
                this.parameters.set(param.name, new Parameter(param));
            }
        }

        // Initialize state machine
        if (this.metadata.machine.states) {
            for (const state of this.metadata.machine.states) {
                this.stateMap.set(state.name, new MachineState(state));
            }
        }

        // Initialize layers
        if (this.metadata.machine.layers) {
            for (const layerData of this.metadata.machine.layers) {
                const layer = new AnimationLayer(
                    layerData,
                    this.stateMap,
                    this.parameters,
                    this.animationGroups,
                    this.frameCache
                );
                this.layers.push(layer);
            }
        }

        this.initialized = true;
    }

    /**
     * Updates the animation controller
     * @param deltaTime - The time elapsed since the last update
     */
    public update(deltaTime: number): void {
        if (!this.initialized) return;

        // Update each layer
        for (const layer of this.layers) {
            layer.update(deltaTime);
        }

        // Extract root motion if enabled
        if (this.rootMotionEnabled && this.rootBone) {
            this.extractRootMotion();
        }
    }

    /**
     * Sets the current state by name
     * @param stateName - The name of the state to transition to
     */
    public setState(stateName: string): void {
        if (!this.initialized) return;

        const state = this.stateMap.get(stateName);
        if (!state) {
            console.warn(`State '${stateName}' not found`);
            return;
        }

        // Handle empty states
        if (state.isEmpty()) {
            console.debug(`State '${stateName}' is an empty state`);
        }

        // Set state on base layer
        if (this.layers.length > 0) {
            this.layers[0].setState(state);
        }
    }

    /**
     * Enables or disables root motion extraction
     */
    public enableRootMotion(enabled: boolean): void {
        this.rootMotionEnabled = enabled;
    }

    /**
     * Sets a float parameter value
     */
    public setFloat(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (param && param.type === ParameterType.Float) {
            param.setValue(value);
        }
    }

    /**
     * Sets a boolean parameter value
     */
    public setBool(name: string, value: boolean): void {
        const param = this.parameters.get(name);
        if (param && param.type === ParameterType.Bool) {
            param.setValue(value);
        }
    }

    /**
     * Sets a trigger parameter
     */
    public setTrigger(name: string): void {
        const param = this.parameters.get(name);
        if (param && param.type === ParameterType.Trigger) {
            param.setValue(true);
        }
    }

    /**
     * Sets the weight of an animation layer
     */
    public setLayerWeight(index: number, weight: number): void {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].setWeight(weight);
        }
    }

    /**
     * Extracts root motion from the current animation frame
     */
    private extractRootMotion(): void {
        if (!this.rootBone) return;


        // Extract motion from base layer only
        if (this.layers.length > 0) {
            const baseLayer = this.layers[0];
            const motion = baseLayer.extractRootMotion();
            
            if (motion) {
                // Apply extracted motion to root bone
                this.rootBone.position.addInPlace(motion.position);
                this.rootBone.rotationQuaternion?.multiplyInPlace(motion.rotation);
            }
        }
    }
}

// Types moved to types.ts
