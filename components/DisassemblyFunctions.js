import * as THREE from 'three';

/**
 * Standalone Disassembly/Reassembly Functions for 3D Models
 */

/**
 * Initialize object hierarchy and create layers
 * @param {THREE.Object3D} rootObject - The root 3D object to analyze
 * @returns {Object} - Contains layers array and original positions map
 */
export function initializeModelLayers(rootObject) {
    if (!rootObject) return { layers: [], originalPositions: new Map() };

    // Collect ALL objects in the hierarchy
    const allObjects = [];
    const collectObjects = (obj) => {
        allObjects.push(obj);
        obj.children.forEach(child => collectObjects(child));
    };
    collectObjects(rootObject);

    // Calculate depth from root for proper layering
    const getDepth = (obj, root) => {
        let depth = 0;
        let current = obj;
        while (current && current !== root && current.parent) {
            depth++;
            current = current.parent;
        }
        return depth;
    };

    // Create layers based on hierarchy depth
    const layers = [];
    allObjects.forEach(obj => {
        if (obj === rootObject) return; // Skip root object
        
        const depth = getDepth(obj, rootObject);
        if (!layers[depth]) layers[depth] = [];
        
        // Only add objects that are actual mesh/geometry containers
        if (obj.type === 'Mesh' || obj.type === 'Group' || 
            obj.type === 'Object3D' || obj.children.length > 0) {
            layers[depth].push(obj);
        }
    });

    // Remove empty layers
    const validLayers = layers.filter(layer => layer && layer.length > 0);
    
    // Store original positions for all objects
    const originalPositions = new Map();
    allObjects.forEach(obj => {
        originalPositions.set(obj.uuid, {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone()
        });
    });

    console.log(`Model initialized with ${validLayers.length} layers:`, 
               validLayers.map(layer => layer.length));

    return {
        layers: validLayers,
        originalPositions: originalPositions
    };
}

/**
 * Disassemble a specific layer with Iron Man style movement
 * @param {Array} layer - Array of objects in the layer to disassemble
 * @param {THREE.Object3D} rootObject - Root object for reference
 * @param {number} disassembleDistance - How far to move objects (default: 3.0)
 * @returns {Array} - Animation targets with start and end positions
 */
export function disassembleLayer(layer, rootObject, disassembleDistance = 3.0) {
    if (!layer || layer.length === 0) return [];

    console.log(`Disassembling layer with ${layer.length} objects`);
    
    // Group objects by their immediate parent
    const parentGroups = new Map();
    const rootObjects = [];

    layer.forEach(obj => {
        if (obj.parent && obj.parent !== rootObject) {
            const parentId = obj.parent.uuid;
            if (!parentGroups.has(parentId)) {
                parentGroups.set(parentId, {
                    parent: obj.parent,
                    children: []
                });
            }
            parentGroups.get(parentId).children.push(obj);
        } else {
            rootObjects.push(obj);
        }
    });

    const animationTargets = [];

    // Process each parent group separately (Iron Man style)
    parentGroups.forEach(({ parent, children }) => {
        // Calculate the bounding box center of the parent
        const parentBox = new THREE.Box3();
        parentBox.setFromObject(parent);
        const parentCenter = parentBox.getCenter(new THREE.Vector3());

        children.forEach(obj => {
            // Get object's world position
            const objWorldPos = obj.getWorldPosition(new THREE.Vector3());
            
            // Calculate direction from parent center to object center
            const direction = new THREE.Vector3()
                .subVectors(objWorldPos, parentCenter)
                .normalize();

            // If direction is zero (object at parent center), use fallback
            if (direction.length() === 0) {
                // Use object's local position relative to parent as fallback
                direction.copy(obj.position).normalize();
                
                // If still zero, use a radial distribution
                if (direction.length() === 0) {
                    const index = children.indexOf(obj);
                    const angle = (index / children.length) * Math.PI * 2;
                    direction.set(Math.cos(angle), 0, Math.sin(angle));
                }
            }

            // Convert world direction to local direction
            const parentWorldMatrix = parent.matrixWorld;
            const parentWorldMatrixInverse = new THREE.Matrix4().copy(parentWorldMatrix).invert();
            direction.transformDirection(parentWorldMatrixInverse);

            // Calculate target position
            const targetPosition = obj.position.clone()
                .add(direction.multiplyScalar(disassembleDistance));

            animationTargets.push({
                object: obj,
                startPosition: obj.position.clone(),
                targetPosition: targetPosition,
                uuid: obj.uuid
            });
        });
    });

    // Handle root-level objects (no parent grouping)
    if (rootObjects.length > 0) {
        // Calculate center of all root objects
        const rootCenter = new THREE.Vector3();
        rootObjects.forEach(obj => {
            rootCenter.add(obj.getWorldPosition(new THREE.Vector3()));
        });
        rootCenter.divideScalar(rootObjects.length);

        rootObjects.forEach(obj => {
            const objWorldPos = obj.getWorldPosition(new THREE.Vector3());
            const direction = new THREE.Vector3()
                .subVectors(objWorldPos, rootCenter)
                .normalize();

            if (direction.length() === 0) {
                // Radial distribution for objects at center
                const angle = (rootObjects.indexOf(obj) / rootObjects.length) * Math.PI * 2;
                direction.set(Math.cos(angle), 0, Math.sin(angle));
            }

            const targetPosition = obj.position.clone()
                .add(direction.multiplyScalar(disassembleDistance));

            animationTargets.push({
                object: obj,
                startPosition: obj.position.clone(),
                targetPosition: targetPosition,
                uuid: obj.uuid
            });
        });
    }

    return animationTargets;
}

