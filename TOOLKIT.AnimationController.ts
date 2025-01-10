import * as BABYLON from 'babylonjs';

/** Babylon Toolkit Namespace */
export namespace TOOLKIT {
    export enum MotionType {
        Clip = 0,
        Tree = 1
    }

    export enum ConditionMode {
        If = 1,
        IfNot = 2,
        Greater = 3,
        Less = 4,
        Equals = 6,
        NotEqual = 7
    }

    export enum InterruptionSource {
        None = 0,
        Source = 1,
        Destination = 2,
        SourceThenDestination = 3,
        DestinationThenSource = 4
    }

    export enum BlendTreeType {
        Simple1D = 0,
        SimpleDirectional2D = 1,
        FreeformDirectional2D = 2,
        FreeformCartesian2D = 3,
        Direct = 4,
        Clip = 5
    }

    export enum AnimatorParameterType {
        Float = 1,
        Int = 3,
        Bool = 4,
        Trigger = 9
    }

    export interface IAnimatorEvent {
        id: number;
        clip: string;
        time: number;
        function: string;
        intParameter: number;
        floatParameter: number;
        stringParameter: string;
        objectIdParameter: string;
        objectNameParameter: string;
    }

    export interface IAvatarMask {
        hash: number;
        maskName: string;
        maskType: string;
        transformCount: number;
        transformPaths: string[];
    }

    export interface IAnimationLayer {
        owner: string;
        hash: number;
        name: string;
        index: number;
        entry: string;
        machine: string;
        iKPass: boolean;
        avatarMask: IAvatarMask;
        blendingMode: number;
        defaultWeight: number;
        syncedLayerIndex: number;
        syncedLayerAffectsTiming: boolean;
        animationTime: number;
        animationNormal: number;
        animationMaskMap: Map<string, number>;
        animationFirstRun: boolean;
        animationEndFrame: boolean;
        animationLoopFrame: boolean;
        animationLoopCount: number;
        animationLoopEvents: any;
        animationStateMachine: MachineState;
    }

    export interface ICondition {
        hash: number;
        mode: ConditionMode;
        parameter: string;
        threshold: number;
    }

    export interface ITransition {
        hash: number;
        anyState: boolean;
        layerIndex: number;
        machineLayer: string;
        machineName: string;
        canTransitionToSelf: boolean;
        destination: string;
        duration: number;
        exitTime: number;
        hasExitTime: boolean;
        fixedDuration: boolean;
        intSource: InterruptionSource;
        isExit: boolean;
        mute: boolean;
        name: string;
        offset: number;
        orderedInt: boolean;
        solo: boolean;
        conditions: ICondition[];
    }

    export interface IBlendTreeChild {
        hash: number;
        layerIndex: number;
        cycleOffset: number;
        directBlendParameter: string;
        apparentSpeed: number;
        averageAngularSpeed: number;
        averageDuration: number;
        averageSpeed: number[];
        mirror: boolean;
        type: MotionType;
        motion: string;
        positionX: number;
        positionY: number;
        threshold: number;
        timescale: number;
        subtree: IBlendTree;
        weight: number;
        ratio: number;
        track: BABYLON.AnimationGroup;
    }

    export interface IBlendTree {
        hash: number;
        name: string;
        state: string;
        children: IBlendTreeChild[];
        layerIndex: number;
        apparentSpeed: number;
        averageAngularSpeed: number;
        averageDuration: number;
        averageSpeed: number[];
        blendParameterX: string;
        blendParameterY: string;
        blendType: BlendTreeType;
        isAnimatorMotion: boolean;
        isHumanMotion: boolean;
        isLooping: boolean;
        minThreshold: number;
        maxThreshold: number;
        useAutomaticThresholds: boolean;
        valueParameterX: number;
        valueParameterY: number;
    }

