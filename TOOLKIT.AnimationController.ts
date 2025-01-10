import * as BABYLON from 'babylonjs';

/** Babylon Toolkit Namespace */
export namespace TOOLKIT {
    export interface IAnimationMachine {
        parameters?: Array<{
            name: string;
            type: AnimatorParameterType;
            defaultFloat?: number;
            defaultInt?: number;
            defaultBool?: boolean;
        }>;
        layers?: Array<{
            name: string;
            index: number;
            entry: string;
            defaultWeight: number;
            avatarMask?: { [key: string]: number };
        }>;
        states?: Array<{
            name: string;
            layer: string;
            layerIndex: number;
            motion?: string;
            loop?: boolean;
            loopBlend?: boolean;
            transitions?: IStateTransition[];
            blendtree?: IBlendTree;
            time?: number;
            speed?: number;
            to?: number;
        }>;
    }

    export class Utilities {
        public static QuaternionDiffToRef(q1: BABYLON.Quaternion, q2: BABYLON.Quaternion, result: BABYLON.Quaternion): void {
            q1.multiplyToRef(BABYLON.Quaternion.Inverse(q2), result);
        }

        public static BlendQuaternionValue(target: BABYLON.Quaternion, value: BABYLON.Quaternion, weight: number): void {
            BABYLON.Quaternion.SlerpToRef(target, value, weight, target);
        }

        public static FastMatrixSlerp(start: BABYLON.Matrix, end: BABYLON.Matrix, amount: number, result: BABYLON.Matrix): void {
            // Decompose matrices
            const sourceScale = new BABYLON.Vector3();
            const sourceRotation = new BABYLON.Quaternion();
            const sourcePosition = new BABYLON.Vector3();
            start.decompose(sourceScale, sourceRotation, sourcePosition);

            const targetScale = new BABYLON.Vector3();
            const targetRotation = new BABYLON.Quaternion();
            const targetPosition = new BABYLON.Vector3();
            end.decompose(targetScale, targetRotation, targetPosition);

            // Interpolate values
            const resultScale = BABYLON.Vector3.Lerp(sourceScale, targetScale, amount);
            const resultRotation = new BABYLON.Quaternion();
            BABYLON.Quaternion.SlerpToRef(sourceRotation, targetRotation, amount, resultRotation);
            const resultPosition = BABYLON.Vector3.Lerp(sourcePosition, targetPosition, amount);

            // Compose result matrix
            BABYLON.Matrix.ComposeToRef(resultScale, resultRotation, resultPosition, result);
        }
    }

    export enum AnimatorParameterType {
        Float = 1,
        Int = 2,
        Bool = 3,
        Trigger = 4
    }

    export enum BlendTreeType {
        Simple1D = 1,
        Simple2DDirectional = 2,
        FreeformDirectional2D = 3,
        FreeformCartesian2D = 4
    }

    export interface IBlendTree {
        blendType: BlendTreeType;
        blendParameterX: string;
        blendParameterY?: string;
        children: Array<{
            motion: string;
            threshold?: number;
            positionX?: number;
            positionY?: number;
            weight?: number;
        }>;
        maxRadius?: number;
    }

    export interface IMorphTarget {
        influence: number;
    }

    export interface ITransformBuffer {
        position: BABYLON.Vector3 | null;
        rotation: BABYLON.Quaternion | null;
        scaling: BABYLON.Vector3 | null;
        originalMatrix: BABYLON.Matrix | null;
        blendingFactor: number;
        blendingSpeed: number;
        targetTransform: BABYLON.TransformNode | null;
        positionBuffer: BABYLON.Vector3;
        rotationBuffer: BABYLON.Quaternion;
        scalingBuffer: BABYLON.Vector3;
        rootPosition: BABYLON.Vector3 | null;
        rootRotation: BABYLON.Quaternion | null;
    }

    export interface IAnimationState {
        name: string;
        layer: string;
        layerIndex: number;
        motion?: BABYLON.AnimationGroup;
        loop?: boolean;
        loopBlend?: boolean;
        transitions?: IStateTransition[];
        blendtree?: IBlendTree;
        time?: number;
        speed?: number;
        to?: number;
    }

    export interface IStateTransition {
        destination: string;
        hasExitTime: boolean;
        exitTime?: number;
        isAny?: boolean;
        layerIndex: number;
        layer?: string;
        duration?: number;
        fixedDuration?: boolean;
        offset?: number;
        conditions?: ITransitionCondition[];
    }

    export interface ITransitionCondition {
        parameter: string;
        mode: number;
        threshold: number | boolean;
    }

    export interface IVector2 {
        x: number;
        y: number;
    }

