/// <reference path="./babylon.toolkit.d.ts" />
/// <reference types="@babylonjs/core" />

import * as BABYLON from "@babylonjs/core";

/** @internal */
export namespace TOOLKIT {
    /** Re-export Babylon types and values */
    export import Scene = BABYLON.Scene;
    export import Vector3 = BABYLON.Vector3;
    export import Vector2 = BABYLON.Vector2;
    export import Quaternion = BABYLON.Quaternion;
    export import Matrix = BABYLON.Matrix;
    export import TransformNode = BABYLON.TransformNode;
    export import AnimationGroup = BABYLON.AnimationGroup;
    export import Animation = BABYLON.Animation;
    export import Observable = BABYLON.Observable;
    export import Tools = BABYLON.Tools;
    export import Scalar = BABYLON.Scalar;
    export type TargetedAnimation = BABYLON.TargetedAnimation & { 
        weight?: number;
        animation?: BABYLON.Animation;
    };

    /** Animation State Constants */
    export class AnimationStateConstants {
        public static readonly TIME: number = 1.0;
        public static readonly SPEED: number = 1.0;
        public static readonly FPS: number = 30;
        public static readonly EXIT: string = "[EXIT]";
    }

    /** Extended TargetedAnimation interface with weight property */
    interface TargetedAnimation extends BABYLON.TargetedAnimation {
        weight?: number;
    }

/** @internal */
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

/** @internal */
export class ScriptComponent {
    protected _scene: Scene;
    protected _transform: TransformNode;
    protected _properties: Map<string, any>;
    
    constructor(transform: TransformNode, scene: Scene) {
        this._transform = transform;
        this._scene = scene;
        this._properties = new Map();
    }
    
    public getClassName(): string {
        return "ScriptComponent";
    }

    protected getProperty<T>(name: string, defaultValue?: T): T {
        return this._properties.get(name) ?? defaultValue;
    }

    protected setProperty(name: string, value: any): void {
        this._properties.set(name, value);
    }
}

/** @internal */
export class TransitionCheck {
    private _transitions: Map<string, boolean> = new Map();
    
    public hasTransition(name: string): boolean {
        return this._transitions.has(name);
    }
    
    public setTransition(name: string, value: boolean): void {
        this._transitions.set(name, value);
    }
    
    public getTransition(name: string): boolean {
        return this._transitions.get(name) || false;
    }
}

export class Utilities {
    public static ValidateTransformQuaternion(transform: TransformNode): void {
        if (transform && !transform.rotationQuaternion) {
            transform.rotationQuaternion = Quaternion.FromEulerAngles(
                transform.rotation.x,
                transform.rotation.y,
                transform.rotation.z
            );
        }
    }

    public static ComputeBlendingSpeed(frameRate: number, duration: number): number {
        return (duration > 0) ? 1 / (duration * frameRate) : 0;
    }

    public static BlendVector3Value(target: Vector3, source: Vector3, weight: number): void {
        target.x = target.x + (source.x - target.x) * weight;
        target.y = target.y + (source.y - target.y) * weight;
        target.z = target.z + (source.z - target.z) * weight;
    }

    public static BlendQuaternionValue(target: Quaternion, source: Quaternion, weight: number): void {
        Quaternion.SlerpToRef(target, source, weight, target);
    }

    public static BlendFloatValue(target: number, source: number, weight: number): number {
        return target + (source - target) * weight;
    }

    public static SampleAnimationVector3(animation: Animation, frame: number, loopMode: number, enableBlending: boolean): Vector3 {
        const value = animation.evaluate(frame);
        return value as Vector3;
    }

    public static SampleAnimationQuaternion(animation: Animation, frame: number, loopMode: number, enableBlending: boolean): Quaternion {
        const value = animation.evaluate(frame);
        return value as Quaternion;
    }

    public static SampleAnimationFloat(animation: Animation, frame: number, loopMode: number, enableBlending: boolean): number {
        const value = animation.evaluate(frame);
        return value as number;
    }

    public static FastMatrixSlerp(start: Matrix, end: Matrix, amount: number, result: Matrix): void {
        Matrix.LerpToRef(start, end, amount, result);
    }
}

export interface BlendTreeValue {
    source: IBlendTreeChild;
    motion: string;
    posX: number;
    posY: number;
    weight: number;
}

export class BlendTreeSystem {
    public static Calculate1DSimpleBlendTree(parameter: number, blendTreeArray: BlendTreeValue[]): void {
        if (blendTreeArray != null && blendTreeArray.length > 0) {
            const count = blendTreeArray.length;
            if (count === 1) {
                blendTreeArray[0].weight = 1;
            } else {
                for (let index = 0; index < count - 1; index++) {
                    const element = blendTreeArray[index];
                    const nextElement = blendTreeArray[index + 1];
                    if (parameter >= element.posX && parameter <= nextElement.posX) {
                        const range = nextElement.posX - element.posX;
                        if (range > 0) {
                            const alpha = (parameter - element.posX) / range;
                            element.weight = 1 - alpha;
                            nextElement.weight = alpha;
                        }
                    }
                }
            }
        }
    }