    export class MachineState {
        public hash: number = 0;
        public name: string = "";
        public tag: string = "";
        public time: number = 0;
        public type: MotionType = MotionType.Clip;
        public rate: number = 30;
        public length: number = 0;
        public layer: string = "";
        public layerIndex: number = 0;
        public played: number = 0;
        public machine: string = "";
        public motionid: number = 0;
        public interrupted: boolean = false;
        public apparentSpeed: number = 0;
        public averageAngularSpeed: number = 0;
        public averageDuration: number = 0;
        public averageSpeed: number[] = [];
        public cycleOffset: number = 0;
        public cycleOffsetParameter: string = "";
        public cycleOffsetParameterActive: boolean = false;
        public iKOnFeet: boolean = false;
        public mirror: boolean = false;
        public mirrorParameter: string = "";
        public mirrorParameterActive: boolean = false;
        public speed: number = 1;
        public speedParameter: string = "";
        public speedParameterActive: boolean = false;
        public blendtree: IBlendTree | null = null;
        public transitions: ITransition[] = [];
        public behaviours: any[] = [];
        public events: IAnimatorEvent[] = [];
        public ccurves: any[] = [];
        public tcurves: BABYLON.Animation[] = [];
    }

    /**
     * Unity-style Animation Controller for Babylon.js
     * Provides state machine-based animation control with support for
     * blend trees, layers, and avatar masks
     */
    export class AnimationController {
        private readonly _scene: BABYLON.Scene;
        private readonly animations: Map<string, BABYLON.AnimationGroup>;
        private rootBone?: BABYLON.TransformNode;
        
        // State machine data
        private readonly layers: IAnimationLayer[];
        private readonly parameters: Map<string, AnimatorParameterType>;
        private readonly _parameterValues: Map<string, number | boolean>;
        private readonly currentStates: Map<number, MachineState>;
        private readonly _transitions: Map<string, ITransition[]>;
        private readonly activeTransitions: Map<number, { from: MachineState; to: MachineState; transition: ITransition; progress: number }>;
        
        // Store states by name, similar to AnimationState.ts's _data Map
        private readonly namedStates: Map<string, MachineState>;
        
        // Animation sampling data
        private currentTime: number = 0;
        private deltaTime: number = 0;
        private lastFrameTime: number = 0;

        
        // Animation speed control
        public speedRatio: number = 1.0;
        
        // Root motion
        private readonly _rootMotionDelta: BABYLON.Vector3;
        private readonly _rootMotionRotation: BABYLON.Quaternion;
        private readonly _rootMotionMatrix: BABYLON.Matrix;
        private readonly _rootMotionPosition: BABYLON.Vector3;
        private readonly _lastMotionPosition: BABYLON.Vector3;
        private readonly _lastMotionRotation: BABYLON.Quaternion;
        private readonly _angularVelocity: BABYLON.Vector3;
        private _rootMotionSpeed: number = 0;
        
        public get scene(): BABYLON.Scene {
            return this._scene;
        }
        
        public get rootMotionDelta(): BABYLON.Vector3 {
            return this._rootMotionDelta;
        }
        
        public get rootMotionRotation(): BABYLON.Quaternion {
            return this._rootMotionRotation;
        }
        
        public get rootMotionMatrix(): BABYLON.Matrix {
            return this._rootMotionMatrix;
        }
        
        public get rootMotionPosition(): BABYLON.Vector3 {
            return this._rootMotionPosition;
        }
        
        public get rootMotionSpeed(): number {
            return this._rootMotionSpeed;
        }
        
        // Observables for animation events
        public onAnimationStateChangeObservable: BABYLON.Observable<{ layerIndex: number; state: MachineState }>;
        public onAnimationTransitionObservable: BABYLON.Observable<{ layerIndex: number; from: MachineState; to: MachineState }>;
        public onAnimationEventObservable: BABYLON.Observable<IAnimatorEvent>;
    
