import * as BABYLON from 'babylonjs';

namespace TOOLKIT {
    // Enums
    export enum BlendTreeType {
        Simple1D = 0,
        Simple2D = 1,
        FreeformDirectional2D = 2,
        FreeformCartesian2D = 3,
        Direct = 4,
        Clip = 5
    }

    export enum MotionType {
        Clip = 0,
        Tree = 1
    }

    export enum ConditionMode {
        If = 1,
        IfNot = 2,
        Greater = 3,
        Less = 4,
        Equals = 5,
        NotEqual = 6
    }

    export enum AnimatorParameterType {
        Float = 1,
        Int = 3,
        Bool = 4,
        Trigger = 9
    }

    // Interfaces
    export interface IMachine {
        hash: number;
        auto: boolean;
        speed: number;
        layers: IAnimationLayer[];
        parameters: IParameter[];
        transitions: ITransition[];
        states: IState[];
    }

    export interface IState {
        name: string;
        hash: number;
        motion?: string;
        blendtree?: IBlendTree;
    }

    export interface IParameter {
        name: string;
        type: AnimatorParameterType;
        defaultFloat: number;
        defaultInt: number;
        defaultBool: boolean;
    }

    export interface IAnimationLayer {
        index: number;
        name: string;
        defaultWeight: number;
        avatarMask: IAvatarMask;
        entry: string;
    }

    export interface IAvatarMask {
        transformPaths: string[];
    }

    export interface ITransition {
        hash: number;
        layerIndex: number;
        isExit: boolean;
        mute: boolean;
        solo: boolean;
        hasExitTime: boolean;
        duration: number;
        offset: number;
        destination: string;
        conditions: ICondition[];
    }

    export interface ICondition {
        parameter: string;
        mode: ConditionMode;
        threshold: number;
    }

    export interface IBlendTree {
        hash: number;
        name: string;
        blendType: BlendTreeType;
        children: IBlendTreeChild[];
        blendParameterX: string | null;
        blendParameterY: string | null;
        minThreshold: number;
        maxThreshold: number;
    }

    export interface IBlendTreeChild {
        hash: number;
        type: MotionType;
        motion: string;
        positionX: number;
        positionY: number;
        threshold: number;
        timescale: number;
        weight: number;
        directBlendParameter: string | null;
        subtree: IBlendTree | null;
        loop?: boolean;
    }

    // Main Animation Controller Class
    export class AnimationController {
        private static readonly FPS: number = 60;
        private static readonly TIME: number = 1;
        private static readonly SPEED: number = 1;

        private _machine: IMachine;
        private _layers: AnimationLayer[];
        private _parameters: Map<string, any>;
        private _animationGroups: Map<string, BABYLON.AnimationGroup>;
        private _rootTransform: BABYLON.TransformNode;

        private _deltaPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _deltaRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _rootMotionMatrix: BABYLON.Matrix = BABYLON.Matrix.Identity();
        
        private _initialized: boolean = false;
        private _speedRatio: number = 1.0;
        private _applyRootMotion: boolean = false;

        constructor(rootTransform: BABYLON.TransformNode) {
            this._rootTransform = rootTransform;
            this._parameters = new Map<string, any>();
            this._animationGroups = new Map<string, BABYLON.AnimationGroup>();
            this._layers = [];
        }

        public initialize(machine: IMachine, animationGroups: BABYLON.AnimationGroup[]): void {
            this._machine = machine;
            this._speedRatio = machine.speed;

            // Initialize parameters
            this._parameters.clear();
            machine.parameters.forEach(param => {
                switch (param.type) {
                    case AnimatorParameterType.Float:
                        this._parameters.set(param.name, param.defaultFloat);
                        break;
                    case AnimatorParameterType.Int:
                        this._parameters.set(param.name, param.defaultInt);
                        break;
                    case AnimatorParameterType.Bool:
                    case AnimatorParameterType.Trigger:
                        this._parameters.set(param.name, param.defaultBool);
                        break;
                }
            });

            // Setup animation groups
            this._animationGroups.clear();
            animationGroups.forEach(group => {
                this._animationGroups.set(group.name, group);
            });

            // Initialize layers
            this._layers = machine.layers.map(layerData => {
                return new AnimationLayer(
                    machine,
                    layerData,
                    this._animationGroups,
                    this._parameters,
                    this._speedRatio
                );
            });

            this._initialized = true;
        }

