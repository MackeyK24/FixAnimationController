# Unity-Style Animation Controller Documentation

A comprehensive guide to the TOOLKIT.AnimationController implementation for Babylon.js.

## Overview

The TOOLKIT.AnimationController provides a high-performance implementation of Unity's Mechanim animation system for Babylon.js. It uses timestamp-based animation sampling instead of direct playback for smooth transitions and efficient performance.

## Installation

```bash
npm install babylonjs
```

## Basic Setup

```typescript
import * as BABYLON from 'babylonjs';
import { TOOLKIT } from './TOOLKIT.AnimationController';

// Create scene and character
const scene = new BABYLON.Scene(engine);
const rootTransform = character.meshes[0];

// Initialize controller
const controller = new TOOLKIT.AnimationController(rootTransform);

// Initialize with machine data and animation groups
controller.initialize(machineData, animationGroups);

// Add to render loop
scene.onBeforeRenderObservable.add(() => {
    controller.update(scene.getEngine().getDeltaTime() / 1000);
});
```

## Core Features

### Animation Sampling System

Instead of starting and stopping animations directly, the controller samples animation clips at specific timestamps:

```typescript
class AnimationController {
    private sampleAnimation(
        animationGroup: BABYLON.AnimationGroup,
        normalizedTime: number,
        weight: number
    ): void {
        // Calculate the actual frame time
        const frameTime = normalizedTime * animationGroup.to;
        
        // Sample all animations at the specific timestamp
        for (const targetAnimation of animationGroup.targetedAnimations) {
            const animation = targetAnimation.animation;
            const target = targetAnimation.target;
            
            // Sample the animation at the specific frame
            animation.evaluate(frameTime).applyToTarget(
                target,
                weight
            );
        }
    }
}
```

### Loop Mode and Blend

When LOOP MODE is enabled with LOOPBLEND flag, the controller smoothly blends between loop cycles:

```typescript
// Example machine.json configuration
{
    "states": {
        "Walk": {
            "motion": "WalkAnimation",
            "loop": true,
            "loopBlend": true
        }
    }
}

// Implementation handles loop blending
private handleLoopBlending(
    normalizedTime: number,
    animation: BABYLON.AnimationGroup,
    weight: number
): void {
    const cycleTime = normalizedTime % 1;
    const nextCycleTime = (cycleTime + 0.1) % 1;
    
    // Blend between current and next cycle
    this.sampleAnimation(animation, cycleTime, weight);
    this.sampleAnimation(animation, nextCycleTime, 0.1 * weight);
}
```

### Blend Trees

The controller supports multiple blend tree types:

1. Simple 1D
2. 2D Freeform Directional
3. 2D Freeform Cartesian

Example machine.json configuration:
```json
{
    "blendTree": {
        "blendType": "Simple1D",
        "blendParameter": "Speed",
        "children": [
            {
                "motion": "Idle",
                "threshold": 0
            },
            {
                "motion": "Walk",
                "threshold": 0.5
            },
            {
                "motion": "Run",
                "threshold": 1
            }
        ]
    }
}
```

### Animation Layers

Support for multiple animation layers with avatar masks:

```typescript
// Example machine.json layer configuration
{
    "layers": [
        {
            "name": "Base Layer",
            "defaultWeight": 1.0,
            "avatarMask": null
        },
        {
            "name": "Upper Body",
            "defaultWeight": 1.0,
            "avatarMask": {
                "transformPaths": [
                    "Spine",
                    "LeftArm",
                    "RightArm"
                ]
            }
        }
    ]
}
```

The avatar mask system allows targeting specific bones for blending:

```typescript
class AnimationLayer {
    private applyAvatarMask(
        target: BABYLON.TransformNode,
        weight: number
    ): void {
        if (!this.avatarMask) {
            return true; // Apply to all bones
        }
        
        // Check if the bone is in the mask
        return this.avatarMask.transformPaths.some(
            path => target.name.startsWith(path)
        );
    }
}
```

### Transitions

Support for all Unity-style transitions, including ANY state transitions:

```typescript
// Example machine.json transition configuration
{
    "transitions": [
        {
            "from": "Any",
            "to": "Fall",
            "conditions": [
                {
                    "parameter": "IsGrounded",
                    "mode": "Equals",
                    "threshold": 0
                }
            ],
            "duration": 0.25,
            "offset": 0
        }
    ]
}
```

### Root Motion

Extract and apply root motion from animations:

```typescript
class AnimationController {
    private extractRootMotion(
        animation: BABYLON.AnimationGroup,
        previousTime: number,
        currentTime: number
    ): void {
        if (!this.enableRootMotion) return;
        
        
        const rootBone = this.rootTransform;
        const deltaPosition = this.calculatePositionDelta(
            animation,
            previousTime,
            currentTime
        );
        
        // Apply extracted motion to root transform
        rootBone.position.addInPlace(deltaPosition);
    }
}
```

### Empty States

Support for states without defined motion:

```typescript
// Example machine.json empty state configuration
{
    "states": {
        "Empty": {
            "motion": null
        }
    }
}
```

## Machine.json Structure

The animation controller is configured using a machine.json file:

```typescript
interface MachineData {
    layers: {
        name: string;
        defaultWeight: number;
        avatarMask?: {
            transformPaths: string[];
        };
        stateMachine: {
            states: {
                [name: string]: {
                    motion?: string;
                    loop?: boolean;
                    loopBlend?: boolean;
                    blendTree?: BlendTreeData;
                };
            };
            transitions: TransitionData[];
        };
    }[];
}
```

## Complete Usage Example

```typescript
import * as BABYLON from 'babylonjs';
import { TOOLKIT } from './TOOLKIT.AnimationController';

// Create scene and load character
const scene = new BABYLON.Scene(engine);
const character = await BABYLON.SceneLoader.ImportMeshAsync(
    "",
    "models/",
    "character.glb",
    scene
);
const rootTransform = character.meshes[0];

// Load animations
const idleAnim = new BABYLON.AnimationGroup("Idle", scene);
const walkAnim = new BABYLON.AnimationGroup("Walk", scene);
const runAnim = new BABYLON.AnimationGroup("Run", scene);

// Create controller with root motion enabled
const controller = new TOOLKIT.AnimationController(
    rootTransform,
    { enableRootMotion: true }
);

// Load and parse machine.json
const response = await fetch('machine.json');
const machineData = await response.json();

// Initialize controller
controller.initialize(machineData, [
    idleAnim,
    walkAnim,
    runAnim
]);

// Set up parameters
controller.setParameter("Speed", 0);
controller.setParameter("IsGrounded", true);

// Add to render loop
scene.onBeforeRenderObservable.add(() => {
    // Update speed based on input
    const speed = getInputSpeed(); // Your input handling
    controller.setParameter("Speed", speed);
    
    // Update controller
    controller.update(scene.getEngine().getDeltaTime() / 1000);
});

// Explicitly set state
controller.setState("Run");
```

## Performance Considerations

1. Timestamp-based sampling instead of starting/stopping animations
2. Efficient blend tree calculations
3. Optimized transition handling
4. Minimal object allocation during updates
5. Smart caching of animation frame data

## Troubleshooting

Common issues and solutions:

1. **Jerky Transitions**
   - Enable loopBlend for looping animations
   - Ensure transition durations are appropriate

2. **Root Motion Issues**
   - Verify root bone hierarchy
   - Check enableRootMotion option
   - Ensure animations contain root motion data

3. **Blend Tree Problems**
   - Verify parameter ranges
   - Check threshold values
   - Ensure motions are properly assigned

4. **Layer Masking**
   - Confirm transform paths match skeleton
   - Check layer weights
   - Verify avatar mask configuration

## API Reference

### TOOLKIT.AnimationController

```typescript
class AnimationController {
    constructor(
        rootTransform: BABYLON.TransformNode,
        options?: {
            enableRootMotion?: boolean;
        }
    );

    // Initialize with machine data and animation groups
    initialize(
        machineData: any,
        animationGroups: BABYLON.AnimationGroup[]
    ): void;

    // Update animation state
    update(deltaTime: number): void;

    // Set current state by name
    setState(stateName: string): void;

    // Parameter management
    setParameter(name: string, value: number | boolean): void;
    getParameter(name: string): number | boolean;
}
```

## Best Practices

1. **Animation Organization**
   - Keep animations properly named
   - Use consistent naming conventions
   - Organize states logically

2. **Performance**
   - Use appropriate transition durations
   - Optimize avatar masks
   - Monitor frame times

3. **State Machine Design**
   - Plan transitions carefully
   - Use ANY state transitions sparingly
   - Keep blend trees simple

4. **Layer Management**
   - Use meaningful layer names
   - Keep avatar masks focused
   - Set appropriate layer weights
