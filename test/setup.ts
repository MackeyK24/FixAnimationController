import * as BABYLON from 'babylonjs';

// Mock BABYLON.Observable
class MockObservable<T> {
    private observers: Array<(data: T) => void> = [];
    
    public add(callback: (data: T) => void): void {
        this.observers.push(callback);
    }
    
    public notifyObservers(data: T): void {
        this.observers.forEach(observer => observer(data));
    }
}

// Mock BABYLON.Engine
class MockEngine {
    public getDeltaTime(): number {
        return 16.67; // 60fps
    }
}

// Mock BABYLON.Scene
class MockScene {
    private _engine: MockEngine;
    
    constructor(engine?: MockEngine) {
        this._engine = engine || new MockEngine();
    }
    
    public getEngine(): MockEngine {
        return this._engine;
    }
}

// Mock BABYLON.TargetedAnimation
class MockTargetedAnimation {
    public animation: BABYLON.Animation;
    public target: any;

    constructor(animation: BABYLON.Animation, target: any) {
        this.animation = animation;
        this.target = target;
    }
}

// Mock BABYLON.AnimationGroup
class MockAnimationGroup {
    public name: string;
    private _targetedAnimations: MockTargetedAnimation[];
    public from: number;
    public to: number;
    private _state: 'playing' | 'paused' | 'stopped';

    constructor(name: string) {
        this.name = name;
        this._targetedAnimations = [];
        this.from = 0;
        this.to = 100; // Default animation length
        this._state = 'stopped';
    }

    public get targetedAnimations(): MockTargetedAnimation[] {
        return this._targetedAnimations;
    }

    public get isPlaying(): boolean {
        return this._state === 'playing';
    }

    public get isPaused(): boolean {
        return this._state === 'paused';
    }

    public addTargetedAnimation(animation: BABYLON.Animation, target: any): MockTargetedAnimation {
        const targetedAnimation = new MockTargetedAnimation(animation, target);
        this._targetedAnimations.push(targetedAnimation);
        return targetedAnimation;
    }

    public start(_loop?: boolean): MockAnimationGroup {
        this._state = 'playing';
        return this;
    }

    public stop(): MockAnimationGroup {
        this._state = 'stopped';
        return this;
    }

    public pause(): MockAnimationGroup {
        if (this._state === 'playing') {
            this._state = 'paused';
        }
        return this;
    }

    public reset(): MockAnimationGroup {
        this._state = 'stopped';
        return this;
    }

    public restart(): MockAnimationGroup {
        this._state = 'playing';
        return this;
    }

    public goToFrame(_frame: number): void {
        // No-op for mock
    }

    public dispose(): void {
        this._targetedAnimations = [];
    }
}

// Mock BABYLON.TransformNode
class MockTransformNode {
    public name: string;
    public position: BABYLON.Vector3;
    public rotationQuaternion: BABYLON.Quaternion;
    
    constructor(name: string) {
        this.name = name;
        this.position = new BABYLON.Vector3();
        this.rotationQuaternion = new BABYLON.Quaternion();
    }
}

// Apply mocks
Object.assign(global as any, {
    BABYLON: {
        ...BABYLON,
        Observable: MockObservable,
        Scene: MockScene,
        Engine: MockEngine,
        AnimationGroup: MockAnimationGroup,
        TransformNode: MockTransformNode,
        TargetedAnimation: MockTargetedAnimation
    }
});