        public update(deltaTime: number): void {
            if (!this._initialized) return;

            // Update each layer
            this._layers.forEach(layer => {
                layer.update(deltaTime);
            });

            // Apply final transforms
            this.finalizeAnimations();
        }

        public setState(stateName: string, layerIndex: number = 0): void {
            if (!this._initialized) return;
            const layer = this._layers[layerIndex];
            if (layer) {
                layer.setState(stateName);
            }
        }

        // Parameter getters/setters
        public hasFloat(name: string): boolean {
            return (this._parameters.get(name) != null);
        }

        public getFloat(name: string): number {
            return this._parameters.get(name) || 0;
        }

        public setFloat(name: string, value: number): void {
            this._parameters.set(name, value);
        }

        public hasBool(name: string): boolean {
            return (this._parameters.get(name) != null);
        }

        public getBool(name: string): boolean {
            return this._parameters.get(name) || false;
        }

        public setBool(name: string, value: boolean): void {
            this._parameters.set(name, value);
        }

        public hasInteger(name: string): boolean {
            return (this._parameters.get(name) != null);
        }

        public getInteger(name: string): number {
            return Math.floor(this._parameters.get(name)) || 0;
        }

        public setInteger(name: string, value: number): void {
            this._parameters.set(name, Math.floor(value));
        }

        public hasTrigger(name: string): boolean {
            return (this._parameters.get(name) != null);
        }

        public getTrigger(name: string): boolean {
            return this._parameters.get(name) || false;
        }

        public setTrigger(name: string): void {
            this._parameters.set(name, true);
        }

        public resetTrigger(name: string): void {
            this._parameters.set(name, false);
        }

        // Root motion
        public get applyRootMotion(): boolean {
            return this._applyRootMotion;
        }

        public set applyRootMotion(value: boolean) {
            this._applyRootMotion = value;
        }

        private finalizeAnimations(): void {
            // Reset root motion
            this._deltaPosition.setAll(0);
            this._deltaRotation.set(0, 0, 0, 1);
            this._rootMotionMatrix.setAll(0);

            // Finalize each layer's animations
            this._layers.forEach(layer => {
                layer.finalizeAnimations(this._rootTransform);
            });

            // Apply root motion if enabled
            if (this._applyRootMotion && this._rootTransform) {
                const rootMotion = this._layers[0]?.getRootMotion();
                if (rootMotion && this._rootTransform.rotationQuaternion) {
                    this._rootTransform.position.addInPlace(rootMotion.position);
                    this._rootTransform.rotationQuaternion.multiplyInPlace(rootMotion.rotation);
                }
            }
        }
    }

    // Animation Layer Class
    class AnimationLayer {
        private _stateMachine: StateMachine;
        private _avatarMask: IAvatarMask;
        private _defaultWeight: number;
        private _currentTime: number = 0;
        private _animationGroups: Map<string, BABYLON.AnimationGroup>;
        private _parameters: Map<string, any>;
        private _speedRatio: number;
        private _machine: IMachine;

        constructor(
            machine: IMachine,
            layerData: IAnimationLayer,
            animationGroups: Map<string, BABYLON.AnimationGroup>,
            parameters: Map<string, any>,
            speedRatio: number
        ) {
            this._machine = machine;
            this._avatarMask = layerData.avatarMask;
            this._defaultWeight = layerData.defaultWeight;
            this._animationGroups = animationGroups;
            this._parameters = parameters;
            this._speedRatio = speedRatio;
            
            // Initialize state machine
            this._stateMachine = new StateMachine(
                this._machine,
                layerData.entry,
                this._animationGroups,
                this._parameters,
                this._speedRatio
            );
        }

        public update(deltaTime: number): void {
            this._currentTime += deltaTime;
            this._stateMachine.update(deltaTime);
        }

        public setState(stateName: string): void {
            this._stateMachine.setState(stateName);
        }

