import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const FluidShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#000000') },
        uColor2: { value: new THREE.Color('#1a0b2e') },
        uColor3: { value: new THREE.Color('#ff0055') },
        uColor4: { value: new THREE.Color('#00ffff') },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform vec2 uMouse;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Simplex noise function
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 uv = vUv;
      float time = uTime * 0.2;
      
      float dist = distance(uv, uMouse);
      float mouseEffect = smoothstep(0.5, 0.0, dist) * 0.1;
      
      float n1 = snoise(uv * 3.0 + time + mouseEffect);
      float n2 = snoise(uv * 6.0 - time + n1 * 2.0);
      float n3 = snoise(uv * 12.0 + time - n2 * 4.0);
      
      vec3 color = mix(uColor1, uColor2, n1 + 0.5);
      color = mix(color, uColor3, n2 * 0.5 + 0.5);
      color += uColor4 * max(0.0, n3 - 0.5) * 2.0;

      float vignette = 1.0 - length(uv - 0.5) * 1.5;
      color *= clamp(vignette + 0.2, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

function FluidPlane() {
    const meshRef = useRef<THREE.Mesh>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);
    const { viewport } = useThree();

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#050510') },
        uColor2: { value: new THREE.Color('#1a0b2e') },
        uColor3: { value: new THREE.Color('#ff0055').multiplyScalar(0.8) },
        uColor4: { value: new THREE.Color('#00ffff').multiplyScalar(0.5) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(1, 1) },
    }), []);

    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            const uvMouse = new THREE.Vector2(
                (state.pointer.x + 1) / 2,
                (state.pointer.y + 1) / 2
            );
            shaderRef.current.uniforms.uMouse.value.lerp(uvMouse, 0.1);
        }
    });

    return (
        <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
                ref={shaderRef}
                args={[FluidShaderMaterial]}
                uniforms={uniforms}
            />
        </mesh>
    );
}

export default function FluidBackground() {
    return (
        <div
            className="fixed inset-0 z-[-1]"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1
            }}
        >
            <Canvas camera={{ position: [0, 0, 1], fov: 75 }}>
                <FluidPlane />
            </Canvas>
        </div>
    );
}