    /**
     * Creates a new Animation Controller instance
     * @param scene The Babylon.js scene
     */
        constructor(scene: BABYLON.Scene) {
            this._scene = scene;
            this.animations = new Map<string, BABYLON.AnimationGroup>();
            this.parameters = new Map<string, AnimatorParameterType>();
            this._parameterValues = new Map<string, number | boolean>();
            this.currentStates = new Map<number, MachineState>();
            this._transitions = new Map<string, ITransition[]>();
            this.activeTransitions = new Map();
            this.layers = new Array<IAnimationLayer>();
            this.namedStates = new Map<string, MachineState>();
            
            // Initialize root motion properties
            this._rootMotionDelta = new BABYLON.Vector3();
            this._rootMotionRotation = new BABYLON.Quaternion();
            this._rootMotionMatrix = BABYLON.Matrix.Identity();
            this._rootMotionPosition = new BABYLON.Vector3();
            this._lastMotionPosition = new BABYLON.Vector3();
            this._lastMotionRotation = new BABYLON.Quaternion();
            this._angularVelocity = new BABYLON.Vector3();

            // Initialize observables
            this.onAnimationStateChangeObservable = new BABYLON.Observable();
            this.onAnimationTransitionObservable = new BABYLON.Observable();
            this.onAnimationEventObservable = new BABYLON.Observable();
    }

    /**
     * Initialize the animation controller with machine data and animations
     * @param machineJson The parsed machine.json data object
     * @param animations Array of animation groups
     * @param rootBone Optional root bone for root motion
     */
    public initialize(
        machineJson: any,
        animations: BABYLON.AnimationGroup[],
        rootBone?: BABYLON.TransformNode
    ): void {
        if (!machineJson) {
            throw new Error("Machine data is required for initialization");
        }

        // Store references
        this.rootBone = rootBone;
        
        // Register animations
        animations.forEach(anim => {
            this.animations.set(anim.name, anim);
        });

        // Parse machine data
        // Initialize parameters
        if (machineJson.parameters) {
            Object.entries(machineJson.parameters).forEach(([key, param]: [string, any]) => {
                if (!param || typeof param.type !== 'number') {
                    throw new Error(`Invalid parameter definition for ${key}`);
                }

                const paramType = param.type as AnimatorParameterType;
                this.parameters.set(key, paramType);

                // Validate and set default value based on type
                switch (paramType) {
                    case AnimatorParameterType.Float:
                        this._parameterValues.set(key, typeof param.defaultValue === 'number' ? param.defaultValue : 0);
                        break;
                    case AnimatorParameterType.Int:
                        this._parameterValues.set(key, typeof param.defaultValue === 'number' ? Math.floor(param.defaultValue) : 0);
                        break;
                    case AnimatorParameterType.Bool:
                        this._parameterValues.set(key, !!param.defaultValue);
                        break;
                    case AnimatorParameterType.Trigger:
                        this._parameterValues.set(key, false);
                        break;
                    default:
                        throw new Error(`Unsupported parameter type: ${paramType}`);
                }
            });
        }

        // Initialize states from machineJson.states
        if (Array.isArray(machineJson.states)) {
            machineJson.states.forEach((stateData: Partial<MachineState>) => {
                const state = new MachineState();
                Object.assign(state, stateData);
                
                // Store state by name for later retrieval
                if (state.name) {
                    this.namedStates.set(state.name, state);
                }
            });
        }

        // Initialize layers
        if (!Array.isArray(machineJson.layers)) {
            throw new Error("Machine data must contain layers array");
        }

        Object.assign(this.layers, machineJson.layers);
        this.layers.forEach((layer, index) => {
            if (!layer.name || typeof layer.index !== 'number') {
                throw new Error(`Invalid layer definition at index ${index}`);
            }

            // Initialize layer's animation mask map
            layer.animationMaskMap = new Map<string, number>();
            
            // Set initial state from machine configuration
            if (layer.entry) {
                const storedState = this.namedStates.get(layer.entry);
                if (storedState) {
                    this.setState(layer.entry, index);
                } else {
                    console.warn(`Entry state '${layer.entry}' not found for layer ${layer.name}`);
                }
            } else {
                console.warn(`No entry state defined for layer ${layer.name}`);
            }

            // Initialize avatar mask if present
            if (layer.avatarMask) {
                if (!Array.isArray(layer.avatarMask.transformPaths)) {
                    throw new Error(`Invalid avatar mask for layer ${layer.name}`);
                }
            }
        });
    }

    /**
     * Update animation states and blend trees
     * Should be called each frame in the render loop
     */
    public update(): void {
        // Calculate delta time
        const currentTime = BABYLON.Tools.Now;
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = currentTime;
        this.currentTime += this.deltaTime;

        // Update each layer
        this.layers.forEach((layer, layerIndex) => {
            this.updateLayer(layer, layerIndex);
        });

        // Apply root motion if enabled
        if (this.rootBone) {
            this.applyRootMotion();
        }
    }

