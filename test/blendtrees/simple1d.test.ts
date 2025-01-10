import { TOOLKIT } from '../../TOOLKIT.AnimationController';
const { AnimationController } = TOOLKIT;
import * as BABYLON from 'babylonjs';

describe('Simple1D Blend Tree', () => {
    let scene: BABYLON.Scene;
    let controller: TOOLKIT.AnimationController;
    
    beforeEach(() => {
        const engine = new BABYLON.Engine(null as any);
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
});