    public static Calculate2DFreeformDirectional(parameterX: number, parameterY: number, blendTreeArray: BlendTreeValue[]): void {
        if (blendTreeArray != null && blendTreeArray.length > 0) {
            const inputVector = new Vector2(parameterX, parameterY);
            const inputMagnitude = inputVector.length();
            
            if (inputMagnitude > 0) {
                const weightTotal = blendTreeArray.reduce((sum, item) => {
                    const itemVector = new Vector2(item.posX, item.posY);
                    const itemMagnitude = itemVector.length();
                    
                    if (itemMagnitude > 0) {
                        const cosine = Vector2.Dot(inputVector, itemVector) / (inputMagnitude * itemMagnitude);
                        item.weight = Math.max(0, cosine);
                        return sum + item.weight;
                    }
                    return sum;
                }, 0);

                // Normalize weights
                if (weightTotal > 0) {
                    blendTreeArray.forEach(item => {
                        item.weight = Scalar.Clamp(item.weight / weightTotal, 0, 1);
                    });
                }
            }
        }
    }

    public static Calculate2DFreeformCartesian(parameterX: number, parameterY: number, blendTreeArray: BlendTreeValue[]): void {
        if (blendTreeArray != null && blendTreeArray.length > 0) {
            const inputPoint = new Vector2(parameterX, parameterY);
            let totalWeight = 0;

            // Calculate weights based on distance
            blendTreeArray.forEach(item => {
                const itemPoint = new Vector2(item.posX, item.posY);
                const result = new Vector2(0, 0);
                itemPoint.subtractToRef(inputPoint, result);
                const distance = result.length();
                item.weight = Math.max(0, 1 - distance);
                totalWeight += item.weight;
            });

            // Normalize weights with epsilon check
            const epsilon = 0.0001;
            if (totalWeight > epsilon) {
                blendTreeArray.forEach(item => {
                    item.weight = Scalar.Clamp(item.weight / totalWeight, 0, 1);
                });
            } else {
                // If total weight is too small, find closest point
                let minDistance = Number.MAX_VALUE;
                let closestIndex = 0;

                blendTreeArray.forEach((item, index) => {
                    const itemPoint = new Vector2(item.posX, item.posY);
                    const result = new Vector2(0, 0);
                    itemPoint.subtractToRef(inputPoint, result);
                    const distance = result.length();
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = index;
                    }
                    item.weight = 0;
                });

                blendTreeArray[closestIndex].weight = 1;
            }
        }
    }
}

