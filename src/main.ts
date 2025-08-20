import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

// Game state
let currentPetal = 0;
let totalPetals = 8;
let lovesMe = true;
let statusText: HTMLDivElement;
let flowerContainer: HTMLDivElement;

// Scene object refs for animation
let yoshiHeadGroup: THREE.Group;
let yoshiTail: THREE.Mesh;
let yoshiLeftEye: THREE.Mesh;
let yoshiRightEye: THREE.Mesh;
let waterSurface: THREE.Mesh;
let deepWaterSurface: THREE.Mesh;
let cloudGroups: THREE.Group[] = [];
let hillsMeta: Array<{ x: number; z: number; rx: number; rz: number; y: number; ry: number }> = [];
let hillsGroupRef: THREE.Group; // reference to hills group for hill-top placement
let yoshiLeftElbow: THREE.Group;
let yoshiRightElbow: THREE.Group;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Tone mapping and color for a nicer look
// @ts-ignore - available in current three versions
renderer.outputColorSpace = THREE.SRGBColorSpace;
// @ts-ignore
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 10;
controls.maxDistance = 50;

// Camera position
camera.position.set(20.92, 23.86, -11.35);
// Set the look direction based on the look vector
const lookTarget = new THREE.Vector3(
  camera.position.x - 0.709,
  camera.position.y - 0.402,
  camera.position.z + 0.579
);
camera.lookAt(lookTarget);

// Gentle atmospheric fog
scene.fog = new THREE.Fog(0xffccaa, 80, 220);

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
  const skyGeometry = new THREE.SphereGeometry(200, 32, 32);
  const textureLoader = new THREE.TextureLoader();
  const skyTexture = textureLoader.load('/sunset.png');
  // @ts-ignore
  if ('SRGBColorSpace' in THREE) skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.wrapS = THREE.ClampToEdgeWrapping;
  skyTexture.wrapT = THREE.ClampToEdgeWrapping;
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
}

// Create castle
function createCastle() {
  const group = new THREE.Group();
  
  // Castle base
  const baseGeometry = new THREE.BoxGeometry(12, 8, 12);
  const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x9a9a9a, specular: 0x333333, shininess: 10 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 4;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  
  // Turrets
  const turretGeometry = new THREE.CylinderGeometry(2, 2, 10, 8);
  const turretMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, specular: 0x333333, shininess: 12 });
  
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
  const brickMaterial = new THREE.MeshPhongMaterial({ color: 0x7a7a7a, specular: 0x222222, shininess: 8 });
  
  for (let i = 0; i < 8; i++) {
    const brick = new THREE.Mesh(brickGeometry, brickMaterial);
    brick.position.set(-4.5 + i * 1.5, 8.5, 6.1);
    group.add(brick);
    
    const brick2 = new THREE.Mesh(brickGeometry, brickMaterial);
    brick2.position.set(-4.5 + i * 1.5, 8.5, -6.1);
    group.add(brick2);
  }

  // Simple crenellations along the walls
  const crenelGeometry = new THREE.BoxGeometry(1, 0.8, 1);
  const crenelMaterial = new THREE.MeshPhongMaterial({ color: 0x9a9a9a, specular: 0x333333, shininess: 10 });

  for (let x = -5.5; x <= 5.5; x += 2) {
    const front = new THREE.Mesh(crenelGeometry, crenelMaterial);
    front.position.set(x, 8.9, 6.2);
    front.castShadow = true;
    group.add(front);
    const back = new THREE.Mesh(crenelGeometry, crenelMaterial);
    back.position.set(x, 8.9, -6.2);
    back.castShadow = true;
    group.add(back);
  }
  for (let z = -3.5; z <= 3.5; z += 2) {
    const left = new THREE.Mesh(crenelGeometry, crenelMaterial);
    left.position.set(-6.2, 8.9, z);
    left.castShadow = true;
    group.add(left);
    const right = new THREE.Mesh(crenelGeometry, crenelMaterial);
    right.position.set(6.2, 8.9, z);
    right.castShadow = true;
    group.add(right);
  }
  
  return group;
}

