import * as BABYLON from 'babylonjs';

/** Babylon Toolkit Namespace */
namespace TOOLKIT {
    export class Utilities {
        public static QuaternionDiffToRef(q1: BABYLON.Quaternion, q2: BABYLON.Quaternion, result: BABYLON.Quaternion): void {
            q1.multiplyToRef(BABYLON.Quaternion.Inverse(q2), result);
        }

        public static FastMatrixSlerp(start: BABYLON.Matrix, end: BABYLON.Matrix, amount: number, result: BABYLON.Matrix): void {
            BABYLON.Matrix.LerpToRef(start, end, amount, result);
        }
    }

    export enum AnimatorParameterType {
        Float = 1,
        Int = 2,
        Bool = 3,
        Trigger = 4
    }

    export interface IBlendTree {
        blendType: number;
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
        private _transformBuffers: Map<string, {
            position: BABYLON.Vector3 | null;
            rotation: BABYLON.Quaternion | null;
            scaling: BABYLON.Vector3 | null;
            originalMatrix: BABYLON.Matrix | null;
            blendingFactor: number;
            blendingSpeed: number;
            targetTransform: BABYLON.TransformNode | null;
        }>;

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
                        targetTransform: target
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
                    const blendTarget = this._loopBlend && this._looptime && Math.abs(this.time - this.getLength()) < 0.001
                        ? BABYLON.Quaternion.Slerp(value, this.sampleAnimationValue(target, 0) as BABYLON.Quaternion || value, 0.5)
                        : value;
                    buffer.rotation.copyFrom(blendTarget);
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
                        this.matrixSlerp(buffer.originalMatrix, this._updateMatrix, buffer.blendingFactor, this._updateMatrix);
                        buffer.blendingFactor += buffer.blendingSpeed;
                    }

                    this.matrixSlerp(this._blenderMatrix, this._updateMatrix, weight, this._blenderMatrix);
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
                    return BABYLON.Quaternion.Slerp(key1.value, key2.value, factor);
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

        private matrixSlerp(source: BABYLON.Matrix, target: BABYLON.Matrix, weight: number, result: BABYLON.Matrix): void {
            // Decompose matrices
            const sourceScale = new BABYLON.Vector3();
            const sourceRotation = new BABYLON.Quaternion();
            const sourcePosition = new BABYLON.Vector3();
            source.decompose(sourceScale, sourceRotation, sourcePosition);

            const targetScale = new BABYLON.Vector3();
            const targetRotation = new BABYLON.Quaternion();
            const targetPosition = new BABYLON.Vector3();
            target.decompose(targetScale, targetRotation, targetPosition);

            // Interpolate components
            const resultScale = BABYLON.Vector3.Lerp(sourceScale, targetScale, weight);
            const resultRotation = BABYLON.Quaternion.Slerp(sourceRotation, targetRotation, weight);
            const resultPosition = BABYLON.Vector3.Lerp(sourcePosition, targetPosition, weight);

            // Compose result
            BABYLON.Matrix.ComposeToRef(resultScale, resultRotation, resultPosition, result);
        }