    export interface ITriangle {
        points: BABYLON.Vector2[];
        indices: number[];
    }

    export class AnimationLayer {
        private currentState: IAnimationState | null;
        private states: Map<string, IAnimationState>;
        private avatarMask: Map<string, number>;
        private time: number;
        private speed: number;
        private index: number;
        private name: string;
        private defaultWeight: number;
        private _loopBlend: boolean;
        private _length: number;
        private _frametime: number;
        private _looptime: boolean;

        // Matrix buffers for transform blending
        private _blenderMatrix: BABYLON.Matrix;
        private _updateMatrix: BABYLON.Matrix;
        private _dirtyBlenderMatrix: boolean;
        private _transformBuffers: Map<string, ITransformBuffer>;

        constructor(layerData: any, index: number, machine: any) {
            this.currentState = null;
            this.states = new Map();
            this.avatarMask = new Map();
            this.time = 0;
            this.speed = 1;
            this.index = index;
            this.name = layerData.name;
            this.defaultWeight = layerData.defaultWeight || 1;
            this._loopBlend = false;
            this._length = 0;
            this._frametime = 0;
            this._looptime = false;

            // Initialize matrix buffers
            this._blenderMatrix = BABYLON.Matrix.Identity();
            this._updateMatrix = BABYLON.Matrix.Identity();
            this._dirtyBlenderMatrix = false;
            this._transformBuffers = new Map();

            // Setup states from machine.states filtered by layer
            if (machine.states) {
                const layerStates = machine.states.filter((state: any) => 
                    state.layerIndex === index || state.layer === layerData.name
                );
                layerStates.forEach((stateData: any) => {
                    this.states.set(stateData.name, stateData);
                });
            }

            // Setup avatar mask
            if (layerData.avatarMask) {
                Object.entries(layerData.avatarMask).forEach(([path, weight]: [string, any]) => {
                    this.avatarMask.set(path, weight);
                });
            }

            // Set initial state from entry point
            if (layerData.entry) {
                this.setState(layerData.entry);
            }
        }

        public setState(stateName: string): void {
            if (!stateName || stateName === "") {
                console.warn("Invalid state name provided");
                return;
            }

            const state = this.states.get(stateName);
            if (!state) {
                console.warn(`State ${stateName} not found`);
                return;
            }

            // Verify state belongs to this layer
            if (state.layerIndex === this.index || state.layer === this.name) {
                // Initialize state properties
                this.currentState = state;
                this.time = 0;
                this._frametime = 0;
                this._loopBlend = state.loopBlend || false;
                this._looptime = state.loop || false;
                this._length = state.motion?.to || 0;
            } else {
                console.warn(`State ${stateName} does not belong to layer ${this.name} (index: ${this.index})`);
            }
        }

        public getCurrentState(): IAnimationState | null {
            return this.currentState;
        }

        public getAvatarMaskWeight(transform: BABYLON.TransformNode): number {
            if (this.avatarMask.size === 0) return 1;

            // Check direct match
            if (this.avatarMask.has(transform.name)) {
                return this.avatarMask.get(transform.name) || 0;
            }

            // Check parent hierarchy and use closest parent's weight
            let current: BABYLON.Node | null = transform;
            while (current) {
                if (this.avatarMask.has(current.name)) {
                    return this.avatarMask.get(current.name) || 0;
                }
                current = current.parent;
            }

            // If no mask entry found in hierarchy, allow full weight
            return 1;
        }

        public checkAvatarMask(transform: BABYLON.TransformNode): boolean {
            return this.getAvatarMaskWeight(transform) > 0;
        }

        public getAnimationTime(): number {
            return this.time;
        }

        public update(deltaTime: number, parameters: Map<string, any>): void {
            if (!this.currentState) return;

            // Handle EMPTY states
            if (!this.currentState.motion && !this.currentState.blendtree) {
                return; // Do nothing for EMPTY states
            }

            // Update animation time with looping
            if (this._looptime) {
                this.time = (this.time + deltaTime * this.speed) % this._length;
            } else {
                this.time = Math.min(this.time + deltaTime * this.speed, this._length);
            }
            this._frametime = this.time;

            // Check for transitions
            this.checkTransitions(parameters);
        }

        private checkTransitions(parameters: Map<string, any>): void {
            if (!this.currentState || !this.currentState.transitions) return;

            for (const transition of this.currentState.transitions) {
                // Skip transitions that don't belong to this layer
                if (transition.layerIndex !== this.index) continue;

                if (this.evaluateTransition(transition, parameters)) {
                    // Verify destination state exists and belongs to this layer
                    const destState = this.states.get(transition.destination);
                    if (destState && (destState.layerIndex === this.index || destState.layer === this.name)) {
                        this.setState(transition.destination);
                        break;
                    } else {
                        console.warn(`Invalid transition destination: ${transition.destination} for layer ${this.name}`);
                    }
                }
            }
        }