    /**
     * Set the current state by name
     * @param stateName Name of the state to transition to
     * @param layerIndex Optional layer index (defaults to 0)
     */
    public setState(stateName: string, layerIndex: number = 0): void {
        const layer = this.layers[layerIndex];
        if (!layer) {
            throw new Error(`Invalid layer index: ${layerIndex}`);
        }

        // Get the state definition from namedStates
        const storedState = this.namedStates.get(stateName);
        if (!storedState) {
            throw new Error(`State '${stateName}' not found in machine configuration`);
        }

        // Update layer-specific properties
        storedState.layerIndex = layerIndex;
        storedState.layer = layer.name;
        storedState.time = 0;
        storedState.played = 0;
        storedState.interrupted = false;

        // Handle animation properties
        if (!storedState.name || !this.animations.has(storedState.name)) {
            storedState.type = MotionType.Clip;
            storedState.length = 0;
            storedState.speed = 0;
        } else {
            const anim = this.animations.get(storedState.name);
            if (anim) {
                storedState.length = anim.to;
                storedState.speed = 1.0;
            }
        }

        // Cancel any active transition
        this.activeTransitions.delete(layerIndex);
        
        // Set the state buffer in the layer and update current states
        layer.animationStateMachine = storedState;
        this.currentStates.set(layerIndex, storedState);
        
        // Notify observers of state change
        this.onAnimationStateChangeObservable.notifyObservers({ layerIndex, state: storedState });
    }

    /**
     * Set a parameter value
     * @param name Parameter name
     * @param value Parameter value
     */
    public setParameter(name: string, value: number | boolean): void {
        this._parameterValues.set(name, value);
    }

    /**
     * Get a parameter value
     * @param name Parameter name
     * @returns Parameter value or undefined if not found
     */
    public getParameter(name: string): number | boolean | undefined {
        return this._parameterValues.get(name);
    }

    /**
     * Update a single animation layer
     * @param layer Layer to update
     * @param layerIndex Index of the layer
     */
        private updateLayer(layer: IAnimationLayer, layerIndex: number): void {
            const currentState = this.currentStates.get(layerIndex);
            if (!currentState || !layer.animationStateMachine) return;

            // Handle active transitions
            const activeTransition = this.activeTransitions.get(layerIndex);
            if (activeTransition) {
                activeTransition.progress += this.deltaTime / activeTransition.transition.duration;
                if (activeTransition.progress >= 1.0) {
                    // Transition complete
                    this.currentStates.set(layerIndex, activeTransition.to);
                    this.activeTransitions.delete(layerIndex);
                    this.onAnimationStateChangeObservable.notifyObservers({ layerIndex, state: activeTransition.to });
                } else {
                    // Update transition blending
                    this.updateTransitionBlending(activeTransition, layer);
                }
            } else {
                // Check for new transitions
                const transition = this.findValidTransition(currentState);
                if (transition) {
                    // Get target state from namedStates
                    const targetState = this.namedStates.get(transition.destination);
                    if (targetState) {
                        // Update layer-specific properties
                        targetState.layerIndex = layerIndex;
                        targetState.layer = layer.name;
                        targetState.time = 0;
                        targetState.played = 0;
                        targetState.interrupted = false;

                        this.activeTransitions.set(layerIndex, {
                            from: currentState,
                            to: targetState,
                            transition,
                            progress: 0
                        });
                        this.onAnimationTransitionObservable.notifyObservers({ layerIndex, from: currentState, to: targetState });
                    }
                }
            }

            // Update current state
            if (currentState.type === MotionType.Tree && currentState.blendtree) {
                this.updateBlendTree(currentState.blendtree, layer);
            } else if (currentState.type === MotionType.Clip) {
                this.sampleAnimation(currentState, layer);
            }

            // Apply avatar mask if present
            if (layer.avatarMask) {
                this.applyAvatarMask(layer.avatarMask, currentState);
            }
        }

