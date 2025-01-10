# New AnimationController Implementation Plan

## Core Architecture

1. Main Classes
```typescript
class AnimationController {
    private machine: any;                    // Parsed machine.json data
    private animationGroups: AnimationGroup[]; // Available animation clips
    private layers: AnimationLayer[];        // Active animation layers
    private parameters: Map<string, any>;    // Animation parameters
    private rootBone: TransformNode;         // Optional root motion bone
}

class AnimationLayer {
    private avatarMask: Map<string, number>; // Bone transform paths
    private currentState: AnimationState;    // Current active state
    private blendWeight: number;             // Layer blend weight
    private targetMixers: Map<string, AnimationMixer>; // Per-target blend data
}

class AnimationMixer {
    position: Vector3;        // Blended position
    rotation: Quaternion;     // Blended rotation
    scaling: Vector3;         // Blended scaling
    blendWeight: number;      // Current blend weight
    targetTransform: TransformNode; // Target bone/transform
}
```

2. Core Features
- Sample animations at timestamps instead of play/stop
- Smooth blending between states using matrix interpolation
- Per-bone blending with avatar masks
- Root motion extraction and application
- Support for empty states

## Implementation Details

1. Animation Sampling
```typescript
// Instead of play/stop, sample at specific time
function sampleAnimation(clip: AnimationGroup, time: number): void {
    // Sample each targeted animation at normalized time
    clip.targetedAnimations.forEach(target => {
        const value = SampleAnimationTrack(target.animation, time);
        ApplyAnimationValue(target.target, value);
    });
}
```

2. Blend Tree Processing
```typescript
// Smooth blend tree implementation
function processBlendTree(tree: IBlendTree, deltaTime: number): void {
    // Calculate blend weights
    const weights = CalculateBlendWeights(tree);
    
    // Interpolate weights over time for smoothness
    InterpolateWeights(weights, deltaTime);
    
    // Sample and blend animations
    tree.children.forEach(child => {
        if (child.weight > 0) {
            SampleAndBlendAnimation(child, weights);
        }
    });
}
```

3. Layer System with Avatar Masks
```typescript
// Process animation layers with masks
function updateLayers(): void {
    layers.forEach(layer => {
        // Process layer animations
        const stateData = layer.currentState.process();
        
        // Apply avatar mask per bone
        layer.targetMixers.forEach((mixer, path) => {
            if (layer.avatarMask.has(path)) {
                ApplyBlendedTransform(mixer, stateData, layer.blendWeight);
            }
        });
    });
}
```

4. Root Motion
```typescript
// Extract and apply root motion
function processRootMotion(deltaTime: number): void {
    if (!rootBone) return;
    
    // Extract motion from animation
    const delta = ExtractRootMotionDelta();
    
    // Apply to transform
    ApplyRootMotionToTransform(delta, deltaTime);
}
```

5. State Machine Update
```typescript
// Main update loop
function update(deltaTime: number): void {
    // Check transitions
    CheckAndApplyTransitions();
    
    // Process blend trees
    ProcessBlendTrees(deltaTime);
    
    // Update layers
    UpdateLayers();
    
    // Process root motion
    ProcessRootMotion(deltaTime);
    
    // Finalize transforms
    FinalizeTransforms();
}
```

## Key Improvements

1. Blend Tree Smoothing
- Interpolate blend weights over time instead of direct application
- Use matrix interpolation for smoother transitions
- Cache and reuse calculations where possible

2. Avatar Mask Enhancement
- Improved transform path matching
- Per-layer mask application
- Proper weight propagation through hierarchy

3. Performance Optimizations
- Minimize matrix operations
- Batch transform updates
- Efficient data structures for lookups

## Usage Example
```typescript
// Initialize controller
const controller = new AnimationController(machine, animationGroups);
if (rootMotionEnabled) {
    controller.setRootBone(rootBone);
}

// Update in render loop
scene.onBeforeRenderObservable.add(() => {
    controller.update(scene.getEngine().getDeltaTime());
});

// Set animation parameters
controller.setFloat("Speed", 1.0);
controller.setBool("IsJumping", true);

// Explicitly set state if needed
controller.setState("Run");
```

## Implementation Order

1. Core Framework
- Basic state machine structure
- Animation sampling system
- Parameter system

2. Blend System
- Matrix-based transform blending
- Smooth weight interpolation
- Blend tree calculations

3. Layer System
- Avatar mask implementation
- Layer blending
- Transform targeting

4. Root Motion
- Motion extraction
- Delta calculation
- Transform application

5. Transitions
- State transition system
- Blending between states
- Condition evaluation

6. Optimization
- Performance improvements
- Memory optimization
- Batch processing