        private evaluateTransition(transition: IStateTransition, parameters: Map<string, any>): boolean {
            // Skip transitions for different layers
            if (transition.layerIndex !== this.index) return false;

            // Handle ANY state transitions
            if (transition.isAny) return true;

            // Check exit time if specified
            if (transition.hasExitTime) {
                const exitTimeNormalized = transition.exitTime || 0;
                const currentTimeNormalized = this.time / this._length;
                if (currentTimeNormalized < exitTimeNormalized) {
                    return false;
                }
            }

            // If no conditions, transition is valid
            if (!transition.conditions || transition.conditions.length === 0) {
                return transition.hasExitTime ? true : false;
            }

            // Check all conditions
            return transition.conditions.every(condition => {
                const paramValue = parameters.get(condition.parameter);
                if (paramValue === undefined) return false;

                const threshold = condition.threshold;
                switch (condition.mode) {
                    case 0: // Equals
                        return Math.abs(paramValue - (threshold as number)) < 0.001;
                    case 1: // Greater
                        return paramValue > threshold;
                    case 2: // Less
                        return paramValue < threshold;
                    case 3: // Not Equal
                        return Math.abs(paramValue - (threshold as number)) >= 0.001;
                    case 4: // If (for booleans)
                        return paramValue === true;
                    case 5: // IfNot (for booleans)
                        return paramValue === false;
                    default:
                        return false;
                }
            });
        }

        public blendTransformValue(target: BABYLON.TransformNode | IMorphTarget, value: any, weight: number): void {
            // Apply layer and avatar mask weights
            const maskWeight = target instanceof BABYLON.TransformNode ? this.getAvatarMaskWeight(target) : 1;
            weight *= this.defaultWeight * maskWeight;

            if (weight <= 0) return; // Skip if no influence

            if (target instanceof BABYLON.TransformNode) {
                const targetId = target.uniqueId.toString();
                if (!this._transformBuffers.has(targetId)) {
                    this._transformBuffers.set(targetId, {
                        position: null,
                        rotation: null,
                        scaling: null,
                        originalMatrix: null,
                        blendingFactor: 0,
                        blendingSpeed: 0.1, // Default blending speed
                        targetTransform: target,
                        positionBuffer: new BABYLON.Vector3(0, 0, 0),
                        rotationBuffer: new BABYLON.Quaternion(),
                        scalingBuffer: new BABYLON.Vector3(1, 1, 1),
                        rootPosition: null,
                        rootRotation: null
                    });
                }

                const buffer = this._transformBuffers.get(targetId)!;

                if (value instanceof BABYLON.Vector3) {
                    // Store position in buffer
                    if (!buffer.position) {
                        buffer.position = new BABYLON.Vector3();
                    }
                    const blendTarget = this._loopBlend && this._looptime && Math.abs(this.time - this.getLength()) < 0.001
                        ? BABYLON.Vector3.Lerp(value, this.sampleAnimationValue(target, 0) as BABYLON.Vector3 || value, 0.5)
                        : value;
                    buffer.position.copyFrom(blendTarget);
                } else if (value instanceof BABYLON.Quaternion) {
                    // Store rotation in buffer
                    if (!buffer.rotation) {
                        buffer.rotation = new BABYLON.Quaternion();
                    }
                    if (this._loopBlend && this._looptime && Math.abs(this.time - this.getLength()) < 0.001) {
                        // Handle loop blending with SLERP
                        const nextValue = this.sampleAnimationValue(target, 0) as BABYLON.Quaternion || value;
                        BABYLON.Quaternion.SlerpToRef(value, nextValue, 0.5, buffer.rotation);
                    } else {
                        // Use BlendQuaternionValue for consistent quaternion handling
                        TOOLKIT.Utilities.BlendQuaternionValue(buffer.rotation, value, weight);
                    }
                }

                // Compose and blend matrices at the end of the frame
                if (buffer.position || buffer.rotation) {
                    BABYLON.Matrix.ComposeToRef(
                        target.scaling,
                        buffer.rotation || target.rotationQuaternion || new BABYLON.Quaternion(),
                        buffer.position || target.position,
                        this._updateMatrix
                    );

                    // Handle blending speed
                    if (buffer.blendingSpeed > 0 && buffer.blendingFactor <= 1.0) {
                        if (!buffer.originalMatrix) {
                            buffer.originalMatrix = BABYLON.Matrix.Compose(
                                target.scaling,
                                target.rotationQuaternion || new BABYLON.Quaternion(),
                                target.position
                            );
                        }
                        this.fastMatrixSlerp(buffer.originalMatrix, this._updateMatrix, buffer.blendingFactor, this._updateMatrix);
                        buffer.blendingFactor += buffer.blendingSpeed;
                    }

                    this.fastMatrixSlerp(this._blenderMatrix, this._updateMatrix, weight, this._blenderMatrix);
                    this._dirtyBlenderMatrix = true;
                }
            } else if ((target as any).influence !== undefined) {
                // Direct morph target update
                (target as IMorphTarget).influence = BABYLON.Scalar.Lerp(
                    (target as IMorphTarget).influence,
                    value,
                    weight
                );
            }
        }