        public finalizeTransforms(): void {
            this._transformBuffers.forEach((buffer, targetId) => {
                if (this._dirtyBlenderMatrix) {
                    const target = buffer.targetTransform;
                    if (target) {
                        // Decompose final blended matrix into target's local space
                        this._blenderMatrix.decompose(
                            target.scaling,
                            target.rotationQuaternion || (target.rotationQuaternion = new BABYLON.Quaternion()),
                            target.position
                        );
                    }
                }
                // Reset buffers
                buffer.position = null;
                buffer.rotation = null;
                buffer.scaling = null;
            });
            this._dirtyBlenderMatrix = false;
            this._blenderMatrix = BABYLON.Matrix.Identity();
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

        public update(deltaTime: number): void {
            if (!this.initialized) return;
            
            this._deltaTime = deltaTime;

            // Scale delta time by speed ratio
            const scaledDeltaTime = deltaTime * this.speedRatio;

            // Update each layer in order (lower layers first)
            this.layers.forEach(layer => {
                // Process state machine for layer
                layer.update(scaledDeltaTime, this.parameters);

                // Sample and blend animations if not in EMPTY state
                const state = layer.getCurrentState();
                if (state && (state.motion || state.blendtree)) {
                    this.processAnimations(layer, scaledDeltaTime);
                    // Finalize transforms after processing animations
                    layer.finalizeTransforms();
                }
            });

            // Update timing properties from active layer
            const activeLayer = this.layers[0]; // Use first layer for root motion
            if (activeLayer) {
                this._frametime = activeLayer.getFrametime();
                this._length = activeLayer.getLength();
                this._looptime = activeLayer.getLooptime();
                this._loopblend = activeLayer.getLoopBlend();
            }

            // Process root motion if enabled
            if (this.applyRootMotion && this.rootBone) {
                // Extract root motion from animation
                const rootMotion = this.extractRootMotion(activeLayer, scaledDeltaTime);
                if (rootMotion) {
                    // Reset root motion matrix
                    this.rootMotionMatrix.reset();
                    this._dirtyMotionMatrix = false;

                    // Process root motion matrix
                    BABYLON.Matrix.ComposeToRef(
                        this.emptyScaling,
                        (rootMotion.rotation || this.emptyRotation),
                        (rootMotion.position || this.emptyPosition),
                        this.updateMatrix
                    );
                    TOOLKIT.Utilities.FastMatrixSlerp(this.rootMotionMatrix, this.updateMatrix, 1.0, this.rootMotionMatrix);
                    this._dirtyMotionMatrix = true;

                    // Apply matrix blending with layer weight
                    this.matrixSlerp(
                        this.rootMotionMatrix,
                        this.updateMatrix,
                        activeLayer.getAvatarMaskWeight(this.rootBone),
                        this.rootMotionMatrix
                    );

                    // Convert to world space if we have a parent
                    if (this.rootBone && this.rootBone.parent) {
                        const parentWorldMatrix = this.rootBone.parent.getWorldMatrix();
                        this.rootMotionMatrix.multiplyToRef(parentWorldMatrix, this.rootMotionMatrix);
                    }
                    this._dirtyMotionMatrix = true;

                    // Process root motion matrix
                    if (this._dirtyMotionMatrix) {
                        this.rootMotionMatrix.decompose(undefined, this.rootMotionRotation, this.rootMotionPosition);

                        // Calculate root motion deltas based on frame
                        if (this.isFirstFrame()) {
                            this.deltaPosition.copyFrom(this.rootMotionPosition);
                            this.deltaRotation.copyFrom(this.rootMotionRotation);
                        } else if (this.isLastFrame()) {
                            this.rootMotionPosition.subtractToRef(this.lastMotionPosition, this.deltaPosition);
                            TOOLKIT.Utilities.QuaternionDiffToRef(this.rootMotionRotation, this.lastMotionRotation, this.deltaRotation);

                            if (this._looptime && this._loopblend) {
                                // Handle loop blending
                                let loopBlendSpeed = (this.loopMotionSpeed + this.lastMotionSpeed);
                                if (loopBlendSpeed !== 0) loopBlendSpeed = loopBlendSpeed / 2;
                                this.deltaPosition.normalize();
                                this.deltaPosition.scaleInPlace(loopBlendSpeed * deltaTime);

                                let loopBlendRotate = (this.loopRotateSpeed + this.lastRotateSpeed);
                                if (loopBlendRotate !== 0) loopBlendRotate = loopBlendRotate / 2;
                                this.deltaRotation.toEulerAnglesToRef(this.angularVelocity);
                                BABYLON.Quaternion.FromEulerAnglesToRef(
                                    this.angularVelocity.x,
                                    loopBlendRotate,
                                    this.angularVelocity.z,
                                    this.deltaRotation
                                );
                            }
                        } else {
                            this.rootMotionPosition.subtractToRef(this.lastMotionPosition, this.deltaPosition);
                            TOOLKIT.Utilities.QuaternionDiffToRef(this.rootMotionRotation, this.lastMotionRotation, this.deltaRotation);
                        }

                        // Calculate motion speed and angular velocity
                        const deltaSpeed = this.deltaPosition.length();
                        this.rootMotionSpeed = deltaSpeed > 0 ? deltaSpeed / deltaTime : deltaSpeed;
                        this.deltaRotation.toEulerAnglesToRef(this.angularVelocity);

                        // Update last frame values
                        this.lastMotionPosition.copyFrom(this.rootMotionPosition);
                        this.lastMotionRotation.copyFrom(this.rootMotionRotation);
                        this.lastMotionSpeed = this.rootMotionSpeed;
                        this.lastRotateSpeed = this.angularVelocity.y;

                        // Store initial frame values for looping
                        if (activeLayer.getFrametime() === 0) {
                            this.loopMotionSpeed = this.rootMotionSpeed;
                            this.loopRotateSpeed = this.angularVelocity.y;
                        }

                        // Apply root motion to transform based on configuration
                        if (this.applyWorldMotion) {
                            // World-space root motion (Unity-like behavior)
                            if (this.rootBone.parent) {
                                const parentWorld = this.rootBone.parent.getWorldMatrix();
                                const parentInverse = parentWorld.clone();
                                parentInverse.invert();
                                const localDelta = BABYLON.Vector3.TransformCoordinates(this.deltaPosition, parentInverse);
                                
                                // Apply position based on blend settings
                                if (this.loopBlendPositionY && this.loopBlendPositionXZ) {
                                    // Bake XYZ into pose
                                    this.rootBone.position.addInPlace(localDelta);
                                } else if (!this.loopBlendPositionY && !this.loopBlendPositionXZ) {
                                    // Use XYZ as root motion
                                    const worldDelta = BABYLON.Vector3.TransformCoordinates(localDelta, parentWorld);
                                    this.rootBone.position.addInPlace(worldDelta);
                                } else {
                                    // Selective axis blending
                                    const worldDelta = BABYLON.Vector3.TransformCoordinates(localDelta, parentWorld);
                                    if (this.loopBlendPositionXZ) {
                                        localDelta.x = worldDelta.x;
                                        localDelta.z = worldDelta.z;
                                    }
                                    if (this.loopBlendPositionY) {
                                        localDelta.y = worldDelta.y;
                                    }
                                    this.rootBone.position.addInPlace(localDelta);
                                }
                            } else {
                                this.rootBone.position.addInPlace(this.deltaPosition);
                            }
                        } else {
                            // Local-space root motion
                            this.rootBone.position.addInPlace(this.deltaPosition);
                        }
                        
                        // Apply rotation
                        if (!this.rootBone.rotationQuaternion) {
                            this.rootBone.rotationQuaternion = new BABYLON.Quaternion();
                        }
                        this.rootBone.rotationQuaternion.multiplyInPlace(this.deltaRotation);
                    }

                    if (this._dirtyMotionMatrix) {
                        // Extract final transforms
                        this.rootMotionMatrix.decompose(
                            BABYLON.Vector3.One(),
                            this.rootMotionRotation,
                            this.rootMotionPosition
                        );

                        // Calculate deltas and velocities
                        if (this.isFirstFrame()) {
                            this.deltaPosition.copyFrom(this.rootMotionPosition);
                            this.deltaRotation.copyFrom(this.rootMotionRotation);
                        } else if (this.isLastFrame() && activeLayer.getLooptime() && activeLayer.getLoopBlend()) {
                            // Handle loop blending
                            this.rootMotionPosition.subtractToRef(this.lastMotionPosition, this.deltaPosition);
                            
                            // Smooth position
                            const loopBlendSpeed = (this.loopMotionSpeed + this.lastMotionSpeed) / 2;
                            this.deltaPosition.normalize();
                            this.deltaPosition.scaleInPlace(loopBlendSpeed * scaledDeltaTime);
                            
                            // Smooth rotation
                            const loopBlendRotate = (this.loopRotateSpeed + this.lastRotateSpeed) / 2;
                            this.deltaRotation.toEulerAnglesToRef(this.angularVelocity);
                            BABYLON.Quaternion.FromEulerAnglesToRef(
                                this.angularVelocity.x,
                                loopBlendRotate,
                                this.angularVelocity.z,
                                this.deltaRotation
                            );
                        } else {
                            this.rootMotionPosition.subtractToRef(this.lastMotionPosition, this.deltaPosition);
                            this.rootMotionRotation.toEulerAnglesToRef(this.angularVelocity);
                        }

                        // Update motion tracking
                        const deltaSpeed = this.deltaPosition.length();
                        this.rootMotionSpeed = deltaSpeed > 0 ? deltaSpeed / scaledDeltaTime : deltaSpeed;
                        
                        // Store current values for next frame
                        this.lastMotionPosition.copyFrom(this.rootMotionPosition);
                        this.lastMotionRotation.copyFrom(this.rootMotionRotation);
                        this.lastMotionSpeed = this.rootMotionSpeed;
                        this.lastRotateSpeed = this.angularVelocity.y;

                        if (this._frametime === 0) {
                            this.loopMotionSpeed = this.rootMotionSpeed;
                            this.loopRotateSpeed = this.angularVelocity.y;
                        }

                        // Apply to root bone in world space
                        if (this.rootBone.parent) {
                            const parentInverse = this.rootBone.parent.getWorldMatrix().clone();
                            parentInverse.invert();
                            
                            // Convert deltas to local space
                            const localDelta = BABYLON.Vector3.TransformCoordinates(
                                this.deltaPosition,
                                parentInverse
                            );
                            this.rootBone.position.addInPlace(localDelta);
                        } else {
                            this.rootBone.position.addInPlace(this.deltaPosition);
                        }

                        if (!this.rootBone.rotationQuaternion) {
                            this.rootBone.rotationQuaternion = new BABYLON.Quaternion();
                        }
                        this.rootBone.rotationQuaternion.multiplyInPlace(this.deltaRotation);
                    }
                }
            }
        }

        private processAnimations(layer: AnimationLayer, deltaTime: number): void {
            const state = layer.getCurrentState();
            if (!state || !state.blendtree) return;

            // Process blend tree
            this.processBlendTree(state.blendtree, layer, deltaTime);
        }

        private processBlendTree(tree: IBlendTree, layer: AnimationLayer, deltaTime: number): void {
            if (!tree.children || tree.children.length === 0) return;

            // Calculate blend weights
            const weights = this.calculateBlendWeights(tree);

            // Sample and blend animations
            tree.children.forEach((child: any) => {
                if (child.weight > 0) {
                    const clip = this.animationGroups.get(child.motion);
                    if (clip) {
                        this.sampleAndBlendAnimation(clip, child.weight, layer, deltaTime);
                    }
                }
            });
        }

        private calculateBlendWeights(tree: IBlendTree): any[] {
            const weights: any[] = [];
            const paramX = this.getFloat(tree.blendParameterX);
            const paramY = tree.blendParameterY ? this.getFloat(tree.blendParameterY) : 0;

            switch (tree.blendType) {
                case 1: // Simple 1D
                    this.calculate1DBlendWeights(tree, paramX, weights);
                    break;
                case 2: // Simple 2D Directional
                    this.calculate2DDirectionalBlendWeights(tree, paramX, paramY, weights);
                    break;
                case 3: // Freeform 2D Directional
                    this.calculate2DFreeformDirectionalBlendWeights(tree, paramX, paramY, weights);
                    break;
                case 4: // Freeform 2D Cartesian
                    this.calculate2DFreeformCartesianBlendWeights(tree, paramX, paramY, weights);
                    break;
            }
            return weights;
        }

        private calculate1DBlendWeights(tree: IBlendTree, paramX: number, weights: any[]): void {
            tree.children.forEach((child: any, index: number) => {
                const threshold = child.threshold;
                const nextThreshold = index < tree.children.length - 1 ? tree.children[index + 1].threshold : threshold;
                
                let weight = 0;
                if (paramX <= threshold) {
                    weight = index === 0 ? 1 : 0;
                } else if (paramX >= nextThreshold) {
                    weight = index === tree.children.length - 1 ? 1 : 0;
                } else {
                    weight = 1 - (paramX - threshold) / (nextThreshold - threshold);
                }
                weights.push({ motion: child.motion, weight });
            });
        }

        private calculate2DDirectionalBlendWeights(tree: IBlendTree, paramX: number, paramY: number, weights: any[]): void {
            const angle = Math.atan2(paramY, paramX);
            const magnitude = Math.sqrt(paramX * paramX + paramY * paramY);

            tree.children.forEach((child: any) => {
                const posY = child.positionY || 0;
                const posX = child.positionX || 0;
                const childAngle = Math.atan2(posY, posX);
                const angleDiff = Math.abs(BABYLON.Scalar.NormalizeRadians(angle - childAngle));
                const weight = 1 - (angleDiff / Math.PI);
                weights.push({ motion: child.motion, weight: Math.max(0, weight) * magnitude });
            });

            // Normalize weights
            const totalWeight = weights.reduce((sum: number, w: any) => sum + w.weight, 0);
            if (totalWeight > 0) {
                weights.forEach(w => w.weight /= totalWeight);
            }
        }

        private calculate2DFreeformDirectionalBlendWeights(tree: IBlendTree, paramX: number, paramY: number, weights: any[]): void {
            const position = new BABYLON.Vector2(paramX, paramY);
            
            tree.children.forEach((child: any) => {
                const childPos = new BABYLON.Vector2(child.positionX || 0, child.positionY || 0);
                const distance = BABYLON.Vector2.Distance(position, childPos);
                const maxRadius = tree.maxRadius || 1; // Default to 1 if not specified
                const weight = Math.max(0, 1 - distance / maxRadius);
                weights.push({ motion: child.motion, weight });
            });

            // Normalize weights
            const totalWeight = weights.reduce((sum: number, w: any) => sum + w.weight, 0);
            if (totalWeight > 0) {
                weights.forEach(w => w.weight /= totalWeight);
            }
        }

        private calculate2DFreeformCartesianBlendWeights(tree: IBlendTree, paramX: number, paramY: number, weights: any[]): void {
            const position = new BABYLON.Vector2(paramX, paramY);
            
            // Find the triangle containing the current position
            const triangles = this.triangulate2DPoints(tree.children);
            const containingTriangle = triangles.find(triangle => 
                this.pointInTriangle(position, 
                    new BABYLON.Vector2(triangle[0].positionX || 0, triangle[0].positionY || 0),
                    new BABYLON.Vector2(triangle[1].positionX || 0, triangle[1].positionY || 0),
                    new BABYLON.Vector2(triangle[2].positionX || 0, triangle[2].positionY || 0)
                )
            );

            if (containingTriangle) {
                // Calculate barycentric coordinates
                const barycentricWeights = this.calculateBarycentricWeights(
                    position,
                    new BABYLON.Vector2(containingTriangle[0].positionX, containingTriangle[0].positionY),
                    new BABYLON.Vector2(containingTriangle[1].positionX, containingTriangle[1].positionY),
                    new BABYLON.Vector2(containingTriangle[2].positionX, containingTriangle[2].positionY)
                );

                weights.push(
                    { motion: containingTriangle[0].motion, weight: barycentricWeights.x },
                    { motion: containingTriangle[1].motion, weight: barycentricWeights.y },
                    { motion: containingTriangle[2].motion, weight: barycentricWeights.z }
                );
            }
        }

        private triangulate2DPoints(points: any[]): any[][] {
            // Simple triangulation - for more complex cases, consider using a proper triangulation library
            const triangles: any[][] = [];
            if (points.length >= 3) {
                const center = points[0];
                for (let i = 1; i < points.length - 1; i++) {
                    triangles.push([center, points[i], points[i + 1]]);
                }
            }
            return triangles;
        }

        private pointInTriangle(p: BABYLON.Vector2, a: BABYLON.Vector2, b: BABYLON.Vector2, c: BABYLON.Vector2): boolean {
            const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
            const s = 1 / (2 * area) * (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y);
            const t = 1 / (2 * area) * (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y);
            return s >= 0 && t >= 0 && (1 - s - t) >= 0;
        }

        private calculateBarycentricWeights(p: BABYLON.Vector2, a: BABYLON.Vector2, b: BABYLON.Vector2, c: BABYLON.Vector2): BABYLON.Vector3 {
            const v0 = b.subtract(a);
            const v1 = c.subtract(a);
            const v2 = p.subtract(a);
            
            const d00 = BABYLON.Vector2.Dot(v0, v0);
            const d01 = BABYLON.Vector2.Dot(v0, v1);
            const d11 = BABYLON.Vector2.Dot(v1, v1);
            const d20 = BABYLON.Vector2.Dot(v2, v0);
            const d21 = BABYLON.Vector2.Dot(v2, v1);
            
            const denom = d00 * d11 - d01 * d01;
            const v = (d11 * d20 - d01 * d21) / denom;
            const w = (d00 * d21 - d01 * d20) / denom;
            const u = 1.0 - v - w;
            
            return new BABYLON.Vector3(u, v, w);
        }

        private sampleAndBlendAnimation(clip: BABYLON.AnimationGroup, weight: number, layer: AnimationLayer, deltaTime: number): void {
            clip.targetedAnimations.forEach(target => {
                if (target.target instanceof BABYLON.TransformNode) {
                    // Check avatar mask
                    if (layer.checkAvatarMask(target.target)) {
                        // Sample animation at current time
                        const time = layer.getAnimationTime();
                        const value = this.sampleAnimationTrack(target, time);
                        
                        // Blend value with layer weight
                        layer.blendTransformValue(target.target, value, weight);
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
                                deltaRotation = nextRot.multiply(BABYLON.Quaternion.Inverse(currentRot));
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
        private matrixSlerp(source: BABYLON.Matrix, target: BABYLON.Matrix, weight: number, result: BABYLON.Matrix): void {
            // Decompose matrices
            const sourceScale = new BABYLON.Vector3();
            const sourceRotation = new BABYLON.Quaternion();
            const sourcePosition = new BABYLON.Vector3();
            source.decompose(sourceScale, sourceRotation, sourcePosition);

            const targetScale = new BABYLON.Vector3();
            const targetRotation = new BABYLON.Quaternion();
            const targetPosition = new BABYLON.Vector3();
            target.decompose(targetScale, targetRotation, targetPosition);

            // Interpolate components
            const resultScale = BABYLON.Vector3.Lerp(sourceScale, targetScale, weight);
            const resultRotation = BABYLON.Quaternion.Slerp(sourceRotation, targetRotation, weight);
            const resultPosition = BABYLON.Vector3.Lerp(sourcePosition, targetPosition, weight);

            // Compose result
            BABYLON.Matrix.ComposeToRef(resultScale, resultRotation, resultPosition, result);
        }

        public setState(stateName: string, layerIndex: number = 0): void {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                this.layers[layerIndex].setState(stateName);
            }
        }
    }
}
