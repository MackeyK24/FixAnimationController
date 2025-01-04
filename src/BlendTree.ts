import * as BABYLON from 'babylonjs';
import { AnimationFrameCache, RootMotion, Parameter, ParameterType } from './types';

/**
 * Blend tree types matching Unity's implementation
 */
export enum BlendTreeType {
    Simple1D = 0,
    SimpleDirectional2D = 1,
    FreeformDirectional2D = 2,
    FreeformCartesian2D = 3
}

/**
 * Implements animation blending functionality
 */
export class BlendTree {
    private children: BlendTreeNode[] = [];
    private type: BlendTreeType = BlendTreeType.Simple1D;
    private parameterX: string = '';
    private parameterY: string = '';
    private minThreshold: number = 0;
    private maxThreshold: number = 1;
    private blendCache: Map<string, Float32Array> = new Map();
    private parameters: Map<string, Parameter>;
    private rootMotionEnabled: boolean = false;
    private rootBone: BABYLON.TransformNode | null = null;
    private rootMotion: RootMotion = {
        position: new BABYLON.Vector3(),
        rotation: new BABYLON.Quaternion()
    };

    constructor(
        private metadata: any,
        parameters: Map<string, Parameter>,
        rootBone?: BABYLON.TransformNode
    ) {
        this.parameters = parameters;
        this.rootBone = rootBone ?? null;
        this.rootMotionEnabled = metadata.enableRootMotion ?? false;
        this.initialize();
    }

    /**
     * Initializes the blend tree from metadata
     */
    private initialize(): void {
        // Set blend tree type
        this.type = this.metadata.blendType ?? BlendTreeType.Simple1D;

        // Set parameters
        this.parameterX = this.metadata.blendParameterX ?? '';
        this.parameterY = this.metadata.blendParameterY ?? '';

        // Set thresholds
        this.minThreshold = this.metadata.minThreshold ?? 0;
        this.maxThreshold = this.metadata.maxThreshold ?? 1;

        // Initialize child nodes
        if (this.metadata.children) {
            for (const child of this.metadata.children) {
                this.children.push(new BlendTreeNode(child, this.rootBone || undefined));
            }
        }
    }

    /**
     * Updates the blend tree animation
     */
    public update(currentTime: number, avatarMask?: Set<string>, layerWeight: number = 1.0, additive: boolean = false): void {
        // Reset root motion if enabled
        if (this.rootMotionEnabled) {
            this.rootMotion = {
                position: new BABYLON.Vector3(),
                rotation: new BABYLON.Quaternion()
            };
        }

        // Handle non-bone transforms by checking transform type
        const isNonBoneTransform = !this.rootBone?.getScene()?.getBoneByName(this.rootBone.name);
        if (isNonBoneTransform) {
            // Use regular transform node methods for non-bone transforms
            this.updateNonBoneTransforms(currentTime, layerWeight, additive);
            return;
        }

        // Calculate blend weights based on type
        switch (this.type) {
            case BlendTreeType.Simple1D:
                this.calculate1DBlend();
                break;
            case BlendTreeType.SimpleDirectional2D:
                this.calculate2DDirectionalBlend();
                break;
            case BlendTreeType.FreeformDirectional2D:
                this.calculate2DFreeformDirectionalBlend();
                break;
            case BlendTreeType.FreeformCartesian2D:
                this.calculate2DFreeformCartesianBlend();
                break;
        }

        // Sample animations at current time
        for (const child of this.children) {
            child.sample(currentTime, avatarMask, layerWeight, additive);
        }
    }

    /**
     * Calculates blend weights for 1D blending
     */
    private calculate1DBlend(): void {
        const paramValue = this.getParameterValue(this.parameterX);
        if (paramValue === null) return;

        // Sort children by threshold for proper interpolation
        const sortedChildren = [...this.children].sort((a, b) => a.threshold - b.threshold);

        // Find the two motions to blend between
        let leftIndex = 0;
        let rightIndex = 0;
        for (let i = 0; i < sortedChildren.length - 1; i++) {
            if (paramValue >= sortedChildren[i].threshold && paramValue <= sortedChildren[i + 1].threshold) {
                leftIndex = i;
                rightIndex = i + 1;
                break;
            }
        }

        // Calculate blend weights
        const leftChild = sortedChildren[leftIndex];
        const rightChild = sortedChildren[rightIndex];
        const range = rightChild.threshold - leftChild.threshold;
        const t = range !== 0 ? (paramValue - leftChild.threshold) / range : 0;

        // Set weights
        for (const child of this.children) {
            child.setWeight(0);
        }
        leftChild.setWeight(1 - t);
        rightChild.setWeight(t);
    }

