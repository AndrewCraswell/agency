// Browser-only viewer copied into the generated preview by src/build.ts.
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

async function initializeViewer() {
  const canvas = document.querySelector("#board-3d-canvas")
  const resetButton = document.querySelector("#reset-3d-view")
  const sceneElement = document.querySelector("#board-3d-scene")

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(resetButton instanceof HTMLButtonElement) ||
    !(sceneElement instanceof HTMLScriptElement)
  ) {
    throw new Error("Interactive 3D viewer controls are missing")
  }
  canvas.dataset.viewerState = "loading"

  const sceneData = JSON.parse(sceneElement.textContent ?? "")

  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#101820")
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x26331f, 2.4))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(100, 180, 120)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x8db7ff, 1.1)
  fillLight.position.set(-120, 80, -100)
  scene.add(fillLight)

  function materialFor(colorValue) {
    const match = typeof colorValue === "string" ? colorValue.match(/rgba?\(([^)]+)\)/) : null
    if (!match) return new THREE.MeshStandardMaterial({ color: colorValue || "#808080", roughness: 0.72 })

    const [red, green, blue, alpha = 1] = match[1].split(",").map(Number)
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(red / 255, green / 255, blue / 255),
      opacity: alpha,
      roughness: 0.72,
      transparent: alpha < 1
    })
  }

  for (const box of sceneData.boxes) {
    const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z)
    const mesh = new THREE.Mesh(geometry, materialFor(box.color))
    mesh.position.set(box.center.x, box.center.y, box.center.z)
    if (box.rotation) mesh.rotation.set(box.rotation.x || 0, box.rotation.y || 0, box.rotation.z || 0)
    scene.add(mesh)
  }

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000)
  const initialCameraPosition = new THREE.Vector3(
    sceneData.camera.position.x,
    sceneData.camera.position.y,
    sceneData.camera.position.z
  )
  const target = new THREE.Vector3(sceneData.camera.lookAt.x, sceneData.camera.lookAt.y, sceneData.camera.lookAt.z)
  camera.position.copy(initialCameraPosition)

  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.maxDistance = 700
  controls.maxPolarAngle = Math.PI * 0.95
  controls.minDistance = 75
  controls.target.copy(target)
  controls.update()

  function render() {
    renderer.render(scene, camera)
  }

  function resize() {
    const parent = canvas.parentElement
    if (!parent || parent.clientWidth === 0 || parent.clientHeight === 0) return
    renderer.setSize(parent.clientWidth, parent.clientHeight, false)
    camera.aspect = parent.clientWidth / parent.clientHeight
    camera.updateProjectionMatrix()
    render()
  }

  function resetView() {
    camera.position.copy(initialCameraPosition)
    controls.target.copy(target)
    controls.update()
    render()
  }

  controls.addEventListener("change", render)
  resetButton.addEventListener("click", resetView)
  canvas.addEventListener("keydown", (event) => {
    const horizontalStep = Math.PI / 24
    if (event.key === "ArrowLeft") camera.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, horizontalStep)
    else if (event.key === "ArrowRight") camera.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -horizontalStep)
    else if (event.key === "ArrowUp") camera.position.y = Math.min(camera.position.y + 12, 500)
    else if (event.key === "ArrowDown") camera.position.y = Math.max(camera.position.y - 12, 12)
    else return
    event.preventDefault()
    camera.lookAt(controls.target)
    controls.update()
    render()
  })

  new ResizeObserver(resize).observe(canvas.parentElement)
  window.addEventListener("circuit-view-changed", (event) => {
    if (event.detail === "view-3d") requestAnimationFrame(resize)
  })
  canvas.dataset.viewerState = "ready"
  requestAnimationFrame(resize)
}

void initializeViewer()
