import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';

export function AnimationController({ updateAnimation }) {
    // Use useFrame to update animation every frame
    useFrame(() => {
        if (updateAnimation) {
            updateAnimation();
        }
    });

    return null; // This component doesn't render anything
}
