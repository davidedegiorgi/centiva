import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Float, RoundedBox } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

const receiptVertex = `
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vBend;
  void main() {
    vUv = uv;
    vec3 p = position;
    float distanceToPointer = distance(uv, uPointer);
    float lens = exp(-distanceToPointer * 8.0);
    float ribs = sin(uv.y * 90.0 + uTime * 1.8) * 0.006;
    p.z += lens * 0.14 + ribs;
    p.x += (uv.y - 0.5) * lens * 0.04;
    vBend = lens;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const receiptFragment = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uScanning;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vBend;
  void main() {
    vec2 direction = vUv - uPointer;
    vec2 refracted = vUv + direction * vBend * 0.035;
    float r = texture2D(uTexture, refracted + vec2(0.004 * vBend, 0.0)).r;
    float g = texture2D(uTexture, refracted).g;
    float b = texture2D(uTexture, refracted - vec2(0.004 * vBend, 0.0)).b;
    vec3 color = vec3(r, g, b);
    float scanY = fract(uTime * 0.22);
    float laser = smoothstep(0.025, 0.0, abs(vUv.y - scanY)) * uScanning;
    float grid = (step(0.97, fract(vUv.x * 22.0)) + step(0.97, fract(vUv.y * 30.0))) * 0.12 * uScanning;
    color += vec3(0.1, 1.0, 0.62) * (laser * 1.8 + grid);
    gl_FragColor = vec4(color, 1.0);
  }
`

function ReceiptObject({ imageUrl, scanning }: { imageUrl: string; scanning: boolean }) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const target = useRef(new THREE.Vector2(0.5, 0.5))
  const texture = useLoader(THREE.TextureLoader, imageUrl)
  const uniforms = useMemo(() => ({ uTexture: { value: texture }, uTime: { value: 0 }, uScanning: { value: scanning ? 1 : 0 }, uPointer: { value: new THREE.Vector2(0.5, 0.5) } }), [texture, scanning])

  useFrame(({ clock }, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value = clock.elapsedTime
      material.current.uniforms.uScanning.value = THREE.MathUtils.damp(material.current.uniforms.uScanning.value, scanning ? 1 : 0, 5, delta)
      material.current.uniforms.uPointer.value.lerp(target.current, 0.08)
    }
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, (0.5 - target.current.y) * 0.28, 5, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, (target.current.x - 0.5) * 0.4, 5, delta)
    }
  })

  return <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.18}>
    <group ref={group} onPointerMove={(event) => target.current.set(event.uv?.x ?? 0.5, event.uv?.y ?? 0.5)} onPointerLeave={() => target.current.set(0.5, 0.5)}>
      <RoundedBox args={[2.32, 3.12, 0.16]} radius={0.08} smoothness={5} position={[0, 0, -0.09]}><meshStandardMaterial color="#292b2a" metalness={0.72} roughness={0.28} /></RoundedBox>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[2.18, 2.96, 48, 48]} />
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={receiptVertex} fragmentShader={receiptFragment} />
      </mesh>
    </group>
  </Float>
}

export function ReceiptMonolith({ imageUrl, scanning }: { imageUrl: string; scanning: boolean }) {
  return <div className="receipt-monolith" data-cursor-label="SCAN / TILT">
    <Canvas camera={{ position: [0, 0, 4.4], fov: 42 }} dpr={[1, 1.5]}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 4, 5]} intensity={3} color="#d8fff0" />
      <Suspense fallback={null}><ReceiptObject imageUrl={imageUrl} scanning={scanning} /></Suspense>
    </Canvas>
  </div>
}
