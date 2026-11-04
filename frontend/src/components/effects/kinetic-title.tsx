import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float force = exp(-distance(uv, uPointer) * 7.0);
    p.z += sin(uv.x * 18.0 + uTime * 2.0) * force * 0.05;
    p.y += sin(uv.x * 8.0 + uTime) * force * 0.025;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uPointer;
  varying vec2 vUv;
  void main() {
    vec2 direction = vUv - uPointer;
    float force = exp(-length(direction) * 8.0);
    vec2 warp = direction * force * 0.06;
    float split = force * 0.009;
    float r = texture2D(uTexture, vUv + warp + vec2(split, 0.0)).r;
    float g = texture2D(uTexture, vUv + warp).g;
    float b = texture2D(uTexture, vUv + warp - vec2(split, 0.0)).b;
    float alpha = max(r, max(g, b));
    vec3 color = vec3(r, g, b);
    gl_FragColor = vec4(color, alpha * 0.92);
  }
`

function TitlePlane({ text }: { text: string }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const target = useRef(new THREE.Vector2(-2, -2))
  const { viewport } = useThree()
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 540
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#f4f4f0'
    context.font = "900 300px 'Syne Variable', sans-serif"
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 10)
    const value = new THREE.CanvasTexture(canvas)
    value.colorSpace = THREE.SRGBColorSpace
    value.minFilter = THREE.LinearFilter
    return value
  }, [text])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uPointer.value.lerp(target.current, 0.09)
  })

  return <mesh onPointerMove={(event) => target.current.set(event.uv?.x ?? 0.5, event.uv?.y ?? 0.5)} onPointerLeave={() => target.current.set(-2, -2)}>
    <planeGeometry args={[Math.min(viewport.width * 0.96, 12), Math.min(viewport.width * 0.225, 2.7), 64, 20]} />
    <shaderMaterial ref={material} transparent depthWrite={false} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={{ uTexture: { value: texture }, uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(-2, -2) } }} />
  </mesh>
}

export function KineticTitle({ text }: { text: string }) {
  return <div className="kinetic-title" data-cursor-label="DISTORT">
    <span className="sr-only">{text}</span>
    <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 90 }} dpr={[1, 1.35]} gl={{ alpha: true, antialias: false }}>
      <TitlePlane text={text} />
    </Canvas>
  </div>
}
