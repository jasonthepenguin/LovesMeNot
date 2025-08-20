import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

// Game state
let currentPetal = 0;
let totalPetals = 8;
let lovesMe = true;
let petals: THREE.Mesh[] = [];
let flowerFace: THREE.Mesh;
let statusText: HTMLDivElement;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 10;
controls.maxDistance = 30;

// Camera position
camera.position.set(15, 12, 15);
camera.lookAt(0, 5, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffa500, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffdd88, 1.2);
sunLight.position.set(20, 15, -10);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
scene.add(sunLight);

// Sunset sky
function createSky() {
  const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0xff9966) },
      bottomColor: { value: new THREE.Color(0xffcc99) },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
}

// Create castle
function createCastle() {
  const group = new THREE.Group();
  
  // Castle base
  const baseGeometry = new THREE.BoxGeometry(12, 8, 12);
  const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x8B7355 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 4;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  
  // Turrets
  const turretGeometry = new THREE.CylinderGeometry(2, 2, 10, 8);
  const turretMaterial = new THREE.MeshPhongMaterial({ color: 0x9B8573 });
  
  const positions = [
    [-5, 8, -5], [5, 8, -5], [-5, 8, 5], [5, 8, 5]
  ];
  
  positions.forEach(pos => {
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.set(pos[0], pos[1], pos[2]);
    turret.castShadow = true;
    group.add(turret);
    
    // Turret tops
    const topGeometry = new THREE.ConeGeometry(2.5, 3, 8);
    const topMaterial = new THREE.MeshPhongMaterial({ color: 0xCC4444 });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.set(pos[0], pos[1] + 6.5, pos[2]);
    top.castShadow = true;
    group.add(top);
  });
  
  // Castle details - bricks pattern
  const brickGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.2);
  const brickMaterial = new THREE.MeshPhongMaterial({ color: 0x7A6550 });
  
  for (let i = 0; i < 8; i++) {
    const brick = new THREE.Mesh(brickGeometry, brickMaterial);
    brick.position.set(-4.5 + i * 1.5, 8.5, 6.1);
    group.add(brick);
    
    const brick2 = new THREE.Mesh(brickGeometry, brickMaterial);
    brick2.position.set(-4.5 + i * 1.5, 8.5, -6.1);
    group.add(brick2);
  }
  
  return group;
}

// Create Yoshi-like character
function createYoshi() {
  const group = new THREE.Group();
  
  // Body
  const bodyGeometry = new THREE.SphereGeometry(2, 16, 16);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.scale.set(1, 1.2, 0.9);
  body.castShadow = true;
  group.add(body);
  
  // Head
  const headGeometry = new THREE.SphereGeometry(1.5, 16, 16);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc00 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.set(0, 2, 0.5);
  head.scale.set(1.1, 1, 1.2);
  head.castShadow = true;
  group.add(head);
  
  // Snout
  const snoutGeometry = new THREE.SphereGeometry(0.8, 16, 16);
  const snoutMaterial = new THREE.MeshPhongMaterial({ color: 0x00dd00 });
  const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
  snout.position.set(0, 1.8, 1.8);
  snout.scale.set(1.2, 0.8, 1);
  group.add(snout);
  
  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const pupilGeometry = new THREE.SphereGeometry(0.15, 8, 8);
  const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.5, 2.2, 1.3);
  group.add(leftEye);
  
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(-0.5, 2.2, 1.45);
  group.add(leftPupil);
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.5, 2.2, 1.3);
  group.add(rightEye);
  
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0.5, 2.2, 1.45);
  group.add(rightPupil);
  
  // Shell
  const shellGeometry = new THREE.SphereGeometry(1.5, 8, 8);
  const shellMaterial = new THREE.MeshPhongMaterial({ color: 0xff4444 });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.position.set(0, 0.5, -1);
  shell.scale.set(1, 1, 0.8);
  shell.castShadow = true;
  group.add(shell);
  
  // Arms
  const armGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const armMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
  
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-1.5, 0, 0);
  leftArm.scale.set(1, 1.5, 0.8);
  group.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(1.5, 0, 0);
  rightArm.scale.set(1, 1.5, 0.8);
  group.add(rightArm);
  
  // Feet
  const footGeometry = new THREE.SphereGeometry(0.6, 8, 8);
  const footMaterial = new THREE.MeshPhongMaterial({ color: 0xff8800 });
  
  const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
  leftFoot.position.set(-0.8, -1.8, 0.3);
  leftFoot.scale.set(1, 0.8, 1.2);
  group.add(leftFoot);
  
  const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
  rightFoot.position.set(0.8, -1.8, 0.3);
  rightFoot.scale.set(1, 0.8, 1.2);
  group.add(rightFoot);
  
  return group;
}

