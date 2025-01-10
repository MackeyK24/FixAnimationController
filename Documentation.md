# Babylon.js Animation Controller Documentation

## Overview
The Animation Controller provides Unity-style animation state machine functionality for Babylon.js applications. It supports blend trees, transitions, layers with avatar masks, and root motion extraction.

## Installation
```typescript
npm install babylon-toolkit-animation-controller
```

## Basic Usage
```typescript
import { TOOLKIT } from 'babylon-toolkit-animation-controller';
const { AnimationController } = TOOLKIT;

// Create controller
const controller = new AnimationController(scene);

// Initialize with machine data and animations
controller.initialize(machineData, [walkAnimation, runAnimation]);

// Update in render loop
scene.onBeforeRenderObservable.add(() => {
    controller.update();
});
```

## Machine Configuration
The controller requires a machine configuration object that defines parameters, layers, and state machines:

```typescript
const machineData = {
    parameters: {
        Speed: { type: TOOLKIT.AnimatorParameterType.Float, defaultValue: 0 },
        IsJumping: { type: TOOLKIT.AnimatorParameterType.Bool, defaultValue: false }
    },
    layers: [{
        name: "Base Layer",
        index: 0,
        defaultWeight: 1,
        animationStateMachine: {
            name: "Locomotion",
            type: TOOLKIT.MotionType.Tree,
            blendtree: {
                blendType: TOOLKIT.BlendTreeType.Simple1D,
                blendParameterX: "Speed",
                children: [
                    { motion: "idle", threshold: 0, type: TOOLKIT.MotionType.Clip },
                    { motion: "walk", threshold: 0.5, type: TOOLKIT.MotionType.Clip },
                    { motion: "run", threshold: 1, type: TOOLKIT.MotionType.Clip }
                ]
            }
        }
    }]
};
```

## Blend Trees
The controller supports multiple blend tree types:

### Simple 1D Blend Tree
```typescript
const blendTree = {
    blendType: TOOLKIT.BlendTreeType.Simple1D,
    blendParameterX: "Speed",
    children: [
        { motion: "walk", threshold: 0, type: TOOLKIT.MotionType.Clip },
        { motion: "run", threshold: 1, type: TOOLKIT.MotionType.Clip }
    ]
};
```

### 2D Directional Blend Tree
```typescript
const blendTree = {
    blendType: TOOLKIT.BlendTreeType.SimpleDirectional2D,
    blendParameterX: "Horizontal",
    blendParameterY: "Vertical",
    children: [
        { motion: "idle", positionX: 0, positionY: 0, type: TOOLKIT.MotionType.Clip },
        { motion: "walkForward", positionX: 0, positionY: 1, type: TOOLKIT.MotionType.Clip },
        { motion: "walkBackward", positionX: 0, positionY: -1, type: TOOLKIT.MotionType.Clip },
        { motion: "walkLeft", positionX: -1, positionY: 0, type: TOOLKIT.MotionType.Clip },
        { motion: "walkRight", positionX: 1, positionY: 0, type: TOOLKIT.MotionType.Clip }
    ]
};
```

## State Transitions
Define transitions between states with conditions:

```typescript
const machineData = {
    layers: [{
        animationStateMachine: {
            name: "idle",
            type: TOOLKIT.MotionType.Clip,
            transitions: [{
                destination: "run",
                duration: 0.25,
                conditions: [{
                    parameter: "Speed",
                    threshold: 0.1,
                    mode: TOOLKIT.ConditionMode.Greater
                }]
            }]
        }
    }]
};
```

## Avatar Masks
Apply animations to specific bones using avatar masks:

```typescript
const upperBodyLayer = {
    name: "Upper Body Layer",
    index: 1,
    defaultWeight: 1,
    avatarMask: {
        transformPaths: ["spine", "leftArm", "rightArm"]
    },
    animationStateMachine: {
        name: "upperBody",
        type: TOOLKIT.MotionType.Clip,
        motion: "punch"
    }
};
```

## Root Motion
Enable root motion extraction:

```typescript
const rootBone = scene.getTransformNodeByName("root");
controller.initialize(machineData, animations, rootBone);

// Access root motion data
const deltaPosition = controller.rootMotionDelta;
const deltaRotation = controller.rootMotionRotation;
```

## API Reference

### Constructor
```typescript
constructor(scene: BABYLON.Scene)
```

### Methods

#### initialize
```typescript
initialize(
    machineData: any,
    animations: BABYLON.AnimationGroup[],
    rootBone?: BABYLON.TransformNode
): void
```

#### update
```typescript
update(): void
```

#### setState
```typescript
setState(stateName: string, layerIndex: number = 0): void
```

#### setParameter
```typescript
setParameter(name: string, value: number | boolean): void
```

