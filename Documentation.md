# Unity-Style Animation Controller for Babylon.js

A high-performance animation controller implementation for Babylon.js that mimics Unity's Mechanim animation system. This controller supports blend trees, state machines, layers with avatar masks, and root motion extraction.

## Installation

```bash
npm install babylonjs
```

## Basic Usage

```typescript
import * as BABYLON from 'babylonjs';
import { AnimationController } from './src/AnimationController';

// Initialize with animation groups and state machine data
const controller = new AnimationController(
    animationGroups,  // Array of BABYLON.AnimationGroup
    animstateJson,    // Parsed animation state machine data
    rootBone          // Optional: Root bone for root motion
);

// In your render loop
scene.onBeforeRenderObservable.add(() => {
    controller.update(scene.getEngine().getDeltaTime() / 1000);
});

// Explicitly set state
controller.setState("RunState");
```

## Features

### 1. State Machine
- Supports multiple animation states
- Smooth transitions between states
- ANY state transitions
- Empty states (no motion)
- Parameter-driven transitions

```typescript
// Set parameters to trigger transitions
controller.setParameter("Speed", 1.0);
controller.setParameter("IsJumping", true);
```

### 2. Blend Trees
Supports multiple blend types:
- Simple 1D blending
- 2D Simple Directional
- 2D Freeform Directional
- 2D Freeform Cartesian

```typescript
// Blend tree parameters control animation mixing
controller.setParameter("BlendX", 0.5);
controller.setParameter("BlendY", 0.3);
```

### 3. Animation Layers
Support for multiple animation layers with:
- Independent state machines
- Avatar masks for partial body animation
- Additive and override blending
- Layer weight control

```typescript
// Control layer weights
controller.setLayerWeight("UpperBody", 0.7);
```

### 4. Root Motion
Extract and apply root motion from animations:

```typescript
// Enable root motion in initialization
const controller = new AnimationController(
    animationGroups,
    animstateJson,
    rootBone,
    { enableRootMotion: true }
);

// Get extracted root motion
const rootMotion = controller.getRootMotion();
// Apply to character
character.position.addInPlace(rootMotion.position);
character.rotationQuaternion.multiplyInPlace(rootMotion.rotation);
```

### 5. Loop Blending
Smooth loop blending for seamless animation cycles:

```typescript
// Enable loop blending in animstate.json
{
    "states": [{
        "name": "Walk",
        "motion": "walk_animation",
        "loopBlend": true
    }]
}
```

### 6. Non-Bone Transforms
Support for animating non-skeletal objects:

```typescript
// Animate any transform node
const controller = new AnimationController(
    animationGroups,
    animstateJson,
    transformNode
);
```

## Configuration

### Animation State JSON Structure
```json
{
    "layers": [{
        "name": "Base Layer",
        "defaultState": "Idle",
        "states": [{
            "name": "Idle",
            "motion": "idle_anim",
            "transitions": [{
                "toState": "Walk",
                "conditions": [{
                    "parameter": "Speed",
                    "threshold": 0.1,
                    "mode": "Greater"
                }]
            }]
        }],
        "anyStateTransitions": [{
            "toState": "Jump",
            "conditions": [{
                "parameter": "IsJumping",
                "mode": "Equals",
                "value": true
            }]
        }]
    }],
    "parameters": [{
        "name": "Speed",
        "type": "Float",
        "defaultValue": 0
    }]
}
```

### Avatar Masks
```json
{
    "layers": [{
        "name": "UpperBody",
        "avatarMask": {
            "includedBones": [
                "Spine",
                "LeftArm",
                "RightArm"
            ]
        }
    }]
}
```

## Performance Considerations

The controller optimizes performance by:
- Sampling animations at specific timestamps instead of playing/stopping
- Caching animation frame data
- Efficient blend tree calculations
- Smart transition handling
- Optimized matrix operations for root motion

## API Reference

### AnimationController
```typescript
class AnimationController {
    constructor(
        animationGroups: BABYLON.AnimationGroup[],
        stateData: any,
        rootBone?: BABYLON.TransformNode,
        options?: {
            enableRootMotion?: boolean
        }
    );

    update(deltaTime: number): void;
    setState(stateName: string): void;
    setParameter(name: string, value: number | boolean): void;
    setLayerWeight(layerName: string, weight: number): void;
    getRootMotion(): { position: BABYLON.Vector3, rotation: BABYLON.Quaternion };
}
```

## Error Handling

The controller includes comprehensive error checking for:
- Invalid state names
- Missing animations
- Invalid parameters
- Layer configuration issues
- Blend tree setup problems

```typescript
try {
    controller.setState("NonExistentState");
} catch (error) {
    console.error("State machine error:", error);
}
```

## Examples

### Complete Setup Example
```typescript
import * as BABYLON from 'babylonjs';
import { AnimationController } from './src/AnimationController';

class CharacterController {
    private animController: AnimationController;

    constructor(
        scene: BABYLON.Scene,
        character: BABYLON.TransformNode,
        animationGroups: BABYLON.AnimationGroup[]
    ) {
        // Load animation state configuration
        const animstateJson = {
            "layers": [{
                "name": "Base",
                "defaultState": "Idle",
                "states": [{
                    "name": "Idle",
                    "motion": "idle_anim"
                }, {
                    "name": "Walk",
                    "motion": {
                        "type": "BlendTree",
                        "blendType": "Simple1D",
                        "parameter": "Speed",
                        "children": [{
                            "motion": "walk_anim",
                            "threshold": 0.5
                        }, {
                            "motion": "run_anim",
                            "threshold": 1.0
                        }]
                    }
                }]
            }]
        };

        // Initialize controller
        this.animController = new AnimationController(
            animationGroups,
            animstateJson,
            character,
            { enableRootMotion: true }
        );

        // Update in render loop
        scene.onBeforeRenderObservable.add(() => {
            const deltaTime = scene.getEngine().getDeltaTime() / 1000;
            this.animController.update(deltaTime);

            // Apply root motion
            const rootMotion = this.animController.getRootMotion();
            character.position.addInPlace(rootMotion.position);
            character.rotationQuaternion.multiplyInPlace(rootMotion.rotation);
        });
    }

    updateMovement(speed: number): void {
        this.animController.setParameter("Speed", speed);
    }
}
```

## Troubleshooting

Common issues and solutions:

1. Animations not blending smoothly
   - Ensure animation clips have matching bone structures
   - Check parameter values are within expected ranges
   - Verify transition times are appropriate

2. Root motion issues
   - Confirm root bone is correctly specified
   - Check animation root motion data
   - Verify world space transformations

3. Layer mask problems
   - Validate bone names in avatar masks
   - Check layer weights
   - Ensure additive layers are properly configured

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

This project is licensed under the MIT License.
