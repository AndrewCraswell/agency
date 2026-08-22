// Browser-only viewer copied into the generated preview by src/build.ts.
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

async function initializeViewer() {
  const canvas = document.querySelector("#board-3d-canvas")
  const resetButton = document.querySelector("#reset-3d-view")
  const modelElement = document.querySelector("#board-3d-model")
  const statusElement = document.querySelector("#board-3d-status")

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(resetButton instanceof HTMLButtonElement) ||
    !(modelElement instanceof HTMLScriptElement) ||
    !(statusElement instanceof HTMLParagraphElement)
  ) {
    throw new Error("Interactive 3D viewer controls are missing")
  }
  canvas.dataset.viewerState = "loading"

  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#101820")
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x26331f, 2.4))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(100, 180, 120)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x8db7ff, 1.1)
  fillLight.position.set(-120, 80, -100)
  scene.add(fillLight)

  function decodeModel(encodedModel) {
    const binary = atob(encodedModel.trim())
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes.buffer
  }

  const boardModel = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(decodeModel(modelElement.textContent ?? ""), "", (gltf) => resolve(gltf.scene), reject)
  })
  scene.add(boardModel)

  const bounds = new THREE.Box3().setFromObject(boardModel)
  const target = bounds.getCenter(new THREE.Vector3())
  const modelSize = bounds.getSize(new THREE.Vector3())
  const maximumDimension = Math.max(modelSize.x, modelSize.y, modelSize.z)

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000)
  const viewingDistance = maximumDimension * 1.45
  const initialCameraPosition = target
    .clone()
    .add(new THREE.Vector3(viewingDistance * 0.72, viewingDistance * 0.6, viewingDistance * 0.72))
  camera.position.copy(initialCameraPosition)
  camera.near = Math.max(maximumDimension / 1000, 0.01)
  camera.far = maximumDimension * 100

  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.maxDistance = maximumDimension * 8
  controls.maxPolarAngle = Math.PI * 0.95
  controls.minDistance = maximumDimension * 0.25
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
  statusElement.hidden = true
  requestAnimationFrame(resize)
}

void initializeViewer().catch((error) => {
  const canvas = document.querySelector("#board-3d-canvas")
  const statusElement = document.querySelector("#board-3d-status")
  if (canvas instanceof HTMLCanvasElement) canvas.dataset.viewerState = "error"
  if (statusElement instanceof HTMLParagraphElement)
    statusElement.textContent = "The detailed board model could not be displayed"
  console.error(error)
})
