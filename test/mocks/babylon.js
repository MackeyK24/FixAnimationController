// Initialize BABYLON namespace
const BABYLON = {
    BlendTreeType: {
        Simple1D: 'Simple1D'
    },
    MotionType: {
        Clip: 'Clip',
        Tree: 'Tree'
    },
    ConditionMode: {
        Greater: 'Greater',
        Less: 'Less',
        Equals: 'Equals'
    },
    Tools: {
        Now: function() {
            return performance.now();
        }
    },
    Animation: {
        ANIMATIONTYPE_FLOAT: 0,
        ANIMATIONTYPE_VECTOR3: 1,
        ANIMATIONTYPE_QUATERNION: 2,
        ANIMATIONTYPE_MATRIX: 3,
        ANIMATIONTYPE_COLOR3: 4,
        ANIMATIONTYPE_COLOR4: 5,
        ANIMATIONTYPE_VECTOR2: 6,
        ANIMATIONTYPE_SIZE: 7
    },
    Scalar: {
        Clamp: (value, min = 0, max = 1) => Math.min(Math.max(value, min), max),
        Denormalize: (value, min, max) => min + (max - min) * value,
        Lerp: (start, end, amount) => start + (end - start) * amount
    },
    AnimatorParameterType: {
        Float: 0,
        Int: 1,
        Bool: 2,
        Trigger: 3
    },
    Utilities: {
        ComputeBlendingSpeed: (frameRate, duration) => {
            return 1.0 / (frameRate * Math.max(duration, 0.01));
        }
    }
};

// Define Vector3 constructor and methods
BABYLON.Vector3 = function(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
};

// Add Vector3 static methods
// Static vectors
BABYLON.Vector3._upVector = new BABYLON.Vector3(0, 1, 0);
BABYLON.Vector3._rightVector = new BABYLON.Vector3(1, 0, 0);
BABYLON.Vector3._forwardVector = new BABYLON.Vector3(0, 0, 1);
BABYLON.Vector3._zeroVector = new BABYLON.Vector3(0, 0, 0);

// Static methods
BABYLON.Vector3.Up = function() { return BABYLON.Vector3._upVector.clone(); };
BABYLON.Vector3.Right = function() { return BABYLON.Vector3._rightVector.clone(); };
BABYLON.Vector3.Forward = function() { return BABYLON.Vector3._forwardVector.clone(); };
BABYLON.Vector3.Zero = function() { return BABYLON.Vector3._zeroVector.clone(); };
BABYLON.Vector3.Lerp = function(start, end, amount) {
    if (!start || !end) return BABYLON.Vector3.Zero();
    const result = new BABYLON.Vector3();
    result.x = start.x + (end.x - start.x) * amount;
    result.y = start.y + (end.y - start.y) * amount;
    result.z = start.z + (end.z - start.z) * amount;
    return result;
};

// Make sure Lerp is also available as a static method
BABYLON.Vector3.prototype.Lerp = BABYLON.Vector3.Lerp;

// Define Vector3 prototype methods
BABYLON.Vector3.prototype = {
    constructor: BABYLON.Vector3,
    
    clone: function() {
        return new BABYLON.Vector3(this.x, this.y, this.z);
    },
    
    normalize: function() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len === 0) return this;
        this.x /= len;
        this.y /= len;
        this.z /= len;
        return this;
    },
    
    subtract: function(other) {
        return new BABYLON.Vector3(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    },
    
    scale: function(scale) {
        return new BABYLON.Vector3(
            this.x * scale,
            this.y * scale,
            this.z * scale
        );
    },
    
    add: function(other) {
        return new BABYLON.Vector3(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z
        );
    },
    
    length: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    },
    
    scaleInPlace: function(scale) {
        this.x *= scale;
        this.y *= scale;
        this.z *= scale;
        return this;
    },
    
    addInPlace: function(other) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
    },
    
    setAll: function(value) {
        this.x = value;
        this.y = value;
        this.z = value;
        return this;
    }
};