        private sampleAnimationValue(target: BABYLON.TransformNode, time: number): BABYLON.Vector3 | BABYLON.Quaternion | null {
            if (!this.currentState || !this.currentState.motion) return null;
            
            const animation = this.currentState.motion.targetedAnimations.find(
                anim => anim.target === target
            );
            
            if (!animation) return null;

            const keys = animation.animation.getKeys();
            if (!keys || keys.length === 0) return null;

            const fps = animation.animation.framePerSecond;
            const totalFrames = keys[keys.length - 1].frame;
            const frame = (time * fps) % totalFrames;

            // Find the two keys to interpolate between
            let key1 = keys[0];
            let key2 = keys[0];

            for (let i = 0; i < keys.length; i++) {
                if (keys[i].frame <= frame) {
                    key1 = keys[i];
                    key2 = keys[i + 1] || keys[0]; // Loop back to first key if needed
                }
            }

            // Calculate interpolation factor
            const range = key2.frame - key1.frame;
            const factor = range <= 0 ? 0 : (frame - key1.frame) / range;

            // Interpolate based on animation property type
            switch (animation.animation.dataType) {
                case BABYLON.Animation.ANIMATIONTYPE_VECTOR3:
                    return BABYLON.Vector3.Lerp(key1.value, key2.value, factor);
                case BABYLON.Animation.ANIMATIONTYPE_QUATERNION:
                    const result = new BABYLON.Quaternion();
                    BABYLON.Quaternion.SlerpToRef(key1.value, key2.value, factor, result);
                    return result;
                case BABYLON.Animation.ANIMATIONTYPE_FLOAT:
                    // Convert float to Vector3 for consistent handling
                    const floatValue = BABYLON.Scalar.Lerp(key1.value, key2.value, factor);
                    return new BABYLON.Vector3(floatValue, 0, 0);
                default:
                    return null;
            }
        }

        public getFrametime(): number {
            return this._frametime;
        }

        public getLength(): number {
            return this._length;
        }

        public getLooptime(): boolean {
            return this._looptime;
        }

        public getLoopBlend(): boolean {
            return this._loopBlend;
        }

        private fastMatrixSlerp(source: BABYLON.Matrix, target: BABYLON.Matrix, weight: number, result: BABYLON.Matrix): void {
            TOOLKIT.Utilities.FastMatrixSlerp(source, target, weight, result);
        }

        public finalizeTransforms(): void {
            this._transformBuffers.forEach((buffer, targetId) => {
                if (this._dirtyBlenderMatrix) {
                    const target = buffer.targetTransform;
                    if (target) {
                        // Store original transform for blending if not already stored
                        if (!buffer.originalMatrix) {
                            buffer.originalMatrix = BABYLON.Matrix.Compose(
                                target.scaling,
                                target.rotationQuaternion || new BABYLON.Quaternion(),
                                target.position
                            );
                        }

                        // Initialize buffers if needed
                        if (!buffer.positionBuffer) buffer.positionBuffer = new BABYLON.Vector3(0, 0, 0);
                        if (!buffer.rotationBuffer) buffer.rotationBuffer = new BABYLON.Quaternion();
                        if (!buffer.scalingBuffer) buffer.scalingBuffer = new BABYLON.Vector3(1, 1, 1);

                        // Blend with original transform using proper quaternion interpolation
                        const blendedMatrix = BABYLON.Matrix.Identity();
                        const sourceScale = new BABYLON.Vector3();
                        const sourceRotation = new BABYLON.Quaternion();
                        const sourcePosition = new BABYLON.Vector3();
                        buffer.originalMatrix.decompose(sourceScale, sourceRotation, sourcePosition);

                        const targetScale = new BABYLON.Vector3();
                        const targetRotation = new BABYLON.Quaternion();
                        const targetPosition = new BABYLON.Vector3();
                        this._blenderMatrix.decompose(targetScale, targetRotation, targetPosition);

                        // Interpolate values with proper quaternion SLERP
                        const resultScale = BABYLON.Vector3.Lerp(sourceScale, targetScale, buffer.blendingFactor);
                        const resultRotation = new BABYLON.Quaternion();
                        BABYLON.Quaternion.SlerpToRef(sourceRotation, targetRotation, buffer.blendingFactor, resultRotation);
                        const resultPosition = BABYLON.Vector3.Lerp(sourcePosition, targetPosition, buffer.blendingFactor);

                        // Compose result matrix
                        BABYLON.Matrix.ComposeToRef(resultScale, resultRotation, resultPosition, blendedMatrix);

                        // Apply final transform
                        blendedMatrix.decompose(target.scaling, target.rotationQuaternion || new BABYLON.Quaternion(), target.position);
                    }
                }
            });
        }
    }