// Create Yoshi-like character
function createYoshi() {
  const group = new THREE.Group();
  
  // Body (sitting position - refined proportions)
  const bodyGeometry = new THREE.SphereGeometry(1.9, 20, 20);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x0aa50a, specular: 0x224422, shininess: 20 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.scale.set(0.95, 1.05, 0.85);
  body.position.y = -0.45;
  body.castShadow = true;
  group.add(body);
  
  // Belly (lighter green)
  const bellyGeometry = new THREE.SphereGeometry(1.55, 20, 20);
  const bellyMaterial = new THREE.MeshPhongMaterial({ color: 0x88ff88, specular: 0x335533, shininess: 25 });
  const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
  belly.position.set(0, -0.5, 0.68);
  belly.scale.set(0.72, 0.72, 0.42);
  group.add(belly);
  
  // Head hierarchy
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.95, 0.28);
  group.add(headGroup);
  yoshiHeadGroup = headGroup;
  
  const headGeometry = new THREE.SphereGeometry(1.65, 20, 20);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc00, specular: 0x224422, shininess: 25 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.scale.set(1.08, 1.0, 1.18);
  head.castShadow = true;
  headGroup.add(head);
  
  // Snout (bigger and more pronounced) - relative to head
  const snoutGeometry = new THREE.SphereGeometry(0.95, 20, 20);
  const snoutMaterial = new THREE.MeshPhongMaterial({ color: 0x00dd00, specular: 0x224422, shininess: 20 });
  const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
  snout.position.set(0, -0.22, 1.26);
  snout.scale.set(1.18, 0.92, 1.0);
  headGroup.add(snout);
  
  // Nostrils - children of snout for correct anchoring
  const nostrilGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  const nostrilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
  leftNostril.position.set(-0.2, 0.05, 0.85);
  snout.add(leftNostril);
  const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
  rightNostril.position.set(0.2, 0.05, 0.85);
  snout.add(rightNostril);
  
  // Eyes (grouped and relative to head)
  const eyeWhiteGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const eyeWhiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  leftEyeWhite.position.set(-0.76, 0.52, 1.46);
  leftEyeWhite.scale.set(0.78, 1, 0.68);
  headGroup.add(leftEyeWhite);
  yoshiLeftEye = leftEyeWhite;
  
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  rightEyeWhite.position.set(0.76, 0.52, 1.46);
  rightEyeWhite.scale.set(0.78, 1, 0.68);
  headGroup.add(rightEyeWhite);
  yoshiRightEye = rightEyeWhite;
  
  // Pupils - attach to the eye whites so they stay aligned
  const pupilGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(0, 0, 0.28);
  leftEyeWhite.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0, 0, 0.28);
  rightEyeWhite.add(rightPupil);
  
  // Eye highlights
  const highlightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const highlightMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  leftHighlight.position.set(-0.1, 0.1, 0.2);
  leftPupil.add(leftHighlight);
  const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  rightHighlight.position.set(-0.1, 0.1, 0.2);
  rightPupil.add(rightHighlight);
  
  // Shell (saddle-like)
  const shellGeometry = new THREE.SphereGeometry(1.8, 12, 8);
  const shellMaterial = new THREE.MeshPhongMaterial({ color: 0xff4444 });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.position.set(0, 0.2, -1.2);
  shell.scale.set(1.2, 1, 1);
  shell.castShadow = true;
  group.add(shell);
  
  // Shell rim
  const rimGeometry = new THREE.TorusGeometry(1.5, 0.15, 8, 16);
  const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.set(0, 0.2, -1.2);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  
  // Arms with proper pivots (shoulder -> elbow)
  const upperArmGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
  const armMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
  const handGeometry = new THREE.SphereGeometry(0.4, 8, 8);
  const handMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  // Left arm
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-1.6, 0.6, 0.2);
  group.add(leftShoulder);
  leftShoulder.rotation.y = Math.PI / 12; // slight inward
  const leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  leftUpperArm.position.y = -0.6; // anchor at shoulder
  leftUpperArm.rotation.z = Math.PI / 8;
  leftUpperArm.rotation.x = -Math.PI / 6; // bring slightly forward
  leftUpperArm.castShadow = true;
  leftShoulder.add(leftUpperArm);
  const leftElbow = new THREE.Group();
  leftElbow.position.set(0.6, -0.9, 1.2); // move forward and slightly inward
  leftElbow.rotation.x = -Math.PI / 10;
  leftShoulder.add(leftElbow);
  yoshiLeftElbow = leftElbow;
  const leftLowerArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  leftLowerArm.scale.set(0.8, 1, 0.8);
  leftLowerArm.position.y = -0.6; // anchor at elbow
  leftElbow.add(leftLowerArm);
  const leftHand = new THREE.Mesh(handGeometry, handMaterial);
  leftHand.position.set(0.1, -1.0, 0.65);
  leftElbow.add(leftHand);
  // store base for animation
  leftElbow.userData.base = leftElbow.position.clone();
  
  // Right arm
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(1.6, 0.6, 0.2);
  group.add(rightShoulder);
  rightShoulder.rotation.y = -Math.PI / 12; // slight inward
  const rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  rightUpperArm.position.y = -0.6;
  rightUpperArm.rotation.z = -Math.PI / 8;
  rightUpperArm.rotation.x = -Math.PI / 6; // bring slightly forward
  rightUpperArm.castShadow = true;
  rightShoulder.add(rightUpperArm);
  const rightElbow = new THREE.Group();
  rightElbow.position.set(-0.6, -0.9, 1.2); // move forward and slightly inward
  rightElbow.rotation.x = -Math.PI / 10;
  rightShoulder.add(rightElbow);
  yoshiRightElbow = rightElbow;
  const rightLowerArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  rightLowerArm.scale.set(0.8, 1, 0.8);
  rightLowerArm.position.y = -0.6;
  rightElbow.add(rightLowerArm);
  const rightHand = new THREE.Mesh(handGeometry, handMaterial);
  rightHand.position.set(-0.1, -1.0, 0.65);
  rightElbow.add(rightHand);
  rightElbow.userData.base = rightElbow.position.clone();
  
  // Legs (sitting position - bent)
  const thighGeometry = new THREE.CylinderGeometry(0.5, 0.6, 1.5, 8);
  const legMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
  
  // Left leg (thigh)
  const leftThigh = new THREE.Mesh(thighGeometry, legMaterial);
  leftThigh.position.set(-1, -1.2, 1.2);
  leftThigh.rotation.x = Math.PI / 3;
  leftThigh.castShadow = true;
  group.add(leftThigh);
  
  // Left shin
  const shinGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.3, 8);
  const leftShin = new THREE.Mesh(shinGeometry, legMaterial);
  leftShin.position.set(-1, -1.8, 2.0);
  leftShin.rotation.x = Math.PI / 6;
  group.add(leftShin);
  
  // Right leg (thigh)
  const rightThigh = new THREE.Mesh(thighGeometry, legMaterial);
  rightThigh.position.set(1, -1.2, 1.2);
  rightThigh.rotation.x = Math.PI / 3;
  rightThigh.castShadow = true;
  group.add(rightThigh);
  
  // Right shin
  const rightShin = new THREE.Mesh(shinGeometry, legMaterial);
  rightShin.position.set(1, -1.8, 2.0);
  rightShin.rotation.x = Math.PI / 6;
  group.add(rightShin);
  
  // Feet/Shoes (bigger and more detailed)
  const footGeometry = new THREE.SphereGeometry(0.7, 8, 8);
  const footMaterial = new THREE.MeshPhongMaterial({ color: 0xff8800 });
  
  const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
  leftFoot.position.set(-1, -2.2, 3);
  leftFoot.scale.set(1.2, 0.8, 1.5);
  leftFoot.castShadow = true;
  group.add(leftFoot);
  
  const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
  rightFoot.position.set(1, -2.2, 3);
  rightFoot.scale.set(1.2, 0.8, 1.5);
  rightFoot.castShadow = true;
  group.add(rightFoot);
  
  // Tail
  const tailGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const tailMaterial = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
  const tail = new THREE.Mesh(tailGeometry, tailMaterial);
  tail.position.set(0, -0.5, -2);
  tail.scale.set(1, 0.8, 1.5);
  group.add(tail);
  yoshiTail = tail;
  
  return group;
}

