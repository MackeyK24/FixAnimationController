export { AnimationController } from './AnimationController';
export { Parameter, ParameterType, AnimationFrameCache, RootMotion } from './types';
export { BlendTree, BlendTreeType } from './BlendTree';
export { MachineState } from './MachineState';
export { AnimationLayer } from './AnimationLayer';

// Re-export everything as a namespace
import * as TOOLKIT from './AnimationController';
export default TOOLKIT;