    /**
     * Calculates blend weights for 2D directional blending
     */
    private calculate2DDirectionalBlend(): void {
        const x = this.getParameterValue(this.parameterX) ?? 0;
        const y = this.getParameterValue(this.parameterY) ?? 0;

        // Calculate angle and magnitude
        const angle = Math.atan2(y, x);
        const magnitude = Math.sqrt(x * x + y * y);

        // Find the two closest motions
        let minAngleDiff = Math.PI * 2;
        let closestIndices: [number, number] = [0, 0];

        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            const childAngle = Math.atan2(child.positionY, child.positionX);
            const angleDiff = Math.abs(angle - childAngle);

            if (angleDiff < minAngleDiff) {
                minAngleDiff = angleDiff;
                closestIndices[0] = i;
                // Find next closest
                for (let j = 0; j < this.children.length; j++) {
                    if (j !== i) {
                        const nextChild = this.children[j];
                        const nextAngle = Math.atan2(nextChild.positionY, nextChild.positionX);
                        const nextDiff = Math.abs(angle - nextAngle);
                        if (nextDiff < Math.PI * 2 && nextDiff > angleDiff) {
                            closestIndices[1] = j;
                            break;
                        }
                    }
                }
            }
        }

        // Calculate blend weights
        const child1 = this.children[closestIndices[0]];
        const child2 = this.children[closestIndices[1]];
        const angle1 = Math.atan2(child1.positionY, child1.positionX);
        const angle2 = Math.atan2(child2.positionY, child2.positionX);
        const t = (angle - angle1) / (angle2 - angle1);

        // Set weights
        for (const child of this.children) {
            child.setWeight(0);
        }
        child1.setWeight((1 - t) * magnitude);
        child2.setWeight(t * magnitude);
    }

    /**
     * Calculates blend weights for 2D freeform directional blending
     */
    private calculate2DFreeformDirectionalBlend(): void {
        const x = this.getParameterValue(this.parameterX) ?? 0;
        const y = this.getParameterValue(this.parameterY) ?? 0;

        // Calculate weights using barycentric coordinates
        const weights = new Map<BlendTreeNode, number>();
        let totalWeight = 0;

        for (const child of this.children) {
            const dx = x - child.positionX;
            const dy = y - child.positionY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = distance === 0 ? 1 : 1 / distance;
            weights.set(child, weight);
            totalWeight += weight;
        }

        // Normalize weights
        for (const child of this.children) {
            const normalizedWeight = weights.get(child)! / totalWeight;
            child.setWeight(normalizedWeight);
        }
    }

    /**
     * Calculates blend weights for 2D freeform cartesian blending
     */
    private calculate2DFreeformCartesianBlend(): void {
        const x = this.getParameterValue(this.parameterX) ?? 0;
        const y = this.getParameterValue(this.parameterY) ?? 0;

        // Find three closest points for triangulation
        const closestPoints = this.findClosestPoints(x, y, 3);
        
        // Calculate barycentric coordinates
        const weights = this.calculateBarycentricWeights(x, y, closestPoints);

        // Set weights
        for (const child of this.children) {
            child.setWeight(0);
        }
        for (let i = 0; i < closestPoints.length; i++) {
            closestPoints[i].setWeight(weights[i]);
        }
    }

    /**
     * Gets a parameter value, returning null if not found
     */
    private getParameterValue(paramName: string): number | null {
        const param = this.parameters?.get(paramName);
        const value = param?.getValue();
        return typeof value === 'number' ? value : null;
    }

    /**
     * Finds the N closest points to the target position
     */
    private findClosestPoints(x: number, y: number, count: number): BlendTreeNode[] {
        return [...this.children]
            .sort((a, b) => {
                const distA = Math.pow(a.positionX - x, 2) + Math.pow(a.positionY - y, 2);
                const distB = Math.pow(b.positionX - x, 2) + Math.pow(b.positionY - y, 2);
                return distA - distB;
            })
            .slice(0, count);
    }

    /**
     * Calculates barycentric weights for the given points
     */
    private calculateBarycentricWeights(x: number, y: number, points: BlendTreeNode[]): number[] {
        if (points.length < 3) {
            return points.map(() => 1 / points.length);
        }

        const [p1, p2, p3] = points;
        const denominator = ((p2.positionY - p3.positionY) * (p1.positionX - p3.positionX) +
                           (p3.positionX - p2.positionX) * (p1.positionY - p3.positionY));

        if (Math.abs(denominator) < 1e-6) {
            return [1/3, 1/3, 1/3];
        }

        const w1 = ((p2.positionY - p3.positionY) * (x - p3.positionX) +
                   (p3.positionX - p2.positionX) * (y - p3.positionY)) / denominator;
        const w2 = ((p3.positionY - p1.positionY) * (x - p3.positionX) +
                   (p1.positionX - p3.positionX) * (y - p3.positionY)) / denominator;
        const w3 = 1 - w1 - w2;

        return [w1, w2, w3];
    }

    /**
     * Updates non-bone transforms using regular transform node methods
     */
    private updateNonBoneTransforms(currentTime: number, layerWeight: number, additive: boolean): void {
        // Calculate blend weights based on type
        switch (this.type) {
            case BlendTreeType.Simple1D:
                this.calculate1DBlend();
                break;
            case BlendTreeType.SimpleDirectional2D:
                this.calculate2DDirectionalBlend();
                break;
            case BlendTreeType.FreeformDirectional2D:
                this.calculate2DFreeformDirectionalBlend();
                break;
            case BlendTreeType.FreeformCartesian2D:
                this.calculate2DFreeformCartesianBlend();
                break;
        }

        // Sample each child's animations
        for (const child of this.children) {
            const weight = child.getWeight();
            if (weight === 0) continue;

            child.sample(currentTime, undefined, layerWeight * weight, additive);
        }
    }
}

