# Animation Controller Implementation Plan

## 1. Core Architecture

### 1.1 Main Classes
```typescript
class AnimationController {
    private layers: AnimationLayer[]
    private parameters: Map<string, Parameter>
    private stateMap: Map<string, MachineState>
    private frameCache: Map<string, AnimationFrameCache>
    
    constructor(animationGroups: BABYLON.AnimationGroup[], metadata: any)
    update(deltaTime: number): void
    setState(stateName: string): void
}
```

### 1.2 Supporting Classes
```typescript
class AnimationLayer {
    private currentState: MachineState
    private targetState: MachineState
    private transitionTime: number
    private avatarMask: AvatarMask
    
    update(deltaTime: number): void
    private checkTransitions(): void
    private updateBlendTrees(): void
}

class BlendTree {
    private children: BlendTreeNode[]
    private type: BlendTreeType
    private paramX: string
    private paramY: string
    
    calculateWeights(): void
    sampleAnimation(time: number): void
}

class Parameter {
    value: number | boolean
    type: ParameterType
    smoothing: boolean
}
```

## 2. Performance Optimizations

### 2.1 Animation Frame Caching
- Cache sampled animation frames for frequently used poses
- Implement LRU cache with configurable size
- Cache key: `${clipId}_${frameTime}`
- Cache value: Computed transformation matrices

### 2.2 Blend Tree Optimization
- Cache blend weights when parameters haven't changed
- Use dirty flags to skip recalculation
- Implement matrix pooling for blend calculations
- Pre-compute blend tree node relationships

### 2.3 State Machine Optimization
- Use dirty flags for transition checks
- Cache transition conditions until parameters change
- Implement efficient parameter change detection
- Pool commonly used vectors/matrices

## 3. Feature Implementation

### 3.1 Animation Sampling System
```typescript
class AnimationSampler {
    sampleAtTime(clip: BABYLON.AnimationGroup, time: number): void
    handleLoopBlending(clip: BABYLON.AnimationGroup, time: number): void
    cacheFrame(key: string, matrices: Float32Array): void
}
```

### 3.2 State Machine & Transitions
- Support all Unity transition types:
  - Normal transitions
  - ANY state transitions
  - Self transitions
- Implement transition blending with configurable curves
- Support exit time and fixed duration transitions

### 3.3 Layer System
```typescript
class AvatarMask {
    private includedBones: Set<string>
    private boneWeights: Map<string, number>
    
    initialize(maskData: any): void
    applyMask(pose: AnimationPose): void
}
```

### 3.4 Root Motion
```typescript
class RootMotionExtractor {
    private rootBone: BABYLON.TransformNode
    private motionAccumulator: BABYLON.Vector3
    
    extractMotion(deltaTime: number): void
    applyMotion(): void
}
```

## 4. Initialization Flow

### 4.1 Setup Process
1. Parse animstate.json metadata
2. Create parameter map
3. Initialize state machine
4. Setup layers and masks
5. Create blend trees
6. Initialize animation groups
7. Setup root motion if enabled

### 4.2 Update Loop
1. Update parameters
2. Check transitions
3. Process blend trees
4. Sample animations
5. Apply avatar masks
6. Extract root motion
7. Update transforms

## 5. API Design

### 5.1 Public Interface
```typescript
interface IAnimationController {
    // State Control
    setState(name: string): void
    
    // Parameter Control
    setFloat(name: string, value: number): void
    setBool(name: string, value: boolean): void
    setTrigger(name: string): void
    
    // Update
    update(deltaTime: number): void
    
    // Layer Control
    setLayerWeight(index: number, weight: number): void
    
    // Root Motion
    enableRootMotion(enabled: boolean): void
}
```

### 5.2 Event System
```typescript
interface IAnimationEvents {
    onStateEnter: Observable<string>
    onStateExit: Observable<string>
    onTransitionStart: Observable<TransitionInfo>
    onTransitionEnd: Observable<TransitionInfo>
}
```

## 6. Testing Strategy

### 6.1 Unit Tests
- Parameter system
- Blend tree calculations
- State transitions
- Frame caching
- Root motion extraction

### 6.2 Integration Tests
- Full animation sequences
- Complex state machines
- Multi-layer animations
- Avatar mask blending
- Root motion scenarios

## 7. Implementation Phases

### Phase 1: Core Framework
1. Basic state machine
2. Parameter system
3. Simple transitions
4. Animation sampling

### Phase 2: Advanced Features
1. Blend trees
2. Avatar masks
3. Root motion
4. Loop blending

### Phase 3: Optimization
1. Frame caching
2. Matrix pooling
3. Transition optimization
4. Memory management

### Phase 4: Polish
1. Event system
2. Error handling
3. Performance monitoring
4. Documentation