        public getRootMotion(): { position: BABYLON.Vector3, rotation: BABYLON.Quaternion } | null {
            return this._stateMachine.getRootMotion();
        }

        public finalizeAnimations(rootNode: BABYLON.TransformNode): void {
            if (!rootNode) return;

            const state = this._stateMachine.getCurrentState();
            if (!state || state.isEmpty) return;

            // Apply animations based on avatar mask
            if (this._avatarMask) {
                this.applyMaskedAnimations(rootNode);
            } else {
                this.applyFullAnimations(rootNode);
            }
        }

        private applyMaskedAnimations(rootNode: BABYLON.TransformNode): void {
            // Filter and apply animations only to masked bones
            const transformPaths = this._avatarMask.transformPaths;
            transformPaths.forEach(path => {
                const node = this.findNodeByPath(rootNode, path);
                if (node) {
                    this._stateMachine.applyAnimationToNode(node, this._defaultWeight);
                }
            });
        }

        private applyFullAnimations(rootNode: BABYLON.TransformNode): void {
            // Apply animations to all bones
            this._stateMachine.applyAnimationToNode(rootNode, this._defaultWeight);
        }

        private findNodeByPath(root: BABYLON.TransformNode, path: string): BABYLON.TransformNode | null {
            const parts = path.split('/');
            let current: BABYLON.Node = root;

            for (const part of parts) {
                current = current.getChildren((node) => node.name === part, false)[0];
                if (!current) return null;
            }

            return current as BABYLON.TransformNode;
        }
    }

    // State Machine Class
    class StateMachine {
        private _currentState: AnimationState | null = null;
        private _states: Map<string, AnimationState> = new Map();
        private _transitions: ITransition[] = [];
        private _anyStateTransitions: ITransition[] = [];
        private _animationGroups: Map<string, BABYLON.AnimationGroup>;
        private _parameters: Map<string, any>;
        private _speedRatio: number;
        private _machine: IMachine;

        constructor(
            machine: IMachine,
            entryState: string,
            animationGroups: Map<string, BABYLON.AnimationGroup>,
            parameters: Map<string, any>,
            speedRatio: number
        ) {
            this._machine = machine;
            this._animationGroups = animationGroups;
            this._parameters = parameters;
            this._speedRatio = speedRatio;
            
            // Initialize with entry state
            this.setState(entryState);
        }

        public update(deltaTime: number): void {
            // Check transitions
            this.checkTransitions();

            // Update current state
            if (this._currentState) {
                this._currentState.update(deltaTime * this._speedRatio);
            }
        }

        public setState(stateName: string): void {
            if (!this._states.has(stateName)) {
                // Get state data from machine configuration
                const stateData = this._machine.states.find(s => s.name === stateName);
                if (!stateData) {
                    console.warn(`State ${stateName} not found in machine configuration`);
                    return;
                }
                
                this._states.set(stateName, new AnimationState(
                    stateName,
                    stateData,
                    this._animationGroups,
                    this._parameters,
                    this._speedRatio
                ));
            }

            const newState = this._states.get(stateName);
            if (newState) {
                if (this._currentState) {
                    this._currentState.exit();
                }
                this._currentState = newState;
                this._currentState.enter();
            }
        }

        public getCurrentState(): AnimationState | null {
            return this._currentState;
        }

        public getRootMotion(): { position: BABYLON.Vector3, rotation: BABYLON.Quaternion } | null {
            return this._currentState?.getRootMotion() || null;
        }

        public applyAnimationToNode(node: BABYLON.TransformNode, weight: number): void {
            this._currentState?.applyToNode(node, weight);
        }

        private checkTransitions(): void {
            if (!this._currentState) return;

            // Check ANY state transitions first
            const anyTransition = this.findValidTransition(this._anyStateTransitions);
            if (anyTransition) {
                this.executeTransition(anyTransition);
                return;
            }

            // Check current state transitions
            const stateTransition = this.findValidTransition(this._transitions);
            if (stateTransition) {
                this.executeTransition(stateTransition);
            }
        }

        private findValidTransition(transitions: ITransition[]): ITransition | null {
            for (const transition of transitions) {
                if (this.isTransitionValid(transition)) {
                    return transition;
                }
            }
            return null;
        }

