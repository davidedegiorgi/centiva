import { Canvas, useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import 'lenis/dist/lenis.css'

gsap.registerPlugin(ScrollTrigger)

const vertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  attribute float aScale;
  varying float vEnergy;

  void main() {
    vec3 p = position;
    float wave = sin(p.x * 1.7 + uTime * 0.28) * cos(p.y * 1.2 - uTime * 0.22);
    float cursor = 1.0 / (1.0 + distance(p.xy * 0.18, uMouse) * 3.5);
    p.z += wave * 0.5 + cursor * 1.35;
    p.xy += normalize(p.xy + vec2(0.001)) * cursor * 0.16;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (1.2 + aScale * 2.2 + cursor * 2.0) * (70.0 / -mvPosition.z);
    vEnergy = cursor + wave * 0.12;
  }
`

const fragmentShader = `
  varying float vEnergy;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float alpha = smoothstep(0.5, 0.08, length(uv));
    vec3 titanium = vec3(0.68, 0.71, 0.70);
    vec3 emerald = vec3(0.02, 0.72, 0.43);
    vec3 color = mix(titanium, emerald, clamp(vEnergy, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha * 0.38);
  }
`

function ParticleField() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const pointer = useRef(new THREE.Vector2())
  const geometry = useMemo(() => {
    const count = 760
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const randomX = Math.sin((index + 1) * 12.9898) * 43758.5453
      const randomY = Math.sin((index + 1) * 78.233) * 24634.6345
      const randomZ = Math.sin((index + 1) * 37.719) * 13579.2468
      const x = randomX - Math.floor(randomX)
      const y = randomY - Math.floor(randomY)
      const z = randomZ - Math.floor(randomZ)
      positions[index * 3] = (x - 0.5) * 18
      positions[index * 3 + 1] = (y - 0.5) * 11
      positions[index * 3 + 2] = (z - 0.5) * 4
      scales[index] = (x + y + z) / 3
    }
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    value.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    return value
  }, [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current.set(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1))
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uMouse.value.lerp(pointer.current, 0.045)
  })

  return <points geometry={geometry} rotation={[-0.08, 0, 0]}>
    <shaderMaterial ref={material} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={{ uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() } }} />
  </points>
}

function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ duration: 1.35, smoothWheel: true, wheelMultiplier: 0.82 })
    lenis.on('scroll', ScrollTrigger.update)
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(update); lenis.destroy() }
  }, [])
  return null
}

function ContextCursor() {
  const cursor = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!cursor.current || window.matchMedia('(pointer: coarse)').matches) return
    const moveX = gsap.quickTo(cursor.current, 'x', { duration: 0.55, ease: 'power4.out' })
    const moveY = gsap.quickTo(cursor.current, 'y', { duration: 0.55, ease: 'power4.out' })
    const move = (event: PointerEvent) => {
      moveX(event.clientX)
      moveY(event.clientY)
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor-label]')
      setLabel(target?.dataset.cursorLabel ?? '')
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return <div ref={cursor} className={`museum-cursor ${label ? 'is-active' : ''}`} aria-hidden="true"><span>{label}</span></div>
}

export function ExperienceLayer() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches

  return <>
    {!reduced && !coarse && <div className="webgl-field" aria-hidden="true"><Canvas camera={{ position: [0, 0, 7], fov: 52 }} dpr={[1, 1.4]} gl={{ antialias: false, alpha: true }}><ParticleField /></Canvas></div>}
    <SmoothScroll />
    <ContextCursor />
  </>
}