#### getParameter
```typescript
getParameter(name: string): number | boolean | undefined
```

### Properties

#### scene
```typescript
get scene(): BABYLON.Scene
```

#### rootMotionDelta
```typescript
get rootMotionDelta(): BABYLON.Vector3
```

#### rootMotionRotation
```typescript
get rootMotionRotation(): BABYLON.Quaternion
```

#### rootMotionMatrix
```typescript
get rootMotionMatrix(): BABYLON.Matrix
```

#### rootMotionPosition
```typescript
get rootMotionPosition(): BABYLON.Vector3
```

#### rootMotionSpeed
```typescript
get rootMotionSpeed(): number
```

### Events
The controller provides several observables for monitoring animation state:

```typescript
// State change events
controller.onAnimationStateChangeObservable.add(({ layerIndex, state }) => {
    console.log(`State changed on layer ${layerIndex} to ${state.name}`);
});

// Transition events
controller.onAnimationTransitionObservable.add(({ layerIndex, from, to }) => {
    console.log(`Transitioning from ${from.name} to ${to.name}`);
});

// Animation events
controller.onAnimationEventObservable.add((event) => {
    console.log(`Animation event: ${event.function}`);
});
```

## Best Practices

### Performance Optimization
1. Use appropriate blend tree types for your needs
2. Minimize the number of active transitions
3. Keep avatar masks as simple as possible
4. Cache transform nodes instead of looking them up each frame

### Memory Management
1. Dispose of unused animation groups
2. Remove event listeners when no longer needed
3. Clear references when disposing of the controller

### Animation Setup
1. Normalize animation lengths for consistent blending
2. Use consistent frame rates across animations
3. Set appropriate transition durations for smooth blending

## Troubleshooting

### Common Issues
1. Animations not playing
   - Check if animations are properly loaded
   - Verify parameter values
   - Ensure state machine configuration is correct

2. Jerky transitions
   - Increase transition duration
   - Check for conflicting conditions
   - Verify animation frame rates match

3. Incorrect blending
   - Check threshold values
   - Verify parameter ranges
   - Ensure animations are compatible

### Debug Tips
1. Enable debug logging
2. Monitor parameter values
3. Check transition conditions
4. Verify avatar mask configurations

## Examples

### Character Controller
```typescript
// Create animations
const idleAnim = new BABYLON.AnimationGroup("idle");
const walkAnim = new BABYLON.AnimationGroup("walk");
const runAnim = new BABYLON.AnimationGroup("run");

// Configure state machine
const machineData = {
    parameters: {
        Speed: { type: TOOLKIT.AnimatorParameterType.Float, defaultValue: 0 }
    },
    layers: [{
        name: "Base Layer",
        index: 0,
        defaultWeight: 1,
        animationStateMachine: {
            name: "Locomotion",
            type: TOOLKIT.MotionType.Tree,
            blendtree: {
                blendType: TOOLKIT.BlendTreeType.Simple1D,
                blendParameterX: "Speed",
                children: [
                    { motion: "idle", threshold: 0, type: TOOLKIT.MotionType.Clip },
                    { motion: "walk", threshold: 0.5, type: TOOLKIT.MotionType.Clip },
                    { motion: "run", threshold: 1, type: TOOLKIT.MotionType.Clip }
                ]
            }
        }
    }]
};

// Initialize controller
const controller = new AnimationController(scene);
controller.initialize(machineData, [idleAnim, walkAnim, runAnim]);

// Update speed based on input
scene.onBeforeRenderObservable.add(() => {
    const inputAxis = new BABYLON.Vector2(
        scene.inputManager.getAxis("Horizontal"),
        scene.inputManager.getAxis("Vertical")
    );
    const speed = inputAxis.length();
    controller.setParameter("Speed", speed);
    controller.update();
});
```

### Combat System
```typescript
// Add upper body layer for combat animations
const combatLayer = {
    name: "Combat Layer",
    index: 1,
    defaultWeight: 1,
    avatarMask: {
        transformPaths: ["spine", "leftArm", "rightArm"]
    },
    animationStateMachine: {
        name: "Combat",
        type: TOOLKIT.MotionType.Clip,
        motion: "idle",
        transitions: [{
            destination: "punch",
            duration: 0.1,
            conditions: [{
                parameter: "Attack",
                mode: TOOLKIT.ConditionMode.Equals,
                threshold: 1
            }]
        }]
    }
};

// Handle combat input
scene.onPointerObservable.add(() => {
    controller.setParameter("Attack", true);
});
```

## Version History
- 1.0.0: Initial release
- 1.1.0: Added root motion support
- 1.2.0: Enhanced blend tree performance
- 1.3.0: Improved avatar mask handling

## Support
For issues and feature requests, please visit the [GitHub repository](https://github.com/MackeyK24/FixAnimationController).