        private isTransitionValid(transition: ITransition): boolean {
            // Check all conditions
            return transition.conditions.every(condition => {
                const paramValue = this._parameters.get(condition.parameter);
                switch (condition.mode) {
                    case ConditionMode.If:
                        return paramValue === true;
                    case ConditionMode.IfNot:
                        return paramValue === false;
                    case ConditionMode.Greater:
                        return paramValue > condition.threshold;
                    case ConditionMode.Less:
                        return paramValue < condition.threshold;
                    case ConditionMode.Equals:
                        return paramValue === condition.threshold;
                    case ConditionMode.NotEqual:
                        return paramValue !== condition.threshold;
                    default:
                        return false;
                }
            });
        }

        private executeTransition(transition: ITransition): void {
            if (transition.destination) {
                this.setState(transition.destination);
            }
        }
    }

    // Animation State Class
    class AnimationState {
        private _name: string;
        private _animationGroup: BABYLON.AnimationGroup | null;
        private _currentTime: number = 0;
        private _speedRatio: number;
        private _blendTree: BlendTree | null = null;
        private _isEmpty: boolean;
        private _parameters: Map<string, any>;

        private _rootMotionPosition: BABYLON.Vector3 = new BABYLON.Vector3();
        private _rootMotionRotation: BABYLON.Quaternion = new BABYLON.Quaternion();

        constructor(
            name: string,
            stateData: any,
            animationGroups: Map<string, BABYLON.AnimationGroup>,
            parameters: Map<string, any>,
            speedRatio: number
        ) {
            this._name = name;
            this._parameters = parameters;
            this._speedRatio = speedRatio;

            // Initialize blend tree based on state data
            if (stateData.blendtree) {
                // State has a blend tree defined
                this._blendTree = new BlendTree(stateData.blendtree, parameters, animationGroups);
                this._isEmpty = false;
            } else if (stateData.motion) {
                // Single motion state - create a simple blend tree
                const singleChildData: IBlendTreeChild = {
                    hash: stateData.hash || 0,
                    type: MotionType.Clip,
                    motion: stateData.motion,
                    positionX: 0,
                    positionY: 0,
                    threshold: 0,
                    timescale: 1,
                    directBlendParameter: "",
                    weight: 1,
                    subtree: null
                };

                const singleBlendTree: IBlendTree = {
                    hash: stateData.hash || 0,
                    name: `${name}_SingleMotion`,
                    blendType: BlendTreeType.Simple1D,
                    children: [singleChildData],
                    blendParameterX: null,
                    blendParameterY: null,
                    minThreshold: 0,
                    maxThreshold: 1
                };

                this._blendTree = new BlendTree(singleBlendTree, parameters, animationGroups);
                this._animationGroup = animationGroups.get(stateData.motion) || null;
                this._isEmpty = !this._animationGroup;
            } else {
                // Empty state
                this._animationGroup = null;
                this._isEmpty = true;
            }
        }

        public get isEmpty(): boolean {
            return this._isEmpty;
        }

        public enter(): void {
            this._currentTime = 0;
        }

        public exit(): void {
            // Reset state
            this._currentTime = 0;
            this._rootMotionPosition.setAll(0);
            this._rootMotionRotation.set(0, 0, 0, 1);
        }

        public update(deltaTime: number): void {
            if (this._isEmpty) return;

            this._currentTime += deltaTime;

            // Update blend tree if exists
            if (this._blendTree) {
                this._blendTree.update(deltaTime);
            }

            // Extract root motion if animation group exists
            if (this._animationGroup) {
                this.extractRootMotion();
            }
        }

        public getRootMotion(): { position: BABYLON.Vector3, rotation: BABYLON.Quaternion } {
            return {
                position: this._rootMotionPosition,
                rotation: this._rootMotionRotation
            };
        }

        public applyToNode(node: BABYLON.TransformNode, weight: number): void {
            if (this._isEmpty) return;

            if (this._blendTree) {
                this._blendTree.applyToNode(node, weight);
            } else if (this._animationGroup) {
                this.sampleAndApplyAnimation(node, weight);
            }
        }