    export class AnimationController {
        private static readonly FPS: number = 30;
        private static readonly TIME: number = 1.0;
        private static readonly SPEED: number = 1.0;

        private machine: any;
        private animationGroups: Map<string, BABYLON.AnimationGroup>;
        private parameters: Map<string, any>;
        private parameterTypes: Map<string, AnimatorParameterType>;
        private rootBone: BABYLON.TransformNode | null;
        private layers: AnimationLayer[];
        private initialized: boolean;
        private _dirtyMotionMatrix: boolean;
        private _deltaTime: number;
        private updateMatrix: BABYLON.Matrix;
        private emptyScaling: BABYLON.Vector3;
        private emptyRotation: BABYLON.Quaternion;
        private emptyPosition: BABYLON.Vector3;
        private deltaPosition: BABYLON.Vector3;
        private deltaRotation: BABYLON.Quaternion;
        private angularVelocity: BABYLON.Vector3;
        private rootMotionMatrix: BABYLON.Matrix;
        private rootMotionPosition: BABYLON.Vector3;
        private rootMotionRotation: BABYLON.Quaternion;
        private lastMotionPosition: BABYLON.Vector3;
        private lastMotionRotation: BABYLON.Quaternion;
        private rootMotionSpeed: number;
        private lastMotionSpeed: number;
        private loopMotionSpeed: number;
        private lastRotateSpeed: number;
        private loopRotateSpeed: number;
        private _frametime: number;
        private _length: number;
        private _looptime: boolean;
        private _loopblend: boolean;

        public speedRatio: number = 1.0;
        public applyRootMotion: boolean = false;
        public applyWorldMotion: boolean = true;  // Default to world-space (Unity-like behavior)
        public loopBlendPositionY: boolean = true;
        public loopBlendPositionXZ: boolean = true;

        constructor(machine: any, animationGroups: BABYLON.AnimationGroup[], rootBone?: BABYLON.TransformNode) {
            this.machine = machine;
            this.rootBone = rootBone || null;
            this.initialized = false;
            this._dirtyMotionMatrix = false;
            this._deltaTime = 0;
            this._frametime = 0;
            this._length = 0;
            this._looptime = false;
            this._loopblend = false;

            // Initialize collections
            this.animationGroups = new Map<string, BABYLON.AnimationGroup>();
            this.parameters = new Map<string, any>();
            this.parameterTypes = new Map<string, AnimatorParameterType>();
            this.layers = [];

            // Initialize vectors/matrices
            this.updateMatrix = BABYLON.Matrix.Identity();
            this.emptyScaling = new BABYLON.Vector3(1, 1, 1);
            this.emptyRotation = new BABYLON.Quaternion();
            this.emptyPosition = new BABYLON.Vector3();
            this.deltaPosition = new BABYLON.Vector3();
            this.deltaRotation = new BABYLON.Quaternion();
            this.angularVelocity = new BABYLON.Vector3();
            this.rootMotionMatrix = BABYLON.Matrix.Zero();
            this.rootMotionPosition = new BABYLON.Vector3();
            this.rootMotionRotation = new BABYLON.Quaternion();
            this.lastMotionPosition = new BABYLON.Vector3();
            this.lastMotionRotation = new BABYLON.Quaternion();
            
            // Initialize motion tracking
            this.rootMotionSpeed = 0;
            this.lastMotionSpeed = 0;
            this.loopMotionSpeed = 0;
            this.lastRotateSpeed = 0;
            this.loopRotateSpeed = 0;

            // Initialize animation groups
            this.setupAnimationGroups(animationGroups);

            // Initialize parameters
            this.setupParameters();

            // Initialize layers
            this.setupLayers();

            this.initialized = true;
        }