        private findValidTransition(state: MachineState): ITransition | null {
            // Get all transitions
            const stateTransitions = this._transitions.get(state.name) || [];
            const anyTransitions = this._transitions.get('ANY') || [];
            const allTransitions = [...stateTransitions, ...anyTransitions];

            // Check for solo transitions first
            const soloTransition = allTransitions.find(t => t.solo === true && t.mute === false);
            if (soloTransition) {
                if (this.checkTransitionConditions(soloTransition) && this.checkExitTime(soloTransition)) {
                    return soloTransition;
                }
                return null;
            }

            // Check regular transitions
            for (const transition of allTransitions) {
                if (transition.mute === true) continue;
                if (this.checkTransitionConditions(transition) && this.checkExitTime(transition)) {
                    return transition;
                }
            }
            return null;
        }

        private checkTransitionConditions(transition: ITransition): boolean {
            if (!transition.conditions || transition.conditions.length === 0) {
                return true;
            }

            let passed = 0;
            const checks = transition.conditions.length;

            for (const condition of transition.conditions) {
                const paramType = this.parameters.get(condition.parameter);
                if (!paramType) continue;

                if (paramType === AnimatorParameterType.Float || paramType === AnimatorParameterType.Int) {
                    const numValue = parseFloat(this.getParameter(condition.parameter)?.toString() || '0');
                    if (condition.mode === ConditionMode.Greater && numValue > condition.threshold) {
                        passed++;
                    } else if (condition.mode === ConditionMode.Less && numValue < condition.threshold) {
                        passed++;
                    } else if (condition.mode === ConditionMode.Equals && numValue === condition.threshold) {
                        passed++;
                    } else if (condition.mode === ConditionMode.NotEqual && numValue !== condition.threshold) {
                        passed++;
                    }
                } else if (paramType === AnimatorParameterType.Bool) {
                    const boolValue = !!this.getParameter(condition.parameter);
                    if (condition.mode === ConditionMode.If && boolValue === true) {
                        passed++;
                    } else if (condition.mode === ConditionMode.IfNot && boolValue === false) {
                        passed++;
                    }
                } else if (paramType === AnimatorParameterType.Trigger) {
                    const triggerValue = !!this.getParameter(condition.parameter);
                    if (triggerValue === true) {
                        passed++;
                    }
                }
            }

            return passed === checks;
        }

        private checkExitTime(transition: ITransition): boolean {
            const state = this.currentStates.get(transition.layerIndex);
            if (!state) return false;

            if (!transition.hasExitTime) return true;

            const exitTimeSecs = (state.length * transition.exitTime) / this.speedRatio;
            const exitTimeExpired = state.time >= exitTimeSecs;

            // Handle interruption sources
            if (!exitTimeExpired && transition.intSource === InterruptionSource.None) {
                return false;
            }

            return exitTimeExpired;
        }

        private updateTransitionBlending(transition: { from: MachineState; to: MachineState; transition: ITransition; progress: number }, layer: IAnimationLayer): void {
            const sourceWeight = 1.0 - transition.progress;
            const targetWeight = transition.progress;

            // Sample both states with appropriate weights
            if (transition.from.type === MotionType.Tree && transition.from.blendtree) {
                this.updateBlendTree(transition.from.blendtree, layer, sourceWeight);
            } else {
                this.sampleAnimation(transition.from, layer, sourceWeight);
            }

            if (transition.to.type === MotionType.Tree && transition.to.blendtree) {
                this.updateBlendTree(transition.to.blendtree, layer, targetWeight);
            } else {
                this.sampleAnimation(transition.to, layer, targetWeight);
            }
        }

