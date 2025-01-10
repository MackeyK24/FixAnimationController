# Unity-Style Animation Controller for Babylon.js

A comprehensive animation controller system that mimics Unity's Mechanim Animation System for Babylon.js, providing support for blend trees, layers, and root motion.

## Installation

```bash
npm install babylonjs
```

## Basic Usage

```typescript
import * as BABYLON from 'babylonjs';

// Initialize controller with machine.json data and animation groups
const controller = new TOOLKIT.AnimationController(
    machineData,           // Parsed machine.json object
    animationGroups,       // Array of BABYLON.AnimationGroup
    optionalRootBone       // Optional: BABYLON.TransformNode for root motion
);

// Update in render loop
scene.onBeforeRenderObservable.add(() => {
    controller.update(scene.getEngine().getDeltaTime());
});

// Set animation parameters
controller.setFloat("Speed", 1.0);
controller.setBool("IsJumping", true);
controller.setInteger("State", 2);
controller.setTrigger("Attack");

// Explicitly set state
controller.setState("Run");
```

## Features

### 1. State Machine
- Supports multiple animation states
- Smooth transitions between states
- ANY state transitions
- EMPTY states (no motion)

```typescript
// Set state with optional layer index
controller.setState("Run", 0);  // Layer 0 (default)
controller.setState("Jump", 1); // Layer 1
```

### 2. Blend Trees
Supports four types of blend trees:
1. Simple 1D
2. Simple 2D Directional
3. Freeform 2D Directional
4. Freeform 2D Cartesian

```typescript
// Example machine.json blend tree configuration
{
    "blendType": 1,           // 1D blend tree
    "blendParameterX": "Speed",
    "children": [
        {
            "motion": "Walk",
            "threshold": 0
        },
        {
            "motion": "Run",
            "threshold": 1
        }
    ]
}
```

### 3. Animation Layers
Support for multiple animation layers with avatar masks:

```typescript
// Example machine.json layer configuration
{
    "layers": [
        {
            "name": "Base",
            "defaultWeight": 1.0,
            "defaultState": "Idle"
        },
        {
            "name": "UpperBody",
            "defaultWeight": 1.0,
            "avatarMask": {
                "Spine": 1,
                "LeftArm": 1,
                "RightArm": 1
            }
        }
    ]
}
```

### 4. Root Motion
Optional root motion extraction from animations:

```typescript
// Enable root motion
controller.applyRootMotion = true;

// Set root bone (optional)
controller.setRootBone(characterRootBone);
```

### 5. Animation Parameters
Four types of parameters supported:
- Float
- Integer
- Boolean
- Trigger

```typescript
// Parameter manipulation
controller.setFloat("Speed", 1.0);
controller.setBool("IsJumping", true);
controller.setInteger("State", 2);
controller.setTrigger("Attack");
controller.resetTrigger("Attack");

// Parameter getters
const speed = controller.getFloat("Speed");
const isJumping = controller.getBool("IsJumping");
const state = controller.getInteger("State");
```

## Machine Configuration

The `machine.json` file defines the animation state machine structure:

```json
{
    "parameters": [
        {
            "name": "Speed",
            "type": 1,
            "defaultFloat": 0
        },
        {
            "name": "IsJumping",
            "type": 3,
            "defaultBool": false
        }
    ],
    "layers": [
        {
            "name": "Base",
            "defaultWeight": 1.0,
            "defaultState": "Idle",
            "stateMachine": {
                "states": [
                    {
                        "name": "Idle",
                        "motion": "idle_anim",
                        "loop": true,
                        "transitions": [
                            {
                                "destination": "Walk",
                                "conditions": [
                                    {
                                        "parameter": "Speed",
                                        "mode": 1,
                                        "threshold": 0.1
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "name": "Walk",
                        "blendtree": {
                            "blendType": 1,
                            "blendParameterX": "Speed",
                            "children": [
                                {
                                    "motion": "walk_slow",
                                    "threshold": 0.5
                                },
                                {
                                    "motion": "walk_fast",
                                    "threshold": 1.0
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]
}
```

## Performance Considerations

1. Animation Sampling
- Uses efficient matrix operations
- Samples animations at specific timestamps
- Smooth interpolation between keyframes

2. Blend Trees
- Optimized weight calculations
- Efficient barycentric coordinates for 2D blending
- Cached calculations where possible

3. Layer System
- Efficient avatar mask checking
- Optimized transform blending
- Minimal object creation

## Best Practices

1. State Organization
- Keep state machine structure simple
- Use meaningful state names
- Group related states together

2. Blend Trees
- Use appropriate blend tree type for your needs
- Keep number of blend states reasonable
- Ensure proper parameter ranges

3. Layers
- Use layers for independent body parts
- Keep avatar masks focused
- Balance between complexity and performance

4. Root Motion
- Enable only when needed
- Provide root bone for accurate motion
- Consider performance impact

## Troubleshooting

1. Animation Not Playing
- Check if state name exists
- Verify animation group is properly loaded
- Ensure parameters meet transition conditions

2. Blend Tree Issues
- Verify parameter values are in range
- Check blend tree type is appropriate
- Confirm motion clips are assigned

3. Layer Problems
- Verify avatar mask configuration
- Check layer weights
- Ensure proper bone targeting

4. Root Motion
- Verify root bone is assigned
- Check animation has root motion data
- Ensure proper coordinate space

## API Reference

### AnimationController

```typescript
class AnimationController {
    // Constructor
    constructor(
        machine: any,                          // Parsed machine.json
        animationGroups: BABYLON.AnimationGroup[], // Animation clips
        rootBone?: BABYLON.TransformNode       // Optional root bone
    );

    // Core methods
    update(deltaTime: number): void;
    setState(stateName: string, layerIndex?: number): void;

    // Parameter methods
    setFloat(name: string, value: number): void;
    setBool(name: string, value: boolean): void;
    setInteger(name: string, value: number): void;
    setTrigger(name: string): void;
    resetTrigger(name: string): void;
    getFloat(name: string): number;
    getBool(name: string): boolean;
    getInteger(name: string): number;

    // Properties
    speedRatio: number;        // Animation speed multiplier
    applyRootMotion: boolean;  // Enable/disable root motion
}
```