        private sampleAndApplyAnimation(node: BABYLON.TransformNode, weight: number): void {
            if (!this._animationGroup) return;

            this._animationGroup.targetedAnimations.forEach(targetAnim => {
                if (targetAnim.target === node) {
                    const animation = targetAnim.animation;
                    const time = this._currentTime % (animation.getKeys()[animation.getKeys().length - 1].frame);

                    // Sample animation at current time
                    let value: any;
                    switch (animation.targetProperty) {
                        case "position":
                            value = this.sampleVector3Animation(animation, time);
                            if (node.position) {
                                BABYLON.Vector3.LerpToRef(node.position, value, weight, node.position);
                            }
                            break;
                        case "rotationQuaternion":
                            value = this.sampleQuaternionAnimation(animation, time);
                            if (node.rotationQuaternion) {
                                BABYLON.Quaternion.SlerpToRef(node.rotationQuaternion, value, weight, node.rotationQuaternion);
                            }
                            break;
                        case "scaling":
                            value = this.sampleVector3Animation(animation, time);
                            if (node.scaling) {
                                BABYLON.Vector3.LerpToRef(node.scaling, value, weight, node.scaling);
                            }
                            break;
                    }
                }
            });
        }

        private sampleVector3Animation(animation: BABYLON.Animation, time: number): BABYLON.Vector3 {
            const result = new BABYLON.Vector3();
            
            // Find keyframes
            const keyFrames = animation.getKeys();
            let prevFrame = keyFrames[0];
            let nextFrame = keyFrames[0];

            for (let i = 0; i < keyFrames.length; i++) {
                if (keyFrames[i].frame <= time && (!keyFrames[i + 1] || keyFrames[i + 1].frame > time)) {
                    prevFrame = keyFrames[i];
                    nextFrame = keyFrames[i + 1] || keyFrames[0];
                    break;
                }
            }

            // Interpolate between keyframes
            const t = (time - prevFrame.frame) / (nextFrame.frame - prevFrame.frame);
            BABYLON.Vector3.LerpToRef(prevFrame.value, nextFrame.value, t, result);

            return result;
        }

        private sampleQuaternionAnimation(animation: BABYLON.Animation, time: number): BABYLON.Quaternion {
            const result = new BABYLON.Quaternion();
            
            // Find keyframes
            const keyFrames = animation.getKeys();
            let prevFrame = keyFrames[0];
            let nextFrame = keyFrames[0];

            for (let i = 0; i < keyFrames.length; i++) {
                if (keyFrames[i].frame <= time && (!keyFrames[i + 1] || keyFrames[i + 1].frame > time)) {
                    prevFrame = keyFrames[i];
                    nextFrame = keyFrames[i + 1] || keyFrames[0];
                    break;
                }
            }

            // Interpolate between keyframes
            const t = (time - prevFrame.frame) / (nextFrame.frame - prevFrame.frame);
            BABYLON.Quaternion.SlerpToRef(prevFrame.value, nextFrame.value, t, result);

            return result;
        }

        private extractRootMotion(): void {
            if (!this._animationGroup) return;

            // Find root bone animation
            const rootAnim = this._animationGroup.targetedAnimations.find(
                ta => ta.target.name.toLowerCase().includes("root")
            );

            if (rootAnim) {
                const time = this._currentTime % rootAnim.animation.getHighestFrame();

                // Extract position
                if (rootAnim.animation.targetProperty === "position") {
                    const currentPos = this.sampleVector3Animation(rootAnim.animation, time);
                    const prevPos = this.sampleVector3Animation(rootAnim.animation, time - 1);
                    this._rootMotionPosition.copyFrom(currentPos.subtract(prevPos));
                }

                // Extract rotation
                if (rootAnim.animation.targetProperty === "rotationQuaternion") {
                    const currentRot = this.sampleQuaternionAnimation(rootAnim.animation, time);
                    const prevRot = this.sampleQuaternionAnimation(rootAnim.animation, time - 1);
                    this._rootMotionRotation.copyFrom(currentRot.multiply(BABYLON.Quaternion.Inverse(prevRot)));
                }
            }
        }
    }