        private updateBlendTree(blendTree: IBlendTree, layer: IAnimationLayer, weight: number = 1.0): void {
            if (!blendTree || !blendTree.children || blendTree.children.length === 0) {
                return;
            }

            // Initialize weights if not set
            blendTree.children.forEach(child => {
                if (typeof child.weight === 'undefined') {
                    child.weight = 0;
                }
            });
            
            // Calculate weights based on blend type
            switch (blendTree.blendType) {
                case BlendTreeType.Simple1D:
                    this.calculateSimple1DWeights(blendTree);
                    break;
                case BlendTreeType.SimpleDirectional2D:
                case BlendTreeType.FreeformDirectional2D:
                    this.calculate2DDirectionalWeights(blendTree);
                    break;
                case BlendTreeType.FreeformCartesian2D:
                    this.calculate2DCartesianWeights(blendTree);
                    break;
            }

            // Sample animations with calculated weights
            blendTree.children.forEach(child => {
                const childWeight = child.weight * weight;
                if (childWeight > 0) {
                    if (child.type === MotionType.Tree && child.subtree) {
                        this.updateBlendTree(child.subtree, layer, childWeight);
                    } else {
                        const animation = this.animations.get(child.motion);
                        if (animation) {
                            this.sampleAnimationGroup(animation, this.currentTime * (child.timescale || 1), childWeight);
                        }
                    }
                }
            });
        }

        private calculateSimple1DWeights(tree: IBlendTree): void {
            const value = this.getParameter(tree.blendParameterX) as number;
            if (typeof value !== 'number') return;

            const children = tree.children;
            if (!children || children.length === 0) return;

            // Initialize all weights to 0
            children.forEach(child => {
                if (!child.hasOwnProperty('weight')) {
                    child.weight = 0;
                }
            });

            if (children.length === 1) {
                children[0].weight = 1;
                return;
            }

            // Sort children by threshold
            const sortedChildren = [...children].sort((a, b) => a.threshold - b.threshold);

            // Handle value below first threshold
            if (value <= sortedChildren[0].threshold) {
                sortedChildren[0].weight = 1;
                return;
            }

            // Handle value above last threshold
            if (value >= sortedChildren[sortedChildren.length - 1].threshold) {
                sortedChildren[sortedChildren.length - 1].weight = 1;
                return;
            }

            // Find and interpolate between appropriate thresholds
            for (let i = 0; i < sortedChildren.length - 1; i++) {
                const current = sortedChildren[i];
                const next = sortedChildren[i + 1];

                if (value >= current.threshold && value <= next.threshold) {
                    const t = (value - current.threshold) / (next.threshold - current.threshold);
                    current.weight = 1 - t;
                    next.weight = t;
                    break;
                }
            }
        }

        private calculate2DDirectionalWeights(tree: IBlendTree): void {
            const paramX = this._parameterValues.get(tree.blendParameterX);
            const paramY = this._parameterValues.get(tree.blendParameterY);
            if (typeof paramX !== 'number' || typeof paramY !== 'number') return;

            const position = new BABYLON.Vector2(paramX, paramY);
            const magnitude = position.length();
            
            if (magnitude < 0.001) {
                const weight = 1.0 / tree.children.length;
                tree.children.forEach(child => child.weight = weight);
                return;
            }

            // Calculate raw weights
            tree.children.forEach(child => {
                const childPos = new BABYLON.Vector2(child.positionX, child.positionY);
                const childDir = childPos.normalize();
                const dot = BABYLON.Vector2.Dot(position.normalize(), childDir);
                child.weight = Math.max(0, dot);
            });

            // Normalize weights
            let total = 0;
            tree.children.forEach(child => total += child.weight);
            if (total > 0) {
                tree.children.forEach(child => child.weight /= total);
            }
        }

        private calculate2DCartesianWeights(tree: IBlendTree): void {
            const paramX = this._parameterValues.get(tree.blendParameterX);
            const paramY = this._parameterValues.get(tree.blendParameterY);
            if (typeof paramX !== 'number' || typeof paramY !== 'number') return;

            const position = new BABYLON.Vector2(paramX, paramY);
            
            // Initialize all weights to 0
            tree.children.forEach(child => child.weight = 0);
            
            // Find the four closest motions forming a quad
            const quad = this.findEnclosingQuad(tree.children, position);
            if (!quad) return;

            const [topLeft, topRight, bottomLeft, bottomRight] = quad;
            const xRange = topRight.positionX - topLeft.positionX;
            const yRange = topLeft.positionY - bottomLeft.positionY;
            
            if (xRange === 0 || yRange === 0) return;

            const xFactor = (paramX - topLeft.positionX) / xRange;
            const yFactor = (topLeft.positionY - paramY) / yRange;

            topLeft.weight = (1 - xFactor) * (1 - yFactor);
            topRight.weight = xFactor * (1 - yFactor);
            bottomLeft.weight = (1 - xFactor) * yFactor;
            bottomRight.weight = xFactor * yFactor;
        }