BABYLON.Vector3.prototype.lerp = function(end, amount) {
    return BABYLON.Vector3.Lerp(this, end, amount);
};

// Add Vector2 class for blend tree calculations
BABYLON.Vector2 = function(x = 0, y = 0) {
    this.x = x;
    this.y = y;
};

BABYLON.Vector2.prototype = {
    constructor: BABYLON.Vector2,
    
    normalize: function() {
        const len = this.length();
        if (len === 0) return this;
        this.x /= len;
        this.y /= len;
        return this;
    },
    
    length: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
};

BABYLON.Vector2.Dot = function(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
};
// Define Quaternion constructor and prototype

// Define Quaternion constructor and prototype
BABYLON.Quaternion = function(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
};

// Add Quaternion static methods
BABYLON.Quaternion.Identity = function() {
    return new BABYLON.Quaternion(0, 0, 0, 1);
};

BABYLON.Quaternion.RotationYawPitchRoll = function(yaw, pitch, roll) {
    if (yaw === undefined || pitch === undefined || roll === undefined) {
        return BABYLON.Quaternion.Identity();
    }

    const halfRoll = roll * 0.5;
    const halfPitch = pitch * 0.5;
    const halfYaw = yaw * 0.5;

    const sinRoll = Math.sin(halfRoll);
    const cosRoll = Math.cos(halfRoll);
    const sinPitch = Math.sin(halfPitch);
    const cosPitch = Math.cos(halfPitch);
    const sinYaw = Math.sin(halfYaw);
    const cosYaw = Math.cos(halfYaw);

    return new BABYLON.Quaternion(
        cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll,
        sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll,
        cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll,
        cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll
    );
};

BABYLON.Quaternion.RotationAxis = function(axis, angle) {
    const normalizedAxis = axis.clone().normalize();
    const sin = Math.sin(angle / 2);
    return new BABYLON.Quaternion(
        normalizedAxis.x * sin,
        normalizedAxis.y * sin,
        normalizedAxis.z * sin,
        Math.cos(angle / 2)
    );
};

BABYLON.Quaternion.Dot = function(q1, q2) {
    return q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
};

BABYLON.Quaternion.Slerp = function(start, end, amount) {
    let cosHalfTheta = start.x * end.x + start.y * end.y + 
                    start.z * end.z + start.w * end.w;
    
    if (Math.abs(cosHalfTheta) >= 1.0) {
        return start.clone();
    }
    
    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    
    if (Math.abs(sinHalfTheta) < 0.001) {
        return new BABYLON.Quaternion(
            start.x * 0.5 + end.x * 0.5,
            start.y * 0.5 + end.y * 0.5,
            start.z * 0.5 + end.z * 0.5,
            start.w * 0.5 + end.w * 0.5
        );
    }
    
    const ratioA = Math.sin((1 - amount) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(amount * halfTheta) / sinHalfTheta;
    
    return new BABYLON.Quaternion(
        start.x * ratioA + end.x * ratioB,
        start.y * ratioA + end.y * ratioB,
        start.z * ratioA + end.z * ratioB,
        start.w * ratioA + end.w * ratioB
    );
};
// Quaternion static methods are defined at initialization

// Add Quaternion prototype methods
BABYLON.Quaternion.prototype = {
    constructor: BABYLON.Quaternion,
    
    clone: function() {
        return new BABYLON.Quaternion(this.x, this.y, this.z, this.w);
    },
    
    equals: function(other) {
        return this.x === other.x && 
               this.y === other.y && 
               this.z === other.z && 
               this.w === other.w;
    },
    
    set: function(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    },
    
    multiplyInPlace: function(other) {
        const x1 = this.x;
        const y1 = this.y;
        const z1 = this.z;
        const w1 = this.w;
        const x2 = other.x;
        const y2 = other.y;
        const z2 = other.z;
        const w2 = other.w;

        this.x = x1 * w2 + y1 * z2 - z1 * y2 + w1 * x2;
        this.y = -x1 * z2 + y1 * w2 + z1 * x2 + w1 * y2;
        this.z = x1 * y2 - y1 * x2 + z1 * w2 + w1 * z2;
        this.w = -x1 * x2 - y1 * y2 - z1 * z2 + w1 * w2;

        return this;
    },
    
    toEulerAngles: function() {
        const sqx = this.x * this.x;
        const sqy = this.y * this.y;
        const sqz = this.z * this.z;
        const sqw = this.w * this.w;

        const x = Math.atan2(2.0 * (this.x * this.w - this.y * this.z), (sqw - sqx - sqy + sqz));
        const y = Math.asin(2.0 * (this.x * this.z + this.y * this.w));
        const z = Math.atan2(2.0 * (this.z * this.w - this.x * this.y), (sqw + sqx - sqy - sqz));

        return new BABYLON.Vector3(x, y, z);
    },
    
    copyFrom: function(other) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        this.w = other.w;
        return this;
    }
};