        private setupAnimationGroups(groups: BABYLON.AnimationGroup[]): void {
            groups.forEach(group => {
                if (group.metadata?.toolkit?.clip) {
                    this.animationGroups.set(group.metadata.toolkit.clip, group);
                }
            });
        }

        private setupParameters(): void {
            if (this.machine.parameters) {
                this.machine.parameters.forEach((param: any) => {
                    this.parameterTypes.set(param.name, param.type);
                    switch (param.type) {
                        case AnimatorParameterType.Bool:
                            this.parameters.set(param.name, param.defaultBool || false);
                            break;
                        case AnimatorParameterType.Float:
                            this.parameters.set(param.name, param.defaultFloat || 0);
                            break;
                        case AnimatorParameterType.Int:
                            this.parameters.set(param.name, param.defaultInt || 0);
                            break;
                        case AnimatorParameterType.Trigger:
                            this.parameters.set(param.name, false);
                            break;
                    }
                });
            }
        }

        private setupLayers(): void {
            if (this.machine.layers) {
                this.machine.layers.forEach((layerData: any, index: number) => {
                    const layer = new AnimationLayer(layerData, index, this.machine);
                    this.layers.push(layer);
                });
            }
        }

        private sampleAndBlendAnimation(clip: BABYLON.AnimationGroup, weight: number, layer: AnimationLayer, deltaTime: number): void {
            clip.targetedAnimations.forEach((target: BABYLON.TargetedAnimation) => {
                if (target.target instanceof BABYLON.TransformNode) {
                    // Check avatar mask
                    if (layer.checkAvatarMask(target.target)) {
                        // Sample animation at current time
                        const time = layer.getAnimationTime();
                        const value = this.sampleAnimationTrack(target, time);
                        
                        if (value) {
                            // Initialize rotation quaternion if needed
                            if (value instanceof BABYLON.Quaternion && !target.target.rotationQuaternion) {
                                target.target.rotationQuaternion = new BABYLON.Quaternion();
                            }

                            // Blend value with layer weight
                            if (value instanceof BABYLON.Quaternion) {
                                // Use SLERP for quaternions
                                const currentRot = target.target.rotationQuaternion || new BABYLON.Quaternion();
                                const blendedRot = new BABYLON.Quaternion();
                                BABYLON.Quaternion.SlerpToRef(currentRot, value, weight, blendedRot);
                                layer.blendTransformValue(target.target, blendedRot, weight);
                            } else {
                                // Use regular blending for other types
                                layer.blendTransformValue(target.target, value, weight);
                            }
                        }
                    }
                }
            });
        }

        private sampleAnimationTrack(targetedAnimation: BABYLON.TargetedAnimation, time: number): any {
        const animation = targetedAnimation.animation;
            const keys = animation.getKeys();
            if (!keys || keys.length === 0) return null;

            const fps = animation.framePerSecond;
            const totalFrames = keys[keys.length - 1].frame;
            const frame = (time * fps) % totalFrames;

            // Find the two keys to interpolate between
            let key1 = keys[0];
            let key2 = keys[0];

            for (let i = 0; i < keys.length; i++) {
                if (keys[i].frame <= frame) {
                    key1 = keys[i];
                    key2 = keys[i + 1] || keys[0]; // Loop back to first key if needed
                }
            }

            // Calculate interpolation factor
            const range = key2.frame - key1.frame;
            const factor = range <= 0 ? 0 : (frame - key1.frame) / range;

            // Interpolate based on animation property type
            switch (animation.dataType) {
                case BABYLON.Animation.ANIMATIONTYPE_FLOAT:
                    return BABYLON.Scalar.Lerp(key1.value, key2.value, factor);
                case BABYLON.Animation.ANIMATIONTYPE_VECTOR3:
                    return BABYLON.Vector3.Lerp(key1.value, key2.value, factor);
                case BABYLON.Animation.ANIMATIONTYPE_QUATERNION:
                    return BABYLON.Quaternion.Slerp(key1.value, key2.value, factor);
                default:
                    return key1.value;
            }
        }