/**
 * Represents a node in the blend tree
 */
class BlendTreeNode {
    private weight: number = 0;
    private _threshold: number = 0;
    private motion: string = '';
    public readonly positionX: number = 0;
    public readonly positionY: number = 0;
    private animationGroup: BABYLON.AnimationGroup | null = null;
    private cachedFrame: AnimationFrameCache | null = null;
    private loopBlend: boolean = false;
    private rootBone: BABYLON.TransformNode | null = null;
    private rootMotionEnabled: boolean = false;
    private rootMotion: RootMotion = {
        position: new BABYLON.Vector3(),
        rotation: new BABYLON.Quaternion()
    };

    constructor(metadata: any, rootBone?: BABYLON.TransformNode) {
        this.motion = metadata.motion ?? '';
        this._threshold = metadata.threshold ?? 0;
        this.positionX = metadata.positionX ?? 0;
        this.positionY = metadata.positionY ?? 0;
        this.loopBlend = metadata.loopBlend ?? false;
        this.rootBone = rootBone ?? null;
        this.rootMotionEnabled = metadata.enableRootMotion ?? false;
    }

    /**
     * Samples the animation at the given time
     */
    public sample(time: number, avatarMask?: Set<string>, layerWeight: number = 1.0, additive: boolean = false): void {
        if (!this.animationGroup || this.weight === 0) return;

        const animations = this.animationGroup.targetedAnimations;
        const normalizedTime = this.getNormalizedTime(time);
        const finalWeight = this.weight * layerWeight;
        
        // Sample each targeted animation
        for (const anim of animations) {
            const keys = anim.animation.getKeys();
            if (keys.length < 2) continue;

            // Find the key frames to interpolate between
            let frame1Index = 0;
            let frame2Index = 1;
            for (let i = 0; i < keys.length - 1; i++) {
                if (normalizedTime >= keys[i].frame && normalizedTime <= keys[i + 1].frame) {
                    frame1Index = i;
                    frame2Index = i + 1;
                    break;
                }
            }

            // Calculate interpolation factor
            const frame1 = keys[frame1Index];
            const frame2 = keys[frame2Index];
            const range = frame2.frame - frame1.frame;
            const t = range !== 0 ? (normalizedTime - frame1.frame) / range : 0;

            // Interpolate value
            let value: any;
            switch (anim.animation.dataType) {
                case BABYLON.Animation.ANIMATIONTYPE_FLOAT:
                    value = frame1.value + (frame2.value - frame1.value) * t;
                    break;
                case BABYLON.Animation.ANIMATIONTYPE_VECTOR3:
                    value = BABYLON.Vector3.Lerp(frame1.value, frame2.value, t);
                    break;
                case BABYLON.Animation.ANIMATIONTYPE_QUATERNION:
                    value = BABYLON.Quaternion.Slerp(frame1.value, frame2.value, t);
                    break;
                default:
                    value = frame1.value;
            }

            // Check if target should be animated based on avatar mask
            const shouldAnimate = !avatarMask || !(anim.target instanceof BABYLON.TransformNode) || avatarMask.has(anim.target.name);

            if (shouldAnimate) {
                // Handle root motion extraction
                const isRootBone = anim.target === this.rootBone;

                // Apply value to target
                if (anim.target instanceof BABYLON.TransformNode) {
                    switch (anim.animation.targetProperty) {
                        case 'position':
                            const pos = value as BABYLON.Vector3;
                            if (isRootBone && this.rootMotionEnabled) {
                                // Extract root motion
                                this.rootMotion.position.addInPlace(pos.scale(finalWeight));
                            } else {
                                if (additive) {
                                    pos.scaleToRef(finalWeight, BABYLON.TmpVectors.Vector3[0]);
                                    anim.target.position.addInPlace(BABYLON.TmpVectors.Vector3[0]);
                                } else {
                                    pos.scaleToRef(finalWeight, BABYLON.TmpVectors.Vector3[0]);
                                    anim.target.position.copyFrom(BABYLON.TmpVectors.Vector3[0]);
                                }
                            }
                            break;
                        case 'rotation':
                            const rot = value as BABYLON.Quaternion;
                            if (isRootBone && this.rootMotionEnabled) {
                                // Extract root motion
                                BABYLON.Quaternion.SlerpToRef(
                                    BABYLON.Quaternion.Identity(),
                                    rot,
                                    finalWeight,
                                    this.rootMotion.rotation
                                );
                            } else if (anim.target.rotationQuaternion) {
                                if (additive) {
                                    BABYLON.Quaternion.SlerpToRef(
                                        BABYLON.Quaternion.Identity(),
                                        rot,
                                        finalWeight,
                                        BABYLON.TmpVectors.Quaternion[0]
                                    );
                                    anim.target.rotationQuaternion.multiplyInPlace(BABYLON.TmpVectors.Quaternion[0]);
                                } else {
                                    BABYLON.Quaternion.SlerpToRef(
                                        BABYLON.Quaternion.Identity(),
                                        rot,
                                        finalWeight,
                                        anim.target.rotationQuaternion
                                    );
                                }
                            }
                            break;
                        case 'scaling':
                            const scale = value as BABYLON.Vector3;
                            if (additive) {
                                const weightedScale = new BABYLON.Vector3(
                                    1 + (scale.x - 1) * finalWeight,
                                    1 + (scale.y - 1) * finalWeight,
                                    1 + (scale.z - 1) * finalWeight
                                );
                                anim.target.scaling.multiplyInPlace(weightedScale);
                            } else {
                                const weightedScale = new BABYLON.Vector3(
                                    scale.x * finalWeight,
                                    scale.y * finalWeight,
                                    scale.z * finalWeight
                                );
                                anim.target.scaling.copyFrom(weightedScale);
                            }
                            break;
                    }
                } else {
                    // Handle non-bone transforms (generic properties)
                    if (typeof value === 'number') {
                        if (additive) {
                            (anim.target as any)[anim.animation.targetProperty] += value * finalWeight;
                        } else {
                            (anim.target as any)[anim.animation.targetProperty] = value * finalWeight;
                        }
                    }
                }
            }
        }
    }