/**
 * Reassemble objects back to their saved positions
 * @param {Map} savedPositions - Map of object UUIDs to their original positions
 * @param {THREE.Object3D} rootObject - Root object to search for objects
 * @returns {Array} - Animation targets for reassembly
 */
export function reassembleLayer(savedPositions, rootObject) {
    const animationTargets = [];

    savedPositions.forEach((savedPosition, uuid) => {
        // Find object in the entire model hierarchy
        let foundObject = null;
        rootObject.traverse((obj) => {
            if (obj.uuid === uuid) {
                foundObject = obj;
            }
        });

        if (foundObject) {
            animationTargets.push({
                object: foundObject,
                startPosition: foundObject.position.clone(),
                targetPosition: savedPosition,
                uuid: uuid
            });
        }
    });

    return animationTargets;
}

/**
 * Animate objects from start to target positions with easing
 * @param {Array} animationTargets - Array of objects with start/target positions
 * @param {number} progress - Animation progress from 0 to 1
 * @param {Function} easingFunction - Optional easing function (default: smoothstep)
 */
export function animateTargets(animationTargets, progress, easingFunction = smoothStep) {
    const easedProgress = easingFunction(Math.max(0, Math.min(1, progress)));
    
    animationTargets.forEach(({ object, startPosition, targetPosition }) => {
        if (object) {
            object.position.lerpVectors(startPosition, targetPosition, easedProgress);
        }
    });
}

/**
 * Smooth step easing function (similar to CSS ease-in-out)
 * @param {number} t - Progress value from 0 to 1
 * @returns {number} - Eased value
 */
export function smoothStep(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Complete disassembly manager class for easy integration
 */
export class ModelDisassemblyManager {
    constructor(rootObject) {
        this.rootObject = rootObject;
        this.currentLayer = 0;
        this.isAnimating = false;
        this.animationStack = [];
        this.layers = [];
        this.originalPositions = new Map();
        
        this.initialize();
    }

    initialize() {
        const result = initializeModelLayers(this.rootObject);
        this.layers = result.layers;
        this.originalPositions = result.originalPositions;
        this.currentLayer = 0;
        this.animationStack = [];
    }

    canDisassemble() {
        return this.currentLayer < this.layers.length && !this.isAnimating;
    }

    canReassemble() {
        return this.currentLayer > 0 && !this.isAnimating && this.animationStack.length > 0;
    }

    disassembleNext(distance = 3.0) {
        if (!this.canDisassemble()) return null;

        const layer = this.layers[this.currentLayer];
        const targets = disassembleLayer(layer, this.rootObject, distance);
        
        // Save positions for reassembly
        const layerPositions = new Map();
        layer.forEach(obj => {
            layerPositions.set(obj.uuid, obj.position.clone());
        });
        this.animationStack.push(layerPositions);
        
        this.currentLayer++;
        return targets;
    }

    reassemblePrevious() {
        if (!this.canReassemble()) return null;

        const savedPositions = this.animationStack.pop();
        this.currentLayer--;
        
        return reassembleLayer(savedPositions, this.rootObject);
    }

    reset() {
        // Reset all objects to original positions
        this.originalPositions.forEach((original, uuid) => {
            let foundObject = null;
            this.rootObject.traverse((obj) => {
                if (obj.uuid === uuid) {
                    foundObject = obj;
                }
            });
            
            if (foundObject) {
                foundObject.position.copy(original.position);
                foundObject.rotation.copy(original.rotation);
                foundObject.scale.copy(original.scale);
            }
        });
        
        this.currentLayer = 0;
        this.animationStack = [];
        this.isAnimating = false;
    }

    getStatus() {
        return {
            currentLayer: this.currentLayer,
            totalLayers: this.layers.length,
            isAnimating: this.isAnimating,
            canDisassemble: this.canDisassemble(),
            canReassemble: this.canReassemble()
        };
    }
}

// Example usage:
/*
// Initialize the disassembly manager
const manager = new ModelDisassemblyManager(loadedModel);

// Disassemble next layer
const disassembleTargets = manager.disassembleNext(3.0);
if (disassembleTargets) {
    // Animate over 1 second
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / 1000, 1);
        
        animateTargets(disassembleTargets, progress);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    animate();
}

// Reassemble previous layer
const reassembleTargets = manager.reassemblePrevious();
if (reassembleTargets) {
    // Animate back to original positions
    // ... similar animation code
}
*/