        private extractRootMotion(layer: AnimationLayer, deltaTime: number): { position: BABYLON.Vector3, rotation: BABYLON.Quaternion } | null {
            if (!layer) return null;

            const state = layer.getCurrentState();
            if (!state || !state.motion) return null;

            // Initialize result
            const deltaPosition = new BABYLON.Vector3();
            let deltaRotation = BABYLON.Quaternion.Identity();

            // Sample root motion if root bone exists
            if (this.rootBone && this._dirtyMotionMatrix) {
                // Find root bone animation
                const rootAnim = state.motion.targetedAnimations.find(
                    anim => anim.target === this.rootBone
                );

                if (rootAnim) {
                    // Sample current and next frame
                    const currentTime = layer.getAnimationTime();
                    const nextTime = Math.min(currentTime + deltaTime, layer.getLength());

                    const currentPos = this.sampleAnimationTrack(rootAnim, currentTime) as BABYLON.Vector3;
                    const nextPos = this.sampleAnimationTrack(rootAnim, nextTime) as BABYLON.Vector3;
                    
                    if (currentPos && nextPos) {
                        nextPos.subtractToRef(currentPos, deltaPosition);
                        
                        // Calculate rotation delta (if rotation animation exists)
                        const rotAnim = state.motion.targetedAnimations.find(
                            anim => anim.target === this.rootBone && 
                                    anim.animation.targetProperty.includes("rotationQuaternion")
                        );
                        
                        if (rotAnim) {
                            const currentRot = this.sampleAnimationTrack(rotAnim, currentTime) as BABYLON.Quaternion;
                            const nextRot = this.sampleAnimationTrack(rotAnim, nextTime) as BABYLON.Quaternion;
                            if (currentRot && nextRot) {
                                // Use QuaternionDiffToRef for more accurate rotation delta
                                TOOLKIT.Utilities.QuaternionDiffToRef(currentRot, nextRot, deltaRotation);
                            }
                        }

                        // Process root motion matrix
                        BABYLON.Matrix.ComposeToRef(
                            BABYLON.Vector3.One(),
                            this.rootMotionRotation,
                            this.rootMotionPosition,
                            this.updateMatrix
                        );

                        if (this.isFirstFrame()) {
                            // Store initial frame values
                            this.deltaPosition.copyFrom(this.rootMotionPosition);
                            this.deltaRotation.copyFrom(this.rootMotionRotation);
                            this.lastMotionPosition.copyFrom(this.rootMotionPosition);
                            this.lastMotionRotation.copyFrom(this.rootMotionRotation);
                            this.rootMotionSpeed = 0;
                            this.lastMotionSpeed = 0;
                            this.loopMotionSpeed = 0;
                            this.lastRotateSpeed = 0;
                            this.loopRotateSpeed = 0;
                        } else {
                            // Calculate motion deltas
                            this.rootMotionPosition.subtractToRef(this.lastMotionPosition, this.deltaPosition);
                            const lastRotationInv = this.lastMotionRotation.conjugate();
                            this.deltaRotation = this.rootMotionRotation.multiply(lastRotationInv);

                            // Handle loop blending
                            if (this.isLastFrame() && this._looptime && this._loopblend) {
                                const loopBlendSpeed = (this.loopMotionSpeed + this.lastMotionSpeed) * 0.5;
                                this.deltaPosition.normalize();
                                this.deltaPosition.scaleInPlace(loopBlendSpeed * this._deltaTime);

                                const loopBlendRotate = (this.loopRotateSpeed + this.lastRotateSpeed) * 0.5;
                                this.deltaRotation.toEulerAnglesToRef(this.angularVelocity);
                                this.angularVelocity.y = loopBlendRotate;
                                BABYLON.Quaternion.FromEulerAnglesToRef(
                                    this.angularVelocity.x,
                                    this.angularVelocity.y,
                                    this.angularVelocity.z,
                                    this.deltaRotation
                                );
                            }

                            // Update motion tracking
                            const deltaSpeed = this.deltaPosition.length();
                            this.rootMotionSpeed = deltaSpeed > 0 ? deltaSpeed / this._deltaTime : deltaSpeed;
                            this.deltaRotation.toEulerAnglesToRef(this.angularVelocity);

                            // Store current values for next frame
                            this.lastMotionPosition.copyFrom(this.rootMotionPosition);
                            this.lastMotionRotation.copyFrom(this.rootMotionRotation);
                            this.lastMotionSpeed = this.rootMotionSpeed;
                            this.lastRotateSpeed = this.angularVelocity.y;

                            if (this._frametime === 0) {
                                this.loopMotionSpeed = this.rootMotionSpeed;
                                this.loopRotateSpeed = this.angularVelocity.y;
                            }
                        }

                        // Apply root motion to character transform
                        const targetNode = this.rootBone;
                        if (targetNode instanceof BABYLON.TransformNode) {
                            // Initialize rotation quaternion if needed
                            if (!targetNode.rotationQuaternion) {
                                targetNode.rotationQuaternion = new BABYLON.Quaternion();
                            }

                            // Get parent world matrix if it exists
                            const parentNode = targetNode.parent;
                            const parentWorldMatrix = parentNode instanceof BABYLON.TransformNode ? 
                                parentNode.getWorldMatrix() : 
                                BABYLON.Matrix.Identity();

                            // Convert deltas to world space if root bone has a parent
                            if (this.rootBone.parent) {
                                const parentWorld = this.rootBone.parent.getWorldMatrix();
                                BABYLON.Vector3.TransformCoordinatesToRef(deltaPosition, parentWorld, deltaPosition);
                                // Note: Rotation is already in local space, no need to convert
                            }

                            // Compose target matrix with deltas
                            const currentRotation = targetNode.rotationQuaternion.multiply(this.deltaRotation);
                            const currentPosition = targetNode.position.add(this.deltaPosition);

                            // Create temporary vectors for decomposition
                            const tempScaling = targetNode.scaling.clone();
                            const tempRotation = currentRotation.clone();
                            const tempPosition = currentPosition.clone();

                            BABYLON.Matrix.ComposeToRef(
                                tempScaling,
                                tempRotation,
                                tempPosition,
                                this.rootMotionMatrix
                            );

                            // Blend matrices using FastMatrixSlerp
                            TOOLKIT.Utilities.FastMatrixSlerp(
                                targetNode.getWorldMatrix(),
                                this.rootMotionMatrix,
                                this._deltaTime * this.speedRatio,
                                this.rootMotionMatrix
                            );

                            // Decompose and apply final transform safely
                            const decompositionSuccessful = this.rootMotionMatrix.decompose(
                                tempScaling,
                                tempRotation,
                                tempPosition
                            );

                            if (decompositionSuccessful) {
                                targetNode.scaling.copyFrom(tempScaling);
                                targetNode.rotationQuaternion.copyFrom(tempRotation);
                                targetNode.position.copyFrom(tempPosition);
                            }
                        }
                    }
                }
            }

            return {
                position: deltaPosition,
                rotation: deltaRotation
            };
        }

