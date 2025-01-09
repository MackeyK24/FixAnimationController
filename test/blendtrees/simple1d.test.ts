import { TOOLKIT } from '../../TOOLKIT.AnimationController';
const { AnimationController } = TOOLKIT;
import * as BABYLON from 'babylonjs';

describe('Simple1D Blend Tree', () => {
    let engine: BABYLON.Engine;
    let scene: BABYLON.Scene;
    let controller: TOOLKIT.AnimationController;
    
    beforeEach(() => {
        engine = new BABYLON.Engine(null as any);
        scene = new BABYLON.Scene(engine);
        controller = new AnimationController(scene);
    });
    
    describe('Simple1D Blend Tree', () => {
        let walkAnimation: BABYLON.AnimationGroup;
        let runAnimation: BABYLON.AnimationGroup;
        let sprintAnimation: BABYLON.AnimationGroup;
        
        beforeEach(() => {
            // Create test animations with mock transforms
            const boneTransform = new BABYLON.TransformNode('root');
            
            walkAnimation = new BABYLON.AnimationGroup('walk');
            const walkAnim = new BABYLON.Animation('walk', 'position', 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
            walkAnim.setKeys([
                { frame: 0, value: new BABYLON.Vector3(0, 0, 0) },
                { frame: 30, value: new BABYLON.Vector3(0, 0, 1) }
            ]);
            walkAnimation.addTargetedAnimation(walkAnim, boneTransform);
            
            runAnimation = new BABYLON.AnimationGroup('run');
            const runAnim = new BABYLON.Animation('run', 'position', 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
            runAnim.setKeys([
                { frame: 0, value: new BABYLON.Vector3(0, 0, 0) },
                { frame: 30, value: new BABYLON.Vector3(0, 0, 2) }
            ]);
            runAnimation.addTargetedAnimation(runAnim, boneTransform);
            
            sprintAnimation = new BABYLON.AnimationGroup('sprint');
            const sprintAnim = new BABYLON.Animation('sprint', 'position', 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
            sprintAnim.setKeys([
                { frame: 0, value: new BABYLON.Vector3(0, 0, 0) },
                { frame: 30, value: new BABYLON.Vector3(0, 0, 4) }
            ]);
            sprintAnimation.addTargetedAnimation(sprintAnim, boneTransform);
            
            // Initialize controller with blend tree data
            const machineData = {
                parameters: {
                    Speed: { type: TOOLKIT.AnimatorParameterType.Float, defaultValue: 0 }
                },
                layers: [{
                    name: 'Base Layer',
                    index: 0,
                    defaultWeight: 1,
                    animationStateMachine: {
                        name: 'Locomotion',
                        type: TOOLKIT.MotionType.Tree,
                        blendtree: {
                            blendType: TOOLKIT.BlendTreeType.Simple1D,
                            blendParameterX: 'Speed',
                            children: [
                                { motion: 'walk', threshold: 0, type: TOOLKIT.MotionType.Clip },
                                { motion: 'run', threshold: 1, type: TOOLKIT.MotionType.Clip },
                                { motion: 'sprint', threshold: 2, type: TOOLKIT.MotionType.Clip }
                            ]
                        }
                    }
                }]
            };
            
            controller.initialize(machineData, [walkAnimation, runAnimation, sprintAnimation]);
        });
        
        test('should blend between animations based on speed parameter', () => {
            // Test walk to run blend
            controller.setParameter('Speed', 0.5);
            controller.update();
            let state = (controller as any).currentStates.get(0);
            expect(state.blendtree.children[0].weight).toBeCloseTo(0.5);
            expect(state.blendtree.children[1].weight).toBeCloseTo(0.5);
            
            // Test run to sprint blend
            controller.setParameter('Speed', 1.5);
            controller.update();
            state = (controller as any).currentStates.get(0);
            expect(state.blendtree.children[1].weight).toBeCloseTo(0.5);
            expect(state.blendtree.children[2].weight).toBeCloseTo(0.5);
        });
        
        test('should smoothly interpolate between animations', () => {
            const positions: BABYLON.Vector3[] = [];
            
            // Gradually increase speed and capture positions
            for (let speed = 0; speed <= 2; speed += 0.2) {
                controller.setParameter('Speed', speed);
                controller.update();
                positions.push(new BABYLON.Vector3(0, 0, 0)); // Store interpolated position
            }
            
            // Verify smooth progression
            for (let i = 1; i < positions.length; i++) {
                const delta = positions[i].z - positions[i-1].z;
                expect(delta).toBeGreaterThan(0); // Should always progress forward
                if (i > 1) {
                    const prevDelta = positions[i-1].z - positions[i-2].z;
                    const deltaDiff = Math.abs(delta - prevDelta);
                    expect(deltaDiff).toBeLessThan(0.1); // Changes should be smooth
                }
            }
        });
    });

    describe('Performance and Stuttering Tests', () => {
        let character: BABYLON.TransformNode;
        let walkAnim: BABYLON.AnimationGroup;
        let runAnim: BABYLON.AnimationGroup;
        
        beforeEach(() => {
            character = new BABYLON.TransformNode('character');
            
            // Create animations
            walkAnim = new BABYLON.AnimationGroup('walk');
            const walkPos = new BABYLON.Animation('walkPos', 'position', 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
            const walkRot = new BABYLON.Animation('walkRot', 'rotationQuaternion', 60, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            
            // Create 60 keyframes for smooth animation
            for (let i = 0; i <= 60; i++) {
                const phase = (i / 60) * Math.PI * 2;
                walkPos.setKeys([...walkPos.getKeys(), {
                    frame: i,
                    value: new BABYLON.Vector3(
                        Math.sin(phase) * 0.1,
                        Math.abs(Math.sin(phase * 2)) * 0.05,
                        i / 60
                    )
                }]);
                walkRot.setKeys([...walkRot.getKeys(), {
                    frame: i,
                    value: BABYLON.Quaternion.RotationYawPitchRoll(
                        Math.sin(phase) * 0.1,
                        Math.sin(phase * 2) * 0.05,
                        Math.sin(phase * 4) * 0.02
                    )
                }]);
            }
            walkAnim.addTargetedAnimation(walkPos, character);
            walkAnim.addTargetedAnimation(walkRot, character);
            
            // Create run animation (faster and more pronounced)
            runAnim = new BABYLON.AnimationGroup('run');
            const runPos = new BABYLON.Animation('runPos', 'position', 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3);
            const runRot = new BABYLON.Animation('runRot', 'rotationQuaternion', 60, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            
            for (let i = 0; i <= 60; i++) {
                const phase = (i / 60) * Math.PI * 2;
                runPos.setKeys([...runPos.getKeys(), {
                    frame: i,
                    value: new BABYLON.Vector3(
                        Math.sin(phase) * 0.2,
                        Math.abs(Math.sin(phase * 2)) * 0.1,
                        (i / 60) * 2
                    )
                }]);
                runRot.setKeys([...runRot.getKeys(), {
                    frame: i,
                    value: BABYLON.Quaternion.RotationYawPitchRoll(
                        Math.sin(phase) * 0.2,
                        Math.sin(phase * 2) * 0.1,
                        Math.sin(phase * 4) * 0.04
                    )
                }]);
            }
            runAnim.addTargetedAnimation(runPos, character);
            runAnim.addTargetedAnimation(runRot, character);
            
            // Initialize controller
            const machineData = {
                parameters: {
                    Speed: { type: TOOLKIT.AnimatorParameterType.Float, defaultValue: 0 }
                },
                layers: [{
                    name: 'Base Layer',
                    index: 0,
                    defaultWeight: 1,
                    animationStateMachine: {
                        name: 'Locomotion',
                        type: TOOLKIT.MotionType.Tree,
                        blendtree: {
                            blendType: TOOLKIT.BlendTreeType.Simple1D,
                            blendParameterX: 'Speed',
                            children: [
                                { motion: 'walk', threshold: 0, type: TOOLKIT.MotionType.Clip },
                                { motion: 'run', threshold: 1, type: TOOLKIT.MotionType.Clip }
                            ]
                        }
                    }
                }]
            };
            
            controller.initialize(machineData, [walkAnim, runAnim]);
        });
        
        test('should maintain smooth transitions under rapid parameter changes', () => {
            interface FrameData {
                time: number;
                position: BABYLON.Vector3;
                rotation: BABYLON.Quaternion;
                speed: number;
            }
            
            const frames: FrameData[] = [];
            const duration = 1000; // Test for 1 second
            const startTime = performance.now();
            let lastTime = startTime;
            
            // Simulate rapid parameter changes
            while (performance.now() - startTime < duration) {
                const currentTime = performance.now();
                // Calculate frame time for performance monitoring
                const frameTime = currentTime - lastTime;
                expect(frameTime).toBeLessThan(16.67); // Ensure 60fps performance
                lastTime = currentTime;
                
                // Oscillate speed parameter
                const time = (currentTime - startTime) / 1000;
                const speed = Math.sin(time * Math.PI * 4) * 0.5 + 0.5; // Oscillate between 0 and 1
                
                controller.setParameter('Speed', speed);
                controller.update();
                
                frames.push({
                    time: currentTime,
                    position: character.position.clone(),
                    rotation: character.rotationQuaternion?.clone() || new BABYLON.Quaternion(),
                    speed
                });
            }
            
            // Analyze frame data
            for (let i = 1; i < frames.length; i++) {
                const prevFrame = frames[i - 1];
                const currFrame = frames[i];
                
                // Check frame timing
                const frameDelta = currFrame.time - prevFrame.time;
                expect(frameDelta).toBeLessThan(16.67); // Should maintain 60fps
                
                // Verify position interpolation
                const posDelta = currFrame.position.subtract(prevFrame.position);
                const posSpeed = posDelta.length() / frameDelta;
                expect(posSpeed).toBeLessThan(0.1); // Position changes should be small
                
                // Verify rotation interpolation
                const rotDelta = BABYLON.Quaternion.Dot(prevFrame.rotation, currFrame.rotation);
                expect(Math.abs(1 - rotDelta)).toBeLessThan(0.1); // Rotation changes should be small
            }
        });
        
        test('should handle rapid weight changes without stuttering', () => {
            const iterations = 1000;
            const frameTimes: number[] = [];
            const positionDeltas: number[] = [];
            
            let lastTime = performance.now();
            let lastPos = character.position.clone();
            
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                const deltaTime = startTime - lastTime;
                lastTime = startTime;
                
                // Rapidly change blend weights
                controller.setParameter('Speed', Math.random());
                controller.update();
                
                // Record frame time
                frameTimes.push(performance.now() - startTime);
                
                // Record position delta
                const posDelta = character.position.subtract(lastPos).length();
                positionDeltas.push(posDelta / deltaTime);
                lastPos = character.position.clone();
            }
            
            // Analyze performance metrics
            const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
            const maxFrameTime = Math.max(...frameTimes);
            const frameTimeVariance = frameTimes.reduce((acc, time) => 
                acc + Math.pow(time - avgFrameTime, 2), 0) / frameTimes.length;
            
            // Analyze motion smoothness
            const avgDelta = positionDeltas.reduce((a, b) => a + b) / positionDeltas.length;
            const deltaVariance = positionDeltas.reduce((acc, delta) => 
                acc + Math.pow(delta - avgDelta, 2), 0) / positionDeltas.length;
            
            // Performance requirements
            expect(avgFrameTime).toBeLessThan(1); // Average frame time under 1ms
            expect(maxFrameTime).toBeLessThan(16.67); // No frame spikes over 60fps threshold
            expect(Math.sqrt(frameTimeVariance)).toBeLessThan(0.5); // Low frame time variance
            
            // Smoothness requirements
            expect(Math.sqrt(deltaVariance)).toBeLessThan(0.05); // Low position delta variance
        });
    });
});
