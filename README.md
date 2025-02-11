# REPO

https://github.com/MackeyK24/FixAnimationController/


# GOALS

Using Babylon.js, please create a system similar to Unity's Animator Controller using Blend Trees
the `AnimationState.ts` script is an existing implementation I previously created to Mimic
Unity's Animation Controller functionallity for Babylon.js. It uses the `babylon.toolkit.d.ts`
runtime library that provides Unity-Like functionallity for babylon.js. It works, but it is
CPU intensive and stutters a bit when using blend trees but I think lerping the weights should
smooth that out.

The `machine.json` is an export of the the Unity Animator Component. All other properties like `states` and `layers` are children of the `machine`
data object. My existing script uses the json to re-implement `animtation state` in babylonjs, including all forms of transitions.

Please create a new TOOLKIT.AnimationController.ts script to replace the existing script at https://github.com/MackeyK24/FixAnimationController/blob/master/AnimationState.ts
The new script should be created from scratch and must fully implement a Unity Style Animation controller inluding complete transition support with blending speeds, dynamic animation sampling to implement blend trees, layers with avatar masks and root motion. All information needed is defined in required and already parsed `machine.json` object (the machine only property) and should be passed to the initialization function along with the an animationGroup[] that are the actual animation clips to sample and the root bone transform to support extracting root motion.

Please use the UMD vserion of Babylon.js
```
npm install babylonjs
```

This will allow you to import BabylonJS entirely using:
```
import * as BABYLON from 'babylonjs';
```

# INSTRUCTIONS

1... Create a Unity-style Animation Controller state machine with support for Blend Trees in BabylonJS by sampling active animation clips at specific timestamps instead of starting and stopping animations directly. This approach should give smooth and seamless transitions while avoiding choppy behavior. Instead of playing or stopping animations, we sample the animation clip at athe given time.

2... The update loop MUST handle checking and applying transitions, and processing the blend trees. We MUST mimic the Unity Mechanim Animation system.

3... MUST support LOOP MODE when sampling animations. When LOOPING is enable and the LOOPBLEND flag is enabled, we must smoothly blend the end and start of looping animation to make is as seamless as posible.

4... MUST support all types of Unity-style trasitions, like ANY.

5... MUST support layers to apply animation clips to just specific parts of the body in BabylonJS by targeting specific bones for blending, much like Unity's animation layers with avatar masks. 

6... If Extrat Root Motion Option enabled, Extract the root motion from the root bone (or the character's transform) in an animation and applying it directly to the character's global transform. This allows the animation to control the character's movement instead of relying solely on physics or scripts.

7... The root bone should be optional for the root motion only. The rest of the animation should work fine if no root bone is specified

8... MUST support EMPTY states that dont have a `motion` defined in the the data object. The EMPTY state simply does nothing, does NOT update the animatable or anything while in the EMPTY state.

8... There should be a 'play' or setState function to explicitly set the current state by its state name.

9... To use the script all I should have to do is initialize with animation groups and the already parsed `machine.json` object and tick its update function in the render loop. The new Animation Controller should handle EVERYTHING. 

10... Do not OVER create classes to deal with metadata.

11... Use my existing `AnimationState.ts` as a guide because it works (Except 2D blendtrees are a bit choppy and avatar masks are not working for each layer)

12... PLEASE CREATE ALL CODE, NEVER LEAVE UN-IMPLEMENTED FUNCTIONS


Please evaluate my existing `AnimationState.ts` and `machine.json` file from the repo to understand the structure of the machine property.

# IMPORTANT

KEEP IT SIMPLE, DONT WAST ACU AND TIME WITH TEST

FOCUS ON SAMPLING THE ANIMATION CLIPS, BLENDING THE VALUES FROM LAYERS USING AVATAR MASK

All the information you need is in the `machine.json` machine object which is currently working using my legacy TOOLKIT.AnimationState class. It just has performance issues, hence us making a new TOOLKIT.AnimationController from scratch to fix those issues.

# DOCUMENTATION

Be sure to create and update the Documentaion.md with complete details and usage examples.