// Quaternion static methods are defined at initialization

// Define Observable class
BABYLON.Observable = function() {
    this.observers = [];
};

BABYLON.Observable.prototype = {
    constructor: BABYLON.Observable,
    
    add: function(callback) {
        this.observers.push(callback);
    },
    
    notifyObservers: function(data) {
        this.observers.forEach(observer => observer(data));
    }
};

// Define Engine class
BABYLON.Engine = function(canvas) {
    this._currentFrameId = 0;
    this._uniformBuffers = new Set();
    this.webGLVersion = 2;
    this._features = { trackUbosInFrame: true };
    this._caps = {
        uintIndices: true,
        uniformBuffer: true,
        maxUniformBufferSize: 65536
    };
};

// Define Scene class
BABYLON.Scene = function(engine) {
    this._engine = engine;
    this.onBeforeRenderObservable = new BABYLON.Observable();
    this.onAfterRenderObservable = new BABYLON.Observable();
    this._frameId = 0;
    this._currentFrameId = 0;
    this._viewMatrix = BABYLON.Matrix.Identity();
    this._projectionMatrix = BABYLON.Matrix.Identity();
    this._transformMatrix = BABYLON.Matrix.Identity();
};

// Define Animation class
BABYLON.Animation = function(name, targetProperty, framePerSecond, dataType, loopMode) {
    this.name = name;
    this.targetProperty = targetProperty;
    this.framePerSecond = framePerSecond;
    this.dataType = dataType;
    this.loopMode = loopMode;
    this._keys = [];
};

BABYLON.Animation.prototype = {
    constructor: BABYLON.Animation,
    
    setKeys: function(keys) {
        this._keys = keys;
    },
    
    getKeys: function() {
        return this._keys;
    }
};

