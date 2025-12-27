import * as THREE from 'three';

/**
 * Advanced highlighting system with customizable neon effects
 */
export class HighlightManager {
    constructor() {
        this.highlightedObjects = new Map();
        this.originalMaterials = new Map();
        this.highlightColor = new THREE.Color(0x00ffff); // Neon blue
        this.highlightOpacity = 0.7;
        this.highlightIntensity = 1.0;
        this.pulseAnimation = true;
        this.pulseSpeed = 2.0;
        this.animationClock = new THREE.Clock();
    }

    /**
     * Set highlight color and properties
     */
    setHighlightProperties(color, opacity = 0.7, intensity = 1.0, pulse = true, pulseSpeed = 2.0) {
        // Handle 8-digit hex codes (RRGGBBAA) by stripping alpha
        let safeColor = color;
        if (typeof color === 'string' && color.startsWith('#') && color.length === 9) {
            safeColor = color.substring(0, 7);
        }

        this.highlightColor = new THREE.Color(safeColor);
        this.highlightOpacity = opacity;
        this.highlightIntensity = intensity;
        this.pulseAnimation = pulse;
        this.pulseSpeed = pulseSpeed;
    }

    /**
     * Create highlight material with neon effect
     */
    createHighlightMaterial(originalMaterial) {
        const baseColor = this.highlightColor.clone();

        // Create a material that overlays the original with neon effect
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: this.highlightOpacity,
            emissive: baseColor.clone().multiplyScalar(this.highlightIntensity * 0.3),
            emissiveIntensity: this.highlightIntensity,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true
        });

        // For wireframe overlay effect
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: this.highlightOpacity * 0.5,
            wireframe: true,
            emissive: baseColor.clone().multiplyScalar(0.2),
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return { highlightMaterial, wireframeMaterial };
    }

    /**
     * Highlight an object with neon effect
     */
    highlightObject(object, options = {}) {
        if (!object || !object.isMesh) {
            console.warn('highlightObject: Invalid object or not a mesh', object);
            return false;
        }

        console.log('Highlighting object:', object.name, object.uuid);

        // Store original material if not already stored
        if (!this.originalMaterials.has(object.uuid)) {
            this.originalMaterials.set(object.uuid, object.material);
        }

        // Remove existing highlight if present (important for re-highlighting)
        this.removeHighlight(object);

        const { highlightMaterial, wireframeMaterial } = this.createHighlightMaterial(object.material);

        // Create highlight mesh (clone geometry but with highlight material)
        const highlightMesh = new THREE.Mesh(object.geometry, highlightMaterial);
        highlightMesh.position.copy(object.position);
        highlightMesh.rotation.copy(object.rotation);
        highlightMesh.scale.copy(object.scale);
        highlightMesh.matrixWorld.copy(object.matrixWorld);
        highlightMesh.name = `${object.name}_highlight`;
        highlightMesh.userData.isHighlight = true;
        highlightMesh.userData.originalObject = object;

        // Create wireframe overlay
        const wireframeMesh = new THREE.Mesh(object.geometry, wireframeMaterial);
        wireframeMesh.position.copy(object.position);
        wireframeMesh.rotation.copy(object.rotation);
        wireframeMesh.scale.copy(object.scale).multiplyScalar(1.001); // Slightly larger to avoid z-fighting
        wireframeMesh.matrixWorld.copy(object.matrixWorld);
        wireframeMesh.name = `${object.name}_wireframe`;
        wireframeMesh.userData.isHighlight = true;
        wireframeMesh.userData.originalObject = object;

        // Add to scene
        if (object.parent) {
            object.parent.add(highlightMesh);
            object.parent.add(wireframeMesh);
            console.log('Added highlight meshes to scene for:', object.name);
        } else {
            console.warn('Object has no parent, cannot add highlight:', object.name);
            return false;
        }

        // Store highlight info
        this.highlightedObjects.set(object.uuid, {
            originalObject: object,
            highlightMesh,
            wireframeMesh,
            startTime: this.animationClock.getElapsedTime(),
            options
        });

        console.log('Highlight created successfully for:', object.name, 'Total highlights:', this.highlightedObjects.size);
        return true;
    }

    /**
     * Remove highlight from object
     */
    removeHighlight(object) {
        if (!object) return false;

        const highlightInfo = this.highlightedObjects.get(object.uuid);
        if (highlightInfo) {
            console.log('Removing highlight from:', object.name);

            // Remove highlight meshes from scene
            if (highlightInfo.highlightMesh && highlightInfo.highlightMesh.parent) {
                highlightInfo.highlightMesh.parent.remove(highlightInfo.highlightMesh);
            }
            if (highlightInfo.wireframeMesh && highlightInfo.wireframeMesh.parent) {
                highlightInfo.wireframeMesh.parent.remove(highlightInfo.wireframeMesh);
            }

            // Dispose materials
            if (highlightInfo.highlightMesh && highlightInfo.highlightMesh.material) {
                highlightInfo.highlightMesh.material.dispose();
            }
            if (highlightInfo.wireframeMesh && highlightInfo.wireframeMesh.material) {
                highlightInfo.wireframeMesh.material.dispose();
            }

            this.highlightedObjects.delete(object.uuid);
            console.log('Highlight removed successfully. Remaining highlights:', this.highlightedObjects.size);
            return true;
        }
        return false;
    }

    /**
     * Clear all highlights
     */
    clearAllHighlights() {
        console.log('Clearing all highlights. Current count:', this.highlightedObjects.size);
        const objectIds = Array.from(this.highlightedObjects.keys());
        objectIds.forEach(uuid => {
            const highlightInfo = this.highlightedObjects.get(uuid);
            if (highlightInfo) {
                this.removeHighlight(highlightInfo.originalObject);
            }
        });
        console.log('All highlights cleared. Remaining:', this.highlightedObjects.size);
    }

    /**
     * Update highlight animations (call in animation loop)
     */
    updateHighlights() {
        const currentTime = this.animationClock.getElapsedTime();

        this.highlightedObjects.forEach((highlightInfo, uuid) => {
            const { highlightMesh, wireframeMesh, originalObject, startTime } = highlightInfo;

            // Update highlight transforms to match original object
            if (originalObject) {
                highlightMesh.position.copy(originalObject.position);
                highlightMesh.rotation.copy(originalObject.rotation);
                highlightMesh.scale.copy(originalObject.scale);
                highlightMesh.updateMatrix();
                highlightMesh.updateMatrixWorld();

                wireframeMesh.position.copy(originalObject.position);
                wireframeMesh.rotation.copy(originalObject.rotation);
                wireframeMesh.scale.copy(originalObject.scale).multiplyScalar(1.001);
                wireframeMesh.updateMatrix();
                wireframeMesh.updateMatrixWorld();
            }

            if (!this.pulseAnimation) return;

            // Calculate pulse effect
            const elapsed = currentTime - startTime;
            const pulseValue = (Math.sin(elapsed * this.pulseSpeed) + 1) * 0.5; // 0 to 1

            // Apply pulse to opacity and emissive intensity
            const baseOpacity = this.highlightOpacity;
            const pulsedOpacity = baseOpacity * (0.5 + pulseValue * 0.5); // Pulse between 50% and 100% of base opacity

            highlightMesh.material.opacity = pulsedOpacity;
            wireframeMesh.material.opacity = pulsedOpacity * 0.5;

            // Pulse emissive intensity
            const emissiveIntensity = this.highlightIntensity * (0.7 + pulseValue * 0.3);
            highlightMesh.material.emissiveIntensity = emissiveIntensity;
        });
    }

    /**
     * Get currently highlighted objects
     */
    getHighlightedObjects() {
        return Array.from(this.highlightedObjects.values()).map(info => info.originalObject);
    }

    /**
     * Check if object is highlighted
     */
    isHighlighted(object) {
        return this.highlightedObjects.has(object.uuid);
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.clearAllHighlights();
        this.originalMaterials.clear();
    }
}