        private findEnclosingQuad(children: IBlendTreeChild[], position: BABYLON.Vector2): IBlendTreeChild[] | null {
            if (children.length < 4) return null;

            // Sort children by distance to position
            const sorted = [...children].sort((a, b) => {
                const distA = Math.pow(a.positionX - position.x, 2) + Math.pow(a.positionY - position.y, 2);
                const distB = Math.pow(b.positionX - position.x, 2) + Math.pow(b.positionY - position.y, 2);
                return distA - distB;
            });

            // Take the four closest points
            return [sorted[0], sorted[1], sorted[2], sorted[3]];
        }

        private sampleAnimation(state: MachineState, _layer: IAnimationLayer, weight: number = 1.0): void {
            if (state.type === MotionType.Clip) {
                const animation = this.animations.get(state.name);
                if (animation) {
                    this.sampleAnimationGroup(animation, state.time, weight);
                    
                    // Update state time
                    state.time += this.deltaTime * state.speed;
                    if (state.time >= state.length) {
                        state.time = state.time % state.length;
                        this.onAnimationEventObservable.notifyObservers({ 
                            id: 0,
                            clip: state.name,
                            time: state.time,
                            function: "loop"
                        } as IAnimatorEvent);
                    }
                }
            }
        }

        private sampleAnimationGroup(animation: BABYLON.AnimationGroup, time: number, weight: number): void {
            const normalizedTime = time % animation.to;
            animation.targetedAnimations.forEach(targetAnim => {
                const keys = targetAnim.animation.getKeys();
                if (keys.length < 2) return;

                // Find the two keyframes to interpolate between
                let frameIndex = 0;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (keys[i].frame <= normalizedTime && keys[i + 1].frame >= normalizedTime) {
                        frameIndex = i;
                        break;
                    }
                }

                const key1 = keys[frameIndex];
                const key2 = keys[frameIndex + 1];
                const frameDiff = key2.frame - key1.frame;
                const fraction = frameDiff !== 0 ? (normalizedTime - key1.frame) / frameDiff : 0;

                // Interpolate between keyframes
                if (targetAnim.target instanceof BABYLON.TransformNode) {
                    if (this.rootBone && targetAnim.target === this.rootBone) {
                        this.extractRootMotion(key1.value, key2.value, fraction, weight);
                    } else {
                        this.interpolateTransform(targetAnim.target, key1.value, key2.value, fraction, weight);
                    }
                }
            });
        }

        private interpolateTransform(target: BABYLON.TransformNode, start: any, end: any, fraction: number, weight: number): void {
            if (!target || !start || !end) return;

            if (start instanceof BABYLON.Vector3 && end instanceof BABYLON.Vector3) {
                // Initialize position if needed
                if (!target.position) {
                    target.position = new BABYLON.Vector3();
                }
                
                // Interpolate between keyframes first
                const interpolated = new BABYLON.Vector3();
                BABYLON.Vector3.LerpToRef(start, end, fraction, interpolated);
                
                // Apply weight blending in place
                if (weight === 1.0) {
                    target.position.copyFrom(interpolated);
                } else {
                    target.position.scaleInPlace(1.0 - weight);
                    interpolated.scaleInPlace(weight);
                    target.position.addInPlace(interpolated);
                }
            } else if (start instanceof BABYLON.Quaternion && end instanceof BABYLON.Quaternion) {
                // Initialize rotation if needed
                if (!target.rotationQuaternion) {
                    target.rotationQuaternion = BABYLON.Quaternion.Identity();
                }
                
                // Interpolate between keyframes first
                const interpolated = new BABYLON.Quaternion();
                BABYLON.Quaternion.SlerpToRef(start, end, fraction, interpolated);
                
                // Apply weight blending in place and normalize
                if (weight === 1.0) {
                    target.rotationQuaternion.copyFrom(interpolated);
                } else {
                    BABYLON.Quaternion.SlerpToRef(
                        target.rotationQuaternion,
                        interpolated,
                        weight,
                        target.rotationQuaternion
                    );
                }
                
                // Ensure quaternion is normalized
                target.rotationQuaternion.normalize();
            }
        }