        private isFirstFrame(): boolean {
            return this._frametime === 0;
        }

        private isLastFrame(): boolean {
            return this._frametime >= this._length;
        }

        // Parameter getters/setters
        public hasBool(name: string): boolean {
            return this.parameters.has(name) && this.parameterTypes.get(name) === AnimatorParameterType.Bool;
        }

        public getBool(name: string): boolean {
            const value = this.parameters.get(name);
            return typeof value === 'boolean' ? value : false;
        }

        public setBool(name: string, value: boolean): void {
            if (this.parameterTypes.get(name) === AnimatorParameterType.Bool) {
                this.parameters.set(name, value);
            }
        }

        public hasFloat(name: string): boolean {
            return this.parameters.has(name) && this.parameterTypes.get(name) === AnimatorParameterType.Float;
        }

        public getFloat(name: string): number {
            const value = this.parameters.get(name);
            return typeof value === 'number' ? value : 0;
        }

        public setFloat(name: string, value: number): void {
            if (this.parameterTypes.get(name) === AnimatorParameterType.Float) {
                this.parameters.set(name, value);
            }
        }

        public hasInteger(name: string): boolean {
            return this.parameters.has(name) && this.parameterTypes.get(name) === AnimatorParameterType.Int;
        }

        public getInteger(name: string): number {
            const value = this.parameters.get(name);
            return typeof value === 'number' ? Math.floor(value) : 0;
        }

        public setInteger(name: string, value: number): void {
            if (this.parameterTypes.get(name) === AnimatorParameterType.Int) {
                this.parameters.set(name, Math.floor(value));
            }
        }

        public hasTrigger(name: string): boolean {
            return this.parameters.has(name) && this.parameterTypes.get(name) === AnimatorParameterType.Trigger;
        }

        public getTrigger(name: string): boolean {
            const value = this.parameters.get(name);
            return typeof value === 'boolean' ? value : false;
        }

        public setTrigger(name: string): void {
            if (this.parameterTypes.get(name) === AnimatorParameterType.Trigger) {
                this.parameters.set(name, true);
            }
        }

        public resetTrigger(name: string): void {
            if (this.parameterTypes.get(name) === AnimatorParameterType.Trigger) {
                this.parameters.set(name, false);
            }
        }

        // State control
        private fastMatrixSlerp(source: BABYLON.Matrix, target: BABYLON.Matrix, weight: number, result: BABYLON.Matrix): void {
            TOOLKIT.Utilities.FastMatrixSlerp(source, target, weight, result);
        }

        public setState(stateName: string, layerIndex: number = 0): void {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                this.layers[layerIndex].setState(stateName);
            }
        }
    }
}