// Define AnimationGroup class
BABYLON.AnimationGroup = function(name) {
    this.name = name;
    this._targetedAnimations = [];
    this._isPlaying = false;
    this._isPaused = false;
    this._frameRate = 30;
    this._from = 0;
    this._to = 0;
    this._lastFrameTime = performance.now();
    this._currentFrame = 0;
    this.blendtree = {
        blendType: BABYLON.BlendTreeType.Simple1D,
        blendParameterX: 'Speed',
        children: [{
            motion: name,
            threshold: 0,
            type: BABYLON.MotionType.Clip,
            weight: 0.5
        }, {
            motion: name,
            threshold: 1,
            type: BABYLON.MotionType.Clip,
            weight: 0.5
        }],
        weight: 1.0,
        currentValue: 0
    };
    
    this.play = function(loop) {
        this._isPlaying = true;
        this._isPaused = false;
        this._lastFrameTime = BABYLON.Tools.Now();
        return this;
    };
    
    this.pause = function() {
        this._isPaused = true;
        return this;
    };
    
    this.stop = function() {
        this._isPlaying = false;
        this._isPaused = false;
        this._currentFrame = 0;
        this._lastFrameTime = 0;
        return this;
    };

    this.setBlendTreeValue = function(value) {
        this.blendtree.currentValue = value;
        
        // Initialize weights if not set
        if (!this.blendtree.children) {
            this.blendtree.children = [];
        }
        
        // Initialize default children if empty
        if (this.blendtree.children.length === 0) {
            this.blendtree.children = [{
                motion: this.name,
                threshold: 0,
                type: BABYLON.MotionType.Clip,
                weight: 0.5
            }, {
                motion: this.name,
                threshold: 1,
                type: BABYLON.MotionType.Clip,
                weight: 0.5
            }];
        }
        
        // Initialize all weights to 0
        this.blendtree.children.forEach(child => {
            if (typeof child.weight === 'undefined') {
                child.weight = 0;
            }
        });
        
        // Handle value below first threshold
        if (value <= this.blendtree.children[0].threshold) {
            this.blendtree.children[0].weight = 1;
            for (let i = 1; i < this.blendtree.children.length; i++) {
                this.blendtree.children[i].weight = 0;
            }
            return;
        }
        
        // Handle value above last threshold
        const lastIndex = this.blendtree.children.length - 1;
        if (value >= this.blendtree.children[lastIndex].threshold) {
            this.blendtree.children[lastIndex].weight = 1;
            for (let i = 0; i < lastIndex; i++) {
                this.blendtree.children[i].weight = 0;
            }
            return;
        }
        
        // Find and interpolate between appropriate thresholds
        for (let i = 0; i < this.blendtree.children.length - 1; i++) {
            const current = this.blendtree.children[i];
            const next = this.blendtree.children[i + 1];
            if (value >= current.threshold && value <= next.threshold) {
                const t = (value - current.threshold) / (next.threshold - current.threshold);
                current.weight = 1 - t;
                next.weight = t;
                // Zero out other weights
                for (let j = 0; j < this.blendtree.children.length; j++) {
                    if (j !== i && j !== i + 1) {
                        this.blendtree.children[j].weight = 0;
                    }
                }
                break;
            }
        }
    };
};

BABYLON.AnimationGroup.prototype = {
    constructor: BABYLON.AnimationGroup,
    
    addTargetedAnimation: function(animation, target) {
        const targetedAnimation = { 
            animation, 
            target,
            currentFrame: 0,
            weight: 1.0
        };
        this._targetedAnimations.push(targetedAnimation);
        // Update animation range
        if (animation._keys.length > 0) {
            const lastKey = animation._keys[animation._keys.length - 1];
            this._to = Math.max(this._to, lastKey.frame);
        }
        return targetedAnimation;
    },

    update: function() {
        if (!this._isPlaying || this._isPaused) {
            return;
        }

        const currentTime = performance.now();
        const deltaTime = (currentTime - this._lastFrameTime) / 1000.0;
        this._lastFrameTime = currentTime;

        // Update current frame
        this._currentFrame += deltaTime * this._frameRate;
        if (this._currentFrame > this._to) {
            this._currentFrame = this._from;
        }

        // Initialize blend tree if needed
        if (this.blendtree && this.blendtree.children.length === 0) {
            this.setBlendTreeValue(0);
        }

        // Update all targeted animations
        this._targetedAnimations.forEach(targetedAnimation => {
            this._evaluateAnimation(targetedAnimation, this._currentFrame);
        });

        // Update blend tree weights if needed
        if (this.blendtree && this.blendtree.currentValue !== undefined) {
            this.setBlendTreeValue(this.blendtree.currentValue);
        }
    },

    _evaluateAnimation: function(targetedAnimation, currentFrame) {
        const animation = targetedAnimation.animation;
        const target = targetedAnimation.target;
        
        if (!animation._keys || animation._keys.length === 0) {
            return;
        }

        let prevKey = null;
        let nextKey = null;

        // Find the surrounding keys
        for (let i = 0; i < animation._keys.length; i++) {
            if (animation._keys[i].frame >= currentFrame) {
                nextKey = animation._keys[i];
                if (i > 0) {
                    prevKey = animation._keys[i - 1];
                }
                break;
            }
        }

        if (!prevKey) {
            prevKey = animation._keys[0];
        }
        if (!nextKey) {
            nextKey = animation._keys[animation._keys.length - 1];
        }

        // Calculate interpolation factor
        const range = nextKey.frame - prevKey.frame;
        const ratio = range === 0 ? 0 : (currentFrame - prevKey.frame) / range;

        // Store previous values
        const prevPosition = target.position ? target.position.clone() : new BABYLON.Vector3();
        const prevRotation = target.rotationQuaternion ? target.rotationQuaternion.clone() : new BABYLON.Quaternion();

        // Interpolate values
        if (animation.dataType === BABYLON.Animation.ANIMATIONTYPE_VECTOR3) {
            target.position = BABYLON.Vector3.Lerp(prevKey.value, nextKey.value, ratio);
        } else if (animation.dataType === BABYLON.Animation.ANIMATIONTYPE_QUATERNION) {
            target.rotationQuaternion = BABYLON.Quaternion.Slerp(prevKey.value, nextKey.value, ratio);
        }

        // Apply weight blending if needed
        if (targetedAnimation.weight !== 1.0) {
            if (target.position) {
                target.position = BABYLON.Vector3.Lerp(prevPosition, target.position, targetedAnimation.weight);
            }
            if (target.rotationQuaternion) {
                target.rotationQuaternion = BABYLON.Quaternion.Slerp(prevRotation, target.rotationQuaternion, targetedAnimation.weight);
            }
        }
    }
};