    // Blend Tree Class
    class BlendTree {
        private _type: BlendTreeType;
        private _children: BlendTreeChild[] = [];
        private _parameterX: string | null;
        private _parameterY: string | null;
        private _minThreshold: number;
        private _maxThreshold: number;
        private _parameters: Map<string, any>;

        constructor(
            data: IBlendTree,
            parameters: Map<string, any>,
            animationGroups: Map<string, BABYLON.AnimationGroup>
        ) {
            this._type = data.blendType;
            this._parameterX = data.blendParameterX;
            this._parameterY = data.blendParameterY;
            this._minThreshold = data.minThreshold;
            this._maxThreshold = data.maxThreshold;
            this._parameters = parameters;

            // Initialize children
            this._children = data.children.map(child => {
                const animGroup = animationGroups.get(child.motion);
                return new BlendTreeChild(child, animGroup || null);
            });
        }

        public update(deltaTime: number): void {
            // Update weights based on parameters
            this.calculateWeights();

            // Update children
            this._children.forEach(child => child.update(deltaTime));
        }

        public applyToNode(node: BABYLON.TransformNode, layerWeight: number): void {
            this._children.forEach(child => {
                child.applyToNode(node, child.weight * layerWeight);
            });
        }

        private calculateWeights(): void {
            const paramX = this._parameterX ? (this._parameters.get(this._parameterX) || 0) : 0;
            const paramY = this._parameterY ? (this._parameters.get(this._parameterY) || 0) : 0;

            switch (this._type) {
                case BlendTreeType.Simple1D:
                    this.calculate1DWeights(paramX);
                    break;
                case BlendTreeType.FreeformDirectional2D:
                    this.calculate2DDirectionalWeights(paramX, paramY);
                    break;
                case BlendTreeType.FreeformCartesian2D:
                    this.calculate2DCartesianWeights(paramX, paramY);
                    break;
                case BlendTreeType.Direct:
                    // For direct blend trees, weights are set directly through parameters
                    this._children.forEach(child => {
                        if (child.directBlendParameter) {
                            child.weight = this._parameters.get(child.directBlendParameter) || 0;
                        }
                    });
                    break;
                case BlendTreeType.Clip:
                    // Single motion clip, full weight
                    if (this._children.length > 0) {
                        this._children[0].weight = 1;
                    }
                    break;
            }
        }

        private calculate1DWeights(paramX: number): void {
            // Sort children by threshold
            const sorted = this._children.sort((a, b) => a.threshold - b.threshold);

            // Find the two motions to blend between
            let leftIndex = 0;
            let rightIndex = 0;
            for (let i = 0; i < sorted.length - 1; i++) {
                if (paramX >= sorted[i].threshold && paramX <= sorted[i + 1].threshold) {
                    leftIndex = i;
                    rightIndex = i + 1;
                    break;
                }
            }

            // Calculate blend weights
            const left = sorted[leftIndex];
            const right = sorted[rightIndex];
            const range = right.threshold - left.threshold;
            const blend = range > 0 ? (paramX - left.threshold) / range : 0;

            // Apply weights
            this._children.forEach(child => child.weight = 0);
            left.weight = 1 - blend;
            right.weight = blend;
        }

        private calculate2DDirectionalWeights(paramX: number, paramY: number): void {
            const position = new BABYLON.Vector2(paramX, paramY);
            const length = position.length();

            if (length < 0.0001) {
                // At origin, weight closest animation fully
                let minDist = Number.MAX_VALUE;
                let closestChild: BlendTreeChild | null = null;

                this._children.forEach(child => {
                    const childPos = new BABYLON.Vector2(child.positionX, child.positionY);
                    const dist = childPos.length();
                    if (dist < minDist) {
                        minDist = dist;
                        closestChild = child;
                    }
                    child.weight = 0;
                });

                if (closestChild) {
                    (closestChild as BlendTreeChild).weight = 1;
                }
            } else {
                // Calculate weights based on angle and magnitude
                const angle = Math.atan2(paramY, paramX);
                let totalWeight = 0;

                this._children.forEach(child => {
                    const childPos = new BABYLON.Vector2(child.positionX, child.positionY);
                    const childAngle = Math.atan2(child.positionY, child.positionX);
                    const angleDiff = Math.abs(Math.atan2(childPos.y - position.y, childPos.x - position.x));

                    // Weight based on angle difference
                    child.weight = 1 - (angleDiff / Math.PI);
                    child.weight = Math.max(0, child.weight);

                    totalWeight += child.weight;
                });

                // Normalize weights
                if (totalWeight > 0) {
                    this._children.forEach(child => {
                        child.weight /= totalWeight;
                    });
                }
            }
        }

