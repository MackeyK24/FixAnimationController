/** Babylon Toolkit Namespace */
namespace TOOLKIT {
    /**
     * Babylon toolkit animation state pro class (Unity Style Mechanim Animation System)
     * @class AnimationState - All rights reserved (c) 2024 Mackey Kinard
     */
    export class AnimationState extends TOOLKIT.ScriptComponent {
        public static FPS: number = 30;
        public static EXIT: string = "[EXIT]";
        public static TIME: number = 1.0;           // Note: Must Be One Second Normalized Time
        public static SPEED: number = 1.0;          // Note: Animation State Blend Speed Factor

        private _looptime: boolean = false;
        private _loopblend: boolean = false;
        private _frametime: number = 0;
        private _layercount: number = 0;
        private _updatemode: number = 0;             // Note: 0 - Transform Node | 1 - Character Controller | 2 - Unscaled Time ???
        private _hasrootmotion: boolean = false;
        private _animationplaying: boolean = false;
        private _initialtargetblending: boolean = false;
        private _hastransformhierarchy: boolean = false;
        private _leftfeetbottomheight: number = 0;
        private _rightfeetbottomheight: number = 0;
        private _runtimecontroller: string = null;
        private _executed: boolean = false;
        private _awakened: boolean = false;
        private _initialized: boolean = false;
        private _checkers: TOOLKIT.TransitionCheck = new TOOLKIT.TransitionCheck();
        private _source: string = "";
        private _machine: any = null;

        private _animationmode: number = 0;
        private _animationrig: string = null;

        private _deltaPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _deltaRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _angularVelocity: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);

