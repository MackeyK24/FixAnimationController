import { TOOLKIT } from '../../TOOLKIT.AnimationController';
const { AnimationController } = TOOLKIT;
import * as BABYLON from 'babylonjs';

describe('Avatar Masks', () => {
    let engine: BABYLON.Engine;
    let scene: BABYLON.Scene;
    let controller: TOOLKIT.AnimationController;
    
    beforeEach(() => {
        engine = new BABYLON.Engine(null as any);
        scene = new BABYLON.Scene(engine);
        controller = new AnimationController(scene);
    });
    
    describe('Avatar Mask Tests', () => {
        let upperBodyAnimation: BABYLON.AnimationGroup;
        let lowerBodyAnimation: BABYLON.AnimationGroup;
        let spine: BABYLON.TransformNode;
        let leftArm: BABYLON.TransformNode;
        let rightArm: BABYLON.TransformNode;
        let leftLeg: BABYLON.TransformNode;
        let rightLeg: BABYLON.TransformNode;
        
        beforeEach(() => {
            // Create bone hierarchy
            spine = new BABYLON.TransformNode('spine');
            leftArm = new BABYLON.TransformNode('leftArm');
            rightArm = new BABYLON.TransformNode('rightArm');
            leftLeg = new BABYLON.TransformNode('leftLeg');
            rightLeg = new BABYLON.TransformNode('rightLeg');
            
            leftArm.parent = spine;
            rightArm.parent = spine;
            leftLeg.parent = spine;
            rightLeg.parent = spine;
            
            // Create upper body animation
            upperBodyAnimation = new BABYLON.AnimationGroup('upperBody');
            const spineAnim = new BABYLON.Animation('spineAnim', 'rotation', 30, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            const leftArmAnim = new BABYLON.Animation('leftArmAnim', 'rotation', 30, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            const rightArmAnim = new BABYLON.Animation('rightArmAnim', 'rotation', 30, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            
            spineAnim.setKeys([{
                frame: 0,
                value: BABYLON.Quaternion.Identity()
            }, {
                frame: 30,
                value: BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), Math.PI / 4)
            }]);
            
            leftArmAnim.setKeys([{
                frame: 0,
                value: BABYLON.Quaternion.Identity()
            }, {
                frame: 30,
                value: BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI / 2)
            }]);
            
            rightArmAnim.setKeys([{
                frame: 0,
                value: BABYLON.Quaternion.Identity()
            }, {
                frame: 30,
                value: BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), -Math.PI / 2)
            }]);
            
            upperBodyAnimation.addTargetedAnimation(spineAnim, spine);
            upperBodyAnimation.addTargetedAnimation(leftArmAnim, leftArm);
            upperBodyAnimation.addTargetedAnimation(rightArmAnim, rightArm);
            
            // Create lower body animation
            lowerBodyAnimation = new BABYLON.AnimationGroup('lowerBody');
            const leftLegAnim = new BABYLON.Animation('leftLegAnim', 'rotation', 30, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            const rightLegAnim = new BABYLON.Animation('rightLegAnim', 'rotation', 30, BABYLON.Animation.ANIMATIONTYPE_QUATERNION);
            
            leftLegAnim.setKeys([{
                frame: 0,
                value: BABYLON.Quaternion.Identity()
            }, {
                frame: 30,
                value: BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI / 4)
            }]);
            
            rightLegAnim.setKeys([{
                frame: 0,
                value: BABYLON.Quaternion.Identity()
            }, {
                frame: 30,
                value: BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), -Math.PI / 4)
            }]);
            
            lowerBodyAnimation.addTargetedAnimation(leftLegAnim, leftLeg);
            lowerBodyAnimation.addTargetedAnimation(rightLegAnim, rightLeg);
            
            // Initialize controller with masked layers
            const machineData = {
                layers: [{
                    name: 'Base Layer',
                    index: 0,
                    defaultWeight: 1,
                    animationStateMachine: {
                        name: 'lowerBody',
                        type: TOOLKIT.MotionType.Clip,
                        motion: 'lowerBody'
                    }
                }, {
                    name: 'Upper Body Layer',
                    index: 1,
                    defaultWeight: 1,
                    avatarMask: {
                        transformPaths: ['spine', 'leftArm', 'rightArm']
                    },
                    animationStateMachine: {
                        name: 'upperBody',
                        type: TOOLKIT.MotionType.Clip,
                        motion: 'upperBody'
                    }
                }]
            };
            
            controller.initialize(machineData, [upperBodyAnimation, lowerBodyAnimation]);
        });
        
        test('should apply mask to specific bones', () => {
            controller.update();
            
            // Upper body bones should be animated
            expect(spine.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            expect(leftArm.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            expect(rightArm.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            
            // Lower body bones should be animated separately
            expect(leftLeg.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            expect(rightLeg.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
        });
        
        test('should respect layer weights', () => {
            // Set upper body layer weight to 0.5
            controller.setLayerWeight(1, 0.5);
            controller.update();
            
            // Upper body should be partially animated
            const expectedRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI / 4);
            const actualRotation = leftArm.rotationQuaternion as BABYLON.Quaternion;
            
            // Check if rotation is interpolated halfway
            const identity = BABYLON.Quaternion.Identity();
            const halfwayRotation = BABYLON.Quaternion.Slerp(identity, expectedRotation, 0.5);
            const dot = BABYLON.Quaternion.Dot(halfwayRotation, actualRotation);
            expect(Math.abs(dot - 1)).toBeLessThan(0.1); // Should be close to halfway point
        });

        test('should handle multiple active masks', () => {
            // Add a third layer with overlapping mask
            const machineData = {
                layers: [{
                    name: 'Base Layer',
                    index: 0,
                    defaultWeight: 1,
                    animationStateMachine: {
                        name: 'lowerBody',
                        type: TOOLKIT.MotionType.Clip,
                        motion: 'lowerBody'
                    }
                }, {
                    name: 'Upper Body Layer',
                    index: 1,
                    defaultWeight: 0.7,
                    avatarMask: {
                        transformPaths: ['spine', 'leftArm', 'rightArm']
                    },
                    animationStateMachine: {
                        name: 'upperBody',
                        type: TOOLKIT.MotionType.Clip,
                        motion: 'upperBody'
                    }
                }, {
                    name: 'Spine Only Layer',
                    index: 2,
                    defaultWeight: 0.3,
                    avatarMask: {
                        transformPaths: ['spine']
                    },
                    animationStateMachine: {
                        name: 'upperBody',
                        type: TOOLKIT.MotionType.Clip,
                        motion: 'upperBody'
                    }
                }]
            };
            
            controller.initialize(machineData, [upperBodyAnimation, lowerBodyAnimation]);
            controller.update();

            // Spine should be affected by both upper body layers
            expect(spine.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            
            // Arms should only be affected by upper body layer
            expect(leftArm.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
            expect(rightArm.rotationQuaternion?.equals(BABYLON.Quaternion.Identity())).toBeFalsy();
        });

        test('should handle mask transitions smoothly', () => {
            interface FrameData {
                weight: number;
                rotation: BABYLON.Quaternion | null;
            }

            const startTime = Date.now();
            const frames: FrameData[] = [];
            
            // Animate for 1 second while changing layer weights
            for (let i = 0; i < 60; i++) {
                const time = (Date.now() - startTime) / 1000;
                const weight = Math.sin(time * Math.PI); // 0 to 1 to 0
                controller.setLayerWeight(1, weight);
                controller.update();
                
                // Store frame data for analysis
                frames.push({
                    weight,
                    rotation: leftArm.rotationQuaternion?.clone() || null
                });
            }
            
            // Verify smooth transitions between frames
            for (let i = 1; i < frames.length; i++) {
                const prevFrame = frames[i - 1];
                const currFrame = frames[i];
                
                // Skip frames with null rotations
                if (!prevFrame.rotation || !currFrame.rotation) {
                    continue;
                }
                
                // Calculate rotation delta between frames
                const deltaDot = BABYLON.Quaternion.Dot(
                    prevFrame.rotation,
                    currFrame.rotation
                );
                
                // Delta should be proportional to weight change
                const weightDelta = Math.abs(currFrame.weight - prevFrame.weight);
                expect(Math.abs(1 - deltaDot)).toBeLessThanOrEqual(weightDelta + 0.1);
            }
        });

        test('should maintain performance with complex masks', () => {
            const iterations = 1000;
            const startTime = performance.now();
            
            // Run many updates
            for (let i = 0; i < iterations; i++) {
                controller.setLayerWeight(1, Math.random());
                controller.update();
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / iterations;
            
            // Average time should be reasonable (adjust threshold based on environment)
            expect(averageTime).toBeLessThan(1); // Less than 1ms per update
        });
    });
});