// Constants moved to top of namespace
// Core Animation Enums
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

    export enum BlendTreePosition {
        Lower = 0,
        Upper = 1
    }

    export enum AnimatorParameterType {
        Float = 1,
        Int = 3,
        Bool = 4,
        Trigger = 9
    }

    export class MachineState {
        public hash: number;
        public name: string;
        public tag: string;
        public time: number;
        public type: MotionType;
        public rate: number;
        public length: number;
        public layer: string;
        public layerIndex: number;
        public played: number;
        public machine: string;
        public motionid: number;
        public interrupted: boolean;
        public apparentSpeed: number;
        public averageAngularSpeed: number;
        public averageDuration: number;
        public averageSpeed: number[];
        public cycleOffset: number;
        public cycleOffsetParameter: string;
        public cycleOffsetParameterActive: boolean;
        public iKOnFeet: boolean;
        public mirror: boolean;
        public mirrorParameter: string;
        public mirrorParameterActive: boolean;
        public speed: number;
        public speedParameter: string;
        public speedParameterActive: boolean;
        public blendtree: IBlendTree;
        public transitions: ITransition[];
        public behaviours: IBehaviour[];
        public events: IAnimatorEvent[];
        public ccurves: IAnimationCurve[];
        public tcurves: BABYLON.Animation[];
        constructor() {}
    }

    // Core Animation Interfaces
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

    export interface IAnimationCurve {
        length: number;
        preWrapMode: string;
        postWrapMode: string;
        keyframes: IAnimationKeyframe[];
    }

    export interface IAnimationKeyframe {
        time: number;
        value: number;
        inTangent: number;
        outTangent: number;
        tangentMode: number;
    }

    export interface IBehaviour {
        hash: number;
        name: string;
        layerIndex: number;
        properties: any;
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

    export interface ICondition {
        hash: number;
        mode: ConditionMode;
        parameter: string;
        threshold: number;
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
        track: AnimationGroup;
    }

    export interface BlendTreeValue {
        source: IBlendTreeChild;
        motion: string;
        posX: number;
        posY: number;
        weight: number;
    }

    /** Re-export Animation type to match original namespace */
    type Animation = import("@babylonjs/core/Animations/animation").Animation;

    /**
     * Enhanced Animation State Component
     * Fixes stuttering in 2D blend trees and improves avatar masking
     */
    /** Enhanced Animation State Component */
    export class AnimationStateEx extends ScriptComponent {
        // Public Properties
        public speedRatio: number = 1.0;
        public delayUpdateUntilReady: boolean = true;
        public enableAnimation: boolean = true;
        
        // Private Properties
        private _initialized: boolean = false;
        private _lastTime: number = 0;
        private _applyRootMotion: boolean = false;
        private _executed: boolean = false;
        private _awakened: boolean = false;
        private _machine: any = null;
        private _animationmode: number = 0;
        private _animationrig: string | null = null;
        private _updatemode: number = 0;
        private _hasrootmotion: boolean = false;
        private _animationplaying: boolean = false;
        private _hastransformhierarchy: boolean = false;
        private _leftfeetbottomheight: number = 0;
        private _rightfeetbottomheight: number = 0;
        private _runtimecontroller: string | null = null;
        private _frametime: number = 0;
        private _layercount: number = 0;
        private _ikFrameEanbled: boolean = false;
        private _looptime: boolean = true;
        private _loopblend: boolean = false;
        private _rootBoneTransform: TOOLKIT.TransformNode | null = null;

        // Animation Properties
        private m_animationTargets: TOOLKIT.TargetedAnimation[] = [];
        private m_defaultGroup: TOOLKIT.AnimationGroup | null = null;
        private m_defaultGroups: TOOLKIT.AnimationGroup[] = [];
        private readonly m_zeroVector: TOOLKIT.Vector3 = TOOLKIT.Vector3.Zero();
        private readonly m_rotationIdentity: TOOLKIT.Quaternion = TOOLKIT.Quaternion.Identity();

        // State Properties
        private _data: Map<string, TOOLKIT.MachineState> = new Map();
        private _anims: Map<string, TOOLKIT.AnimationGroup> = new Map();
        private _clips: any[] = [];
        private _numbers: Map<string, number> = new Map();
        private _booleans: Map<string, boolean> = new Map();
        private _triggers: Map<string, boolean> = new Map();
        private _parameters: Map<string, TOOLKIT.AnimatorParameterType> = new Map();
        private _checkers: TOOLKIT.TransitionCheck = new TOOLKIT.TransitionCheck();
        private _source: string | null = null;

        // Root Motion Properties
        private _deltaPosition: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _deltaRotation: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);
        private _angularVelocity: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _rootMotionSpeed: number = 0;
        private _lastMotionSpeed: number = 0;
        private _loopMotionSpeed: number = 0;
        private _lastRotateSpeed: number = 0;
        private _loopRotateSpeed: number = 0;
        private _lastMotionRotation: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);
        private _lastMotionPosition: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _rootMotionMatrix: TOOLKIT.Matrix = TOOLKIT.Matrix.Identity();
        private _dirtyMotionMatrix: TOOLKIT.Matrix | null = null;
        private _rootMotionPosition: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _rootMotionRotation: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);

        // Blend Properties
        private _positionWeight: boolean = false;
        private _rotationWeight: boolean = false;
        private _rootBoneWeight: boolean = false;
        private _rootQuatWeight: boolean = false;
        private _positionHolder: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _rotationHolder: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);
        private _rootBoneHolder: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _rootQuatHolder: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);
        private _targetPosition: TOOLKIT.Vector3 = new TOOLKIT.Vector3(0, 0, 0);
        private _targetRotation: TOOLKIT.Quaternion = new TOOLKIT.Quaternion(0, 0, 0, 0);
        private _targetScaling: TOOLKIT.Vector3 = new TOOLKIT.Vector3(1, 1, 1);
        private _blenderMatrix: TOOLKIT.Matrix = TOOLKIT.Matrix.Identity();
        private _dirtyBlenderMatrix: TOOLKIT.Matrix | null = null;
        private _updateMatrix: TOOLKIT.Matrix = TOOLKIT.Matrix.Identity();
        private _initialtargetblending: boolean = true;

        // Observable Events
        public onAnimationEventObservable?: TOOLKIT.Observable<TOOLKIT.IAnimatorEvent>;
        public onAnimationAwakeObservable?: TOOLKIT.Observable<TOOLKIT.TransformNode>;
        public onAnimationInitObservable?: TOOLKIT.Observable<TOOLKIT.TransformNode>;
        public onAnimationIKObservable?: TOOLKIT.Observable<number>;
        public onAnimationEndObservable?: TOOLKIT.Observable<number>;
        public onAnimationLoopObservable?: TOOLKIT.Observable<number>;
        public onAnimationUpdateObservable?: TOOLKIT.Observable<TOOLKIT.TransformNode>;
        public onAnimationTransitionObservable?: TOOLKIT.Observable<TOOLKIT.TransformNode>;

        constructor(transform: TOOLKIT.TransformNode, scene: TOOLKIT.Scene) {
            super(transform, scene);
            
            // Initialize time tracking
            this._lastTime = Date.now() / 1000;
            
            // Initialize observables
            this.onAnimationEventObservable = new Observable<IAnimatorEvent>();
            this.onAnimationAwakeObservable = new Observable<TransformNode>();
            this.onAnimationInitObservable = new Observable<TransformNode>();
            this.onAnimationIKObservable = new Observable<number>();
            this.onAnimationEndObservable = new Observable<number>();
            this.onAnimationLoopObservable = new Observable<number>();
            this.onAnimationUpdateObservable = new Observable<TransformNode>();
            this.onAnimationTransitionObservable = new Observable<TransformNode>();

            // Initialize transform
            this._rootBoneTransform = transform;
            Utilities.ValidateTransformQuaternion(transform);
        }

        /** Gets if root motion is enabled */
        public get applyRootMotion(): boolean {
            return this._applyRootMotion;
        }

        /** Sets if root motion is enabled */
        public set applyRootMotion(value: boolean) {
            this._applyRootMotion = value;
        }

        /** Gets if the animation state machine is initialized */
        public get isInitialized(): boolean {
            return this._initialized;
        }

        /** @inheritdoc */
        public isReady(): boolean {
            return this._initialized;
        }

        /** @inheritdoc */
        protected awake(): void { 
            this.awakeStateMachine(); 
        }
        
        /** @inheritdoc */
        protected update(): void { 
            if (!this.delayUpdateUntilReady || this.isReady()) {
                this.updateStateMachine(); 
            }
        }
        
        /** @inheritdoc */
        protected destroy(): void { 
            this.destroyStateMachine(); 
        }

        /** Gets if the animation state machine has been awakened */
        public awakened(): boolean { 
            return this._awakened; 
        }

        /** Gets if the animation state machine has root motion */
        public hasRootMotion(): boolean { 
            return this._hasrootmotion; 
        }

        /** Gets if this is the first animation frame */
        public isFirstFrame(): boolean { 
            return (this._frametime === 0); 
        }

        /** Gets if this is the last animation frame */
        public isLastFrame(): boolean { 
            return (this._frametime >= .985); 
        }

        /** Gets if IK frame is enabled */
        public ikFrameEnabled(): boolean { 
            return this._ikFrameEanbled; 
        }

        /** Gets the current animation time */
        public getAnimationTime(): number { 
            return this._frametime; 
        }

        /** Gets if frame loop time is enabled */
        public getFrameLoopTime(): boolean { 
            return this._looptime; 
        }

        /** Gets if frame loop blend is enabled */
        public getFrameLoopBlend(): boolean { 
            return this._loopblend; 
        }

        /** Gets if animation is currently playing */
        public getAnimationPlaying(): boolean { 
            return this._animationplaying; 
        }

        /** Gets the runtime controller name */
        public getRuntimeController(): string { 
            return this._runtimecontroller ?? ""; 
        }

        /** Gets the root bone transform */
        public getRootBoneTransform(): TransformNode | null { 
            return this._rootBoneTransform; 
        }

        /** Gets the delta root motion angle */
        public getDeltaRootMotionAngle(): number { 
            return this._angularVelocity.y; 
        }

        /** Gets the delta root motion speed */
        public getDeltaRootMotionSpeed(): number { 
            return this._rootMotionSpeed; 
        }

        /** Gets the delta root motion position */
        public getDeltaRootMotionPosition(): Vector3 { 
            return this._deltaPosition; 
        }

        /** Gets the delta root motion rotation */
        public getDeltaRootMotionRotation(): Quaternion { 
            return this._deltaRotation; 
        }

        /** Gets the fixed root motion position */
        public getFixedRootMotionPosition(): Vector3 | null { 
            return (this._dirtyMotionMatrix != null) ? this._rootMotionPosition : null; 
        }

        /** Gets the fixed root motion rotation */
        public getFixedRootMotionRotation(): Quaternion | null { 
            return (this._dirtyMotionMatrix != null) ? this._rootMotionRotation : null; 
        }

        /** Gets if transform hierarchy is enabled */
        public get hasTransformHierarchy(): boolean {
            return this._hastransformhierarchy;
        }

        /** Gets the machine state */
        public getMachine(): any {
            return this._machine;
        }

        /** Sets the machine state */
        public setMachine(machine: any): void {
            this._machine = machine;
        }

        /** Gets the class name */
        public override getClassName(): string {
            return "AnimationStateEx";
        }

        // Protected Properties
        protected _scene: Scene;
        protected _transform: TransformNode;

        /** Gets the scene instance */
        protected get scene(): Scene {
            return this._scene;
        }

        /** Gets the transform node */
        protected get transform(): TransformNode {
            return this._transform;
        }

        /** Gets the machine state for a given name */
        private getMachineState(name: string): MachineState | undefined {
            return this._data.get(name);
        }

        /** Gets the transform path for a target */
        private getTargetPath(target: any): string {
            if (!target) return "";
            let path = target.name || "";
            let current = target.parent;
            while (current) {
                path = current.name + "/" + path;
                current = current.parent;
            }
            return path;
        }

        /** Gets the current state for a layer */
        public getCurrentState(layer: number): MachineState | null {
            return (this._machine?.layers != null && this._machine.layers.length > layer) ? 
                this._machine.layers[layer].animationStateMachine : null;
        }

        /** Gets the default animation clips */
        public getDefaultClips(): any[] {
            return this._clips;
        }

        /** Gets the default animation source */
        public getDefaultSource(): string {
            return this._source ?? "";
        }

        /** Apply avatar mask to targeted animations */
        private applyAvatarMask(layer: IAnimationLayer, targets: TargetedAnimation[]): void {
            if (!layer.avatarMask || !layer.avatarMask.transformPaths) return;

            const maskPaths = new Set(layer.avatarMask.transformPaths);
            for (const target of targets) {
                const targetPath = this.getTargetPath(target.target);
                if (!maskPaths.has(targetPath)) {
                    target.weight *= 0; // Mask out non-matching transforms
                }
            }
        }

        /** Parse tree branches for blend weights */
        private parseTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            switch (tree.blendType) {
                case BlendTreeType.Simple1D:
                    this.parse1DSimpleTreeBranches(layer, tree, parentWeight, weightList);
                    break;
                case BlendTreeType.SimpleDirectional2D:
                    this.parse2DSimpleDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                    break;
                case BlendTreeType.FreeformDirectional2D:
                    this.parse2DFreeformDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                    break;
                case BlendTreeType.FreeformCartesian2D:
                    this.parse2DFreeformCartesianTreeBranches(layer, tree, parentWeight, weightList);
                    break;
                case BlendTreeType.Direct:
                    this.parseDirectTreeBranches(layer, tree, parentWeight, weightList);
                    break;
            }
        }

        // Core Animation Methods
        private playCurrentAnimationState(layer: IAnimationLayer, state: string, blendingSpeed: number): void {
            if (layer && layer.animationStateMachine) {
                // Set current state and handle transitions
                const currentState = this.getMachineState(state);
                if (currentState) {
                    layer.animationStateMachine = currentState;
                    layer.animationTime = 0;
                    layer.animationNormal = 0;
                    layer.animationLoopFrame = false;
                    layer.animationFirstRun = true;
                    
                    // Notify transition observers
                    if (this.onAnimationTransitionObservable?.hasObservers()) {
                        this.onAnimationTransitionObservable?.notifyObservers(this.transform);
                    }
                }
            }
        }

        private stopCurrentAnimationState(layer: IAnimationLayer): void {
            if (layer && layer.animationStateMachine) {
                layer.animationStateMachine = null;
                layer.animationTime = 0;
                layer.animationNormal = 0;
                layer.animationLoopFrame = false;
                layer.animationFirstRun = false;
            }
        }

        private awakeStateMachine(): void {
            if (!this._awakened) {
                this._awakened = true;
                if (this.onAnimationAwakeObservable?.hasObservers()) {
                    this.onAnimationAwakeObservable?.notifyObservers(this.transform);
                }
            }
        }

        private updateStateMachine(): void {
            if (!this.delayUpdateUntilReady || this.isReady()) {
                if (!this._executed) {
                    this._executed = true;
                    if (this._machine?.layers?.length > 0) {
                        this._machine.layers.forEach((layer: IAnimationLayer) => {
                            this.playCurrentAnimationState(layer, layer.entry, 0);
                        });
                    }
                    this._initialized = true;
                    if (this.onAnimationInitObservable?.hasObservers()) {
                        this.onAnimationInitObservable?.notifyObservers(this.transform);
                    }
                }
                if (this.enableAnimation) {
                    this.updateAnimationState();
                    if (this._machine?.layers) {
                        for (const layer of this._machine.layers) {
                            this.updateAnimationTargets(layer);
                        }
                    }
                    if (this.onAnimationUpdateObservable?.hasObservers()) {
                        this.onAnimationUpdateObservable?.notifyObservers(this.transform);
                    }
                }
            }
        }

        private destroyStateMachine(): void {
            this._data = new Map<string, MachineState>();
            this._clips = [];
            this._anims = new Map<string, AnimationGroup>();
            this._numbers = new Map<string, number>();
            this._booleans = new Map<string, boolean>();
            this._triggers = new Map<string, boolean>();
            this._parameters = new Map<string, AnimatorParameterType>();
            this._checkers = new TransitionCheck();
            this._machine = null;

            // Clear observables
            this.onAnimationAwakeObservable?.clear();
            this.onAnimationInitObservable?.clear();
            this.onAnimationIKObservable?.clear();
            this.onAnimationEndObservable?.clear();
            this.onAnimationLoopObservable?.clear();
            this.onAnimationEventObservable?.clear();
            this.onAnimationUpdateObservable?.clear();
            this.onAnimationTransitionObservable?.clear();
        }

        private updateAnimationState(): void {
            if (this._initialized && this._machine?.layers) {
                for (const layer of this._machine.layers) {
                    if (layer.animationStateMachine) {
                        this.updateLayerState(layer);
                    }
                }
            }
        }

        private updateLayerState(layer: TOOLKIT.IAnimationLayer): void {
            if (!layer || !layer.animationStateMachine) return;
            
            const state = layer.animationStateMachine;
            const frameRatio = this._scene.getAnimationRatio();
            const deltaTime = this._scene.getEngine().getDeltaTime() / 1000.0;
            
            try {
                // Initialize animation time if needed
                if (layer.animationTime === undefined) layer.animationTime = 0;
                
                // Calculate normalized time with improved stability
                const stateSpeed = (state.speed !== undefined) ? state.speed : 1.0;
                const scaledDeltaTime = deltaTime * frameRatio * this.speedRatio * Math.abs(stateSpeed);
                layer.animationTime = Math.min(layer.animationTime + scaledDeltaTime, TOOLKIT.AnimationStateConstants.TIME);
                
                // Handle animation loop
                if (layer.animationTime >= TOOLKIT.AnimationStateConstants.TIME) {
                    layer.animationTime = 0;
                    layer.animationLoopFrame = true;
                    layer.animationLoopCount = (layer.animationLoopCount || 0) + 1;
                    
                    if (this.onAnimationLoopObservable?.hasObservers()) {
                        this.onAnimationLoopObservable.notifyObservers(layer.index);
                    }
                } else {
                    layer.animationLoopFrame = false;
                }
                
                // Calculate normalized time with improved precision
                layer.animationNormal = Math.max(0, Math.min(layer.animationTime / TOOLKIT.AnimationStateConstants.TIME, 1));
                
                // Reverse normalized time if playing backwards
                if (stateSpeed < 0) {
                    layer.animationNormal = 1 - layer.animationNormal;
                }
                
                // Update blend tree weights with improved stability
                if (state.type === TOOLKIT.MotionType.Tree && state.blendtree) {
                    this.updateBlendTreeWeights(layer, state.blendtree);
                }
                
                // Update animation targets
                this.updateAnimationTargets(layer);
                
                // Handle IK notifications
                if (this._ikFrameEanbled && layer.iKPass && this.onAnimationIKObservable?.hasObservers()) {
                    this.onAnimationIKObservable.notifyObservers(layer.index);
                }
            } catch (error) {
                console.error(`Error updating layer state: ${error}`);
                // Reset layer state to prevent corrupted state
                layer.animationTime = 0;
                layer.animationNormal = 0;
                layer.animationLoopFrame = false;
            }
        }

        private updateBlendTreeWeights(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree): void {
            try {
                const weightList: TOOLKIT.IBlendTreeChild[] = [];
                this.parseTreeBranches(layer, tree, 1.0, weightList);

                // Normalize weights to prevent stuttering
                let totalWeight = 0;
                weightList.forEach(child => {
                    if (child.weight !== undefined) {
                        totalWeight += child.weight;
                    }
                });
                
                if (totalWeight > 0) {
                    weightList.forEach(child => {
                        if (child.weight !== undefined) {
                            child.ratio = child.weight / totalWeight;
                        }
                    });
                }
            } catch (error) {
                console.error(`Error updating blend tree weights: ${error}`);
            }
        }

        private updateAnimationTargets(layer: TOOLKIT.IAnimationLayer): void {
            if (!layer.animationStateMachine) return;

            try {
                const state = layer.animationStateMachine;
                const targetList: TOOLKIT.TargetedAnimation[] = [];

                // Collect targeted animations
                if (state.type === TOOLKIT.MotionType.Tree && state.blendtree) {
                    this.collectBlendTreeTargets(state.blendtree, targetList);
                } else if (state.type === TOOLKIT.MotionType.Clip) {
                    // Handle single clip animation
                    const group = this._anims.get(state.name);
                    if (group) {
                        targetList.push(...group.targetedAnimations);
                    }
                }

                // Apply avatar masking with improved handling
                if (layer.avatarMask && targetList.length > 0) {
                    this.applyAvatarMask(layer, targetList);
                }

                // Update animation values with stability improvements
                this.updateBlendableTargets(layer, targetList);
            } catch (error) {
                console.error(`Error updating animation targets: ${error}`);
            }
        }
        }

        private collectBlendTreeTargets(tree: TOOLKIT.IBlendTree, targetList: TOOLKIT.TargetedAnimation[]): void {
            if (!tree || !tree.children) return;

            try {
                for (const child of tree.children) {
                    if (child.type === TOOLKIT.MotionType.Clip) {
                        const group = this._anims.get(child.motion);
                        if (group) {
                            targetList.push(...group.targetedAnimations.map(target => ({
                                ...target,
                                weight: child.weight || 0
                            })));
                        }
                    } else if (child.type === TOOLKIT.MotionType.Tree && child.subtree) {
                        this.collectBlendTreeTargets(child.subtree, targetList);
                    }
                }
            } catch (error) {
                console.error(`Error collecting blend tree targets: ${error}`);
            }
        }

        private updateBlendableTargets(layer: TOOLKIT.IAnimationLayer, targets: TOOLKIT.TargetedAnimation[]): void {
            if (!targets.length) return;

            try {
                // Group targets by transform path for proper blending
                const targetGroups = new Map<string, TOOLKIT.TargetedAnimation[]>();
                for (const target of targets) {
                    const path = this.getTargetPath(target.target);
                    if (!targetGroups.has(path)) {
                        targetGroups.set(path, []);
                    }
                    targetGroups.get(path)?.push(target);
                }

                // Blend animations within each group
                for (const [path, groupTargets] of targetGroups) {
                    let totalWeight = 0;
                    groupTargets.forEach(target => {
                        if (target.weight !== undefined) {
                            totalWeight += target.weight;
                        }
                    });

                    if (totalWeight > 0) {
                        // Normalize weights with improved stability
                        groupTargets.forEach(target => {
                            if (target.weight !== undefined) {
                                target.weight = target.weight / totalWeight;
                            }
                        });

                        // Apply blended values with error handling
                        this.applyBlendedAnimation(groupTargets);
                    }
                }
            } catch (error) {
                console.error(`Error updating blendable targets: ${error}`);
            }
        }
        }

        private applyBlendedAnimation(targets: TOOLKIT.TargetedAnimation[]): void {
            if (!targets.length) return;

            try {
                const target = targets[0].target as BABYLON.TransformNode;
                if (!target) return;

                // Initialize blend values
                let position = BABYLON.Vector3.Zero();
                let rotation = BABYLON.Quaternion.Identity();
                let scaling = BABYLON.Vector3.One();

                // Blend all animations
                targets.forEach(anim => {
                    const weight = anim.weight;
                    if (weight && weight > 0) {
                        // Sample animation at current time
                        const currentPosition = this.sampleAnimationVector3(anim, "position");
                        const currentRotation = this.sampleAnimationQuaternion(anim, "rotationQuaternion");
                        const currentScaling = this.sampleAnimationVector3(anim, "scaling");

                        // Blend values with improved stability
                        BABYLON.Vector3.LerpToRef(position, currentPosition, weight, position);
                        BABYLON.Quaternion.SlerpToRef(rotation, currentRotation, weight, rotation);
                        BABYLON.Vector3.LerpToRef(scaling, currentScaling, weight, scaling);
                    }
                });

                // Apply final values with validation
                if (position && rotation && scaling) {
                    target.position = position;
                    target.rotationQuaternion = rotation;
                    target.scaling = scaling;
                }
            } catch (error) {
                console.error(`Error applying blended animation: ${error}`);
            }
        }

        private sampleAnimationVector3(target: TOOLKIT.TargetedAnimation, property: string): BABYLON.Vector3 {
            try {
                const animation = target.animation;
                if (!animation) return BABYLON.Vector3.Zero();

                const currentFrame = this._scene.getAnimationRatio() * animation.framePerSecond;
                return TOOLKIT.Utilities.SampleAnimationVector3(
                    animation,
                    currentFrame,
                    animation.loopMode || BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
                    true
                );
            } catch (error) {
                console.error(`Error sampling Vector3 animation: ${error}`);
                return BABYLON.Vector3.Zero();
            }
        }

        private sampleAnimationQuaternion(target: TOOLKIT.TargetedAnimation, property: string): BABYLON.Quaternion {
            try {
                const animation = target.animation;
                if (!animation) return BABYLON.Quaternion.Identity();

                const currentFrame = this._scene.getAnimationRatio() * animation.framePerSecond;
                return TOOLKIT.Utilities.SampleAnimationQuaternion(
                    animation,
                    currentFrame,
                    animation.loopMode || BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
                    true
                );
            } catch (error) {
                console.error(`Error sampling Quaternion animation: ${error}`);
                return BABYLON.Quaternion.Identity();
            }
        }

        /** Parse 1D simple tree branches */
        private parse1DSimpleTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            const blendTreeArray: BlendTreeValue[] = [];
            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight = 0; // Reset Weight Value
                const item = {
                    source: child,
                    motion: child.motion,
                    posX: child.positionX,
                    posY: child.positionY,
                    weight: child.weight
                };
                blendTreeArray.push(item);
            });

            BlendTreeSystem.Calculate1DSimpleBlendTree(tree.valueParameterX, blendTreeArray);
            blendTreeArray.forEach((element: BlendTreeValue) => {
                if (element.source != null) {
                    element.source.weight = element.weight;
                }
            });

            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight *= parentWeight; // Scale Weight Value
                if (child.type === MotionType.Clip) {
                    if (child.weight > 0) {
                        weightList.push(child);
                    }
                }
                if (child.type === MotionType.Tree) {
                    this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                }
            });
        }

        /** Parse 2D simple directional tree branches */
        private parse2DSimpleDirectionalTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            const blendTreeArray: BlendTreeValue[] = [];
            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight = 0; // Reset Weight Value
                const item = {
                    source: child,
                    motion: child.motion,
                    posX: child.positionX,
                    posY: child.positionY,
                    weight: child.weight
                };
                blendTreeArray.push(item);
            });

            BlendTreeSystem.Calculate2DFreeformDirectional(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
            blendTreeArray.forEach((element: BlendTreeValue) => {
                if (element.source != null) {
                    element.source.weight = element.weight;
                }
            });

            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight *= parentWeight; // Scale Weight Value
                if (child.type === MotionType.Clip) {
                    if (child.weight > 0) {
                        weightList.push(child);
                    }
                }
                if (child.type === MotionType.Tree) {
                    this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                }
            });
        }

        /** Parse 2D freeform directional tree branches */
        private parse2DFreeformDirectionalTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            const blendTreeArray: BlendTreeValue[] = [];
            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight = 0; // Reset Weight Value
                const item = {
                    source: child,
                    motion: child.motion,
                    posX: child.positionX,
                    posY: child.positionY,
                    weight: child.weight
                };
                blendTreeArray.push(item);
            });

            BlendTreeSystem.Calculate2DFreeformDirectional(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
            blendTreeArray.forEach((element: BlendTreeValue) => {
                if (element.source != null) {
                    element.source.weight = element.weight;
                }
            });

            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight *= parentWeight; // Scale Weight Value
                if (child.type === MotionType.Clip) {
                    if (child.weight > 0) {
                        weightList.push(child);
                    }
                }
                if (child.type === MotionType.Tree) {
                    this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                }
            });
        }

        /** Parse 2D freeform cartesian tree branches */
        private parse2DFreeformCartesianTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            const blendTreeArray: BlendTreeValue[] = [];
            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight = 0; // Reset Weight Value
                const item = {
                    source: child,
                    motion: child.motion,
                    posX: child.positionX,
                    posY: child.positionY,
                    weight: child.weight
                };
                blendTreeArray.push(item);
            });

            BlendTreeSystem.Calculate2DFreeformCartesian(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
            blendTreeArray.forEach((element: BlendTreeValue) => {
                if (element.source != null) {
                    element.source.weight = element.weight;
                }
            });

            tree.children.forEach((child: IBlendTreeChild) => {
                child.weight *= parentWeight; // Scale Weight Value
                if (child.type === MotionType.Clip) {
                    if (child.weight > 0) {
                        weightList.push(child);
                    }
                }
                if (child.type === MotionType.Tree) {
                    this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                }
            });
        }

        /** Parse direct tree branches */
        private parseDirectTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (!tree?.children?.length) return;

            tree.children.forEach((child: IBlendTreeChild) => {
                if (child.type === MotionType.Clip) {
                    child.weight = parentWeight;
                    if (child.weight > 0) {
                        weightList.push(child);
                    }
                }
                if (child.type === MotionType.Tree) {
                    this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                }
            });
        }
        }
            const deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
            
            // Calculate normalized time
            layer.animationTime += deltaTime * frameRatio * this.speedRatio;
            if (layer.animationTime >= AnimationStateConstants.TIME) {
                layer.animationTime = 0;
                layer.animationLoopFrame = true;
            } else {
                layer.animationLoopFrame = false;
            }
            layer.animationNormal = layer.animationTime / AnimationStateConstants.TIME;

            // Update blend tree weights
            if (state.type === MotionType.Tree && state.blendtree) {
                this.updateBlendTreeWeights(layer, state.blendtree);
            }

            // Update animation targets
            this.updateAnimationTargets(layer);
        }

        /**
         * Update blend tree weights with improved stability
         */
        private updateBlendTreeWeights(layer: IAnimationLayer, tree: IBlendTree): void {
            const weightList: IBlendTreeChild[] = [];
            this.parseTreeBranches(layer, tree, 1.0, weightList);

            // Normalize weights to prevent stuttering
            let totalWeight = 0;
            weightList.forEach(child => totalWeight += child.weight);
            
            if (totalWeight > 0) {
                weightList.forEach(child => {
                    child.ratio = child.weight / totalWeight;
                });
            }
        }

        /**
         * Update animation targets with improved avatar masking
         */
        private updateAnimationTargets(layer: IAnimationLayer): void {
            if (!layer.animationStateMachine) return;

            const state = layer.animationStateMachine;
            const targetList: TargetedAnimation[] = [];

            // Collect targeted animations
            if (state.type === MotionType.Tree && state.blendtree) {
                this.collectBlendTreeTargets(state.blendtree, targetList);
            } else if (state.type === MotionType.Clip) {
                // Handle single clip animation
                const group = this._anims.get(state.name);
                if (group) {
                    targetList.push(...group.targetedAnimations);
                }
            }

            // Apply avatar masking
            if (layer.avatarMask && targetList.length > 0) {
                this.applyAvatarMask(layer, targetList);
            }

            // Update animation values
            this.updateBlendableTargets(layer, targetList);
        }

        /**
         * Apply avatar mask to targeted animations
         */
        private applyAvatarMask(layer: IAnimationLayer, targets: TargetedAnimation[]): void {
            if (!layer.avatarMask || !layer.avatarMask.transformPaths) return;

            const maskPaths = new Set(layer.avatarMask.transformPaths);
            for (const target of targets) {
                const targetPath = this.getTargetPath(target.target);
                if (!maskPaths.has(targetPath)) {
                    target.weight *= 0; // Mask out non-matching transforms
                }
            }
        }

        /**
         * Get the transform path for a target
         */
        private getTargetPath(target: any): string {
            if (!target) return "";
            let path = target.name || "";
            let current = target.parent;
            while (current) {
                path = current.name + "/" + path;
                current = current.parent;
            }
            return path;
        }

        /**
         * Parse tree branches for blend weights
         */
        private parseTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                switch (tree.blendType) {
                    case BlendTreeType.Simple1D:
                        this.parse1DSimpleTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case BlendTreeType.SimpleDirectional2D:
                        this.parse2DSimpleDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case BlendTreeType.FreeformDirectional2D:
                        this.parse2DFreeformDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case BlendTreeType.FreeformCartesian2D:
                        this.parse2DFreeformCartesianTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case BlendTreeType.Direct:
                        this.parseDirectTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                }
            }
        }

        /**
         * Parse direct tree branches
         */
        private parseDirectTreeBranches(layer: IAnimationLayer, tree: IBlendTree, parentWeight: number, weightList: IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                tree.children.forEach((child: IBlendTreeChild) => {
                    if (child.type === MotionType.Clip) {
                        child.weight = parentWeight;
                        if (child.weight > 0) {
                            weightList.push(child);
                        }
                    }
                    if (child.type === MotionType.Tree) {
                        this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                    }
                });
            }
        }

    }
}