        private _rootMotionSpeed: number = 0;
        private _lastMotionSpeed: number = 0;
        private _loopMotionSpeed: number = 0;
        private _lastRotateSpeed: number = 0;
        private _loopRotateSpeed: number = 0;
        private _lastMotionRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _lastMotionPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);

        private _positionWeight: boolean = false;
        private _rootBoneWeight: boolean = false;
        private _rotationWeight: boolean = false;
        private _rootQuatWeight: boolean = false;
        private _rootBoneTransform: BABYLON.TransformNode = null;
        private _positionHolder: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _rootBoneHolder: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _rotationHolder: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _rootQuatHolder: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _rootMotionMatrix: BABYLON.Matrix = BABYLON.Matrix.Zero();
        private _rootMotionScaling: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _rootMotionRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _rootMotionPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _dirtyMotionMatrix: any = null;
        private _dirtyBlenderMatrix: any = null;
        //private _bodyOrientationAngleY:number = 0;

        private _targetPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _targetRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _targetScaling: BABYLON.Vector3 = new BABYLON.Vector3(1, 1, 1);
        private _updateMatrix: BABYLON.Matrix = BABYLON.Matrix.Zero();
        private _blenderMatrix: BABYLON.Matrix = BABYLON.Matrix.Zero();
        private _blendWeights: TOOLKIT.BlendingWeights = new TOOLKIT.BlendingWeights();
        private _emptyScaling: BABYLON.Vector3 = new BABYLON.Vector3(1, 1, 1);
        private _emptyPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        private _emptyRotation: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);
        private _ikFrameEanbled: boolean = false;

        private _data: Map<string, TOOLKIT.MachineState> = new Map<string, TOOLKIT.MachineState>();
        private _anims: Map<string, BABYLON.AnimationGroup> = new Map<string, BABYLON.AnimationGroup>();
        private _clips: any[] = null;
        private _numbers: Map<string, number> = new Map();
        private _booleans: Map<string, boolean> = new Map();
        private _triggers: Map<string, boolean> = new Map();
        private _parameters: Map<string, TOOLKIT.AnimatorParameterType> = new Map<string, TOOLKIT.AnimatorParameterType>();

        public speedRatio: number = 1.0;
        public delayUpdateUntilReady = true;
        public enableAnimation: boolean = true;
        public applyRootMotion: boolean = false;
        public awakened(): boolean { return this._awakened; }
        public initialized(): boolean { return this._initialized; }
        public hasRootMotion(): boolean { return this._hasrootmotion }
        public isFirstFrame(): boolean { return (this._frametime === 0); }
        public isLastFrame(): boolean { return (this._frametime >= .985); }
        public ikFrameEnabled(): boolean { return this._ikFrameEanbled; }
        public getAnimationTime(): number { return this._frametime; }
        public getFrameLoopTime(): boolean { return this._looptime; }
        public getFrameLoopBlend(): boolean { return this._loopblend; }
        public getAnimationPlaying(): boolean { return this._animationplaying; }
        public getRuntimeController(): string { return this._runtimecontroller; }
        public getRootBoneTransform(): BABYLON.TransformNode { return this._rootBoneTransform; }
        public getDeltaRootMotionAngle(): number { return this._angularVelocity.y; }
        public getDeltaRootMotionSpeed(): number { return this._rootMotionSpeed }
        public getDeltaRootMotionPosition(): BABYLON.Vector3 { return this._deltaPosition; }
        public getDeltaRootMotionRotation(): BABYLON.Quaternion { return this._deltaRotation; }
        public getFixedRootMotionPosition(): BABYLON.Vector3 { return (this._dirtyMotionMatrix != null) ? this._rootMotionPosition : null; }
        public getFixedRootMotionRotation(): BABYLON.Quaternion { return (this._dirtyMotionMatrix != null) ? this._rootMotionRotation : null; }
        /** Register handler that is triggered when the animation state machine has been awakened */
        public onAnimationAwakeObservable = new BABYLON.Observable<BABYLON.TransformNode>();
        /** Register handler that is triggered when the animation state machine has been initialized */
        public onAnimationInitObservable = new BABYLON.Observable<BABYLON.TransformNode>();
        /** Register handler that is triggered when the animation ik setup has been triggered */
        public onAnimationIKObservable = new BABYLON.Observable<number>();
        /** Register handler that is triggered when the animation end has been triggered */
        public onAnimationEndObservable = new BABYLON.Observable<number>();
        /** Register handler that is triggered when the animation loop has been triggered */
        public onAnimationLoopObservable = new BABYLON.Observable<number>();
        /** Register handler that is triggered when the animation event has been triggered */
        public onAnimationEventObservable = new BABYLON.Observable<TOOLKIT.IAnimatorEvent>();
        /** Register handler that is triggered when the animation frame has been updated */
        public onAnimationUpdateObservable = new BABYLON.Observable<BABYLON.TransformNode>();
        /** Register handler that is triggered when the animation state is going to transition */
        public onAnimationTransitionObservable = new BABYLON.Observable<BABYLON.TransformNode>();

        protected m_zeroVector: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
        protected m_defaultGroup: BABYLON.AnimationGroup = null;
        protected m_animationTargets: BABYLON.TargetedAnimation[] = null;
        protected m_rotationIdentity: BABYLON.Quaternion = new BABYLON.Quaternion(0, 0, 0, 0);

        protected awake(): void { this.awakeStateMachine(); }
        protected update(): void { this.updateStateMachine(); }
        protected destroy(): void { this.destroyStateMachine(); }

        /////////////////////////////////////////////////////////////////////////////////////
        // State Machine Functions
        /////////////////////////////////////////////////////////////////////////////////////

        public playDefaultAnimation(transitionDuration: number = 0, animationLayer: number = 0, frameRate: number = null): boolean {
            let result: boolean = false;
            if (this._initialized === true) {
                if (this._machine != null && this._machine.layers != null && this._machine.layers.length > animationLayer) {
                    const layer: TOOLKIT.IAnimationLayer = this._machine.layers[animationLayer];
                    const blendFrameRate: number = (layer.animationStateMachine != null) ? (layer.animationStateMachine.rate || TOOLKIT.AnimationState.FPS) : TOOLKIT.AnimationState.FPS;
                    const blendingSpeed: number = (transitionDuration > 0) ? TOOLKIT.Utilities.ComputeBlendingSpeed(frameRate || blendFrameRate, transitionDuration) : 0;
                    this.playCurrentAnimationState(layer, layer.entry, blendingSpeed);
                    result = true;
                } else {
                    BABYLON.Tools.Warn("No animation state layers on " + this.transform.name);
                }
            } else {
                BABYLON.Tools.Warn("Animation state machine not initialized for " + this.transform.name);
            }
            return result;
        }
        public playAnimation(state: string, transitionDuration: number = 0, animationLayer: number = 0, frameRate: number = null): boolean {
            let result: boolean = false;
            if (this._initialized === true) {
                if (this._machine != null && this._machine.layers != null && this._machine.layers.length > animationLayer) {
                    const layer: TOOLKIT.IAnimationLayer = this._machine.layers[animationLayer];
                    const blendFrameRate: number = (layer.animationStateMachine != null) ? (layer.animationStateMachine.rate || TOOLKIT.AnimationState.FPS) : TOOLKIT.AnimationState.FPS;
                    const blendingSpeed: number = (transitionDuration > 0) ? TOOLKIT.Utilities.ComputeBlendingSpeed(frameRate || blendFrameRate, transitionDuration) : 0;
                    this.playCurrentAnimationState(layer, state, blendingSpeed);

                    result = true;
                } else {
                    BABYLON.Tools.Warn("No animation state layers on " + this.transform.name);
                }
            } else {
                BABYLON.Tools.Warn("Animation state machine not initialized for " + this.transform.name);
            }
            return result;
        }
        public stopAnimation(animationLayer: number = 0): boolean {
            let result: boolean = false;
            if (this._initialized === true) {
                if (this._machine != null && this._machine.layers != null && this._machine.layers.length > animationLayer) {
                    const layer: TOOLKIT.IAnimationLayer = this._machine.layers[animationLayer];
                    this.stopCurrentAnimationState(layer);
                    result = true;
                } else {
                    BABYLON.Tools.Warn("No animation state layers on " + this.transform.name);
                }
            } else {
                BABYLON.Tools.Warn("Animation state machine not initialized for " + this.transform.name);
            }
            return result;
        }
        public killAnimations(): boolean {
            let result: boolean = false;
            if (this._initialized === true) {
                if (this._machine != null && this._machine.layers != null) {
                    this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                        this.stopCurrentAnimationState(layer);
                        result = true;
                    });
                } else {
                    BABYLON.Tools.Warn("No animation state layers on " + this.transform.name);
                }
            } else {
                BABYLON.Tools.Warn("Animation state machine not initialized for " + this.transform.name);
            }
            return result;
        }

        /////////////////////////////////////////////////////////////////////////////////////
        // State Machine Functions
        /////////////////////////////////////////////////////////////////////////////////////

        public hasBool(name: string): boolean {
            return (this._booleans.get(name) != null);
        }
        public getBool(name: string): boolean {
            return this._booleans.get(name) || false;
        }
        public setBool(name: string, value: boolean): void {
            this._booleans.set(name, value);
        }
        public hasFloat(name: string): boolean {
            return (this._numbers.get(name) != null);
        }
        public getFloat(name: string): number {
            return this._numbers.get(name) || 0;
        }
        public setFloat(name: string, value: number): void {
            this._numbers.set(name, value);
        }
        public hasInteger(name: string): boolean {
            return (this._numbers.get(name) != null)
        }
        public getInteger(name: string): number {
            return this._numbers.get(name) || 0;
        }
        public setInteger(name: string, value: number): void {
            this._numbers.set(name, value);
        }
        public hasTrigger(name: string): boolean {
            return (this._triggers.get(name) != null);
        }
        public getTrigger(name: string): boolean {
            return this._triggers.get(name) || false;
        }
        public setTrigger(name: string): void {
            this._triggers.set(name, true);
        }
        public resetTrigger(name: string): void {
            this._triggers.set(name, false);
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Smooth Blend Functions
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Set Smooth Float
         * @param name name of the float
         * @param targetValue the target value
         * @param lerpSpeed the lerp speed factor (0.0 - 1.0)
         */
        public setSmoothFloat(name: string, targetValue: number, lerpSpeed: number): void {
            const gradient:number = BABYLON.Scalar.Lerp(this.getFloat(name), targetValue, Math.min(lerpSpeed, 1.0));
            this.setFloat(name, gradient);
        }
        /**
         * Set Smooth Interger
         * @param name the name of the integer 
         * @param targetValue the target value
         * @param lerpSpeed the lerp speed factor (0.0 - 1.0)
         */
        public setSmoothInteger(name: string, targetValue: number, lerpSpeed: number): void {
            const gradient:number = BABYLON.Scalar.Lerp(this.getInteger(name), targetValue, Math.min(lerpSpeed, 1.0));
            this.setInteger(name, gradient);
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // DEPRECATED
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        
        // private _timers: Map<string, number> = new Map();
        // private _starts: Map<string, number> = new Map();
        // private _stops: Map<string, number> = new Map();
        // public setSmoothFloat(name: string, targetValue: number, dampTime: number, deltaTime: number): void {
        //     let elapsedTime = this._timers.get(name) || -1;
        //     let startValue: BABYLON.Nullable<number> = this._starts.get(name) || null;
        //     let stopValue: BABYLON.Nullable<number> = this._stops.get(name) || null;
        //     // ..
        //     // Reset Interpolation
        //     // ..
        //     if (stopValue != null && targetValue != null && stopValue != targetValue) {
        //         elapsedTime = -1;
        //     }
        //     if (elapsedTime < 0) {
        //         elapsedTime = 0;
        //         startValue = null;
        //         stopValue = null;
        //     }
        //     if (startValue == null) {
        //         startValue = this.getFloat(name);
        //     }
        //     if (stopValue == null) {
        //         stopValue = targetValue;
        //     }
        //     // ..
        //     // Interpolate Float Value
        //     // ..
        //     if (elapsedTime >= 0 && startValue != null && stopValue != null) {
        //         let gradientValue = 0;
        //         if (elapsedTime < dampTime) {
        //             gradientValue = BABYLON.Scalar.Lerp(startValue, stopValue, (elapsedTime / dampTime));
        //             elapsedTime += deltaTime;
        //         } else {
        //             gradientValue = stopValue;
        //             elapsedTime = -1;
        //             startValue = null;
        //             stopValue = null;
        //         }
        //         this._numbers.set(name, gradientValue);
        //     }
        //     this._timers.set(name, elapsedTime);
        //     this._starts.set(name, startValue);
        //     this._stops.set(name, stopValue);
        // }
        // public setSmoothInteger(name: string, targetValue: number, dampTime: number, deltaTime: number): void {
        //     this.setSmoothFloat(name, targetValue, dampTime, deltaTime);
        // }
        // public resetSmoothProperty(name: string): void {
        //     this._timers.delete(name);
        //     this._starts.delete(name);
        //     this._stops.delete(name);
        //     this._numbers.delete(name);
        // }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        private getMachineState(name: string): TOOLKIT.MachineState {
            return this._data.get(name);
        }
        private setMachineState(name: string, value: TOOLKIT.MachineState): void {
            this._data.set(name, value);
        }
        public getCurrentState(layer: number): TOOLKIT.MachineState {
            return (this._machine.layers != null && this._machine.layers.length > layer) ? this._machine.layers[layer].animationStateMachine : null;
        }
        public getDefaultClips(): any[] {
            return this._clips;
        }
        public getDefaultSource(): string {
            return this._source;
        }
        public fixAnimationGroup(group: BABYLON.AnimationGroup): string {
            let result: any = null;
            if (this._clips != null && this._clips.length > 0) {
                for (let index = 0; index < this._clips.length; index++) {
                    const xclip = this._clips[index];
                    if (xclip.clip != null) {
                        const skey = ("." + xclip.clip).toLowerCase();
                        if (group.name.toLowerCase().endsWith(skey)) {
                            if (group.metadata == null) group.metadata = {};
                            if (group.metadata.toolkit == null) group.metadata.toolkit = xclip;
                            group.metadata.toolkit.source = this._source;
                            result = xclip;
                            break;
                        }
                    }
                }
            }
            return result;
        }
        public getAnimationGroup(name: string): BABYLON.AnimationGroup {
            return this._anims.get(name);
        }
        public getAnimationGroups(): BABYLON.AnimationGroup[] {
            return this.sourceAnimationGroups;
        }
        public setAnimationGroups(groups: BABYLON.AnimationGroup[]): void {
            if (this.transform.metadata == null) this.transform.metadata = {};
            if (this.transform.metadata.toolkit == null) this.transform.metadata.toolkit = {};
            this.transform.metadata.toolkit.sourceAnimationGroups = groups;
            this.setupSourceAnimationGroups();
        }
        private updateAnimationGroups(groups: BABYLON.AnimationGroup[]): void {
            if (groups != null && groups.length > 0) {
                this._anims = new Map<string, BABYLON.AnimationGroup>();
                this.m_animationTargets = [];
                this.m_defaultGroup = null;
                this.sourceAnimationGroups = null;
                groups.forEach((group: BABYLON.AnimationGroup) => {
                    let issource: boolean = false;
                    const agroup: any = group;
                    if (agroup != null && agroup.metadata != null && agroup.metadata.toolkit != null && agroup.metadata.toolkit.source != null && agroup.metadata.toolkit.source !== "") {
                        if (agroup.metadata.toolkit.source === this._source) {
                            issource = true;
                        }
                    }
                    if (issource === true && agroup != null && agroup.metadata != null && agroup.metadata.toolkit != null && agroup.metadata.toolkit.clip != null && agroup.metadata.toolkit.clip !== "") {
                        try { group.stop(); } catch { }
                        if (this.sourceAnimationGroups == null) this.sourceAnimationGroups = [];
                        this.sourceAnimationGroups.push(group);
                        this._anims.set(agroup.metadata.toolkit.clip, group);
                        if (this.m_defaultGroup == null) this.m_defaultGroup = group;
                        if (group.targetedAnimations != null && group.targetedAnimations.length > 0) {
                            group.targetedAnimations.forEach((targetedAnimation) => {
                                // Note: For Loop Faster Than IndexOf
                                let indexOfTarget: number = -1;
                                for (let i = 0; i < this.m_animationTargets.length; i++) {
                                    if (this.m_animationTargets[i].target === targetedAnimation.target) {
                                        indexOfTarget = i;
                                        break
                                    }
                                }
                                if (indexOfTarget < 0) {
                                    this.m_animationTargets.push(targetedAnimation);
                                    if (targetedAnimation.target.metadata == null) targetedAnimation.target.metadata = {};

                                    if (targetedAnimation.target instanceof BABYLON.TransformNode) {
                                        TOOLKIT.Utilities.ValidateTransformQuaternion(targetedAnimation.target);
                                        const layerMixers: TOOLKIT.AnimationMixer[] = [];
                                        for (let index = 0; index < this._layercount; index++) {
                                            const layerMixer: TOOLKIT.AnimationMixer = new TOOLKIT.AnimationMixer();
                                            layerMixer.positionBuffer = null;
                                            layerMixer.rotationBuffer = null;
                                            layerMixer.scalingBuffer = null;
                                            layerMixer.originalMatrix = null;
                                            layerMixer.blendingFactor = 0;
                                            layerMixer.blendingSpeed = 0;
                                            layerMixer.rootPosition = null;
                                            layerMixer.rootRotation = null;
                                            layerMixers.push(layerMixer);
                                        }
                                        targetedAnimation.target.metadata.mixer = layerMixers;
                                    } else if (targetedAnimation.target instanceof BABYLON.MorphTarget) {
                                        const morphLayerMixers: TOOLKIT.AnimationMixer[] = [];
                                        for (let index = 0; index < this._layercount; index++) {
                                            const morphLayerMixer: TOOLKIT.AnimationMixer = new TOOLKIT.AnimationMixer();
                                            morphLayerMixer.influenceBuffer = null;
                                            morphLayerMixers.push(morphLayerMixer);
                                        }
                                        (<any>targetedAnimation.target).metadata.mixer = morphLayerMixers;
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }

        /* Animation Controller State Machine Functions */

        private awakeStateMachine(): void {
            TOOLKIT.Utilities.ValidateTransformQuaternion(this.transform);
            this.m_animationTargets = [];
            this.m_defaultGroup = null;
            this.m_rotationIdentity = BABYLON.Quaternion.Identity();
            // ..
            this._source = (this.transform.metadata != null && this.transform.metadata.toolkit != null && this.transform.metadata.toolkit.animator != null && this.transform.metadata.toolkit.animator !== "") ? this.transform.metadata.toolkit.animator : null;
            this._clips = this.getProperty("clips", this._clips);
            this._machine = this.getProperty("machine", this._machine);
            this._updatemode = this.getProperty("updatemode", this._updatemode);
            this._animationrig = this.getProperty("animationrig", this._animationrig);
            this._animationmode = this.getProperty("animationmode", this._animationmode);
            this._hasrootmotion = this.getProperty("hasrootmotion", this._hasrootmotion);
            this._runtimecontroller = this.getProperty("runtimecontroller", this._runtimecontroller);
            this._hastransformhierarchy = this.getProperty("hastransformhierarchy", this._hastransformhierarchy);
            this._leftfeetbottomheight = this.getProperty("leftfeetbottomheight", this._leftfeetbottomheight);
            this._rightfeetbottomheight = this.getProperty("rightfeetbottomheight", this._rightfeetbottomheight);
            this.applyRootMotion = this.getProperty("applyrootmotion", this.applyRootMotion);
            // ..
            if (this._machine != null) {
                if (this._machine.owner == null || this._machine.owner == undefined || this._machine.owner === "" || this._machine.owner === "*") {
                    this._machine.owner = (this.transform.parent != null) ? this.transform.parent.name : this.transform.name;
                } else {
                    //console.warn("### Animation State Machine Already Owned By: " + this._machine.owner + " --> For: " + this.transform.parent.name);
                }
                if (this._machine.speed != null) {
                    this.speedRatio = this._machine.speed;
                }
                if (this._machine.parameters != null && this._machine.parameters.length > 0) {
                    const plist: any[] = this._machine.parameters;
                    plist.forEach((parameter) => {
                        const name: string = parameter.name;
                        const type: TOOLKIT.AnimatorParameterType = parameter.type;
                        const curve: boolean = parameter.curve;
                        const defaultFloat: number = parameter.defaultFloat;
                        const defaultBool: boolean = parameter.defaultBool;
                        const defaultInt: number = parameter.defaultInt;
                        this._parameters.set(name, type);
                        if (type === TOOLKIT.AnimatorParameterType.Bool) {
                            this.setBool(name, defaultBool);
                        } else if (type === TOOLKIT.AnimatorParameterType.Float) {
                            this.setFloat(name, defaultFloat);
                        } else if (type === TOOLKIT.AnimatorParameterType.Int) {
                            this.setInteger(name, defaultInt);
                        } else if (type === TOOLKIT.AnimatorParameterType.Trigger) {
                            this.resetTrigger(name);
                        }
                    });
                }
                // ..
                // Process Machine State Layers
                // ..
                if (this._machine.layers != null && this._machine.layers.length > 0) {
                    this._layercount = this._machine.layers.length;
                    // Sort In Ascending Order
                    this._machine.layers.sort((left, right): number => {
                        if (left.index < right.index) return -1;
                        if (left.index > right.index) return 1;
                        return 0;
                    });
                    // Parse State Machine Layers
                    this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                        if (layer.owner == null || layer.owner == undefined || layer.owner === "" || layer.owner === "*") {
                            //layer.owner = (this.transform.parent != null) ? this.transform.parent.name : this.transform.name;
                        } else {
                            //console.warn("### Machine Layer Already Owned By: " + layer.owner + " --> For: " + this.transform.parent.name);
                        }
                        // Set Layer Avatar Mask Transform Path
                        layer.animationMaskMap = new Map<string, number>();
                        if (layer.avatarMask != null && layer.avatarMask.transformPaths != null && layer.avatarMask.transformPaths.length > 0) {
                            for (let i = 0; i < layer.avatarMask.transformPaths.length; i++) {
                                layer.animationMaskMap.set(layer.avatarMask.transformPaths[i], i);
                            }
                        }
                    });
                }
            }
            this._awakened = true;
            if (this.onAnimationAwakeObservable && this.onAnimationAwakeObservable.hasObservers()) {
                this.onAnimationAwakeObservable.notifyObservers(this.transform);
            }
            // .. 
            // console.warn("Animation State Mahine: " + this.transform.name);
            // console.log(this);
            // TOOLKIT.SceneManager.SetWindowState(this.transform.name, this);
        }

        private sourceAnimationGroups: BABYLON.AnimationGroup[] = null;
        private updateStateMachine(deltaTime: number = null): void {
            if (this.delayUpdateUntilReady === false || (this.delayUpdateUntilReady === true && this.isReady())) {
                if (this.sourceAnimationGroups == null) {
                    this.setupSourceAnimationGroups();
                }
                if (this.sourceAnimationGroups != null) {
                    if (this._executed === false) {
                        this._executed = true;
                        if (this._machine.layers != null && this._machine.layers.length > 0) {
                            this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                                this.playCurrentAnimationState(layer, layer.entry, 0);
                            });
                        }
                        this._initialized = true;
                        if (this.onAnimationInitObservable && this.onAnimationInitObservable.hasObservers()) {
                            this.onAnimationInitObservable.notifyObservers(this.transform);
                        }
                    }
                    if (this.enableAnimation === true) {
                        const frameDeltaTime: number = deltaTime || this.getDeltaSeconds();
                        this.updateAnimationState(frameDeltaTime);
                        this.updateAnimationTargets(frameDeltaTime);
                        if (this.onAnimationUpdateObservable && this.onAnimationUpdateObservable.hasObservers()) {
                            this.onAnimationUpdateObservable.notifyObservers(this.transform);
                        }
                    }
                }
            }
        }
        private setupSourceAnimationGroups(): void {
            const sourcegroups = (this.transform.metadata != null && this.transform.metadata.toolkit != null && this.transform.metadata.toolkit.sourceAnimationGroups != null) ? this.transform.metadata.toolkit.sourceAnimationGroups : null;
            if (sourcegroups != null) {
                this.updateAnimationGroups(sourcegroups);
                // ..
                // Map State Machine Tracks (Animation Groups)
                // ..
                if (this.sourceAnimationGroups != null) {
                    if (this._machine != null && this._machine.states != null && this._machine.states.length > 0) {
                        this._machine.states.forEach((state: TOOLKIT.MachineState) => {
                            if (state != null && state.name != null) {
                                // Set Custom Animation Curves
                                if (state.ccurves != null && state.ccurves.length > 0) {
                                    state.ccurves.forEach((curve: TOOLKIT.IUnityCurve) => {
                                        if (curve.animation != null) {
                                            const anim: BABYLON.Animation = BABYLON.Animation.Parse(curve.animation);
                                            if (anim != null) {
                                                if (state.tcurves == null) state.tcurves = [];
                                                state.tcurves.push(anim);
                                            }
                                        }
                                    });
                                }
                                // Setup Animation State Machines
                                this.setupTreeBranches(state.blendtree);
                                this.setMachineState(state.name, state);
                            }
                        });
                    }
                }
            }
            /* DEPRECATED
            let sourcegroups:BABYLON.AnimationGroup[] = (this.transform.metadata != null && this.transform.metadata.toolkit != null && this.transform.metadata.toolkit.sourceAnimationGroups != null) ? this.transform.metadata.toolkit.sourceAnimationGroups : null;
            if (this._source != null && this._source !== "" && sourcegroups != null) {
                sourcegroups.forEach((group:BABYLON.AnimationGroup) => {
                    const agroup:any = group;
                    if (agroup != null && agroup.metadata != null && agroup.metadata.toolkit != null && agroup.metadata.toolkit.source != null && agroup.metadata.toolkit.source !== "") {
                        if (agroup.metadata.toolkit.source === this._source) {
                            if (sourceanims == null) sourceanims = [];
                            sourceanims.push(group);
                        }
                    }
                });
                if (sourceanims != null && sourceanims.length > 0) {
                    this.setAnimationGroups(sourceanims);
                }
            }
            if (sourceanims == null || sourceanims.length < 1) {
                console.warn("Failed to locate source animation groups for: " + this.transform.parent.name);
            }*/
        }

        private destroyStateMachine(): void {
            this._data = null;
            this._clips = null;
            this._anims = null;
            this._numbers = null;
            this._booleans = null;
            this._triggers = null;
            this._parameters = null;
            this._checkers = null;
            this._machine = null;
            this.sourceAnimationGroups = null;
            this.onAnimationAwakeObservable.clear();
            this.onAnimationAwakeObservable = null;
            this.onAnimationInitObservable.clear();
            this.onAnimationInitObservable = null;
            this.onAnimationIKObservable.clear();
            this.onAnimationIKObservable = null;
            this.onAnimationEndObservable.clear();
            this.onAnimationEndObservable = null;
            this.onAnimationLoopObservable.clear();
            this.onAnimationLoopObservable = null;
            this.onAnimationEventObservable.clear();
            this.onAnimationEventObservable = null;
            this.onAnimationUpdateObservable.clear();
            this.onAnimationUpdateObservable = null;
            this.onAnimationTransitionObservable.clear();
            this.onAnimationTransitionObservable = null;
        }

        /* Animation Controller Private Update Functions */

        private updateAnimationState(deltaTime: number): void {
            if (this._machine.layers != null && this._machine.layers.length > 0) {
                this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                    this.checkStateMachine(layer, deltaTime);
                });
            }
        }

        private updateAnimationTargets(deltaTime: number): void {
            this._looptime = false;
            this._loopblend = false;
            this._ikFrameEanbled = false;   // Reset Current Inverse Kinematics
            this._animationplaying = false; // Reset Current Animation Is Playing
            // this._bodyOrientationAngleY = 0;
            // if (this.transform.rotationQuaternion != null) {
            //    this._bodyOrientationAngleY = this.transform.rotationQuaternion.toEulerAngles().y; // TODO - OPTIMIZE THIS
            // } else if (this.transform.rotation != null) {
            //    this._bodyOrientationAngleY = this.transform.rotation.y;
            // }
            if (this._machine.layers != null && this._machine.layers.length > 0) {
                this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    if (layer.index === 0) this._frametime = layer.animationTime;   // Note: Update Master Animation Frame Time
                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    if (layer.animationStateMachine != null && layer.animationStateMachine.blendtree != null) {
                        if (layer.animationStateMachine.iKOnFeet === true) {
                            this._ikFrameEanbled = true;
                        }
                        if (layer.iKPass === true) {
                            if (this.onAnimationIKObservable && this.onAnimationIKObservable.hasObservers()) {
                                this.onAnimationIKObservable.notifyObservers(layer.index);
                            }
                        }
                        const layerState: TOOLKIT.MachineState = layer.animationStateMachine;
                        if (layerState.type === TOOLKIT.MotionType.Clip && layerState.played !== -1) layerState.played += deltaTime;
                        if (layerState.blendtree.children != null && layerState.blendtree.children.length > 0) {
                            const primaryBlendTree: TOOLKIT.IBlendTreeChild = layerState.blendtree.children[0];
                            if (primaryBlendTree != null) {
                                if (layerState.blendtree.blendType == TOOLKIT.BlendTreeType.Clip) {
                                    const animationTrack: BABYLON.AnimationGroup = primaryBlendTree.track;
                                    if (animationTrack != null) {
                                        //const animLength:number = (animationTrack.to / TOOLKIT.SceneManager.AnimationTargetFps);
                                        const animLength: number = animationTrack.metadata.toolkit.length;
                                        const frameRatio: number = (TOOLKIT.AnimationState.TIME / animLength);
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        // Motion Clip Animation Delta Time
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        layer.animationTime += (deltaTime * frameRatio * Math.abs(layerState.speed) * Math.abs(this.speedRatio) * TOOLKIT.AnimationState.SPEED);
                                        if (layer.animationTime > TOOLKIT.AnimationState.TIME) layer.animationTime = TOOLKIT.AnimationState.TIME;
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        //// DEPRECATED: layer.animationNormal = (layer.animationTime / TOOLKIT.AnimationState.TIME);        // Note: Normalize Layer Frame Time
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        layer.animationNormal = (layer.animationTime > 0) ? BABYLON.Scalar.Clamp(layer.animationTime / TOOLKIT.AnimationState.TIME, 0, 1) : 0;
                                        const validateTime: number = (layer.animationNormal >= 0.99) ? 1 : layer.animationNormal;
                                        const formattedTime: number = parseFloat(validateTime.toFixed(3)); //Math.round(validateTime * 100) / 100;
                                        if (layerState.speed < 0) layer.animationNormal = (1 - layer.animationNormal);      // Note: Reverse Normalized Frame Time
                                        const animationFrameTime: number = (animLength * layer.animationNormal);      // Note: Denormalize Animation Frame Time
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        // let additivereferenceposeclip:number = 0;
                                        // let additivereferenceposetime:number = 0.0;
                                        // let hasadditivereferencepose:boolean = false;
                                        // let starttime:number = 0.0;
                                        // let stoptime:number = 0.0;
                                        // let mirror:boolean = false;
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        let level: number = 0.0;
                                        let xspeed: number = 0.0;
                                        let zspeed: number = 0.0;
                                        let looptime: boolean = false;
                                        let loopblend: boolean = false;
                                        //let cycleoffset:number = 0.0;
                                        //let heightfromfeet:boolean = false;
                                        let orientationoffsety: number = 0.0;
                                        //let keeporiginalorientation:boolean = true;
                                        //let keeporiginalpositiony:boolean = true;
                                        //let keeporiginalpositionxz:boolean = true;
                                        let loopblendorientation: boolean = true;
                                        let loopblendpositiony: boolean = true;
                                        let loopblendpositionxz: boolean = true;
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        const agroup: any = animationTrack;
                                        if (agroup.metadata != null && agroup.metadata.toolkit != null) {
                                            if (agroup.metadata.toolkit.averagespeed != null) {
                                                xspeed = (agroup.metadata.toolkit.averagespeed.x != null) ? agroup.metadata.toolkit.averagespeed.x : 0;
                                                zspeed = (agroup.metadata.toolkit.averagespeed.z != null) ? agroup.metadata.toolkit.averagespeed.z : 0;
                                            }
                                            if (agroup.metadata.toolkit.settings != null) {
                                                level = (agroup.metadata.toolkit.settings.level != null) ? agroup.metadata.toolkit.settings.level : 0;
                                                looptime = (agroup.metadata.toolkit.settings.looptime != null) ? agroup.metadata.toolkit.settings.looptime : false;
                                                loopblend = (agroup.metadata.toolkit.settings.loopblend != null) ? agroup.metadata.toolkit.settings.loopblend : false;
                                                // DEPRECIATED: cycleoffset = (agroup.metadata.toolkit.settings.cycleoffset != null) ? agroup.metadata.toolkit.settings.cycleoffset : 0;
                                                // DEPRECIATED: heightfromfeet = (agroup.metadata.toolkit.settings.heightfromfeet != null) ? agroup.metadata.toolkit.settings.heightfromfeet : false;
                                                orientationoffsety = (agroup.metadata.toolkit.settings.orientationoffsety != null) ? agroup.metadata.toolkit.settings.orientationoffsety : 0;
                                                // DEPRECIATED: keeporiginalorientation = (agroup.metadata.toolkit.settings.keeporiginalorientation != null) ? agroup.metadata.toolkit.settings.keeporiginalorientation : true;
                                                // DEPRECIATED: keeporiginalpositiony = (agroup.metadata.toolkit.settings.keeporiginalpositiony != null) ? agroup.metadata.toolkit.settings.keeporiginalpositiony : true;
                                                // DEPRECIATED: keeporiginalpositionxz = (agroup.metadata.toolkit.settings.keeporiginalpositionxz != null) ? agroup.metadata.toolkit.settings.keeporiginalpositionxz : true;
                                                loopblendorientation = (agroup.metadata.toolkit.settings.loopblendorientation != null) ? agroup.metadata.toolkit.settings.loopblendorientation : true;
                                                loopblendpositiony = (agroup.metadata.toolkit.settings.loopblendpositiony != null) ? agroup.metadata.toolkit.settings.loopblendpositiony : true;
                                                loopblendpositionxz = (agroup.metadata.toolkit.settings.loopblendpositionxz != null) ? agroup.metadata.toolkit.settings.loopblendpositionxz : true;
                                            }
                                        }
                                        if (layer.index === 0) {
                                            this._looptime = looptime;
                                            this._loopblend = loopblend;
                                        }
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        // Unity Inverts Root Motion Animation Offsets
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        orientationoffsety = BABYLON.Tools.ToRadians(orientationoffsety);
                                        // DEPRECIATED: orientationoffsety *= -1;
                                        xspeed = Math.abs(xspeed);
                                        zspeed = Math.abs(zspeed);
                                        level *= -1;
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        if (layer.animationTime >= TOOLKIT.AnimationState.TIME) {
                                            layer.animationFirstRun = false;
                                            layer.animationLoopFrame = true;
                                            if (looptime === true) {
                                                layer.animationLoopCount++;
                                                if (this.onAnimationLoopObservable && this.onAnimationLoopObservable.hasObservers()) {
                                                    this.onAnimationLoopObservable.notifyObservers(layer.index);
                                                }
                                            } else {
                                                if (layer.animationEndFrame === false) {
                                                    layer.animationEndFrame = true;
                                                    if (this.onAnimationEndObservable && this.onAnimationEndObservable.hasObservers()) {
                                                        this.onAnimationEndObservable.notifyObservers(layer.index);
                                                    }
                                                }
                                            }
                                        }
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        if (layer.animationFirstRun === true || looptime === true) {
                                            this._animationplaying = true;
                                            animationTrack.targetedAnimations.forEach((targetedAnim: BABYLON.TargetedAnimation) => {
                                                if (targetedAnim.target instanceof BABYLON.TransformNode) {
                                                    const clipTarget: BABYLON.TransformNode = targetedAnim.target;
                                                    if (layer.index === 0 || layer.avatarMask == null || this.filterTargetAvatarMask(layer, clipTarget)) {
                                                        const targetRootBone: boolean = (clipTarget.metadata != null && clipTarget.metadata.toolkit != null && clipTarget.metadata.toolkit.rootbone != null) ? clipTarget.metadata.toolkit.rootbone : false;
                                                        if (targetRootBone === true) {
                                                            if (this._rootBoneTransform == null) this._rootBoneTransform = clipTarget;
                                                        }
                                                        if (clipTarget.metadata != null && clipTarget.metadata.mixer != null) {
                                                            const clipTargetMixer: TOOLKIT.AnimationMixer = clipTarget.metadata.mixer[layer.index];
                                                            if (clipTargetMixer != null) {
                                                                if (targetedAnim.animation.targetProperty === "position") {
                                                                    this._targetPosition = TOOLKIT.Utilities.SampleAnimationVector3(targetedAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                                    // ..
                                                                    // Handle Root Motion (Position)
                                                                    // ..
                                                                    if (targetRootBone === true && this._rootBoneTransform != null) {
                                                                        this._positionWeight = true;
                                                                        this._positionHolder.set(0, 0, 0);
                                                                        this._rootBoneWeight = false;
                                                                        this._rootBoneHolder.set(0, 0, 0);
                                                                        // ..
                                                                        // Apply Root Motion
                                                                        // ..
                                                                        if (this.applyRootMotion === true) {
                                                                            if (loopblendpositiony === true && loopblendpositionxz === true) {
                                                                                this._positionWeight = true;        // Bake XYZ Into Pose
                                                                                this._positionHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                                                            } else if (loopblendpositiony === false && loopblendpositionxz === false) {
                                                                                this._rootBoneWeight = true;        // Use XYZ As Root Motion
                                                                                this._rootBoneHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                                                            } else if (loopblendpositiony === true && loopblendpositionxz === false) {
                                                                                this._positionWeight = true;        // Bake Y Into Pose 
                                                                                this._positionHolder.set(this.m_zeroVector.x, (this._targetPosition.y + level), this.m_zeroVector.z);
                                                                                this._rootBoneWeight = true;        // Use XZ As Root Motion
                                                                                this._rootBoneHolder.set(this._targetPosition.x, this.m_zeroVector.y, this._targetPosition.z); // MAYBE: Use this.transform.position.y - ???
                                                                            } else if (loopblendpositionxz === true && loopblendpositiony === false) {
                                                                                this._positionWeight = true;        // Bake XZ Into Pose
                                                                                this._positionHolder.set(this._targetPosition.x, this.m_zeroVector.y, this._targetPosition.z);
                                                                                this._rootBoneWeight = true;        // Use Y As Root Motion
                                                                                this._rootBoneHolder.set(this.m_zeroVector.x, (this._targetPosition.y + level), this.m_zeroVector.z); // MAYBE: Use this.transform.position.xz - ???
                                                                            }
                                                                        } else {
                                                                            this._positionWeight = true;            // Bake XYZ Original Motion
                                                                            this._positionHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                                                        }
                                                                        // Bake Position Holder
                                                                        if (this._positionWeight === true) {
                                                                            if (clipTargetMixer.positionBuffer == null) clipTargetMixer.positionBuffer = new BABYLON.Vector3(0, 0, 0);
                                                                            TOOLKIT.Utilities.BlendVector3Value(clipTargetMixer.positionBuffer, this._positionHolder, 1.0);
                                                                        }
                                                                        // Bake Root Bone Holder
                                                                        if (this._rootBoneWeight === true) {
                                                                            if (clipTargetMixer.rootPosition == null) clipTargetMixer.rootPosition = new BABYLON.Vector3(0, 0, 0);
                                                                            TOOLKIT.Utilities.BlendVector3Value(clipTargetMixer.rootPosition, this._rootBoneHolder, 1.0);
                                                                        }
                                                                    } else {
                                                                        // Bake Normal Pose Position
                                                                        if (clipTargetMixer.positionBuffer == null) clipTargetMixer.positionBuffer = new BABYLON.Vector3(0, 0, 0);
                                                                        TOOLKIT.Utilities.BlendVector3Value(clipTargetMixer.positionBuffer, this._targetPosition, 1.0);
                                                                    }
                                                                } else if (targetedAnim.animation.targetProperty === "rotationQuaternion") {
                                                                    this._targetRotation = TOOLKIT.Utilities.SampleAnimationQuaternion(targetedAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                                    // ..
                                                                    // Handle Root Motion (Rotation)
                                                                    // ..
                                                                    if (targetRootBone === true && this._rootBoneTransform != null) {
                                                                        this._rotationWeight = false;
                                                                        this._rotationHolder.copyFrom(this.m_rotationIdentity);
                                                                        this._rootQuatWeight = false;
                                                                        this._rootQuatHolder.copyFrom(this.m_rotationIdentity);
                                                                        // TODO - OPTIMIZE TO EULER ANGLES
                                                                        const eulerAngle: BABYLON.Vector3 = this._targetRotation.toEulerAngles();
                                                                        const orientationAngleY: number = eulerAngle.y; //(keeporiginalorientation === true) ? eulerAngle.y : this._bodyOrientationAngleY;
                                                                        // ..
                                                                        // Apply Root Motion
                                                                        // ..
                                                                        if (this.applyRootMotion === true) {
                                                                            if (loopblendorientation === true) {
                                                                                this._rotationWeight = true;        // Bake XYZ Into Pose
                                                                                BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, (orientationAngleY + orientationoffsety), eulerAngle.z, this._rotationHolder);
                                                                            } else {
                                                                                this._rotationWeight = true;        // Bake XZ Into Pose
                                                                                BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, this.m_zeroVector.y, eulerAngle.z, this._rotationHolder);
                                                                                this._rootQuatWeight = true;        // Use Y As Root Motion
                                                                                BABYLON.Quaternion.FromEulerAnglesToRef(this.m_zeroVector.x, (orientationAngleY + orientationoffsety), this.m_zeroVector.z, this._rootQuatHolder); // MAYBE: Use this.transform.rotation.xz - ???
                                                                            }
                                                                        } else {
                                                                            this._rotationWeight = true;            // Bake XYZ Into Pose
                                                                            BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, (orientationAngleY + orientationoffsety), eulerAngle.z, this._rotationHolder);
                                                                        }
                                                                        // Bake Rotation Holder
                                                                        if (this._rotationWeight === true) {
                                                                            if (clipTargetMixer.rotationBuffer == null) clipTargetMixer.rotationBuffer = new BABYLON.Quaternion(0, 0, 0, 0);
                                                                            TOOLKIT.Utilities.BlendQuaternionValue(clipTargetMixer.rotationBuffer, this._rotationHolder, 1.0);
                                                                        }
                                                                        // Bake Root Bone Rotation
                                                                        if (this._rootQuatWeight === true) {
                                                                            if (clipTargetMixer.rootRotation == null) clipTargetMixer.rootRotation = new BABYLON.Quaternion(0, 0, 0, 0);
                                                                            TOOLKIT.Utilities.BlendQuaternionValue(clipTargetMixer.rootRotation, this._rootQuatHolder, 1.0);
                                                                        }
                                                                    } else {
                                                                        // Bake Normal Pose Rotation
                                                                        if (clipTargetMixer.rotationBuffer == null) clipTargetMixer.rotationBuffer = new BABYLON.Quaternion(0, 0, 0, 0);
                                                                        TOOLKIT.Utilities.BlendQuaternionValue(clipTargetMixer.rotationBuffer, this._targetRotation, 1.0);
                                                                    }
                                                                } else if (targetedAnim.animation.targetProperty === "scaling") {
                                                                    this._targetScaling = TOOLKIT.Utilities.SampleAnimationVector3(targetedAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                                    if (clipTargetMixer.scalingBuffer == null) clipTargetMixer.scalingBuffer = new BABYLON.Vector3(1, 1, 1);
                                                                    TOOLKIT.Utilities.BlendVector3Value(clipTargetMixer.scalingBuffer, this._targetScaling, 1.0);
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else if (targetedAnim.target instanceof BABYLON.MorphTarget) {
                                                    const morphTarget: any = targetedAnim.target;
                                                    if (morphTarget.metadata != null && morphTarget.metadata.mixer != null) {
                                                        const morphTargetMixer: TOOLKIT.AnimationMixer = morphTarget.metadata.mixer[layer.index];
                                                        if (targetedAnim.animation.targetProperty === "influence") {
                                                            const floatValue = TOOLKIT.Utilities.SampleAnimationFloat(targetedAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                            if (morphTargetMixer.influenceBuffer == null) morphTargetMixer.influenceBuffer = 0;
                                                            morphTargetMixer.influenceBuffer = TOOLKIT.Utilities.BlendFloatValue(morphTargetMixer.influenceBuffer, floatValue, 1.0);
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                        if (this._animationplaying == true) {
                                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                            // Parse Layer Animation Curves
                                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                            if (layer.animationStateMachine.tcurves != null && layer.animationStateMachine.tcurves.length > 0) {
                                                layer.animationStateMachine.tcurves.forEach((animation: BABYLON.Animation) => {
                                                    if (animation.targetProperty != null && animation.targetProperty !== "") {
                                                        const sample: number = TOOLKIT.Utilities.SampleAnimationFloat(animation, layer.animationNormal, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                        this.setFloat(animation.targetProperty, sample);
                                                    }
                                                });
                                            }
                                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                            // Validate Layer Animation Events (TODO - Pass Layer Index Properties To Observers)
                                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                            if (layer.animationStateMachine.events != null && layer.animationStateMachine.events.length > 0) {
                                                //console.log("Formatted Time: " + formattedTime);
                                                layer.animationStateMachine.events.forEach((animatorEvent: TOOLKIT.IAnimatorEvent) => {
                                                    if (formattedTime >= (animatorEvent.time - 0.01) && formattedTime <= (animatorEvent.time + 0.01)) {
                                                        const animEventKey: string = animatorEvent.function + "_" + animatorEvent.time;
                                                        if (layer.animationLoopEvents == null) layer.animationLoopEvents = {};
                                                        if (!layer.animationLoopEvents[animEventKey]) {
                                                            layer.animationLoopEvents[animEventKey] = true;
                                                            //console.log("Motion Clip Animation Event: " + animatorEvent.time + " >> " + animatorEvent.clip + " >> " + animatorEvent.function);
                                                            if (this.onAnimationEventObservable && this.onAnimationEventObservable.hasObservers()) {
                                                                this.onAnimationEventObservable.notifyObservers(animatorEvent);
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        // Step Motion Clip Animation Time
                                        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        if (layer.animationLoopFrame === true) {
                                            layer.animationTime = 0;
                                            layer.animationNormal = 0;
                                            layer.animationLoopFrame = false;
                                            layer.animationLoopEvents = null;
                                        }
                                    } else {
                                        // console.warn(">>> No Motion Clip Animation Track Found For: " + this.transform.name);
                                    }
                                } else {
                                    this._animationplaying = true; // Note: Blend Tree Are Always Playing
                                    // this._blendMessage = "";
                                    this._blendWeights.primary = null;
                                    this._blendWeights.secondary = null;
                                    const scaledWeightList: TOOLKIT.IBlendTreeChild[] = [];
                                    const primaryBlendTree: TOOLKIT.IBlendTree = layerState.blendtree;
                                    this.parseTreeBranches(layer, primaryBlendTree, 1.0, scaledWeightList);
                                    const frameRatio: number = this.computeWeightedFrameRatio(scaledWeightList);
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    // Blend Tree Animation Delta Time
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    layer.animationTime += (deltaTime * frameRatio * Math.abs(layerState.speed) * Math.abs(this.speedRatio) * TOOLKIT.AnimationState.SPEED);
                                    if (layer.animationTime > TOOLKIT.AnimationState.TIME) layer.animationTime = TOOLKIT.AnimationState.TIME;
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    //// DEPRECATED: layer.animationNormal = (layer.animationTime / TOOLKIT.AnimationState.TIME);        // Note: Normalize Layer Frame Time
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    layer.animationNormal = (layer.animationTime > 0) ? BABYLON.Scalar.Clamp(layer.animationTime / TOOLKIT.AnimationState.TIME, 0, 1) : 0;
                                    const validateTime: number = (layer.animationNormal >= 0.99) ? 1 : layer.animationNormal;
                                    const formattedTime: number = parseFloat(validateTime.toFixed(3)); //Math.round(validateTime * 100) / 100;
                                    if (layerState.speed < 0) layer.animationNormal = (1 - layer.animationNormal);      // Note: Reverse Normalized Frame Time
                                    const blendingNormalTime: number = layer.animationNormal;                            // Note: Denormalize Animation Frame Time
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    if (layer.animationTime >= TOOLKIT.AnimationState.TIME) {
                                        layer.animationFirstRun = false;
                                        layer.animationLoopFrame = true; // Note: No Loop Or End Events For Blend Trees - ???
                                        layer.animationLoopCount++;
                                    }
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    const masterAnimationTrack: BABYLON.AnimationGroup = (scaledWeightList != null && scaledWeightList.length > 0 && scaledWeightList[0].track != null) ? scaledWeightList[0].track : null;
                                    if (masterAnimationTrack != null) {
                                        const targetCount: number = masterAnimationTrack.targetedAnimations.length;
                                        for (let targetIndex: number = 0; targetIndex < targetCount; targetIndex++) {
                                            const masterAnimimation: BABYLON.TargetedAnimation = masterAnimationTrack.targetedAnimations[targetIndex];
                                            if (masterAnimimation.target instanceof BABYLON.TransformNode) {
                                                const blendTarget: BABYLON.TransformNode = masterAnimimation.target;
                                                if (layer.index === 0 || layer.avatarMask == null || this.filterTargetAvatarMask(layer, blendTarget)) {
                                                    const targetRootBone: boolean = (blendTarget.metadata != null && blendTarget.metadata.toolkit != null && blendTarget.metadata.toolkit.rootbone != null) ? blendTarget.metadata.toolkit.rootbone : false;
                                                    if (targetRootBone === true) {
                                                        if (this._rootBoneTransform == null) this._rootBoneTransform = blendTarget;
                                                    }
                                                    if (blendTarget.metadata != null && blendTarget.metadata.mixer != null) {
                                                        this._initialtargetblending = true; // Note: Reset First Target Blending Buffer
                                                        const blendTargetMixer: TOOLKIT.AnimationMixer = blendTarget.metadata.mixer[layer.index];
                                                        this.updateBlendableTargets(deltaTime, layer, primaryBlendTree, masterAnimimation, targetIndex, blendTargetMixer, blendingNormalTime, targetRootBone, blendTarget);
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        // console.warn(">>> No Blend Tree Master Animation Track Found For: " + this.transform.name);
                                    }
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    // Parse Layer Animation Curves
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    if (layer.animationStateMachine.tcurves != null && layer.animationStateMachine.tcurves.length > 0) {
                                        layer.animationStateMachine.tcurves.forEach((animation: BABYLON.Animation) => {
                                            if (animation.targetProperty != null && animation.targetProperty !== "") {
                                                const sample: number = TOOLKIT.Utilities.SampleAnimationFloat(animation, layer.animationNormal, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                                this.setFloat(animation.targetProperty, sample);
                                            }
                                        });
                                    }
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    // Validate Layer Animation Events (TODO - Pass Layer Index And Clip Blended Weight Properties To Observers)
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    if (layer.animationStateMachine.events != null && layer.animationStateMachine.events.length > 0) {
                                        //console.log("Formatted Time: " + formattedTime);
                                        layer.animationStateMachine.events.forEach((animatorEvent: TOOLKIT.IAnimatorEvent) => {
                                            if (formattedTime >= (animatorEvent.time - 0.01) && formattedTime <= (animatorEvent.time + 0.01)) {
                                                const animEventKey: string = animatorEvent.function + "_" + animatorEvent.time;
                                                if (layer.animationLoopEvents == null) layer.animationLoopEvents = {};
                                                if (!layer.animationLoopEvents[animEventKey]) {
                                                    layer.animationLoopEvents[animEventKey] = true;
                                                    //console.log("Blend Tree Animation Event: " + animatorEvent.time + " >> " + animatorEvent.clip + " >> " + animatorEvent.function);
                                                    if (this.onAnimationEventObservable && this.onAnimationEventObservable.hasObservers()) {
                                                        this.onAnimationEventObservable.notifyObservers(animatorEvent);
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    // Step Blend Tree Animation Time
                                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                    if (layer.animationLoopFrame === true) {
                                        layer.animationTime = 0;
                                        layer.animationNormal = 0;
                                        layer.animationLoopFrame = false;
                                        layer.animationLoopEvents = null;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            this.finalizeAnimationTargets(deltaTime);
        }

        // private _blendMessage:string = "";
        private updateBlendableTargets(deltaTime: number, layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, masterAnimation: BABYLON.TargetedAnimation, targetIndex: number, targetMixer: TOOLKIT.AnimationMixer, normalizedFrameTime: number, targetRootBone: boolean, blendTarget: BABYLON.TransformNode): void {
            if (targetMixer != null && tree.children != null && tree.children.length > 0) {
                for (let index = 0; index < tree.children.length; index++) {
                    const child: TOOLKIT.IBlendTreeChild = tree.children[index];
                    if (child.weight > 0) {
                        if (child.type === TOOLKIT.MotionType.Clip) {
                            if (child.track != null) {
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                // let additivereferenceposeclip:number = 0;
                                // let additivereferenceposetime:number = 0.0;
                                // let hasadditivereferencepose:boolean = false;
                                // let starttime:number = 0.0;
                                // let stoptime:number = 0.0;
                                // let mirror:boolean = false;
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                // let looptime:boolean = true;
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                let level: number = 0.0;
                                let xspeed: number = 0.0;
                                let zspeed: number = 0.0;
                                let loopblend: boolean = false;
                                //let cycleoffset:number = 0.0;
                                //let heightfromfeet:boolean = false;
                                let orientationoffsety: number = 0.0;
                                //let keeporiginalorientation:boolean = true;
                                //let keeporiginalpositiony:boolean = true;
                                //let keeporiginalpositionxz:boolean = true;
                                let loopblendorientation: boolean = true;
                                let loopblendpositiony: boolean = true;
                                let loopblendpositionxz: boolean = true;
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                const agroup: any = child.track;
                                if (agroup.metadata != null && agroup.metadata.toolkit != null) {
                                    if (agroup.metadata.toolkit.averagespeed != null) {
                                        xspeed = (agroup.metadata.toolkit.averagespeed.x != null) ? agroup.metadata.toolkit.averagespeed.x : 0;
                                        zspeed = (agroup.metadata.toolkit.averagespeed.z != null) ? agroup.metadata.toolkit.averagespeed.z : 0;
                                    }
                                    if (agroup.metadata.toolkit.settings != null) {
                                        level = (agroup.metadata.toolkit.settings.level != null) ? agroup.metadata.toolkit.settings.level : 0;
                                        loopblend = (agroup.metadata.toolkit.settings.loopblend != null) ? agroup.metadata.toolkit.settings.loopblend : false;
                                        // DEPRECIATED: cycleoffset = (agroup.metadata.toolkit.settings.cycleoffset != null) ? agroup.metadata.toolkit.settings.cycleoffset : 0;
                                        // DEPRECIATED: heightfromfeet = (agroup.metadata.toolkit.settings.heightfromfeet != null) ? agroup.metadata.toolkit.settings.heightfromfeet : false;
                                        orientationoffsety = (agroup.metadata.toolkit.settings.orientationoffsety != null) ? agroup.metadata.toolkit.settings.orientationoffsety : 0;
                                        // DEPRECIATED: keeporiginalorientation = (agroup.metadata.toolkit.settings.keeporiginalorientation != null) ? agroup.metadata.toolkit.settings.keeporiginalorientation : true;
                                        // DEPRECIATED: keeporiginalpositiony = (agroup.metadata.toolkit.settings.keeporiginalpositiony != null) ? agroup.metadata.toolkit.settings.keeporiginalpositiony : true;
                                        // DEPRECIATED: keeporiginalpositionxz = (agroup.metadata.toolkit.settings.keeporiginalpositionxz != null) ? agroup.metadata.toolkit.settings.keeporiginalpositionxz : true;
                                        loopblendorientation = (agroup.metadata.toolkit.settings.loopblendorientation != null) ? agroup.metadata.toolkit.settings.loopblendorientation : true;
                                        loopblendpositiony = (agroup.metadata.toolkit.settings.loopblendpositiony != null) ? agroup.metadata.toolkit.settings.loopblendpositiony : true;
                                        loopblendpositionxz = (agroup.metadata.toolkit.settings.loopblendpositionxz != null) ? agroup.metadata.toolkit.settings.loopblendpositionxz : true;
                                    }
                                }
                                if (layer.index === 0) {
                                    this._looptime = true;
                                    this._loopblend = loopblend;
                                }
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                // Unity Inverts Root Motion Animation Offsets
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                orientationoffsety = BABYLON.Tools.ToRadians(orientationoffsety);
                                // DEPRECIATED: orientationoffsety *= -1;
                                xspeed = Math.abs(xspeed);
                                zspeed = Math.abs(zspeed);
                                level *= -1;
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                // this._blendMessage += (" >>> " + child.motion + ": " + child.weight.toFixed(2));
                                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                                // TODO - Get blendable animation from target map - ???
                                const blendableAnim: BABYLON.TargetedAnimation = child.track.targetedAnimations[targetIndex];
                                const blendableWeight: number = (this._initialtargetblending === true) ? 1.0 : parseFloat(child.weight.toFixed(2));
                                this._initialtargetblending = false; // Note: Clear First Target Blending Buffer
                                if (blendableAnim.target === masterAnimation.target && blendableAnim.animation.targetProperty === masterAnimation.animation.targetProperty) {
                                    let adjustedFrameTime: number = normalizedFrameTime;                     // Note: Adjust Normalized Frame Time
                                    if (child.timescale < 0) adjustedFrameTime = (1 - adjustedFrameTime);   // Note: Reverse Normalized Frame Time
                                    //const animLength:number = (child.track.to / TOOLKIT.SceneManager.AnimationTargetFps);
                                    const animLength: number = child.track.metadata.toolkit.length;
                                    const animationFrameTime: number = (animLength * adjustedFrameTime); // Note: Denormalize Animation Frame Time
                                    //const animationFrameTime:number = (Math.round((animLength * adjustedFrameTime) * 100) / 100);  // Note: Denormalize Animation Frame Time
                                    if (masterAnimation.animation.targetProperty === "position") {
                                        this._targetPosition = TOOLKIT.Utilities.SampleAnimationVector3(blendableAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                        // ..
                                        // Root Transform Position
                                        // ..
                                        if (targetRootBone === true && this._rootBoneTransform != null) {
                                            this._positionWeight = true;
                                            this._positionHolder.set(0, 0, 0);
                                            this._rootBoneWeight = false;
                                            this._rootBoneHolder.set(0, 0, 0);
                                            // ..
                                            // Apply Root Motion
                                            // ..
                                            if (this.applyRootMotion === true) {
                                                if (loopblendpositiony === true && loopblendpositionxz === true) {
                                                    this._positionWeight = true;        // Bake XYZ Into Pose
                                                    this._positionHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                                } else if (loopblendpositiony === false && loopblendpositionxz === false) {
                                                    this._rootBoneWeight = true;        // Use XYZ As Root Motion
                                                    this._rootBoneHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                                } else if (loopblendpositiony === true && loopblendpositionxz === false) {
                                                    this._positionWeight = true;        // Bake Y Into Pose 
                                                    this._positionHolder.set(this.m_zeroVector.x, (this._targetPosition.y + level), this.m_zeroVector.z);
                                                    this._rootBoneWeight = true;        // Use XZ As Root Motion
                                                    this._rootBoneHolder.set(this._targetPosition.x, this.m_zeroVector.y, this._targetPosition.z); // MAYBE: Use this.transform.position.y - ???
                                                } else if (loopblendpositionxz === true && loopblendpositiony === false) {
                                                    this._positionWeight = true;        // Bake XZ Into Pose
                                                    this._positionHolder.set(this._targetPosition.x, this.m_zeroVector.y, this._targetPosition.z);
                                                    this._rootBoneWeight = true;        // Use Y As Root Motion
                                                    this._rootBoneHolder.set(this.m_zeroVector.x, (this._targetPosition.y + level), this.m_zeroVector.z); // MAYBE: Use this.transform.position.xz - ???
                                                }
                                            } else {
                                                this._positionWeight = true;        // Bake XYZ Original Motion
                                                this._positionHolder.set(this._targetPosition.x, (this._targetPosition.y + level), this._targetPosition.z);
                                            }
                                            // Bake Position Holder
                                            if (this._positionWeight === true) {
                                                if (targetMixer.positionBuffer == null) targetMixer.positionBuffer = new BABYLON.Vector3(0, 0, 0);
                                                TOOLKIT.Utilities.BlendVector3Value(targetMixer.positionBuffer, this._positionHolder, blendableWeight);
                                            }
                                            // Bake Root Bone Holder
                                            if (this._rootBoneWeight === true) {
                                                if (targetMixer.rootPosition == null) targetMixer.rootPosition = new BABYLON.Vector3(0, 0, 0);
                                                // DEPRECATED: if (blendTarget.parent != null) TOOLKIT.Utilities.TransformDirectionToRef((blendTarget.parent as BABYLON.TransformNode), this._rootBoneHolder, this._rootBoneHolder);
                                                TOOLKIT.Utilities.BlendVector3Value(targetMixer.rootPosition, this._rootBoneHolder, blendableWeight);
                                            }
                                        } else {
                                            // Bake Normal Pose Position
                                            if (targetMixer.positionBuffer == null) targetMixer.positionBuffer = new BABYLON.Vector3(0, 0, 0);
                                            TOOLKIT.Utilities.BlendVector3Value(targetMixer.positionBuffer, this._targetPosition, blendableWeight);
                                        }
                                    } else if (masterAnimation.animation.targetProperty === "rotationQuaternion") {
                                        this._targetRotation = TOOLKIT.Utilities.SampleAnimationQuaternion(blendableAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                        // ..
                                        // Root Transform Rotation
                                        // ..
                                        if (targetRootBone === true && this._rootBoneTransform != null) {
                                            this._rotationWeight = false;
                                            this._rotationHolder.copyFrom(this.m_rotationIdentity);
                                            this._rootQuatWeight = false;
                                            this._rootQuatHolder.copyFrom(this.m_rotationIdentity);
                                            // TODO - OPTIMIZE TO EULER ANGLES
                                            const eulerAngle: BABYLON.Vector3 = this._targetRotation.toEulerAngles();
                                            const orientationAngleY: number = eulerAngle.y; //(keeporiginalorientation === true) ? eulerAngle.y : this._bodyOrientationAngleY;
                                            // ..
                                            // Apply Root Motion
                                            // ..
                                            if (this.applyRootMotion === true) {
                                                if (loopblendorientation === true) {
                                                    this._rotationWeight = true;        // Bake XYZ Into Pose
                                                    BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, (orientationAngleY + orientationoffsety), eulerAngle.z, this._rotationHolder);
                                                } else {
                                                    this._rotationWeight = true;        // Bake XZ Into Pose
                                                    BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, this.m_zeroVector.y, eulerAngle.z, this._rotationHolder);
                                                    this._rootQuatWeight = true;        // Use Y As Root Motion
                                                    BABYLON.Quaternion.FromEulerAnglesToRef(this.m_zeroVector.x, (orientationAngleY + orientationoffsety), this.m_zeroVector.z, this._rootQuatHolder); // MAYBE: Use this.transform.rotation.xz - ???
                                                }
                                            } else {
                                                this._rotationWeight = true;            // Bake XYZ Into Pose
                                                BABYLON.Quaternion.FromEulerAnglesToRef(eulerAngle.x, (orientationAngleY + orientationoffsety), eulerAngle.z, this._rotationHolder);
                                            }
                                            // Bake Rotation Holder
                                            if (this._rotationWeight === true) {
                                                if (targetMixer.rotationBuffer == null) targetMixer.rotationBuffer = new BABYLON.Quaternion(0, 0, 0, 0);
                                                TOOLKIT.Utilities.BlendQuaternionValue(targetMixer.rotationBuffer, this._rotationHolder, blendableWeight);
                                            }
                                            // Bake Root Bone Rotation
                                            if (this._rootQuatWeight === true) {
                                                if (targetMixer.rootRotation == null) targetMixer.rootRotation = new BABYLON.Quaternion(0, 0, 0, 0);
                                                TOOLKIT.Utilities.BlendQuaternionValue(targetMixer.rootRotation, this._rootQuatHolder, blendableWeight);
                                            }
                                        } else {
                                            // Bake Normal Pose Rotation
                                            if (targetMixer.rotationBuffer == null) targetMixer.rotationBuffer = new BABYLON.Quaternion(0, 0, 0, 0);
                                            TOOLKIT.Utilities.BlendQuaternionValue(targetMixer.rotationBuffer, this._targetRotation, blendableWeight);
                                        }
                                    } else if (masterAnimation.animation.targetProperty === "scaling") {
                                        this._targetScaling = TOOLKIT.Utilities.SampleAnimationVector3(blendableAnim.animation, animationFrameTime, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, true);
                                        if (targetMixer.scalingBuffer == null) targetMixer.scalingBuffer = new BABYLON.Vector3(1, 1, 1);
                                        TOOLKIT.Utilities.BlendVector3Value(targetMixer.scalingBuffer, this._targetScaling, blendableWeight);
                                    }
                                } else {
                                    // DEPRECATED: BABYLON.Tools.Warn(tree.name + " - " + child.track.name + " blend tree mismatch (" + targetIndex + "): " + masterAnimation.target.name + " >>> " + blendableAnim.target.name);
                                }
                            }
                        } else if (child.type === TOOLKIT.MotionType.Tree) {
                            this.updateBlendableTargets(deltaTime, layer, child.subtree, masterAnimation, targetIndex, targetMixer, normalizedFrameTime, targetRootBone, blendTarget);
                        }
                    }
                }
            }
            //if (targetIndex === 0) TOOLKIT.Utilities.PrintToScreen(this._blendMessage, "red");
        }

        private finalizeAnimationTargets(deltaTime: number): void {
            this._deltaPosition.set(0, 0, 0);
            this._deltaRotation.set(0, 0, 0, 0);
            this._angularVelocity.set(0, 0, 0);
            this._rootMotionSpeed = 0;
            this._rootMotionMatrix.reset();
            this._dirtyMotionMatrix = null;
            this._rootMotionPosition.set(0, 0, 0);
            this._rootMotionRotation.set(0, 0, 0, 0);
            ////this._lastMotionPosition.set(0,0,0);
            ////this._lastMotionRotation.set(0,0,0,0);
            if (this.m_animationTargets != null && this.m_animationTargets.length > 0) {
                this.m_animationTargets.forEach((targetedAnim: BABYLON.TargetedAnimation) => {
                    const animationTarget: any = targetedAnim.target;
                    // ..
                    // Update Direct Transform Targets For Each Layer
                    // ..
                    if (animationTarget.metadata != null && animationTarget.metadata.mixer != null) {
                        if (this._machine.layers != null && this._machine.layers.length > 0) {
                            this._blenderMatrix.reset();
                            this._dirtyBlenderMatrix = null;
                            this._machine.layers.forEach((layer: TOOLKIT.IAnimationLayer) => {
                                const animationTargetMixer: TOOLKIT.AnimationMixer = animationTarget.metadata.mixer[layer.index];
                                if (animationTargetMixer != null) {
                                    if (animationTarget instanceof BABYLON.TransformNode) {
                                        // ..
                                        // Update Dirty Transform Matrix
                                        // ..
                                        if (animationTargetMixer.positionBuffer != null || animationTargetMixer.rotationBuffer != null || animationTargetMixer.scalingBuffer != null) {
                                            BABYLON.Matrix.ComposeToRef(
                                                (animationTargetMixer.scalingBuffer || animationTarget.scaling),
                                                (animationTargetMixer.rotationBuffer || animationTarget.rotationQuaternion),
                                                (animationTargetMixer.positionBuffer || animationTarget.position),
                                                this._updateMatrix
                                            );
                                            if (animationTargetMixer.blendingSpeed > 0.0) {
                                                if (animationTargetMixer.blendingFactor <= 1.0 && animationTargetMixer.originalMatrix == null) {
                                                    animationTargetMixer.originalMatrix = BABYLON.Matrix.Compose(
                                                        (animationTarget.scaling),
                                                        (animationTarget.rotationQuaternion),
                                                        (animationTarget.position)
                                                    );
                                                }
                                                if (animationTargetMixer.blendingFactor <= 1.0 && animationTargetMixer.originalMatrix != null) {
                                                    TOOLKIT.Utilities.FastMatrixSlerp(animationTargetMixer.originalMatrix, this._updateMatrix, animationTargetMixer.blendingFactor, this._updateMatrix);
                                                    animationTargetMixer.blendingFactor += animationTargetMixer.blendingSpeed;
                                                }
                                            }
                                            TOOLKIT.Utilities.FastMatrixSlerp(this._blenderMatrix, this._updateMatrix, layer.defaultWeight, this._blenderMatrix);
                                            this._dirtyBlenderMatrix = true;
                                            animationTargetMixer.positionBuffer = null;
                                            animationTargetMixer.rotationBuffer = null;
                                            animationTargetMixer.scalingBuffer = null;
                                        }
                                        // ..
                                        // Update Dirty Root Motion Matrix
                                        // ..
                                        if (animationTargetMixer.rootPosition != null || animationTargetMixer.rootRotation != null) {
                                            BABYLON.Matrix.ComposeToRef(
                                                (this._emptyScaling),
                                                (animationTargetMixer.rootRotation || this._emptyRotation),
                                                (animationTargetMixer.rootPosition || this._emptyPosition),
                                                this._updateMatrix
                                            );
                                            // ..
                                            // TODO - May Need Seperate Blending Speed Properties
                                            // Note: Might Fix Large Root Motion Delta Issue - ???
                                            // ..
                                            /*
                                            if (animationTargetMixer.blendingSpeed > 0.0) {
                                                if (animationTargetMixer.blendingFactor <= 1.0 && animationTargetMixer.originalMatrix == null) {
                                                    animationTargetMixer.originalMatrix = BABYLON.Matrix.Compose(
                                                        (this.transform.scaling),
                                                        (this.transform.rotationQuaternion),
                                                        (this.transform.position)
                                                    );
                                                }
                                                if (animationTargetMixer.blendingFactor <= 1.0 && animationTargetMixer.originalMatrix != null) {
                                                    TOOLKIT.Utilities.FastMatrixSlerp(animationTargetMixer.originalMatrix, this._updateMatrix, animationTargetMixer.blendingFactor, this._updateMatrix);
                                                    animationTargetMixer.blendingFactor += animationTargetMixer.blendingSpeed;
                                                }
                                            }
                                            */
                                            TOOLKIT.Utilities.FastMatrixSlerp(this._rootMotionMatrix, this._updateMatrix, layer.defaultWeight, this._rootMotionMatrix);
                                            this._dirtyMotionMatrix = true;
                                            animationTargetMixer.rootPosition = null;
                                            animationTargetMixer.rootRotation = null;
                                        }
                                    } else if (animationTarget instanceof BABYLON.MorphTarget) {
                                        if (animationTargetMixer.influenceBuffer != null) {
                                            animationTarget.influence = BABYLON.Scalar.Lerp(animationTarget.influence, animationTargetMixer.influenceBuffer, layer.defaultWeight);
                                            animationTargetMixer.influenceBuffer = null;
                                        }
                                    }
                                }
                            });
                            if (this._dirtyBlenderMatrix != null) {
                                this._blenderMatrix.decompose(animationTarget.scaling, animationTarget.rotationQuaternion, animationTarget.position);
                            }
                        }
                    }
                });
            }
            // ..
            if (this.applyRootMotion === true) {
                if (this._dirtyMotionMatrix != null) {
                    this._rootMotionMatrix.decompose(this._rootMotionScaling, this._rootMotionRotation, this._rootMotionPosition);
                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Calculate Built-In Root Motion Deltas
                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    if (this.isFirstFrame() === true) {
                        //console.warn("### Reset Root Motion Frame: " + this._frametime);
                        this._deltaPosition.copyFrom(this._rootMotionPosition);
                        this._deltaRotation.copyFrom(this._rootMotionRotation);
                        //this._deltaRotation.copyFrom(this.m_rotationIdentity); // NOTE: ZERO ROTATION
                    } else if (this.isLastFrame() === true) {
                        this._rootMotionPosition.subtractToRef(this._lastMotionPosition, this._deltaPosition);
                        TOOLKIT.Utilities.QuaternionDiffToRef(this._rootMotionRotation, this._lastMotionRotation, this._deltaRotation);
                        //this._deltaRotation = this._rootMotionRotation.subtract(this._lastMotionRotation);
                        if (this._looptime === true && this._loopblend === true) {
                            //console.warn("### Loop Blend Last Root Motion Frame: " + this._frametime);
                            let loopBlendSpeed = (this._loopMotionSpeed + this._lastMotionSpeed);
                            if (loopBlendSpeed !== 0) loopBlendSpeed = (loopBlendSpeed / 2);
                            // Fix Movement Velocity
                            this._deltaPosition.normalize();
                            this._deltaPosition.scaleInPlace(loopBlendSpeed * deltaTime);
                            // Fix Angular Velocity
                            let loopBlendRotate = (this._loopRotateSpeed + this._lastRotateSpeed);
                            if (loopBlendRotate !== 0) loopBlendRotate = (loopBlendRotate / 2);
                            // FIXME: ??? - loopBlendRotate *= deltaTime;
                            this._deltaRotation.toEulerAnglesToRef(this._angularVelocity);
                            BABYLON.Quaternion.FromEulerAnglesToRef(this._angularVelocity.x, loopBlendRotate, this._angularVelocity.z, this._deltaRotation);
                        }
                    } else {
                        this._rootMotionPosition.subtractToRef(this._lastMotionPosition, this._deltaPosition);
                        TOOLKIT.Utilities.QuaternionDiffToRef(this._rootMotionRotation, this._lastMotionRotation, this._deltaRotation);
                        //this._deltaRotation = this._rootMotionRotation.subtract(this._lastMotionRotation);
                    }
                    const deltaSpeed: number = this._deltaPosition.length();
                    this._rootMotionSpeed = (deltaSpeed > 0) ? (deltaSpeed / deltaTime) : deltaSpeed;
                    this._deltaRotation.toEulerAnglesToRef(this._angularVelocity);
                    this._lastMotionPosition.copyFrom(this._rootMotionPosition);
                    this._lastMotionRotation.copyFrom(this._rootMotionRotation);
                    this._lastMotionSpeed = this._rootMotionSpeed;
                    this._lastRotateSpeed = this._angularVelocity.y;
                    if (this._frametime === 0) {
                        this._loopMotionSpeed = this._rootMotionSpeed;
                        this._loopRotateSpeed = this._angularVelocity.y;
                    }
                    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                }
            }
        }

        private checkStateMachine(layer: TOOLKIT.IAnimationLayer, deltaTime: number): void {
            this._checkers.result = null;
            this._checkers.offest = 0;
            this._checkers.blending = 0;
            this._checkers.triggered = [];
            // ..
            // Check Animation State Transitions
            // ..
            if (layer.animationStateMachine != null) {
                layer.animationStateMachine.time += deltaTime; // Update State Timer
                // Check Local Transition Conditions
                this.checkStateTransitions(layer, layer.animationStateMachine.transitions);
                // Check Any State Transition Conditions
                if (this._checkers.result == null && this._machine.transitions != null) {
                    this.checkStateTransitions(layer, this._machine.transitions);
                }
            }
            // ..
            // Reset Transition Condition Triggers
            // ..
            if (this._checkers.triggered != null && this._checkers.triggered.length > 0) {
                this._checkers.triggered.forEach((trigger) => { this.resetTrigger(trigger); });
                this._checkers.triggered = null;
            }
            // ..
            // Set Current Machine State Result
            // ..
            if (this._checkers.result != null) {
                if (this.onAnimationTransitionObservable && this.onAnimationTransitionObservable.hasObservers()) {
                    this.onAnimationTransitionObservable.notifyObservers(this.transform);
                }
                this.playCurrentAnimationState(layer, this._checkers.result, this._checkers.blending, this._checkers.offest);
            }
        }
        private checkStateTransitions(layer: TOOLKIT.IAnimationLayer, transitions: TOOLKIT.ITransition[]): any {
            let currentAnimationRate: number = layer.animationStateMachine.rate;
            let currentAnimationLength: number = layer.animationStateMachine.length;
            if (transitions != null && transitions.length > 0) {
                let i: number = 0; let ii: number = 0; let solo: number = -1;
                // ..
                // Check Has Solo Transitions
                // ..
                for (i = 0; i < transitions.length; i++) {
                    if (transitions[i].solo === true && transitions[i].mute === false) {
                        solo = i;
                        break;
                    }
                }
                // ..
                // Check State Machine Transitions
                // ..
                for (i = 0; i < transitions.length; i++) {
                    const transition: TOOLKIT.ITransition = transitions[i];
                    if (transition.layerIndex !== layer.index) continue;
                    if (transition.mute === true) continue;
                    if (solo >= 0 && solo !== i) continue;
                    let transitionOk: boolean = false;
                    // ..
                    // Check Has Transition Exit Time
                    // ..
                    let exitTimeSecs: number = 0;
                    let exitTimeExpired: boolean = true;
                    if (transition.exitTime > 0) {
                        exitTimeSecs = (currentAnimationLength * transition.exitTime) / this.speedRatio; // Note: Is Normalized Transition Exit Time
                        exitTimeExpired = (transition.hasExitTime === true) ? (layer.animationStateMachine.time >= exitTimeSecs) : true;
                    }
                    if (transition.hasExitTime === true && transition.intSource == TOOLKIT.InterruptionSource.None && exitTimeExpired === false) continue;
                    // ..
                    // Check All Transition Conditions
                    // ..
                    if (transition.conditions != null && transition.conditions.length > 0) {
                        let passed: number = 0; let checks: number = transition.conditions.length;
                        transition.conditions.forEach((condition) => {
                            const ptype: TOOLKIT.AnimatorParameterType = this._parameters.get(condition.parameter);
                            if (ptype != null) {
                                if (ptype == TOOLKIT.AnimatorParameterType.Float || ptype == TOOLKIT.AnimatorParameterType.Int) {
                                    const numValue: number = parseFloat(this.getFloat(condition.parameter).toFixed(2));
                                    if (condition.mode === TOOLKIT.ConditionMode.Greater && numValue > condition.threshold) {
                                        passed++;
                                    } else if (condition.mode === TOOLKIT.ConditionMode.Less && numValue < condition.threshold) {
                                        passed++;
                                    } else if (condition.mode === TOOLKIT.ConditionMode.Equals && numValue === condition.threshold) {
                                        passed++;
                                    } else if (condition.mode === TOOLKIT.ConditionMode.NotEqual && numValue !== condition.threshold) {
                                        passed++;
                                    }
                                } else if (ptype == TOOLKIT.AnimatorParameterType.Bool) {
                                    const boolValue: boolean = this.getBool(condition.parameter);
                                    if (condition.mode === TOOLKIT.ConditionMode.If && boolValue === true) {
                                        passed++;
                                    } else if (condition.mode === TOOLKIT.ConditionMode.IfNot && boolValue === false) {
                                        passed++;
                                    }
                                } else if (ptype == TOOLKIT.AnimatorParameterType.Trigger) {
                                    const triggerValue: boolean = this.getTrigger(condition.parameter);
                                    if (triggerValue === true) {
                                        passed++;
                                        // Note: For Loop Faster Than IndexOf
                                        let indexOfTrigger: number = -1;
                                        for (let i = 0; i < this._checkers.triggered.length; i++) {
                                            if (this._checkers.triggered[i] === condition.parameter) {
                                                indexOfTrigger = i;
                                                break
                                            }
                                        }
                                        if (indexOfTrigger < 0) {
                                            this._checkers.triggered.push(condition.parameter);
                                        }
                                    }
                                }
                            }
                        });
                        if (transition.hasExitTime === true) {
                            // ..
                            // TODO - CHECK TRANSITION INTERRUPTION SOURCE STATUS
                            // ..
                            // Validate Transition Has Exit Time And All Conditions Passed
                            transitionOk = (exitTimeExpired === true && passed === checks);
                        } else {
                            // Validate All Transition Conditions Passed
                            transitionOk = (passed === checks);
                        }
                    } else {
                        // Validate Transition Has Expired Exit Time Only
                        transitionOk = (transition.hasExitTime === true && exitTimeExpired === true);
                    }
                    // Validate Current Transition Destination Change
                    if (transitionOk === true) {
                        if (transition.hasExitTime === true && exitTimeExpired === true) {
                            if (this.onAnimationEndObservable && this.onAnimationEndObservable.hasObservers()) {
                                this.onAnimationEndObservable.notifyObservers(layer.index);
                            }
                        }
                        const blendRate: number = (currentAnimationRate > 0) ? currentAnimationRate : TOOLKIT.AnimationState.FPS;
                        const destState: string = (transition.isExit === false) ? transition.destination : TOOLKIT.AnimationState.EXIT;
                        const durationSecs: number = (transition.fixedDuration === true) ? transition.duration : BABYLON.Scalar.Denormalize(transition.duration, 0, currentAnimationLength);
                        const blendingSpeed: number = TOOLKIT.Utilities.ComputeBlendingSpeed(blendRate, durationSecs);
                        const normalizedOffset: number = transition.offset;  // Note: Is Normalized Transition Offset Time
                        this._checkers.result = destState;
                        this._checkers.offest = normalizedOffset;
                        this._checkers.blending = blendingSpeed;
                        break;
                    }
                }
            }
        }
        private playCurrentAnimationState(layer: TOOLKIT.IAnimationLayer, name: string, blending: number, normalizedOffset: number = 0): void {
            if (layer == null) return;
            if (name == null || name === "" || name === TOOLKIT.AnimationState.EXIT) return;
            if (layer.animationStateMachine != null && layer.animationStateMachine.name === name) return;
            // ..
            // Reset Animation Target Mixers
            // ..
            if (this.m_animationTargets != null && this.m_animationTargets.length > 0) {
                this.m_animationTargets.forEach((targetedAnim: BABYLON.TargetedAnimation) => {
                    const animationTarget: any = targetedAnim.target;
                    if (animationTarget.metadata != null && animationTarget.metadata.mixer != null) {
                        const animationTargetMixer: TOOLKIT.AnimationMixer = animationTarget.metadata.mixer[layer.index];
                        if (animationTargetMixer != null) {
                            animationTargetMixer.originalMatrix = null;
                            animationTargetMixer.blendingFactor = 0;
                            animationTargetMixer.blendingSpeed = blending;
                        }
                    }
                });
            }
            // ..
            // Play Current Layer Animation State
            // ..
            const state: TOOLKIT.MachineState = this.getMachineState(name);
            if (state != null && state.layerIndex === layer.index) {
                state.time = 0;
                state.played = 0;
                state.interrupted = false;
                layer.animationTime = BABYLON.Scalar.Clamp(normalizedOffset);
                layer.animationNormal = 0;
                layer.animationFirstRun = true;
                layer.animationEndFrame = false;
                layer.animationLoopFrame = false;
                layer.animationLoopCount = 0;
                layer.animationLoopEvents = null;
                layer.animationStateMachine = state;

                this._deltaPosition.set(0, 0, 0);
                this._deltaRotation.set(0, 0, 0, 0);
                this._angularVelocity.set(0, 0, 0);
                this._rootMotionSpeed = 0;
                this._rootMotionMatrix.reset();
                this._dirtyMotionMatrix = null;
                this._rootMotionPosition.set(0, 0, 0);
                this._rootMotionRotation.set(0, 0, 0, 0);
                this._lastMotionPosition.set(0, 0, 0);
                this._lastMotionRotation.set(0, 0, 0, 0);

                //console.warn(">>> Play Animation State: " + this.transform.name + " --> " + state.name + " --> Foot IK: " + layer.animationStateMachine.iKOnFeet);
            }
        }
        private stopCurrentAnimationState(layer: TOOLKIT.IAnimationLayer): void {
            if (layer == null) return;
            // ..
            // Reset Animation Target Mixers
            // ..
            if (this.m_animationTargets != null && this.m_animationTargets.length > 0) {
                this.m_animationTargets.forEach((targetedAnim: BABYLON.TargetedAnimation) => {
                    const animationTarget: any = targetedAnim.target;
                    if (animationTarget.metadata != null && animationTarget.metadata.mixer != null) {
                        const animationTargetMixer: TOOLKIT.AnimationMixer = animationTarget.metadata.mixer[layer.index];
                        if (animationTargetMixer != null) {
                            animationTargetMixer.originalMatrix = null;
                            animationTargetMixer.blendingFactor = 0;
                            animationTargetMixer.blendingSpeed = 0;
                        }
                    }
                });
            }
            // ..
            // Stop Current Layer Animation State
            // ..
            layer.animationTime = 0;
            layer.animationNormal = 0;
            layer.animationFirstRun = true;
            layer.animationEndFrame = false;
            layer.animationLoopFrame = false;
            layer.animationLoopCount = 0;
            layer.animationLoopEvents = null;
            layer.animationStateMachine = null;

            this._deltaPosition.set(0, 0, 0);
            this._deltaRotation.set(0, 0, 0, 0);
            this._angularVelocity.set(0, 0, 0);
            this._rootMotionSpeed = 0;
            this._rootMotionMatrix.reset();
            this._dirtyMotionMatrix = null;
            this._rootMotionPosition.set(0, 0, 0);
            this._rootMotionRotation.set(0, 0, 0, 0);
            this._lastMotionPosition.set(0, 0, 0);
            this._lastMotionRotation.set(0, 0, 0, 0);
        }
        private checkAvatarTransformPath(layer: TOOLKIT.IAnimationLayer, transformPath: string): boolean {
            let result: boolean = false;
            if (layer.animationMaskMap != null) {
                const transformIndex: number = layer.animationMaskMap.get(transformPath);
                if (transformIndex != null && transformIndex >= 0) {
                    result = true;
                }
            }
            return result;
        }
        private filterTargetAvatarMask(layer: TOOLKIT.IAnimationLayer, target: BABYLON.TransformNode): boolean {
            let result: boolean = false;
            if (target.metadata != null && target.metadata.toolkit != null && target.metadata.toolkit.bone != null && target.metadata.toolkit.bone !== "") {
                const transformPath: string = target.metadata.toolkit.bone;
                result = this.checkAvatarTransformPath(layer, transformPath);
            }
            return result;
        }
        private sortWeightedBlendingList(weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (weightList != null && weightList.length > 0) {
                // Sort In Descending Order
                weightList.sort((left, right): number => {
                    if (left.weight < right.weight) return 1;
                    if (left.weight > right.weight) return -1;
                    return 0;
                });
            }
        }
        private computeWeightedFrameRatio(weightList: TOOLKIT.IBlendTreeChild[]): number {
            let result: number = 1.0;
            if (weightList != null && weightList.length > 0) {
                this.sortWeightedBlendingList(weightList);
                this._blendWeights.primary = weightList[0];
                const primaryWeight: number = this._blendWeights.primary.weight;
                if (primaryWeight < 1.0 && weightList.length > 1) {
                    this._blendWeights.secondary = weightList[1];
                }
                // ..
                if (this._blendWeights.primary != null && this._blendWeights.secondary != null) {
                    const frameWeightDelta: number = BABYLON.Scalar.Clamp(this._blendWeights.primary.weight);
                    result = BABYLON.Scalar.Lerp(this._blendWeights.secondary.ratio, this._blendWeights.primary.ratio, frameWeightDelta);
                } else if (this._blendWeights.primary != null && this._blendWeights.secondary == null) {
                    result = this._blendWeights.primary.ratio;
                }
            }
            return result;
        }

        ///////////////////////////////////////////////////////////////////////////////////////////////
        // Blend Tree Branches -  Helper Functions
        ///////////////////////////////////////////////////////////////////////////////////////////////

        private setupTreeBranches(tree: TOOLKIT.IBlendTree): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                tree.children.forEach((child) => {
                    if (child.type === TOOLKIT.MotionType.Tree) {
                        this.setupTreeBranches(child.subtree);
                    } else if (child.type === TOOLKIT.MotionType.Clip) {
                        if (child.motion != null && child.motion !== "") {
                            child.weight = 0;
                            child.ratio = 0;
                            child.track = this.getAnimationGroup(child.motion);
                            if (child.track != null) {
                                //const animLength:number = (child.track.to / TOOLKIT.SceneManager.AnimationTargetFps);
                                const animLength: number = child.track.metadata.toolkit.length;
                                child.ratio = (TOOLKIT.AnimationState.TIME / animLength);
                            }
                        }
                    }
                });
            }
        }
        private parseTreeBranches(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, parentWeight: number, weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (tree != null) {
                tree.valueParameterX = (tree.blendParameterX != null) ? parseFloat(this.getFloat(tree.blendParameterX).toFixed(2)) : 0;
                tree.valueParameterY = (tree.blendParameterY != null) ? parseFloat(this.getFloat(tree.blendParameterY).toFixed(2)) : 0;
                switch (tree.blendType) {
                    case TOOLKIT.BlendTreeType.Simple1D:
                        this.parse1DSimpleTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case TOOLKIT.BlendTreeType.SimpleDirectional2D:
                        this.parse2DSimpleDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case TOOLKIT.BlendTreeType.FreeformDirectional2D:
                        this.parse2DFreeformDirectionalTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                    case TOOLKIT.BlendTreeType.FreeformCartesian2D:
                        this.parse2DFreeformCartesianTreeBranches(layer, tree, parentWeight, weightList);
                        break;
                }
            }
        }
        private parse1DSimpleTreeBranches(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, parentWeight: number, weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                const blendTreeArray: TOOLKIT.BlendTreeValue[] = [];
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight = 0; // Note: Reset Weight Value
                    const item = {
                        source: child,
                        motion: child.motion,
                        posX: child.threshold,
                        posY: child.threshold,
                        weight: child.weight
                    };
                    blendTreeArray.push(item);
                });
                TOOLKIT.BlendTreeSystem.Calculate1DSimpleBlendTree(tree.valueParameterX, blendTreeArray);
                blendTreeArray.forEach((element: TOOLKIT.BlendTreeValue) => {
                    if (element.source != null) {
                        element.source.weight = element.weight;
                    }
                });
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight *= parentWeight; // Note: Scale Weight Value
                    if (child.type === TOOLKIT.MotionType.Clip) {
                        if (child.weight > 0) {
                            weightList.push(child);
                        }
                    }
                    if (child.type === TOOLKIT.MotionType.Tree) {
                        this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                    }
                });
            }
        }
        private parse2DSimpleDirectionalTreeBranches(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, parentWeight: number, weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                const blendTreeArray: TOOLKIT.BlendTreeValue[] = [];
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight = 0; // Note: Reset Weight Value
                    const item = {
                        source: child,
                        motion: child.motion,
                        posX: child.positionX,
                        posY: child.positionY,
                        weight: child.weight
                    };
                    blendTreeArray.push(item);
                });
                TOOLKIT.BlendTreeSystem.Calculate2DFreeformDirectional(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
                blendTreeArray.forEach((element: TOOLKIT.BlendTreeValue) => {
                    if (element.source != null) {
                        element.source.weight = element.weight;
                    }
                });
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight *= parentWeight; // Note: Scale Weight Value
                    if (child.type === TOOLKIT.MotionType.Clip) {
                        if (child.weight > 0) {
                            weightList.push(child);
                        }
                    }
                    if (child.type === TOOLKIT.MotionType.Tree) {
                        this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                    }
                });
            }
        }
        private parse2DFreeformDirectionalTreeBranches(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, parentWeight: number, weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                const blendTreeArray: TOOLKIT.BlendTreeValue[] = [];
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight = 0; // Note: Reset Weight Value
                    const item = {
                        source: child,
                        motion: child.motion,
                        posX: child.positionX,
                        posY: child.positionY,
                        weight: child.weight
                    };
                    blendTreeArray.push(item);
                });
                TOOLKIT.BlendTreeSystem.Calculate2DFreeformDirectional(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
                blendTreeArray.forEach((element: TOOLKIT.BlendTreeValue) => {
                    if (element.source != null) {
                        element.source.weight = element.weight;
                    }
                });
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight *= parentWeight; // Note: Scale Weight Value
                    if (child.type === TOOLKIT.MotionType.Clip) {
                        if (child.weight > 0) {
                            weightList.push(child);
                        }
                    }
                    if (child.type === TOOLKIT.MotionType.Tree) {
                        this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                    }
                });
            }
        }
        private parse2DFreeformCartesianTreeBranches(layer: TOOLKIT.IAnimationLayer, tree: TOOLKIT.IBlendTree, parentWeight: number, weightList: TOOLKIT.IBlendTreeChild[]): void {
            if (tree != null && tree.children != null && tree.children.length > 0) {
                const blendTreeArray: TOOLKIT.BlendTreeValue[] = [];
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight = 0; // Note: Reset Weight Value
                    const item = {
                        source: child,
                        motion: child.motion,
                        posX: child.positionX,
                        posY: child.positionY,
                        weight: child.weight
                    };
                    blendTreeArray.push(item);
                });
                TOOLKIT.BlendTreeSystem.Calculate2DFreeformCartesian(tree.valueParameterX, tree.valueParameterY, blendTreeArray);
                blendTreeArray.forEach((element: TOOLKIT.BlendTreeValue) => {
                    if (element.source != null) {
                        element.source.weight = element.weight;
                    }
                });
                tree.children.forEach((child: TOOLKIT.IBlendTreeChild) => {
                    child.weight *= parentWeight; // Note: Scale Weight Value
                    if (child.type === TOOLKIT.MotionType.Clip) {
                        if (child.weight > 0) {
                            weightList.push(child);
                        }
                    }
                    if (child.type === TOOLKIT.MotionType.Tree) {
                        this.parseTreeBranches(layer, child.subtree, child.weight, weightList);
                    }
                });
            }
        }
    }

    ///////////////////////////////////////////
    // Support Classes, Blend Tree Utilities
    ///////////////////////////////////////////

    export class BlendTreeValue {
        public source: TOOLKIT.IBlendTreeChild;
        public motion: string;
        public posX: number;
        public posY: number;
        public weight: number;
        constructor(config: { source: TOOLKIT.IBlendTreeChild, motion: string, posX?: number, posY?: number, weight?: number }) {
            this.source = config.source;
            this.motion = config.motion;
            this.posX = config.posX || 0;
            this.posY = config.posY || 0;
            this.weight = config.weight || 0;
        }
    }
    export class BlendTreeUtils {
        public static ClampValue(num: number, min: number, max: number): number {
            return num <= min ? min : num >= max ? max : num;
        }
        public static GetSignedAngle(a: BABYLON.Vector2, b: BABYLON.Vector2): number {
            return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
        }
        public static GetLinearInterpolation(x0: number, y0: number, x1: number, y1: number, x: number): number {
            return y0 + (x - x0) * ((y1 - y0) / (x1 - x0));
        }
        public static GetRightNeighbourIndex(inputX: number, blendTreeArray: TOOLKIT.BlendTreeValue[]): number {
            blendTreeArray.sort((a: TOOLKIT.BlendTreeValue, b: TOOLKIT.BlendTreeValue) => { return (a.posX - b.posX); });
            for (let i = 0; i < blendTreeArray.length; ++i) {
                if (blendTreeArray[i].posX > inputX) {
                    return i;
                }
            }
            return -1;
        }
    }
    export class BlendTreeSystem {
        public static Calculate1DSimpleBlendTree(inputX: number, blendTreeArray: TOOLKIT.BlendTreeValue[]): void {
            const firstBlendTree: TOOLKIT.BlendTreeValue = blendTreeArray[0];
            const lastBlendTree: TOOLKIT.BlendTreeValue = blendTreeArray[blendTreeArray.length - 1];
            if (inputX <= firstBlendTree.posX) {
                firstBlendTree.weight = 1;
            } else if (inputX >= lastBlendTree.posX) {
                lastBlendTree.weight = 1;
            } else {
                const rightNeighbourBlendTreeIndex: number = TOOLKIT.BlendTreeUtils.GetRightNeighbourIndex(inputX, blendTreeArray);
                const leftNeighbour: TOOLKIT.BlendTreeValue = blendTreeArray[rightNeighbourBlendTreeIndex - 1];
                const rightNeighbour: TOOLKIT.BlendTreeValue = blendTreeArray[rightNeighbourBlendTreeIndex];
                const interpolatedValue: number = TOOLKIT.BlendTreeUtils.GetLinearInterpolation(leftNeighbour.posX, 1, rightNeighbour.posX, 0, inputX);
                leftNeighbour.weight = interpolatedValue;
                rightNeighbour.weight = 1 - leftNeighbour.weight;
            }
        }
        public static Calculate2DFreeformDirectional(inputX: number, inputY: number, blendTreeArray: TOOLKIT.BlendTreeValue[]): void {
            TOOLKIT.BlendTreeSystem.TempVector2_IP.set(inputX, inputY);
            TOOLKIT.BlendTreeSystem.TempVector2_POSI.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSJ.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSIP.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSIJ.set(0, 0);
            const kDirScale: number = 2;
            let totalWeight: number = 0;
            let inputLength: number = TOOLKIT.BlendTreeSystem.TempVector2_IP.length();
            for (let i = 0; i < blendTreeArray.length; ++i) {
                const blendTree: TOOLKIT.BlendTreeValue = blendTreeArray[i];
                TOOLKIT.BlendTreeSystem.TempVector2_POSI.set(blendTree.posX, blendTree.posY);
                const posILength: number = TOOLKIT.BlendTreeSystem.TempVector2_POSI.length();
                const inputToPosILength: number = (inputLength - posILength);
                const posIToInputAngle: number = TOOLKIT.BlendTreeUtils.GetSignedAngle(TOOLKIT.BlendTreeSystem.TempVector2_POSI, TOOLKIT.BlendTreeSystem.TempVector2_IP);
                let weight: number = 1;
                for (let j = 0; j < blendTreeArray.length; ++j) {
                    if (j === i) {
                        continue;
                    } else {
                        TOOLKIT.BlendTreeSystem.TempVector2_POSJ.set(blendTreeArray[j].posX, blendTreeArray[j].posY);
                        const posJLength: number = TOOLKIT.BlendTreeSystem.TempVector2_POSJ.length();
                        const averageLengthOfIJ: number = (posILength + posJLength) / 2;
                        const magOfPosIToInputPos: number = (inputToPosILength / averageLengthOfIJ);
                        const magOfIJ: number = (posJLength - posILength) / averageLengthOfIJ;
                        const angleIJ: number = TOOLKIT.BlendTreeUtils.GetSignedAngle(TOOLKIT.BlendTreeSystem.TempVector2_POSI, TOOLKIT.BlendTreeSystem.TempVector2_POSJ);
                        TOOLKIT.BlendTreeSystem.TempVector2_POSIP.set(magOfPosIToInputPos, posIToInputAngle * kDirScale);
                        TOOLKIT.BlendTreeSystem.TempVector2_POSIJ.set(magOfIJ, angleIJ * kDirScale);
                        const lenSqIJ: number = TOOLKIT.BlendTreeSystem.TempVector2_POSIJ.lengthSquared();
                        let newWeight: number = BABYLON.Vector2.Dot(TOOLKIT.BlendTreeSystem.TempVector2_POSIP, TOOLKIT.BlendTreeSystem.TempVector2_POSIJ) / lenSqIJ;
                        newWeight = 1 - newWeight;
                        newWeight = TOOLKIT.BlendTreeUtils.ClampValue(newWeight, 0, 1);
                        weight = Math.min(newWeight, weight);
                    }
                }
                blendTree.weight = weight;
                totalWeight += weight;
            }
            for (const blendTree of blendTreeArray) {
                blendTree.weight /= totalWeight;
            }
        }
        public static Calculate2DFreeformCartesian(inputX: number, inputY: number, blendTreeArray: TOOLKIT.BlendTreeValue[]): void {
            TOOLKIT.BlendTreeSystem.TempVector2_IP.set(inputX, inputY);
            TOOLKIT.BlendTreeSystem.TempVector2_POSI.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSJ.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSIP.set(0, 0);
            TOOLKIT.BlendTreeSystem.TempVector2_POSIJ.set(0, 0);
            let totalWeight: number = 0;
            for (let i = 0; i < blendTreeArray.length; ++i) {
                const blendTree: TOOLKIT.BlendTreeValue = blendTreeArray[i];
                TOOLKIT.BlendTreeSystem.TempVector2_POSI.set(blendTree.posX, blendTree.posY);
                TOOLKIT.BlendTreeSystem.TempVector2_IP.subtractToRef(TOOLKIT.BlendTreeSystem.TempVector2_POSI, TOOLKIT.BlendTreeSystem.TempVector2_POSIP);
                let weight: number = 1;
                for (let j = 0; j < blendTreeArray.length; ++j) {
                    if (j === i) {
                        continue;
                    } else {
                        TOOLKIT.BlendTreeSystem.TempVector2_POSJ.set(blendTreeArray[j].posX, blendTreeArray[j].posY);
                        TOOLKIT.BlendTreeSystem.TempVector2_POSJ.subtractToRef(TOOLKIT.BlendTreeSystem.TempVector2_POSI, TOOLKIT.BlendTreeSystem.TempVector2_POSIJ);
                        const lenSqIJ: number = TOOLKIT.BlendTreeSystem.TempVector2_POSIJ.lengthSquared();
                        let newWeight: number = BABYLON.Vector2.Dot(TOOLKIT.BlendTreeSystem.TempVector2_POSIP, TOOLKIT.BlendTreeSystem.TempVector2_POSIJ) / lenSqIJ;
                        newWeight = 1 - newWeight;
                        newWeight = TOOLKIT.BlendTreeUtils.ClampValue(newWeight, 0, 1);
                        weight = Math.min(weight, newWeight);
                    }
                }
                blendTree.weight = weight;
                totalWeight += weight;
            }
            for (const blendTree of blendTreeArray) {
                blendTree.weight /= totalWeight;
            }
        }
        private static TempVector2_IP: BABYLON.Vector2 = new BABYLON.Vector2(0, 0);
        private static TempVector2_POSI: BABYLON.Vector2 = new BABYLON.Vector2(0, 0);
        private static TempVector2_POSJ: BABYLON.Vector2 = new BABYLON.Vector2(0, 0);
        private static TempVector2_POSIP: BABYLON.Vector2 = new BABYLON.Vector2(0, 0);
        private static TempVector2_POSIJ: BABYLON.Vector2 = new BABYLON.Vector2(0, 0);
    }

    ///////////////////////////////////////////
    // Support Classes, Enums And Interfaces
    ///////////////////////////////////////////

    export class MachineState {
        public hash: number;
        public name: string;
        public tag: string;
        public time: number;
        public type: TOOLKIT.MotionType;
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
        public blendtree: TOOLKIT.IBlendTree;
        public transitions: TOOLKIT.ITransition[];
        public behaviours: TOOLKIT.IBehaviour[];
        public events: TOOLKIT.IAnimatorEvent[];
        public ccurves: TOOLKIT.IUnityCurve[];
        public tcurves: BABYLON.Animation[];
        public constructor() { }
    }
    export class TransitionCheck {
        public result: string;
        public offest: number;
        public blending: number;
        public triggered: string[];
    }
    export class AnimationMixer {
        public influenceBuffer: number;
        public positionBuffer: BABYLON.Vector3;
        public rotationBuffer: BABYLON.Quaternion;
        public scalingBuffer: BABYLON.Vector3;
        public originalMatrix: BABYLON.Matrix;
        public blendingFactor: number;
        public blendingSpeed: number;
        public rootPosition: BABYLON.Vector3;
        public rootRotation: BABYLON.Quaternion;
    }
    export class BlendingWeights {
        public primary: TOOLKIT.IBlendTreeChild;
        public secondary: TOOLKIT.IBlendTreeChild;
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
        Upper = 1,
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
        avatarMask: TOOLKIT.IAvatarMask;
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
        animationStateMachine: TOOLKIT.MachineState;
    }
    export interface IAnimationCurve {
        length: number;
        preWrapMode: string;
        postWrapMode: string;
        keyframes: TOOLKIT.IAnimationKeyframe[];
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
        intSource: TOOLKIT.InterruptionSource;
        isExit: boolean;
        mute: boolean;
        name: string;
        offset: number;
        orderedInt: boolean;
        solo: boolean;
        conditions: TOOLKIT.ICondition[];
    }
    export interface ICondition {
        hash: number;
        mode: TOOLKIT.ConditionMode;
        parameter: string;
        threshold: number;
    }
    export interface IBlendTree {
        hash: number;
        name: string;
        state: string;
        children: TOOLKIT.IBlendTreeChild[];
        layerIndex: number;
        apparentSpeed: number;
        averageAngularSpeed: number;
        averageDuration: number;
        averageSpeed: number[];
        blendParameterX: string;
        blendParameterY: string;
        blendType: TOOLKIT.BlendTreeType;
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
        type: TOOLKIT.MotionType;
        motion: string;
        positionX: number;
        positionY: number;
        threshold: number;
        timescale: number;
        subtree: TOOLKIT.IBlendTree;
        weight: number;
        ratio: number;
        track: BABYLON.AnimationGroup;
    }
}