// Create 2D flower UI
function create2DFlower() {
  flowerContainer = document.createElement('div');
  flowerContainer.className = 'flower-container';
  flowerContainer.innerHTML = `
    <div class="flower-stem"></div>
    <div class="flower">
      <div class="flower-center" id="flower-face">
        <div class="flower-shine"></div>
        <div class="flower-eyes">
          <div class="eye">
            <div class="eye-sparkle"></div>
          </div>
          <div class="eye">
            <div class="eye-sparkle"></div>
          </div>
        </div>
        <div class="flower-mouth happy"></div>
        <div class="flower-cheeks">
          <div class="cheek"></div>
          <div class="cheek"></div>
        </div>
      </div>
      <div class="petals" id="petals-container"></div>
    </div>
  `;
  document.body.appendChild(flowerContainer);
  
  // Create petals
  createPetals();
}

function createPetals() {
  const petalsContainer = document.getElementById('petals-container')!;
  petalsContainer.innerHTML = '';
  
  for (let i = 0; i < totalPetals; i++) {
    const angle = (i / totalPetals) * Math.PI * 2 - Math.PI / 2; // Start from top
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.dataset.index = i.toString();
    
    // Add inner petal detail
    const petalInner = document.createElement('div');
    petalInner.className = 'petal-inner';
    petal.appendChild(petalInner);
    
    // Position petals in a circle
    const x = Math.cos(angle) * 65;
    const y = Math.sin(angle) * 65;
    const rotationDeg = (angle * 180 / Math.PI) + 90;
    petal.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotationDeg}deg)`;
    
    // Stagger animation
    petal.style.animationDelay = `${i * 0.05}s`;
    
    petal.addEventListener('click', () => pullPetal(petal));
    petalsContainer.appendChild(petal);
  }
}

function updateFlowerFace(happy: boolean) {
  const mouth = document.querySelector('.flower-mouth')!;
  const face = document.getElementById('flower-face')!;
  if (happy) {
    mouth.classList.add('happy');
    mouth.classList.remove('sad');
    face.classList.remove('sad');
  } else {
    mouth.classList.add('sad');
    mouth.classList.remove('happy');
    face.classList.add('sad');
  }
}

// Create ground
function createGround() {
  const group = new THREE.Group();
  
  // Main ground (larger)
  const groundGeometry = new THREE.PlaneGeometry(800, 800);
  const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x77aa77 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  
  // Castle island (raised platform)
  const islandGeometry = new THREE.CylinderGeometry(18, 20, 2, 32);
  const islandMaterial = new THREE.MeshPhongMaterial({ color: 0x8B7355 });
  const island = new THREE.Mesh(islandGeometry, islandMaterial);
  island.position.y = 1;
  island.receiveShadow = true;
  island.castShadow = true;
  group.add(island);
  
  // Grass on island
  const grassGeometry = new THREE.CylinderGeometry(18, 18, 0.2, 32);
  const grassMaterial = new THREE.MeshPhongMaterial({ color: 0x55aa55 });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.position.y = 2.1;
  grass.receiveShadow = true;
  group.add(grass);
  
  return group;
}

// Create water moat
function createWater() {
  const group = new THREE.Group();
  
  // Water surface
  const waterGeometry = new THREE.RingGeometry(22, 35, 64);
  const waterMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x006994,
    transparent: true,
    opacity: 0.8,
    shininess: 100
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.5;
  water.receiveShadow = true;
  group.add(water);
  waterSurface = water;
  
  // Add some depth variation with darker water
  const deepWaterGeometry = new THREE.RingGeometry(24, 33, 64);
  const deepWaterMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x004466,
    transparent: true,
    opacity: 0.6
  });
  const deepWater = new THREE.Mesh(deepWaterGeometry, deepWaterMaterial);
  deepWater.rotation.x = -Math.PI / 2;
  deepWater.position.y = 0.3;
  group.add(deepWater);
  deepWaterSurface = deepWater;
  
  return group;
}

// Create bridge
function createBridge() {
  const group = new THREE.Group();
  
  // Bridge deck
  const deckGeometry = new THREE.BoxGeometry(8, 0.5, 14);
  const deckMaterial = new THREE.MeshPhongMaterial({ color: 0x8B6F47 });
  const deck = new THREE.Mesh(deckGeometry, deckMaterial);
  deck.position.set(0, 1.5, 28);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  
  // Bridge supports
  const supportGeometry = new THREE.BoxGeometry(0.8, 3, 0.8);
  const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x6B5637 });
  
  // Four support posts
  const positions = [
    [-3, 0, 22], [3, 0, 22],
    [-3, 0, 34], [3, 0, 34]
  ];
  
  positions.forEach(pos => {
    const support = new THREE.Mesh(supportGeometry, supportMaterial);
    support.position.set(pos[0], pos[1], pos[2]);
    support.castShadow = true;
    group.add(support);
  });
  
  // Railings
  const railGeometry = new THREE.BoxGeometry(0.3, 1.5, 14);
  const railMaterial = new THREE.MeshPhongMaterial({ color: 0x6B5637 });
  
  const leftRail = new THREE.Mesh(railGeometry, railMaterial);
  leftRail.position.set(-3.8, 2.5, 28);
  leftRail.castShadow = true;
  group.add(leftRail);
  
  const rightRail = new THREE.Mesh(railGeometry, railMaterial);
  rightRail.position.set(3.8, 2.5, 28);
  rightRail.castShadow = true;
  group.add(rightRail);
  
  // Decorative arches
  const archGeometry = new THREE.TorusGeometry(4, 0.3, 8, 16, Math.PI);
  const archMaterial = new THREE.MeshPhongMaterial({ color: 0x8B6F47 });
  const arch = new THREE.Mesh(archGeometry, archMaterial);
  arch.position.set(0, 5, 28);
  arch.rotation.z = Math.PI;
  arch.castShadow = true;
  group.add(arch);
  
  return group;
}

// Add some background hills
function createHills() {
  const group = new THREE.Group();
  // Reset hill footprints before populating
  hillsMeta = [];
  
  const hillGeometry = new THREE.SphereGeometry(25, 16, 16);
  const hillMaterial = new THREE.MeshPhongMaterial({ color: 0x669966 });
  
  // More and larger hills (repositioned to avoid bridge)
  const hill1 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill1.position.set(-50, -10, -60);
  hill1.scale.set(2.5, 1.2, 2.5);
  group.add(hill1);
  hillsMeta.push({ x: hill1.position.x, z: hill1.position.z, rx: 25 * hill1.scale.x, rz: 25 * hill1.scale.z, y: hill1.position.y, ry: 25 * hill1.scale.y });
  
  const hill2 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill2.position.set(45, -12, -65);
  hill2.scale.set(2, 1, 2);
  group.add(hill2);
  hillsMeta.push({ x: hill2.position.x, z: hill2.position.z, rx: 25 * hill2.scale.x, rz: 25 * hill2.scale.z, y: hill2.position.y, ry: 25 * hill2.scale.y });
  
  const hill3 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill3.position.set(30, -15, -80);  // Moved to the side to avoid bridge
  hill3.scale.set(3.5, 1.5, 2.5);
  group.add(hill3);
  hillsMeta.push({ x: hill3.position.x, z: hill3.position.z, rx: 25 * hill3.scale.x, rz: 25 * hill3.scale.z, y: hill3.position.y, ry: 25 * hill3.scale.y });
  
  const hill4 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill4.position.set(-60, -8, 30);
  hill4.scale.set(2, 1.3, 2);
  group.add(hill4);
  hillsMeta.push({ x: hill4.position.x, z: hill4.position.z, rx: 25 * hill4.scale.x, rz: 25 * hill4.scale.z, y: hill4.position.y, ry: 25 * hill4.scale.y });
  
  const hill5 = new THREE.Mesh(hillGeometry, hillMaterial);
  hill5.position.set(55, -10, 40);
  hill5.scale.set(2.2, 1, 2.2);
  group.add(hill5);
  hillsMeta.push({ x: hill5.position.x, z: hill5.position.z, rx: 25 * hill5.scale.x, rz: 25 * hill5.scale.z, y: hill5.position.y, ry: 25 * hill5.scale.y });
  
  // Add some distant mountains
  const mountainGeometry = new THREE.ConeGeometry(30, 40, 8);
  const mountainMaterial = new THREE.MeshPhongMaterial({ color: 0x556b55 });
  
  const mountain1 = new THREE.Mesh(mountainGeometry, mountainMaterial);
  mountain1.position.set(-80, 10, -90);
  mountain1.rotation.y = Math.random() * Math.PI;
  group.add(mountain1);
  
  const mountain2 = new THREE.Mesh(mountainGeometry, mountainMaterial);
  mountain2.position.set(75, 8, -85);
  mountain2.scale.set(0.8, 1.2, 0.8);
  mountain2.rotation.y = Math.random() * Math.PI;
  group.add(mountain2);
  
  hillsGroupRef = group;
  return group;
}

// Add trees for environment polish
function createTrees() {
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x6b4f2a });
  const leafMaterial = new THREE.MeshPhongMaterial({ color: 0x2e8b57 });

  function isInHillFootprint(x: number, z: number): boolean {
    for (const h of hillsMeta) {
      const dx = x - h.x;
      const dz = z - h.z;
      const nx = dx / (h.rx + 5); // small margin to avoid edges
      const nz = dz / (h.rz + 5);
      if (nx * nx + nz * nz <= 1) return true;
    }
    return false;
  }

  function isValid(x: number, z: number): boolean {
    const r = Math.sqrt(x * x + z * z);
    if (r < 40) return false; // keep outside moat area
    if (isInHillFootprint(x, z)) return false;
    return true;
  }

  const targetCount = 10;
  let placed = 0;
  let attempts = 0;
  while (placed < targetCount && attempts < 200) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const radius = 45 + Math.random() * 35; // 45..80
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!isValid(x, z)) continue;

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 8), trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const layers = 3 + Math.floor(Math.random() * 2);
    for (let l = 0; l < layers; l++) {
      const radiusLayer = 2.3 - l * 0.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radiusLayer, 2.2, 10), leafMaterial);
      cone.position.y = 3.2 + l * 1.2;
      cone.castShadow = true;
      tree.add(cone);
    }

    tree.position.set(x, 0, z);
    group.add(tree);
    placed++;
  }

  return group;
}

// Soft clouds drifting across the sky
function createClouds() {
  const group = new THREE.Group();
  const cloudMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });

  function makeCloud(x: number, y: number, z: number, scale = 1, speed = 0.2) {
    const cg = new THREE.Group();
    const parts = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < parts; i++) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 1.2, 12, 12), cloudMaterial);
      sphere.position.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2);
      sphere.castShadow = false;
      cg.add(sphere);
    }
    cg.position.set(x, y, z);
    cg.scale.setScalar(scale);
    // store speed/amplitude for animation
    cg.userData.speed = speed + Math.random() * 0.15;
    cg.userData.amp = 2 + Math.random() * 1.5;
    cloudGroups.push(cg);
    group.add(cg);
  }

  makeCloud(-80, 40, -70, 2.4, 0.18);
  makeCloud(60, 38, -90, 2.0, 0.22);
  makeCloud(-40, 35, -60, 1.6, 0.2);
  makeCloud(20, 42, -50, 1.8, 0.16);
  makeCloud(0, 37, -85, 2.2, 0.19);

  return group;
}

// Small wildflowers sprinkled around and on hilltops
function createFlowers() {
  const flowersRoot = new THREE.Group();
  const groundFlowers = new THREE.Group();
  const hillFlowers = new THREE.Group();

  const stemMaterial = new THREE.MeshPhongMaterial({ color: 0x2d6e2d });
  const centerMaterial = new THREE.MeshPhongMaterial({ color: 0xffdd55 });
  const petalPalettes = [
    0xffffff, 0xffe6f2, 0xfff7c2, 0xd6f5ff, 0xe6ffe6, 0xffdde1, 0xf0f8ff
  ];

  function makeSmallFlower(scaleBoost = 1) {
    const g = new THREE.Group();

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scaleBoost, 0.05 * scaleBoost, 0.6 * scaleBoost, 6), stemMaterial);
    stem.position.y = 0.3 * scaleBoost;
    stem.castShadow = true;
    stem.receiveShadow = true;
    g.add(stem);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scaleBoost, 8, 8), centerMaterial);
    center.position.y = 0.6 * scaleBoost;
    center.castShadow = true;
    g.add(center);

    const petalCount = 5 + Math.floor(Math.random() * 3);
    const petalRadius = 0.18 * scaleBoost;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const color = petalPalettes[Math.floor(Math.random() * petalPalettes.length)];
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scaleBoost, 8, 8), new THREE.MeshPhongMaterial({ color }));
      petal.position.set(Math.cos(angle) * petalRadius, 0.6 * scaleBoost, Math.sin(angle) * petalRadius);
      petal.castShadow = true;
      g.add(petal);
    }

    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }

  // Scatter on the island grass top around the castle
  const islandTopY = 2.2; // grass top at 2.1 with height 0.2 → top ~2.2
  const islandInnerR = 7.0; // avoid castle footprint (~12x12)
  const islandOuterR = 17.0; // within grass radius (18), leave small margin
  const islandTarget = 80;
  let islandPlaced = 0;
  let islandAttempts = 0;
  while (islandPlaced < islandTarget && islandAttempts < 1000) {
    islandAttempts++;
    const angle = Math.random() * Math.PI * 2;
    const radius = islandInnerR + Math.random() * (islandOuterR - islandInnerR);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const f = makeSmallFlower(1);
    f.position.set(x, islandTopY, z);
    groundFlowers.add(f);
    islandPlaced++;
  }

  // Clusters on hilltops for visibility
  for (const h of hillsMeta) {
    const topY = h.y + h.ry;
    const clusterCount = 6 + Math.floor(Math.random() * 4);
    const spreadX = Math.max(1.5, h.rx * 0.18);
    const spreadZ = Math.max(1.5, h.rz * 0.18);
    for (let i = 0; i < clusterCount; i++) {
      const dx = (Math.random() - 0.5) * 2 * spreadX;
      const dz = (Math.random() - 0.5) * 2 * spreadZ;
      const flower = makeSmallFlower(1.6);
      flower.position.set(h.x + dx, topY + 0.25, h.z + dz);
      hillFlowers.add(flower);
    }
  }

  flowersRoot.add(groundFlowers);
  // Prefer attaching hill flowers under the hills group if available
  if (typeof hillsGroupRef !== 'undefined' && hillsGroupRef) {
    hillsGroupRef.add(hillFlowers);
  } else {
    flowersRoot.add(hillFlowers);
  }

  return flowersRoot;
}

// Initialize scene
createSky();
scene.add(createGround());
scene.add(createWater());
scene.add(createBridge());
scene.add(createHills());
scene.add(createTrees());
scene.add(createFlowers());
scene.add(createClouds());

const castle = createCastle();
castle.position.y = 2; // Raise castle to sit on island
scene.add(castle);

const yoshiBaseY = 12.3;
const yoshi = createYoshi();
yoshi.position.set(0, yoshiBaseY, 5); // Moved forward so feet dangle over wall
scene.add(yoshi);

// UI Elements
function createUI() {
  // Status text
  statusText = document.createElement('div');
  statusText.className = 'status-text';
  statusText.textContent = 'Click on a petal to start!';
  document.body.appendChild(statusText);
  
  // Camera info display
  const cameraInfo = document.createElement('div');
  cameraInfo.className = 'camera-info';
  cameraInfo.id = 'camera-info';
  document.body.appendChild(cameraInfo);
  
  // Create 2D flower
  create2DFlower();
  
  // Create new round button (hidden initially)
  const newRoundBtn = document.createElement('button');
  newRoundBtn.id = 'new-round-btn';
  newRoundBtn.textContent = 'New Flower 🌸';
  newRoundBtn.style.display = 'none';
  newRoundBtn.addEventListener('click', () => {
    newRoundBtn.style.display = 'none';
    flowerContainer.style.display = 'block';
    flowerContainer.classList.remove('fade-out');
    flowerContainer.classList.add('fade-in');
    resetGame();
    setTimeout(() => {
      flowerContainer.classList.remove('fade-in');
    }, 500);
  });
  document.body.appendChild(newRoundBtn);
}

function pullPetal(petal: HTMLElement) {
  if (petal.classList.contains('pulled')) return;
  
  petal.classList.add('pulled');
  
  // Update game state
  lovesMe = !lovesMe;
  currentPetal++;
  
  // Update flower face
  updateFlowerFace(lovesMe);
  
  // Update status text
  if (currentPetal === totalPetals) {
    statusText.textContent = lovesMe ? '💖 LOVES ME! 💖' : '💔 Loves me not... 💔';
    statusText.classList.add(lovesMe ? 'loves-me' : 'loves-me-not');
    
    // Hide flower and show new round button after delay
    setTimeout(() => {
      flowerContainer.style.display = 'none';
      const newRoundBtn = document.getElementById('new-round-btn')!;
      newRoundBtn.style.display = 'block';
    }, 3000);
  } else {
    statusText.textContent = lovesMe ? 'Loves me!' : 'Loves me not...';
  }
}

function resetGame() {
  // Reset game state
  currentPetal = 0;
  lovesMe = true;
  
  // Random number of petals
  totalPetals = 6 + Math.floor(Math.random() * 5); // Random 6-10 petals
  
  // Create new petals
  createPetals();
  
  // Reset face
  updateFlowerFace(true);
  
  // Reset text
  statusText.textContent = 'Click on a petal to start!';
  statusText.classList.remove('loves-me', 'loves-me-not');
}

// Event listeners
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize UI
createUI();

// Update camera info display
function updateCameraInfo() {
  const cameraInfo = document.getElementById('camera-info');
  if (cameraInfo) {
    // Get look vector (direction camera is facing)
    const lookVector = new THREE.Vector3(0, 0, -1);
    lookVector.applyQuaternion(camera.quaternion);
    
    cameraInfo.innerHTML = `
      <strong>Camera Position:</strong><br>
      X: ${camera.position.x.toFixed(2)}<br>
      Y: ${camera.position.y.toFixed(2)}<br>
      Z: ${camera.position.z.toFixed(2)}<br>
      <br>
      <strong>Look Vector:</strong><br>
      X: ${lookVector.x.toFixed(3)}<br>
      Y: ${lookVector.y.toFixed(3)}<br>
      Z: ${lookVector.z.toFixed(3)}
    `;
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Animate Yoshi idle
  yoshi.rotation.y = Math.sin(Date.now() * 0.001) * 0.1;
  yoshi.position.y = yoshiBaseY + Math.sin(Date.now() * 0.002) * 0.1;
  const t = Date.now() * 0.001;
  if (yoshiHeadGroup) {
    yoshiHeadGroup.rotation.x = Math.sin(t * 0.9) * 0.03;
    yoshiHeadGroup.rotation.y = Math.sin(t * 0.5) * 0.03;
  }
  if (yoshiTail) {
    yoshiTail.rotation.y = Math.sin(t * 2.0) * 0.3;
  }
  // Hands fiddling: small alternating motions near the center
  if (yoshiLeftElbow && yoshiRightElbow) {
    const lbase: THREE.Vector3 = yoshiLeftElbow.userData.base;
    const rbase: THREE.Vector3 = yoshiRightElbow.userData.base;
    const amp = 0.05;
    const phase = Math.sin(t * 3.0) * amp;
    yoshiLeftElbow.position.set(lbase.x + phase, lbase.y + Math.sin(t * 4.0) * amp, lbase.z + Math.cos(t * 2.5) * amp);
    yoshiRightElbow.position.set(rbase.x - phase, rbase.y + Math.cos(t * 4.0) * amp, rbase.z + Math.sin(t * 2.8) * amp);
  }
  // Occasional blink every ~4s
  const blinkPhase = t % 4.0;
  const eyeScaleY = blinkPhase < 0.06 ? 0.15 : (blinkPhase < 0.08 ? 0.4 : (blinkPhase < 0.10 ? 0.15 : 1.0));
  if (yoshiLeftEye && yoshiRightEye) {
    yoshiLeftEye.scale.y = eyeScaleY;
    yoshiRightEye.scale.y = eyeScaleY;
  }

  // Subtle water motion
  if (waterSurface && deepWaterSurface) {
    waterSurface.rotation.z += 0.0005;
    deepWaterSurface.rotation.z -= 0.0004;
  }

  // Drift clouds
  for (const cg of cloudGroups) {
    cg.position.x += (cg.userData.speed || 0.2) * 0.3;
    cg.position.y += Math.sin(t * 0.5) * 0.002 * (cg.userData.amp || 2.5);
    if (cg.position.x > 100) cg.position.x = -100;
  }
  
  // Update camera info
  updateCameraInfo();
  
  controls.update();
  renderer.render(scene, camera);
}

animate();