    /**
     * Gets the normalized time for animation sampling
     */
    public getNormalizedTime(time: number): number {
        if (!this.animationGroup) return 0;

        const duration = this.animationGroup.to - this.animationGroup.from;
        if (duration <= 0) return 0;

        let normalizedTime = time;
        if (this.animationGroup.loopAnimation) {
            normalizedTime = time % duration;
            if (this.loopBlend) {
                const loopStart = duration * 0.75;
                const loopEnd = duration;
                if (normalizedTime > loopStart) {
                    // Smooth looping blend between end and start
                    const blendFactor = (normalizedTime - loopStart) / (loopEnd - loopStart);
                    const startTime = duration * blendFactor * 0.25; // Blend with first 25% of animation
                    normalizedTime = startTime;
                }
            }
        } else {
            normalizedTime = Math.min(time, duration);
        }

        return normalizedTime + this.animationGroup.from;
    }

    /**
     * Sets the blend weight for this node
     */
    public setWeight(weight: number): void {
        this.weight = Math.max(0, Math.min(1, weight));
    }

    /**
     * Gets the current blend weight
     */
    public getWeight(): number {
        return this.weight;
    }

    /**
     * Gets the threshold value for 1D blending
     */
    public get threshold(): number {
        return this._threshold;
    }
}