        private extractRootMotion(start: any, end: any, _fraction: number, weight: number): void {
            if (start instanceof BABYLON.Vector3 && end instanceof BABYLON.Vector3) {
                const delta = end.subtract(start);
                this.rootMotionDelta.addInPlace(delta.scale(weight));
            } else if (start instanceof BABYLON.Quaternion && end instanceof BABYLON.Quaternion) {
                const delta = end.multiply(BABYLON.Quaternion.Inverse(start));
                const newRotation = BABYLON.Quaternion.Slerp(
                    BABYLON.Quaternion.Identity(),
                    delta,
                    weight
                );
                this._rootMotionRotation.copyFrom(newRotation.multiply(this._rootMotionRotation));
            }
        }

        /**
         * Set the weight of an animation layer
         * @param layerIndex The index of the layer to set the weight for
         * @param weight The weight value between 0 and 1
         */
        public setLayerWeight(layerIndex: number, weight: number): void {
            const layer = this.layers.find(l => l.index === layerIndex);
            if (layer) {
                layer.defaultWeight = Math.max(0, Math.min(1, weight));
            }
        }

        private applyAvatarMask(mask: IAvatarMask, _state: MachineState, _layerWeight: number = 1): void {
            if (!mask.transformPaths || mask.transformPaths.length === 0) return;

            const transformSet = new Set(mask.transformPaths);
            
            // Apply mask to current animations with layer weight
            this.animations.forEach(animation => {
                animation.targetedAnimations.forEach(targetAnim => {
                    if (targetAnim.target instanceof BABYLON.TransformNode) {
                        const path = targetAnim.target.name; // Assuming name matches transform path
                        if (!transformSet.has(path)) {
                            // Reset transform if not in mask
                            if (targetAnim.target.position) {
                                targetAnim.target.position.setAll(0);
                            }
                            if (targetAnim.target.rotationQuaternion) {
                                targetAnim.target.rotationQuaternion.set(0, 0, 0, 1);
                            }
                        } else {
                            // Apply layer weight to masked transforms
                            if (targetAnim.target.position) {
                                targetAnim.target.position.scaleInPlace(_layerWeight);
                            }
                            if (targetAnim.target.rotationQuaternion) {
                                const identity = BABYLON.Quaternion.Identity();
                                BABYLON.Quaternion.SlerpToRef(
                                    identity,
                                    targetAnim.target.rotationQuaternion,
                                    _layerWeight,
                                    targetAnim.target.rotationQuaternion
                                );
                            }
                        }
                    }
                });
            });
        }

        /**
         * Apply accumulated root motion to the root bone
         */
        private applyRootMotion(): void {
            if (!this.rootBone) return;

            // Apply accumulated motion to root bone
            if (this._rootMotionDelta.lengthSquared() > 0) {
                this.rootBone.position.addInPlace(this._rootMotionDelta);
                this._rootMotionSpeed = this._rootMotionDelta.length() / this.deltaTime;
                this._rootMotionDelta.scaleInPlace(0);
            }

            if (!this._rootMotionRotation.equals(BABYLON.Quaternion.Identity())) {
                if (!this.rootBone.rotationQuaternion) {
                    this.rootBone.rotationQuaternion = new BABYLON.Quaternion();
                }
                this.rootBone.rotationQuaternion.multiplyInPlace(this._rootMotionRotation);
                
                // Calculate angular velocity
                const rotationDelta = this._rootMotionRotation.toEulerAngles();
                this._angularVelocity.copyFromFloats(
                    rotationDelta.x / this.deltaTime,
                    rotationDelta.y / this.deltaTime,
                    rotationDelta.z / this.deltaTime
                );
                
                this._rootMotionRotation.set(0, 0, 0, 1);
            }

            // Store current transform for next frame
            this._lastMotionPosition.copyFrom(this.rootBone.position);
            if (this.rootBone.rotationQuaternion) {
                this._lastMotionRotation.copyFrom(this.rootBone.rotationQuaternion);
            }
        }
    }
}