        private calculate2DCartesianWeights(paramX: number, paramY: number): void {
            const position = new BABYLON.Vector2(paramX, paramY);
            let totalWeight = 0;

            // Calculate weights based on distance
            this._children.forEach(child => {
                const childPos = new BABYLON.Vector2(child.positionX, child.positionY);
                const distance = BABYLON.Vector2.Distance(position, childPos);
                
                // Weight is inverse of distance
                child.weight = 1 / (1 + distance);
                totalWeight += child.weight;
            });

            // Normalize weights
            if (totalWeight > 0) {
                this._children.forEach(child => {
                    child.weight /= totalWeight;
                });
            }
        }
    }

    // Blend Tree Child Class
    class BlendTreeChild {
        private _animationGroup: BABYLON.AnimationGroup | null;
        private _positionX: number;
        private _positionY: number;
        private _threshold: number;
        private _weight: number = 0;
        private _currentTime: number = 0;
        private _directBlendParameter: string | null = null;
        private _loop: boolean = true;
        private _timescale: number = 1;

        constructor(
            data: IBlendTreeChild,
            animationGroup: BABYLON.AnimationGroup | null
        ) {
            this._animationGroup = animationGroup;
            this._positionX = data.positionX;
            this._positionY = data.positionY;
            this._threshold = data.threshold;
            this._directBlendParameter = data.directBlendParameter;
            this._loop = data.loop !== undefined ? data.loop : true;
            this._timescale = data.timescale || 1;
        }


        public get positionX(): number { return this._positionX; }
        public get positionY(): number { return this._positionY; }
        public get threshold(): number { return this._threshold; }
        public get weight(): number { return this._weight; }
        public set weight(value: number) { this._weight = value; }
        public get directBlendParameter(): string | null { return this._directBlendParameter; }

        public update(deltaTime: number): void {
            if (!this._animationGroup) return;
            this._currentTime += deltaTime * this._timescale;
        }

        public applyToNode(node: BABYLON.TransformNode, weight: number): void {
            if (!this._animationGroup || weight <= 0) return;

            this._animationGroup.targetedAnimations.forEach(targetAnim => {
                if (targetAnim.target === node) {
                    const animation = targetAnim.animation;
                    const keyFrames = animation.getKeys();
                    const maxFrame = keyFrames[keyFrames.length - 1].frame;
                    let time: number;
                    
                    if (this._loop) {
                        const normalizedTime = (this._currentTime * this._timescale) % maxFrame;
                        const blendThreshold = maxFrame * 0.1; // Blend in last 10% of animation
                        
                        if (normalizedTime > maxFrame - blendThreshold) {
                            // We're near the end of the animation, blend with start
                            const endWeight = (maxFrame - normalizedTime) / blendThreshold;
                            const startWeight = 1 - endWeight;
                            
                            // Sample both end and start of animation
                            const endValue = this.sampleAnimationAtTime(animation, normalizedTime);
                            const startValue = this.sampleAnimationAtTime(animation, normalizedTime % blendThreshold);
                            
                            // Blend between end and start
                            if (animation.targetProperty === "rotationQuaternion") {
                                BABYLON.Quaternion.SlerpToRef(endValue as BABYLON.Quaternion, startValue as BABYLON.Quaternion, startWeight, endValue as BABYLON.Quaternion);
                                this.applyRotationAnimation(node, animation, 0, weight, endValue as BABYLON.Quaternion);
                            } else {
                                BABYLON.Vector3.LerpToRef(endValue as BABYLON.Vector3, startValue as BABYLON.Vector3, startWeight, endValue as BABYLON.Vector3);
                                if (animation.targetProperty === "position") {
                                    this.applyPositionAnimation(node, animation, 0, weight, endValue as BABYLON.Vector3);
                                } else {
                                    this.applyScalingAnimation(node, animation, 0, weight, endValue as BABYLON.Vector3);
                                }
                            }
                            return;
                        }
                        time = normalizedTime;
                    } else {
                        time = Math.min(this._currentTime * this._timescale, maxFrame);
                    }

                    // Sample and apply animation at calculated time
                    switch (animation.targetProperty) {
                        case "position":
                            this.applyPositionAnimation(node, animation, time, weight);
                            break;
                        case "rotationQuaternion":
                            this.applyRotationAnimation(node, animation, time, weight);
                            break;
                        case "scaling":
                            this.applyScalingAnimation(node, animation, time, weight);
                            break;
                    }

                    // Sample and apply animation
                    switch (animation.targetProperty) {
                        case "position":
                            this.applyPositionAnimation(node, animation, time, weight);
                            break;
                        case "rotationQuaternion":
                            this.applyRotationAnimation(node, animation, time, weight);
                            break;
                        case "scaling":
                            this.applyScalingAnimation(node, animation, time, weight);
                            break;
                    }
                }
            });
        }

