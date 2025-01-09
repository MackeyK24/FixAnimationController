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
        blendParameterX: string;
        blendParameterY: string;
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
        directBlendParameter: string;
        subtree: IBlendTree;
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
            // Only pass rootTransform if root motion is enabled AND we have a valid transform
            // This ensures root transform is truly optional and only used for root motion
            const shouldUseRootTransform = this._applyRootMotion && this._rootTransform != null;
            this._layers.forEach(layer => {
                layer.finalizeAnimations(shouldUseRootTransform ? this._rootTransform : undefined);
            });

            // Apply root motion if enabled and we have a valid root transform
            if (this._applyRootMotion) {
                if (!this._rootTransform) {
                    console.log(`[AnimationController] Root motion is enabled but no root transform provided, skipping root motion application`);
                    return;
                }

                const rootMotion = this._layers[0]?.getRootMotion();
                if (!rootMotion) {
                    console.log(`[AnimationController] No root motion data available from base layer`);
                    return;
                }

                // Apply root motion to transform if available
                if (this._rootTransform.position) {
                    this._rootTransform.position.addInPlace(rootMotion.position);
                }

                if (this._rootTransform.rotationQuaternion) {
                    this._rootTransform.rotationQuaternion.multiplyInPlace(rootMotion.rotation);
                    console.log(`[AnimationController] Applied root motion position and rotation`);
                } else {
                    console.log(`[AnimationController] Root transform has no rotation quaternion, applied position only`);
                }
            }
        }
    }

    // Animation Layer Class
    class AnimationLayer {
        private _name: string;
        private _stateMachine: StateMachine;
        private _avatarMask: IAvatarMask;
        private _defaultWeight: number;
        private _currentTime: number = 0;
        private _animationGroups: Map<string, BABYLON.AnimationGroup>;
        private _parameters: Map<string, any>;
        private _speedRatio: number;

        constructor(
            layerData: IAnimationLayer,
            animationGroups: Map<string, BABYLON.AnimationGroup>,
            parameters: Map<string, any>,
            speedRatio: number
        ) {
            this._name = layerData.name;
            this._avatarMask = layerData.avatarMask;
            this._defaultWeight = layerData.defaultWeight;
            this._animationGroups = animationGroups;
            this._parameters = parameters;
            this._speedRatio = speedRatio;
            
            // Initialize state machine
            this._stateMachine = new StateMachine(
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

        public finalizeAnimations(rootNode?: BABYLON.TransformNode): void {
            const state = this._stateMachine.getCurrentState();
            if (!state || state.isEmpty) {
                console.log(`[AnimationLayer] No valid state or empty state, skipping animation application`);
                return;
            }

            // Log if no root node is provided
            if (!rootNode) {
                console.log(`[AnimationLayer] No root node provided. Layer: ${this._name}, Weight: ${this._defaultWeight}. Some features may be limited.`);
            }

            // Apply animations based on avatar mask
            if (this._avatarMask && rootNode) {
                // Avatar masks require a root node to traverse the hierarchy
                this.applyMaskedAnimations(rootNode);
            } else if (!this._avatarMask) {
                // For non-masked animations, we can still apply them without a root node
                this.applyFullAnimations();
            }
        }

        private applyMaskedAnimations(rootNode?: BABYLON.TransformNode): void {
            // If no root node is provided, we can't traverse the hierarchy for masked animations
            if (!rootNode) {
                console.log(`[AnimationLayer] No root node provided for masked animations in layer "${this._name}". Skipping ${this._avatarMask.transformPaths.length} masked paths.`);
                // Instead of returning, try to apply animations to their original targets
                this.applyFullAnimations();
                return;
            }

            // Filter and apply animations only to masked bones/transforms
            const transformPaths = this._avatarMask.transformPaths;
            let appliedCount = 0;
            transformPaths.forEach(path => {
                const node = this.findNodeByPath(path, rootNode);
                if (node) {
                    this._stateMachine.applyAnimationToNode(node, this._defaultWeight);
                    appliedCount++;
                } else {
                    console.log(`[AnimationLayer] Could not find node at path "${path}" in layer "${this._name}"`);
                }
            });

            console.log(`[AnimationLayer] Applied masked animations to ${appliedCount}/${transformPaths.length} nodes in layer "${this._name}"`);
        }

        private applyFullAnimations(): void {
            // Apply animations directly through the state machine
            // This will handle both skeletal and non-skeletal animations
            if (this._stateMachine.getCurrentState()) {
                this._stateMachine.applyAnimationToNode(undefined, this._defaultWeight);
            }
        }

        private findNodeByPath(path: string, root?: BABYLON.TransformNode): BABYLON.TransformNode | null {
            if (!root) {
                console.log(`[AnimationLayer] Cannot find node by path: ${path}, root node is undefined`);
                return null;
            }

            const parts = path.split('/');
            let current: BABYLON.Node | null = root;

            for (const part of parts) {
                if (!current) return null;
                current = current.getChildren((node) => node.name === part, false)[0] || null;
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

        constructor(
            entryState: string,
            animationGroups: Map<string, BABYLON.AnimationGroup>,
            parameters: Map<string, any>,
            speedRatio: number
        ) {
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
                this._states.set(stateName, new AnimationState(
                    stateName,
                    this._animationGroups.get(stateName) || null,
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

        public applyAnimationToNode(node?: BABYLON.TransformNode, weight: number = 1.0): void {
            // Allow animations without root node
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

        private _rootMotionPosition: BABYLON.Vector3 = new BABYLON.Vector3();
        private _rootMotionRotation: BABYLON.Quaternion = new BABYLON.Quaternion();

        constructor(
            name: string,
            animationGroup: BABYLON.AnimationGroup | null,
            speedRatio: number
        ) {
            this._name = name;
            this._animationGroup = animationGroup;
            this._speedRatio = speedRatio;
            this._isEmpty = !animationGroup;
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

        public applyToNode(node?: BABYLON.TransformNode, weight: number = 1.0): void {
            if (this._isEmpty) return;

            if (this._blendTree) {
                this._blendTree.applyToNode(node, weight);
            } else if (this._animationGroup) {
                // Allow animations without root node
                this.sampleAndApplyAnimation(node, weight);
            }
        }

        private sampleAndApplyAnimation(node?: BABYLON.TransformNode, weight: number = 1.0): void {
            if (!this._animationGroup) return;

            this._animationGroup.targetedAnimations.forEach(targetAnim => {
                // If no node is provided, use the animation's target directly
                // If node is provided, only apply if it matches the target
                const targetNode = (node || targetAnim.target) as BABYLON.TransformNode;
                if (!node || targetAnim.target === node) {
                    const animation = targetAnim.animation;
                    const time = this._currentTime % (animation.getKeys()[animation.getKeys().length - 1].frame);

                    // Sample animation at current time
                    let value: any;
                    switch (animation.targetProperty) {
                        case "position":
                            value = this.sampleVector3Animation(animation, time);
                            if (targetNode && targetNode.position) {
                                BABYLON.Vector3.LerpToRef(targetNode.position, value, weight, targetNode.position);
                            }
                            break;
                        case "rotationQuaternion":
                            value = this.sampleQuaternionAnimation(animation, time);
                            if (targetNode && targetNode.rotationQuaternion) {
                                BABYLON.Quaternion.SlerpToRef(targetNode.rotationQuaternion, value, weight, targetNode.rotationQuaternion);
                            }
                            break;
                        case "scaling":
                            value = this.sampleVector3Animation(animation, time);
                            if (targetNode && targetNode.scaling) {
                                BABYLON.Vector3.LerpToRef(targetNode.scaling, value, weight, targetNode.scaling);
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
        private _parameterX: string;
        private _parameterY: string;
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
            this._children = data.children.map(child => new BlendTreeChild(
                child,
                animationGroups.get(child.motion) || null
            ));
        }

        public update(deltaTime: number): void {
            // Update weights based on parameters
            this.calculateWeights();

            // Update children
            this._children.forEach(child => child.update(deltaTime));
        }

        public applyToNode(node?: BABYLON.TransformNode, layerWeight: number = 1.0): void {
            this._children.forEach(child => {
                child.applyToNode(node, child.weight * layerWeight);
            });
        }

        private calculateWeights(): void {
            const paramX = this._parameters.get(this._parameterX) || 0;
            const paramY = this._parameters.get(this._parameterY) || 0;

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

        constructor(
            data: IBlendTreeChild,
            animationGroup: BABYLON.AnimationGroup | null
        ) {
            this._animationGroup = animationGroup;
            this._positionX = data.positionX;
            this._positionY = data.positionY;
            this._threshold = data.threshold;
        }


        public get positionX(): number { return this._positionX; }
        public get positionY(): number { return this._positionY; }
        public get threshold(): number { return this._threshold; }
        public get weight(): number { return this._weight; }
        public set weight(value: number) { this._weight = value; }

        public update(deltaTime: number): void {
            if (!this._animationGroup) return;
            this._currentTime += deltaTime;
        }

        public applyToNode(node?: BABYLON.TransformNode, weight: number = 1.0): void {
            if (!this._animationGroup || weight <= 0) return;

            this._animationGroup.targetedAnimations.forEach(targetAnim => {
                // If no node is provided, use the animation's target directly
                // If node is provided, only apply if it matches the target
                if (!node || targetAnim.target === node) {
                    const animation = targetAnim.animation;
                    const time = this._currentTime % (animation.getKeys()[animation.getKeys().length - 1].frame);

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
            node: BABYLON.TransformNode | undefined,
            animation: BABYLON.Animation,
            time: number,
            weight: number
        ): void {
            if (!node) return;
            const value = this.sampleVector3Animation(animation, time);
            if (node.position) {
                BABYLON.Vector3.LerpToRef(node.position, value, weight, node.position);
            }
        }

        private applyRotationAnimation(
            node: BABYLON.TransformNode | undefined,
            animation: BABYLON.Animation,
            time: number,
            weight: number
        ): void {
            if (!node) return;
            const value = this.sampleQuaternionAnimation(animation, time);
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
            node: BABYLON.TransformNode | undefined,
            animation: BABYLON.Animation,
            time: number,
            weight: number
        ): void {
            if (!node) return;
            const value = this.sampleVector3Animation(animation, time);
            if (node.scaling) {
                BABYLON.Vector3.LerpToRef(node.scaling, value, weight, node.scaling);
            }
        }

        private sampleVector3Animation(
            animation: BABYLON.Animation,
            time: number
        ): BABYLON.Vector3 {
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

        private sampleQuaternionAnimation(
            animation: BABYLON.Animation,
            time: number
        ): BABYLON.Quaternion {
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
    }
}