// Define TransformNode class
BABYLON.TransformNode = function(name) {
    this.name = name;
    this.position = new BABYLON.Vector3();
    this.rotationQuaternion = new BABYLON.Quaternion();
    this.parent = null;
};

// Define Matrix class and methods
BABYLON.Matrix = function() {
    this.m = new Float32Array(16);
    this.m[0] = 1; this.m[5] = 1; this.m[10] = 1; this.m[15] = 1;
};

BABYLON.Matrix.prototype = {
    constructor: BABYLON.Matrix,
    
    reset: function() {
        this.m[0] = 1; this.m[1] = 0; this.m[2] = 0; this.m[3] = 0;
        this.m[4] = 0; this.m[5] = 1; this.m[6] = 0; this.m[7] = 0;
        this.m[8] = 0; this.m[9] = 0; this.m[10] = 1; this.m[11] = 0;
        this.m[12] = 0; this.m[13] = 0; this.m[14] = 0; this.m[15] = 1;
        return this;
    }
};

BABYLON.Matrix.Identity = function() {
    return new BABYLON.Matrix();
};

BABYLON.Matrix.Zero = function() {
    const matrix = new BABYLON.Matrix();
    matrix.m.fill(0);
    return matrix;
};

BABYLON.Matrix.FromValues = function(m11, m12, m13, m14, m21, m22, m23, m24, m31, m32, m33, m34, m41, m42, m43, m44) {
    const matrix = new BABYLON.Matrix();
    const m = matrix.m;
    m[0] = m11; m[1] = m12; m[2] = m13; m[3] = m14;
    m[4] = m21; m[5] = m22; m[6] = m23; m[7] = m24;
    m[8] = m31; m[9] = m32; m[10] = m33; m[11] = m34;
    m[12] = m41; m[13] = m42; m[14] = m43; m[15] = m44;
    return matrix;
};
// Add Animation Types
BABYLON.Animation.ANIMATIONTYPE_FLOAT = 0;
BABYLON.Animation.ANIMATIONTYPE_VECTOR3 = 1;
BABYLON.Animation.ANIMATIONTYPE_QUATERNION = 2;
BABYLON.Animation.ANIMATIONTYPE_MATRIX = 3;
BABYLON.Animation.ANIMATIONTYPE_COLOR3 = 4;
BABYLON.Animation.ANIMATIONTYPE_COLOR4 = 5;
BABYLON.Animation.ANIMATIONTYPE_VECTOR2 = 6;
BABYLON.Animation.ANIMATIONTYPE_SIZE = 7;

module.exports = { BABYLON };