        private applyPositionAnimation(
            node: BABYLON.TransformNode,
            animation: BABYLON.Animation,
            time: number,
            weight: number,
            precomputedValue?: BABYLON.Vector3
        ): void {
            const value = precomputedValue || this.sampleVector3Animation(animation, time);
            if (node.position) {
                BABYLON.Vector3.LerpToRef(node.position, value, weight, node.position);
            }
        }

        private applyRotationAnimation(
            node: BABYLON.TransformNode,
            animation: BABYLON.Animation,
            time: number,
            weight: number,
            precomputedValue?: BABYLON.Quaternion
        ): void {
            const value = precomputedValue || this.sampleQuaternionAnimation(animation, time);
            if (node.rotationQuaternion) {
                BABYLON.Quaternion.SlerpToRef(
                    node.rotationQuaternion,
                    value,
                    weight,
                    node.rotationQuaternion
                );
            }
        }

        private applyScalingAnimation(
            node: BABYLON.TransformNode,
            animation: BABYLON.Animation,
            time: number,
            weight: number,
            precomputedValue?: BABYLON.Vector3
        ): void {
            const value = precomputedValue || this.sampleVector3Animation(animation, time);
            if (node.scaling) {
                BABYLON.Vector3.LerpToRef(node.scaling, value, weight, node.scaling);
            }
        }

        private sampleAnimationAtTime(animation: BABYLON.Animation, time: number): BABYLON.Vector3 | BABYLON.Quaternion {
            const keyFrames = animation.getKeys();
            let prevFrame = keyFrames[0];
            let nextFrame = keyFrames[0];

            // Find surrounding keyframes
            for (let i = 0; i < keyFrames.length; i++) {
                if (keyFrames[i].frame <= time && (!keyFrames[i + 1] || keyFrames[i + 1].frame > time)) {
                    prevFrame = keyFrames[i];
                    nextFrame = keyFrames[i + 1] || keyFrames[0];
                    break;
                }
            }

            // Calculate interpolation factor
            const t = (time - prevFrame.frame) / (nextFrame.frame - prevFrame.frame);

            // Create result based on animation type
            if (animation.targetProperty === "rotationQuaternion") {
                const result = new BABYLON.Quaternion();
                BABYLON.Quaternion.SlerpToRef(prevFrame.value, nextFrame.value, t, result);
                return result;
            } else {
                const result = new BABYLON.Vector3();
                BABYLON.Vector3.LerpToRef(prevFrame.value, nextFrame.value, t, result);
                return result;
            }
        }

        private sampleVector3Animation(animation: BABYLON.Animation, time: number): BABYLON.Vector3 {
            return this.sampleAnimationAtTime(animation, time) as BABYLON.Vector3;
        }

        private sampleQuaternionAnimation(animation: BABYLON.Animation, time: number): BABYLON.Quaternion {
            return this.sampleAnimationAtTime(animation, time) as BABYLON.Quaternion;
        }
    }
}