// Create flower
function createFlower() {
  const group = new THREE.Group();
  
  // Stem
  const stemGeometry = new THREE.CylinderGeometry(0.2, 0.3, 5, 8);
  const stemMaterial = new THREE.MeshPhongMaterial({ color: 0x228822 });
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = 2.5;
  stem.castShadow = true;
  group.add(stem);
  
  // Flower center (face)
  const faceGeometry = new THREE.SphereGeometry(1.2, 16, 16);
  const faceMaterial = new THREE.MeshPhongMaterial({ color: 0xffaa00 });
  flowerFace = new THREE.Mesh(faceGeometry, faceMaterial);
  flowerFace.position.y = 5.5;
  flowerFace.castShadow = true;
  group.add(flowerFace);
  
  // Create face texture (simple eyes and mouth)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  function updateFace(happy: boolean) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, 0, 256, 256);
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(80, 100, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(176, 100, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (happy) {
      ctx.arc(128, 140, 40, 0, Math.PI);
    } else {
      ctx.arc(128, 180, 40, Math.PI, Math.PI * 2);
    }
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    flowerFace.material = new THREE.MeshPhongMaterial({ map: texture });
  }
  
  updateFace(true);
  
  // Petals
  const petalGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const petalMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  for (let i = 0; i < totalPetals; i++) {
    const angle = (i / totalPetals) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.position.set(
      Math.cos(angle) * 2.2,
      5.5,
      Math.sin(angle) * 2.2
    );
    petal.scale.set(1.2, 1, 0.6);
    petal.lookAt(flowerFace.position);
    petal.castShadow = true;
    petal.userData = { index: i, pulled: false };
    petals.push(petal);
    group.add(petal);
  }
  
  group.userData = { updateFace };
  return group;
}

// Create ground
function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x77aa77 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

// Add some background hills
function createHills() {
  const group = new THREE.Group();
  
  const hillGeometry = new THREE.SphereGeometry(15, 16, 16);
  const hillMaterial = new THREE.MeshPhongMaterial({ color: 0x669966 });
  
  const hill1 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill1.position.set(-30, -5, -30);
  hill1.scale.set(2, 1, 2);
  group.add(hill1);
  
  const hill2 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill2.position.set(25, -8, -35);
  hill2.scale.set(1.5, 0.8, 1.5);
  group.add(hill2);
  
  const hill3 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill3.position.set(0, -10, -40);
  hill3.scale.set(3, 1.2, 2);
  group.add(hill3);
  
  return group;
}

// Initialize scene
createSky();
scene.add(createGround());
scene.add(createHills());

const castle = createCastle();
scene.add(castle);

const yoshi = createYoshi();
yoshi.position.set(0, 8, 3);
scene.add(yoshi);

const flower = createFlower();
flower.position.set(5, 0, 8);
scene.add(flower);

// UI Elements
function createUI() {
  // Status text
  statusText = document.createElement('div');
  statusText.className = 'status-text';
  statusText.textContent = 'Click on a petal to start!';
  document.body.appendChild(statusText);
  
  // Instructions
  const instructions = document.createElement('div');
  instructions.className = 'instructions';
  instructions.innerHTML = `
    <h2>Loves Me Not</h2>
    <p>Click on the white petals to pull them off!</p>
    <button id="reset-btn">New Flower</button>
  `;
  document.body.appendChild(instructions);
  
  // Reset button
  document.getElementById('reset-btn')?.addEventListener('click', resetGame);
}

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(petals);
  
  if (intersects.length > 0) {
    const petal = intersects[0].object as THREE.Mesh;
    if (!petal.userData.pulled) {
      pullPetal(petal);
    }
  }
}

function pullPetal(petal: THREE.Mesh) {
  if (petal.userData.pulled) return;
  
  petal.userData.pulled = true;
  
  // Animate petal falling
  const fallAnimation = () => {
    petal.position.y -= 0.3;
    petal.rotation.x += 0.1;
    petal.rotation.z += 0.05;
    
    if (petal.position.y > -5) {
      requestAnimationFrame(fallAnimation);
    } else {
      petal.visible = false;
    }
  };
  fallAnimation();
  
  // Update game state
  lovesMe = !lovesMe;
  currentPetal++;
  
  // Update flower face
  flower.userData.updateFace(lovesMe);
  
  // Update status text
  if (currentPetal === totalPetals) {
    statusText.textContent = lovesMe ? '💖 LOVES ME! 💖' : '💔 Loves me not... 💔';
    statusText.classList.add(lovesMe ? 'loves-me' : 'loves-me-not');
  } else {
    statusText.textContent = lovesMe ? 'Loves me!' : 'Loves me not...';
  }
}

function resetGame() {
  // Reset game state
  currentPetal = 0;
  lovesMe = true;
  
  // Remove old petals
  petals.forEach(petal => {
    flower.remove(petal);
  });
  petals = [];
  
  // Create new petals
  const petalGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const petalMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  totalPetals = 6 + Math.floor(Math.random() * 5); // Random 6-10 petals
  
  for (let i = 0; i < totalPetals; i++) {
    const angle = (i / totalPetals) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.position.set(
      Math.cos(angle) * 2.2,
      5.5,
      Math.sin(angle) * 2.2
    );
    petal.scale.set(1.2, 1, 0.6);
    petal.lookAt(new THREE.Vector3(0, 5.5, 0));
    petal.castShadow = true;
    petal.userData = { index: i, pulled: false };
    petals.push(petal);
    flower.add(petal);
  }
  
  // Reset face
  flower.userData.updateFace(true);
  
  // Reset text
  statusText.textContent = 'Click on a petal to start!';
  statusText.classList.remove('loves-me', 'loves-me-not');
}

// Event listeners
window.addEventListener('click', onMouseClick);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize UI
createUI();

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Animate Yoshi idle
  yoshi.rotation.y = Math.sin(Date.now() * 0.001) * 0.1;
  yoshi.position.y = 8 + Math.sin(Date.now() * 0.002) * 0.1;
  
  // Animate flower gentle sway
  flower.rotation.z = Math.sin(Date.now() * 0.0015) * 0.05;
  
  controls.update();
  renderer.render(scene, camera);
}

animate();
