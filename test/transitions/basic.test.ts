import { TOOLKIT } from '../../TOOLKIT.AnimationController';
const { AnimationController } = TOOLKIT;
import * as BABYLON from 'babylonjs';

describe('Basic State Transitions', () => {
    let engine: BABYLON.Engine;
    let scene: BABYLON.Scene;
    let controller: TOOLKIT.AnimationController;
    
    beforeEach(() => {
        engine = new BABYLON.Engine(null as any);
        scene = new BABYLON.Scene(engine);
        controller = new AnimationController(scene);
    });
    
    describe('Basic State Transitions', () => {
        let idleAnimation: BABYLON.AnimationGroup;
        let runAnimation: BABYLON.AnimationGroup;
        
        beforeEach(() => {
            // Create test animations
            idleAnimation = new BABYLON.AnimationGroup('idle');
            runAnimation = new BABYLON.AnimationGroup('run');
            
            // Initialize controller with test data
            const machineData = {
                parameters: {
                    Speed: { type: TOOLKIT.AnimatorParameterType.Float, defaultValue: 0 }
                },
                layers: [{
                    name: 'Base Layer',
                    index: 0,
                    defaultWeight: 1,
                    animationStateMachine: {
                        name: 'idle',
                        type: TOOLKIT.MotionType.Clip,
                        transitions: [{
                            destination: 'run',
                            duration: 0.25,
                            conditions: [{
                                parameter: 'Speed',
                                threshold: 0.1,
                                mode: TOOLKIT.ConditionMode.Greater
                            }]
                        }]
                    }
                }]
            };
            
            controller.initialize(machineData, [idleAnimation, runAnimation]);
        });
        
        test('should transition from idle to run when speed increases', () => {
            // Initial state should be idle
            expect(controller.getParameter('Speed')).toBe(0);
            
            // Trigger transition
            controller.setParameter('Speed', 1.0);
            
            // Update a few frames
            for (let i = 0; i < 5; i++) {
                controller.update();
            }
            
            // Verify transition occurred
            const currentState = (controller as any).currentStates.get(0);
            expect(currentState.name).toBe('run');
        });
        
        test('should respect transition duration', () => {
            const startTime = BABYLON.Tools.Now;
            
            // Trigger transition
            controller.setParameter('Speed', 1.0);
            
            // Update until transition completes
            while ((controller as any).activeTransitions.get(0)) {
                controller.update();
            }
            
            const duration = (BABYLON.Tools.Now - startTime) / 1000;
            expect(duration).toBeCloseTo(0.25, 1);
        });
    });
});
