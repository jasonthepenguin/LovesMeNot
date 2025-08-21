import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import * as Tone from 'tone';

// Game state
let currentPetal = 0;
let totalPetals = 6 + Math.floor(Math.random() * 5); // 6–10 for varied first outcome
let lovesMe = true;
let statusText: HTMLDivElement;
let flowerContainer: HTMLDivElement;

let crushName: string | null = null;
let letterOverlay: HTMLDivElement | null = null;
let cameraInfoVisible = false;

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

// Pink character references
let pinkCharacter: THREE.Group | null = null;
let isPinkCharacterWalking = false;
let isPinkCharacterWaving = false;
let isPinkCharacterWalkingAway = false;
let pinkWalkStartTime = 0;
let pinkWalkDuration = 6000; // ms to walk across bridge (longer for more distance)
let pinkWalkAwayDuration = 20000; // ms to walk away into distance (doubled for double distance)
let pinkWaveStartTime = 0;
// Pink nametag
let pinkNametagSprite: THREE.Sprite | null = null;

// Corner letter element ref
let cornerLetterEl: HTMLDivElement | null = null;

// Particles and emotion state
let activeParticles: Array<{
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: number;
  rotZ: number;
  spawnTimeMs: number;
  lifeTimeMs: number;
  accelY: number;
  startScale: number;
  endScale: number;
}> = [];
let yoshiEmotion: 'neutral' | 'happy' | 'sad' = 'neutral';
let emotionEndTimeMs = 0;
let lastFrameTimeMs = performance.now();
const BILLBOARD_Z_AXIS = new THREE.Vector3(0, 0, 1);

// --- Soothing background music (Tone.js) ---
let musicInitialized = false;
let padSynth: Tone.PolySynth | null = null;
let arpSynth: Tone.Synth | null = null;
let freeverb: Tone.Freeverb | null = null;
let chorus: Tone.Chorus | null = null;
let lowpass: Tone.Filter | null = null;
let mainVolume: Tone.Volume | null = null;
let padSeq: Tone.Sequence | null = null;
let arpLoop: Tone.Loop | null = null;
let currentChord: string[] = ['C4', 'E4', 'G4', 'B4'];
let arpIndex = 0;
let musicToggleBtn: HTMLButtonElement | null = null;
let autoStartArmed = false;

// Pluck sound effect
let pluckSynth: Tone.Synth | null = null;

async function startBackgroundMusic(): Promise<void> {
  // Ensure audio context is unlocked by a user gesture
  await Tone.start().catch(() => {});
  if (musicInitialized) {
    if (Tone.Transport.state !== 'started') Tone.Transport.start();
    // Quick unmute ramp
    if (mainVolume) {
      mainVolume.volume.cancelScheduledValues(Tone.now());
      mainVolume.volume.rampTo(-30, 0.25);
    }
    if (musicToggleBtn) musicToggleBtn.textContent = 'Music: On';
    return;
  }

  Tone.Transport.bpm.value = 70;
  Tone.Transport.swing = 0.15;
  Tone.Transport.swingSubdivision = '8n';

  // Lower overall output; this is the base level, then we ramp in
  mainVolume = new Tone.Volume(-36).toDestination();
  chorus = new Tone.Chorus({ frequency: 0.18, delayTime: 2.5, depth: 0.3, feedback: 0.1, wet: 0.35 }).start();
  freeverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 2800, wet: 0.35 });
  lowpass = new Tone.Filter({ type: 'lowpass', frequency: 8500, rolloff: -24, Q: 0.3 });

  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 2.5, decay: 1.2, sustain: 0.7, release: 4.5 },
    volume: -10,
  });
  arpSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.15, release: 0.9 },
    portamento: 0.01,
    volume: -20,
  });

  padSynth.chain(chorus, freeverb, lowpass, mainVolume);
  arpSynth.chain(freeverb, mainVolume);

  const chords: Array<string[]> = [
    ['C4', 'E4', 'G4', 'B4'],  // Cmaj7
    ['G3', 'B3', 'D4', 'F4'],  // G7 (avoid harsh leading tone)
    ['A3', 'C4', 'E4', 'G4'],  // Am7
    ['F3', 'A3', 'C4', 'E4'],  // Fmaj7
  ];
  currentChord = chords[0];

  padSeq = new Tone.Sequence((time, chord: any) => {
    currentChord = chord as string[];
    padSynth?.triggerAttackRelease(currentChord, '2m', time, 0.6);
  }, chords, '2m');
  padSeq.start(0);

  arpIndex = 0;
  arpLoop = new Tone.Loop((time) => {
    const note = currentChord[arpIndex % currentChord.length];
    const arpNote = Tone.Frequency(note).transpose(12).toNote();
    arpSynth?.triggerAttackRelease(arpNote, '8n', time, 0.18);
    arpIndex++;
  }, '8n');
  arpLoop.start(0);

  musicInitialized = true;
  Tone.Transport.start();
  // Gentle fade-in to a quieter target
  if (mainVolume) mainVolume.volume.rampTo(-30, 2.5);
  if (musicToggleBtn) musicToggleBtn.textContent = 'Music: On';
}

function pauseBackgroundMusicImmediately(): void {
  // Stop scheduling and silence quickly
  Tone.Transport.pause();
  try { padSynth?.releaseAll?.(); } catch {}
  if (mainVolume) {
    mainVolume.volume.cancelScheduledValues(Tone.now());
    mainVolume.volume.rampTo(-60, 0.05);
  }
  if (musicToggleBtn) musicToggleBtn.textContent = 'Music: Off';
}

function setupAutoMusicStart(): void {
  if (autoStartArmed) return;
  autoStartArmed = true;
  const handler = async () => {
    if (!autoStartArmed) return;
    autoStartArmed = false;
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('keydown', handler);
    document.removeEventListener('touchstart', handler);
    await startBackgroundMusic();
  };
  document.addEventListener('pointerdown', handler);
  document.addEventListener('keydown', handler);
  document.addEventListener('touchstart', handler);
}

// 3D flower held by character
let heldFlowerRoot: THREE.Group | null = null;
let heldFlowerPetals: THREE.Mesh[] = [];
type PetalAnim = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  spawnTimeMs: number;
  lifeTimeMs: number;
  accel: THREE.Vector3;
};
let activePetalAnims: PetalAnim[] = [];

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
camera.position.set(-7.98, 21.07, 22.90);
// Set the look direction based on provided look vector; set controls target so it persists
const lookVectorInit = new THREE.Vector3(0.207, -0.342, -0.917);
// Move camera a bit forward along the initial look direction
camera.position.addScaledVector(lookVectorInit, 5.0);
const lookTarget = new THREE.Vector3().copy(camera.position).add(lookVectorInit);
camera.lookAt(lookTarget);
controls.target.copy(lookTarget);
controls.update();

// Save initial camera state to return to after round-end sequence
const initialCameraPosition = camera.position.clone();
const initialLookTarget = controls.target.clone();

// --- Camera flight (round-end sequence) ---
type CameraWaypoint = { position: THREE.Vector3; target: THREE.Vector3 };
let isCameraFlying = false;
let camFromPos = new THREE.Vector3();
let camFromTarget = new THREE.Vector3();
let camToPos = new THREE.Vector3();
let camToTarget = new THREE.Vector3();
let camSegStartMs = 0;
let camSegDurationMs = 0;
let camSegmentIndex = 0;
let camWaypoints: CameraWaypoint[] = [];
let camSegmentDurations: number[] = [];
let onCameraFlightComplete: (() => void) | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function advanceCameraSegment() {
  camSegmentIndex++;
  if (camSegmentIndex >= camWaypoints.length) {
    isCameraFlying = false;
    if (onCameraFlightComplete) onCameraFlightComplete();
    return;
  }
  const targetWp = camWaypoints[camSegmentIndex];
  camFromPos.copy(camera.position);
  camFromTarget.copy(controls.target);
  camToPos.copy(targetWp.position);
  camToTarget.copy(targetWp.target);
  camSegDurationMs = camSegmentDurations[camSegmentIndex] || 1500;
  camSegStartMs = performance.now();
}

function startCameraFlight(waypoints: CameraWaypoint[], durationPerSegmentMs = 1800, onComplete?: () => void) {
  if (!waypoints || waypoints.length === 0) return;
  isCameraFlying = true;
  controls.enabled = false;
  onCameraFlightComplete = onComplete || null;
  camWaypoints = waypoints.slice();
  camSegmentDurations = new Array(camWaypoints.length).fill(durationPerSegmentMs);
  camSegmentIndex = -1;
  advanceCameraSegment();
}

function updateCameraFlight(nowMs: number) {
  if (!isCameraFlying) return;
  const t = Math.min(1, (nowMs - camSegStartMs) / camSegDurationMs);
  const et = easeInOutCubic(t);
  const curPos = new THREE.Vector3().lerpVectors(camFromPos, camToPos, et);
  const curTarget = new THREE.Vector3().lerpVectors(camFromTarget, camToTarget, et);
  camera.position.copy(curPos);
  camera.lookAt(curTarget);
  controls.target.copy(curTarget);

  if (t >= 1) {
    camera.position.copy(camToPos);
    camera.lookAt(camToTarget);
    controls.target.copy(camToTarget);
    advanceCameraSegment();
  }
}

function returnCameraToInitialPosition(onComplete?: () => void) {
  // Build a gentle two-segment path back using a raised, slightly side-offset midpoint
  const curPos = camera.position.clone();
  const curTarget = controls.target.clone();
  const midPos = curPos.clone().lerp(initialCameraPosition, 0.5);
  midPos.y += 1.4; // subtle lift for an arc
  const pathDir = new THREE.Vector3().subVectors(initialCameraPosition, curPos).normalize();
  const side = new THREE.Vector3().crossVectors(pathDir, new THREE.Vector3(0, 1, 0)).normalize();
  if (isFinite(side.lengthSq()) && side.lengthSq() > 1e-6) {
    midPos.addScaledVector(side, 1.2);
  }
  const midTarget = curTarget.clone().lerp(initialLookTarget, 0.5);
  const endWp: CameraWaypoint = { position: initialCameraPosition.clone(), target: initialLookTarget.clone() };
  startCameraFlight([
    { position: midPos, target: midTarget },
    endWp,
  ], 1400, () => {
    controls.enabled = true;
    controls.update();
    if (onComplete) onComplete();
  });
}

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
  const skyTexture = textureLoader.load('/sunset_sky.png');
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

// Create pink version of character (crush)
function createPinkCharacter() {
  const group = new THREE.Group();
  
  // Body (standing position)
  const bodyGeometry = new THREE.SphereGeometry(1.9, 20, 20);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff69b4, specular: 0x662244, shininess: 20 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.scale.set(0.95, 1.05, 0.85);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);
  
  // Belly (lighter pink)
  const bellyGeometry = new THREE.SphereGeometry(1.55, 20, 20);
  const bellyMaterial = new THREE.MeshPhongMaterial({ color: 0xffccdd, specular: 0x553344, shininess: 25 });
  const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
  belly.position.set(0, 1.1, 0.68);
  belly.scale.set(0.72, 0.72, 0.42);
  group.add(belly);
  
  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 3.6, 0.28);
  group.add(headGroup);
  
  const headGeometry = new THREE.SphereGeometry(1.65, 20, 20);
  const headMaterial = new THREE.MeshPhongMaterial({ color: 0xff88cc, specular: 0x662244, shininess: 25 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.scale.set(1.08, 1.0, 1.18);
  head.castShadow = true;
  headGroup.add(head);
  
  // Snout
  const snoutGeometry = new THREE.SphereGeometry(0.95, 20, 20);
  const snoutMaterial = new THREE.MeshPhongMaterial({ color: 0xffaadd, specular: 0x662244, shininess: 20 });
  const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
  snout.position.set(0, -0.22, 1.26);
  snout.scale.set(1.18, 0.92, 1.0);
  headGroup.add(snout);
  
  // Eyes
  const eyeWhiteGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const eyeWhiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  leftEyeWhite.position.set(-0.76, 0.52, 1.46);
  leftEyeWhite.scale.set(0.78, 1, 0.68);
  headGroup.add(leftEyeWhite);
  
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  rightEyeWhite.position.set(0.76, 0.52, 1.46);
  rightEyeWhite.scale.set(0.78, 1, 0.68);
  headGroup.add(rightEyeWhite);
  
  // Pupils
  const pupilGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(0, 0, 0.28);
  leftEyeWhite.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0, 0, 0.28);
  rightEyeWhite.add(rightPupil);
  
  // Shell (pink/purple)
  const shellGeometry = new THREE.SphereGeometry(1.8, 12, 8);
  const shellMaterial = new THREE.MeshPhongMaterial({ color: 0xcc44cc });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.position.set(0, 1.9, -1.2);
  shell.scale.set(1.2, 1, 1);
  shell.castShadow = true;
  group.add(shell);
  
  // Simple arms (for waving)
  const armGeometry = new THREE.CylinderGeometry(0.35, 0.4, 2.2, 8);
  const armMaterial = new THREE.MeshPhongMaterial({ color: 0xff88bb });
  const handGeometry = new THREE.SphereGeometry(0.45, 8, 8);
  const handMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  
  // Left arm (will be animated for waving)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-1.6, 2.8, 0.2);
  group.add(leftArmGroup);
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.y = -1.1;
  leftArm.rotation.z = Math.PI / 8;
  leftArmGroup.add(leftArm);
  // Add hand at end of arm
  const leftHand = new THREE.Mesh(handGeometry, handMaterial);
  leftHand.position.set(0, -2.2, 0);
  leftArmGroup.add(leftHand);
  // Store reference for wave animation
  leftArmGroup.name = 'leftArm';
  
  // Right arm
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(1.6, 2.8, 0.2);
  group.add(rightArmGroup);
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.y = -1.1;
  rightArm.rotation.z = -Math.PI / 8;
  rightArmGroup.add(rightArm);
  const rightHand = new THREE.Mesh(handGeometry, handMaterial);
  rightHand.position.set(0, -2.2, 0);
  rightArmGroup.add(rightHand);
  
  // Legs (standing/walking position)
  const legGeometry = new THREE.CylinderGeometry(0.45, 0.5, 2.5, 8);
  const legMaterial = new THREE.MeshPhongMaterial({ color: 0xff88bb });
  
  // Left leg
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.8, 0, 0);
  group.add(leftLegGroup);
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.y = -1.25;
  leftLegGroup.add(leftLeg);
  leftLegGroup.name = 'leftLeg';
  
  // Right leg
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.8, 0, 0);
  group.add(rightLegGroup);
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.y = -1.25;
  rightLegGroup.add(rightLeg);
  rightLegGroup.name = 'rightLeg';
  
  // Feet
  const footGeometry = new THREE.SphereGeometry(0.7, 8, 8);
  const footMaterial = new THREE.MeshPhongMaterial({ color: 0xff8800 });
  
  const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
  leftFoot.position.set(-0.8, -2.5, 0.5);
  leftFoot.scale.set(1.2, 0.8, 1.5);
  group.add(leftFoot);
  
  const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
  rightFoot.position.set(0.8, -2.5, 0.5);
  rightFoot.scale.set(1.2, 0.8, 1.5);
  group.add(rightFoot);
  
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

// Build a 3D flower to be held by the right hand
function rebuildHeldFlower(petalCount: number) {
  // Remove existing
  if (heldFlowerRoot && heldFlowerRoot.parent) {
    heldFlowerRoot.parent.remove(heldFlowerRoot);
  }
  heldFlowerRoot = null;
  heldFlowerPetals = [];

  if (!yoshiRightElbow) return;

  const root = new THREE.Group();
  // Position relative to right elbow so it sits in the hand
  // Nudge slightly forward to keep flower head clear of body
  root.position.set(-0.1, -1.05, 0.9);
  root.rotation.set(-0.2, -0.35, 0.15);

  const stemMaterial = new THREE.MeshPhongMaterial({ color: 0x2d6e2d, shininess: 20, specular: 0x335533 });
  const centerMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc33, shininess: 40, specular: 0x553300 });
  const petalMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 30, specular: 0x666666 });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 8), stemMaterial);
  stem.position.y = 0.7;
  stem.castShadow = true;
  stem.receiveShadow = true;
  root.add(stem);

  const centerY = 1.42;
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), centerMaterial);
  center.position.y = centerY;
  center.castShadow = true;
  root.add(center);

  // Petals arranged around center, index order matches 2D (start at top)
  const petalRadius = 0.28;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), petalMaterial.clone());
    petal.scale.set(0.9, 1.1, 0.35);
    petal.position.set(Math.cos(angle) * petalRadius, centerY, Math.sin(angle) * petalRadius);
    // Slight tilt away from center
    petal.lookAt(new THREE.Vector3(Math.cos(angle) * 2, centerY, Math.sin(angle) * 2));
    petal.castShadow = true;
    petal.receiveShadow = true;
    // Store index for pluck mapping
    (petal.userData as any).petalIndex = i;
    root.add(petal);
    heldFlowerPetals.push(petal);
  }

  heldFlowerRoot = root;
  yoshiRightElbow.add(root);
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

  // Keep trees well spaced to reduce clustering
  const placedPositions: Array<{ x: number; z: number }> = [];
  const minTreeDistance = 12; // units

  function isValid(x: number, z: number): boolean {
    const r = Math.sqrt(x * x + z * z);
    if (r < 40) return false; // keep outside moat area
    if (isInHillFootprint(x, z)) return false;
    // Enforce minimum spacing between trees
    for (const p of placedPositions) {
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz < minTreeDistance * minTreeDistance) return false;
    }
    return true;
  }

  const targetCount = 10;
  let placed = 0;
  let attempts = 0;
  while (placed < targetCount && attempts < 800) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 40; // 50..90
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
    placedPositions.push({ x, z });
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
    const clusterCount = 6 + Math.floor(Math.random() * 4);
    const spreadX = Math.max(1.5, h.rx * 0.18);
    const spreadZ = Math.max(1.5, h.rz * 0.18);
    for (let i = 0; i < clusterCount; i++) {
      const dx = (Math.random() - 0.5) * 2 * spreadX;
      const dz = (Math.random() - 0.5) * 2 * spreadZ;
      const flower = makeSmallFlower(1.6);
      // Place flower on the hill ellipsoid surface and lower slightly to avoid hovering
      const nx = dx / h.rx;
      const nz = dz / h.rz;
      const inside = Math.max(0, 1 - nx * nx - nz * nz);
      const dy = h.ry * Math.sqrt(inside);
      const ySurface = h.y + dy;
      // tiny inset to avoid hovering while preventing z-fighting
      const groundOffset = -0.02;
      flower.position.set(h.x + dx, ySurface + groundOffset, h.z + dz);
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
// Build initial held flower to match starting petals
rebuildHeldFlower(totalPetals);

// --- Emotion and particles helpers ---
let heartGeometry: THREE.ShapeGeometry | null = null;
function getHeartGeometry(): THREE.ShapeGeometry {
  if (heartGeometry) return heartGeometry;
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x + 0.25, y + 0.25);
  shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
  shape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
  shape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.15, y + 0.77, x + 0.25, y + 0.95);
  shape.bezierCurveTo(x + 0.55, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
  shape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
  shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
  const geo = new THREE.ShapeGeometry(shape);
  geo.center();
  heartGeometry = geo;
  return geo;
}

function getYoshiHeadWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
  if (yoshiHeadGroup) {
    yoshiHeadGroup.getWorldPosition(out);
  } else {
    out.set(0, yoshiBaseY + 2, 5);
  }
  return out;
}

function spawnHeartParticle(params: {
  color: number;
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeTimeMs: number;
  startScale: number;
  endScale: number;
  accelY: number;
}): void {
  const geom = getHeartGeometry();
  const mat = new THREE.MeshBasicMaterial({ color: params.color, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(params.origin);
  mesh.scale.setScalar(params.startScale);
  // Initial billboard facing
  mesh.quaternion.copy(camera.quaternion);
  scene.add(mesh);
  activeParticles.push({
    mesh,
    velocity: params.velocity.clone(),
    angularVelocity: (Math.random() * 2 - 1) * 2.0, // rad/s around facing axis
    rotZ: Math.random() * Math.PI * 2,
    spawnTimeMs: performance.now(),
    lifeTimeMs: params.lifeTimeMs,
    accelY: params.accelY,
    startScale: params.startScale,
    endScale: params.endScale,
  });
}

function emitHeartsBurst(count = 18) {
  const origin = getYoshiHeadWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Slightly faster and wider spread
    const speed = 1.0 + Math.random() * 1.4;
    const vx = Math.cos(angle) * 0.45;
    const vz = Math.sin(angle) * 0.45;
    const vy = 1.2 + Math.random() * 1.1;
    spawnHeartParticle({
      color: 0xff4da6,
      // Slightly larger spawn radius for a more dispersed feel
      origin: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random()) * 0.25, (Math.random() - 0.5) * 0.6)),
      velocity: new THREE.Vector3(vx * speed, vy, vz * speed),
      lifeTimeMs: 2200 + Math.random() * 600,
      // Make hearts a bit larger overall
      startScale: 0.60 + Math.random() * 0.20,
      endScale: 0.26 + Math.random() * 0.12,
      accelY: -0.35,
    });
  }
}

function emitSadBurst(count = 16) {
  const origin = getYoshiHeadWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 0.8;
    const vx = Math.cos(angle) * 0.25 * speed;
    const vz = Math.sin(angle) * 0.25 * speed;
    const vy = -(0.8 + Math.random() * 0.8);
    spawnHeartParticle({
      color: 0x7fb3ff,
      origin: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.2) * 0.2, (Math.random() - 0.5) * 0.2)),
      velocity: new THREE.Vector3(vx, vy, vz),
      lifeTimeMs: 1800 + Math.random() * 500,
      startScale: 0.12 + Math.random() * 0.05,
      endScale: 0.04 + Math.random() * 0.03,
      accelY: -0.6,
    });
  }
}

function triggerRoundEndEffects(isHappy: boolean) {
  yoshiEmotion = isHappy ? 'happy' : 'sad';
  emotionEndTimeMs = performance.now() + 2800;
  if (isHappy) {
    emitHeartsBurst(20);
    setTimeout(() => emitHeartsBurst(14), 200);
    setTimeout(() => emitHeartsBurst(12), 400);
  } else {
    emitSadBurst(18);
    setTimeout(() => emitSadBurst(12), 180);
    setTimeout(() => emitSadBurst(10), 360);
    // Add a brief sad emoji overlay on loss
    showSadEmojiOverlay();
  }
}

// Brief overlay of sad emojis when losing
function showSadEmojiOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'sad-emoji-overlay';
  const emojis = ['🥺', '😢', '💔', '🥺', '😢'];
  for (let i = 0; i < emojis.length; i++) {
    const span = document.createElement('span');
    span.className = 'sad-emoji';
    span.textContent = emojis[i];
    const xPct = 45 + Math.random() * 10; // 45%..55%
    const yPct = 58 + Math.random() * 8;  // 58%..66%
    span.style.left = `${xPct}%`;
    span.style.top = `${yPct}%`;
    span.style.fontSize = `${38 + Math.random() * 18}px`;
    span.style.animationDelay = `${i * 0.15 + Math.random() * 0.1}s`;
    overlay.appendChild(span);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2600);
}

// --- Bottom-left corner letter helpers ---
function ensureCornerLetter(): HTMLDivElement {
  if (cornerLetterEl && document.body.contains(cornerLetterEl)) return cornerLetterEl;
  const el = document.createElement('div');
  el.className = 'corner-letter';
  el.id = 'corner-letter';
  document.body.appendChild(el);
  cornerLetterEl = el;
  return el;
}

function showCornerLetter(bodyText: string) {
  const el = ensureCornerLetter();
  const words = (bodyText || '').trim().split(/\s+/).filter(Boolean);
  const bodyLines: string[] = [];
  for (let i = 0; i < words.length; i += 4) {
    bodyLines.push(words.slice(i, i + 4).join(' '));
  }
  const html = `Hey anon,<br><br>${bodyLines.join('<br>')}<br><br>-Love JB`;
  el.innerHTML = html;
}

function hideCornerLetter() {
  if (cornerLetterEl) {
    cornerLetterEl.remove();
    cornerLetterEl = null;
  }
}

// --- Pink character nametag helpers ---
function createRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const min = Math.min(w, h);
  const radius = Math.min(r, min / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function buildNametagTexture(text: string): { texture: THREE.Texture; width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  // Style roughly matching .status-text
  const fontSizePx = 40; // base size; sprite scale will adjust world size
  const font = `700 ${fontSizePx}px "Comic Sans MS", cursive, sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(fontSizePx * 1.2);
  const padX = 28;
  const padY = 16;
  const radius = 14;

  const cw = (textWidth + padX * 2);
  const ch = (textHeight + padY * 2);
  canvas.width = Math.ceil(cw * dpr);
  canvas.height = Math.ceil(ch * dpr);
  ctx.scale(dpr, dpr);

  // Background rounded rect (translucent black)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  createRoundedRect(ctx, 0, 0, cw, ch, radius);
  ctx.fill();

  // Text with subtle shadow for readability
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = font;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, cw / 2, ch / 2);

  const texture = new THREE.CanvasTexture(canvas);
  // @ts-ignore
  if ('SRGBColorSpace' in THREE) (texture as any).colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return { texture, width: cw, height: ch };
}

function ensurePinkNametag(label: string) {
  const nameText = (label || 'Your Crush').trim();
  const built = buildNametagTexture(nameText);
  const aspect = built.width / built.height;
  const worldHeight = 1.4; // world units
  const worldWidth = worldHeight * aspect;

  if (!pinkNametagSprite) {
    const material = new THREE.SpriteMaterial({ map: built.texture, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(worldWidth, worldHeight, 1);
    // Position above head in local space
    sprite.position.set(0, 6.6, 0);
    pinkNametagSprite = sprite;
    if (pinkCharacter) pinkCharacter.add(sprite);
  } else {
    const mat = pinkNametagSprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = built.texture;
    mat.opacity = 1;
    pinkNametagSprite.scale.set(worldWidth, worldHeight, 1);
    mat.needsUpdate = true;
  }
}

function removePinkNametag() {
  if (pinkNametagSprite) {
    if (pinkNametagSprite.parent) pinkNametagSprite.parent.remove(pinkNametagSprite);
    const mat = pinkNametagSprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.dispose();
    pinkNametagSprite = null;
  }
}

// Start pink character walk and wave animation
function startPinkCharacterSequence(lovesMe: boolean) {
  
  if (!pinkCharacter) {
    pinkCharacter = createPinkCharacter();
    scene.add(pinkCharacter);
  }
  
  // Reset opacity for all meshes
  pinkCharacter.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshPhongMaterial;
      mat.transparent = true;
      mat.opacity = 1;
    }
  });
  
  if (lovesMe) {
    // Walk toward the castle and wave
    pinkCharacter.position.set(0, 4, 55);
    pinkCharacter.rotation.y = Math.PI; // Face toward castle
    isPinkCharacterWalking = true;
    isPinkCharacterWaving = false;
    isPinkCharacterWalkingAway = false;
  } else {
    // Start closer and walk away
    pinkCharacter.position.set(0, 4, 25);
    pinkCharacter.rotation.y = 0; // Face away from castle
    isPinkCharacterWalking = false;
    isPinkCharacterWaving = false;
    isPinkCharacterWalkingAway = true;
  }
  
  pinkWalkStartTime = performance.now();
  pinkCharacter.visible = true;
  // Add/update nametag above the head
  ensurePinkNametag(crushName || 'Your Crush');
}

// Clean up pink character after sequence
function removePinkCharacter() {
  if (pinkCharacter && pinkCharacter.parent) {
    scene.remove(pinkCharacter);
    pinkCharacter = null;
  }
  removePinkNametag();
  isPinkCharacterWalking = false;
  isPinkCharacterWaving = false;
  isPinkCharacterWalkingAway = false;
}

function updateParticles(dtSeconds: number) {
  const now = performance.now();
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    const ageMs = now - p.spawnTimeMs;
    const lifeMs = p.lifeTimeMs;
    const age01 = Math.min(1, Math.max(0, ageMs / lifeMs));
    // physics
    p.velocity.y += p.accelY * dtSeconds;
    p.mesh.position.x += p.velocity.x * dtSeconds;
    p.mesh.position.y += p.velocity.y * dtSeconds;
    p.mesh.position.z += p.velocity.z * dtSeconds;
    // billboard + spin
    p.rotZ += p.angularVelocity * dtSeconds;
    p.mesh.quaternion.copy(camera.quaternion);
    p.mesh.rotateOnAxis(BILLBOARD_Z_AXIS, p.rotZ);
    // scale & fade
    const scale = p.startScale + (p.endScale - p.startScale) * age01;
    p.mesh.scale.setScalar(scale);
    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 1 - age01;
    // lifetime
    if (ageMs >= lifeMs) {
      scene.remove(p.mesh);
      activeParticles.splice(i, 1);
    }
  }
}

function pluckHeldFlowerPetal(indexZeroBased: number) {
  if (!heldFlowerPetals || heldFlowerPetals.length === 0) return;
  // Find the first non-removed petal matching the index mapping
  const petal = heldFlowerPetals[indexZeroBased];
  if (!petal || !(petal as any).parent) return;

  // Detach to world for independent animation
  const worldPos = new THREE.Vector3();
  petal.getWorldPosition(worldPos);
  const worldQuat = new THREE.Quaternion();
  petal.getWorldQuaternion(worldQuat);
  petal.parent?.remove(petal);
  petal.position.copy(worldPos);
  petal.quaternion.copy(worldQuat);
  scene.add(petal);

  // Setup animation parameters
  const dir = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
  const vel = dir.multiplyScalar(0.9);
  const angVel = new THREE.Vector3((Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 2.0);
  activePetalAnims.push({
    mesh: petal,
    velocity: vel,
    angularVelocity: angVel,
    spawnTimeMs: performance.now(),
    lifeTimeMs: 2200 + Math.random() * 600,
    accel: new THREE.Vector3(0, -0.9, 0),
  });

  // Mark removed slot so we don't try to pluck again
  heldFlowerPetals[indexZeroBased] = null as any;
}

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
  cameraInfo.style.display = 'none';
  document.body.appendChild(cameraInfo);
  
  // Create 2D flower
  create2DFlower();
  
  // Create new round button (hidden initially)
  const newRoundBtn = document.createElement('button');
  newRoundBtn.id = 'new-round-btn';
  newRoundBtn.textContent = 'Try Again?';
  newRoundBtn.style.display = 'none';
  newRoundBtn.addEventListener('click', () => {
    newRoundBtn.style.display = 'none';
    hideCornerLetter();
    // Fly back to initial camera, then reset and show flower
    returnCameraToInitialPosition(() => {
      flowerContainer.style.display = 'block';
      flowerContainer.classList.remove('fade-out');
      flowerContainer.classList.add('fade-in');
      resetGame();
      setTimeout(() => {
        flowerContainer.classList.remove('fade-in');
      }, 500);
    });
  });
  document.body.appendChild(newRoundBtn);

  // Music toggle (explicit user control; default Off)
  const musicToggle = document.createElement('button');
  musicToggle.id = 'music-toggle';
  musicToggle.textContent = 'Music: Off';
  musicToggleBtn = musicToggle;
  // Prevent auto-start handler from triggering when using this button
  musicToggle.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  musicToggle.addEventListener('touchstart', (ev) => ev.stopPropagation());
  musicToggle.addEventListener('click', async () => {
    if (Tone.Transport.state !== 'started') {
      await startBackgroundMusic();
      musicToggle.textContent = 'Music: On';
    } else {
      pauseBackgroundMusicImmediately();
    }
  });
  document.body.appendChild(musicToggle);
}

// Intro overlay: romantic letter asking for crush's name
function createLoveLetterOverlay() {
  letterOverlay = document.createElement('div');
  letterOverlay.className = 'letter-overlay fade-in';
  letterOverlay.innerHTML = `
    <div class="letter-card">
      <div class="letter-hearts"></div>
      <h1 class="letter-title">To My Secret Crush</h1>
      <p class="letter-body">Write their name below, then pluck the petals to divine your fate.</p>
      <div class="letter-input-row">
        <input id="crush-input" type="text" maxlength="42" placeholder="Their name..." />
        <button id="crush-start-btn">Seal & Begin 💌</button>
      </div>
    </div>
  `;
  document.body.appendChild(letterOverlay);

  const input = letterOverlay.querySelector('#crush-input') as HTMLInputElement;
  const btn = letterOverlay.querySelector('#crush-start-btn') as HTMLButtonElement;

  const begin = () => {
    const name = (input?.value || '').trim();
    crushName = name || 'Your Crush';
    if (statusText) {
      statusText.textContent = `Will ${crushName} love me? Click a petal to find out!`;
    }
    if (letterOverlay) {
      letterOverlay.classList.remove('fade-in');
      letterOverlay.classList.add('fade-out');
      setTimeout(() => { letterOverlay?.remove(); letterOverlay = null; }, 600);
    }
  };

  btn?.addEventListener('click', begin);
  input?.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') begin(); });
  setTimeout(() => input?.focus(), 0);
  // Arm auto-start after overlay shows so the first site interaction starts music
  setupAutoMusicStart();
}

// Initialize and play pluck sound effect
async function initializePluckSound() {
  if (pluckSynth) return;
  
  // Ensure audio context is started
  await Tone.start().catch(() => {});
  
  // Create a gentle pluck synth with a soft, mellow sound
  pluckSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.02,
      decay: 0.6,
      sustain: 0,
      release: 1.2
    },
    volume: -24
  }).toDestination();
}

function playPluckSound() {
  if (!pluckSynth) {
    initializePluckSound().then(() => {
      if (pluckSynth) {
        // Play a random note in a pleasant range for variety
        const notes = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
        const note = notes[Math.floor(Math.random() * notes.length)];
        pluckSynth.triggerAttackRelease(note, '8n');
      }
    });
  } else {
    // Play a random note in a pleasant range for variety
    const notes = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
    const note = notes[Math.floor(Math.random() * notes.length)];
    pluckSynth.triggerAttackRelease(note, '8n');
  }
}

function pullPetal(petal: HTMLElement) {
  if (petal.classList.contains('pulled')) return;
  
  petal.classList.add('pulled');
  
  // Play pluck sound effect
  playPluckSound();
  
  // Update game state
  lovesMe = !lovesMe;
  currentPetal++;
  
  // Update flower face
  updateFlowerFace(lovesMe);
  // Also pluck a 3D petal from the held flower
  pluckHeldFlowerPetal(currentPetal - 1);
  
  // Update status text
  if (currentPetal === totalPetals) {
    const nameForMsg = crushName || 'Your Crush';
    statusText.textContent = lovesMe ? `💖 ${nameForMsg} loves you! 💖` : `💔 ${nameForMsg} loves you not... 💔 🥺`;
    statusText.classList.add(lovesMe ? 'loves-me' : 'loves-me-not');
    // Trigger particles and yoshi emotion
    triggerRoundEndEffects(lovesMe);
    
    // Start camera tour across provided waypoints; then wait 3s and show button
    // Waypoint 1 from screenshot: Pos (-16.47, 22.86, 9.69), Look (0.863, -0.506, -0.007)
    const wp1Pos = new THREE.Vector3(-16.47, 22.86, 9.69);
    const wp1Target = wp1Pos.clone().add(new THREE.Vector3(0.863, -0.506, -0.007));
    // Waypoint 2: Raised camera position but same look direction
    const wp2Pos = new THREE.Vector3(2.73, 24.5, -5.64);  // Raised Y from 21.67 to 24.5
    const wp2Target = wp2Pos.clone().add(new THREE.Vector3(-0.311, -0.418, 0.854));

    // Keep the 2D flower visible during the cinematic so the petal-less flower stays on screen
    
    // Start the pink character walking sequence (pass lovesMe to determine behavior)
    startPinkCharacterSequence(lovesMe);

    const newRoundBtn = document.getElementById('new-round-btn')! as HTMLButtonElement;
    startCameraFlight([
      { position: wp1Pos, target: wp1Target },
      { position: wp2Pos, target: wp2Target },
    ], 1800, () => {
      // Show note immediately upon arriving at final camera position
      const loveMsg = 'Go for it, at the end of the day we are all just trying our best.';
      const notMsg = 'it’s important to know when to stay and fight, but even more important to know when to let go.';
      showCornerLetter(lovesMe ? loveMsg : notMsg);
      // Show the Try Again button a bit later
      setTimeout(() => {
        newRoundBtn.style.display = 'block';
      }, 3000);
    });
  } else {
    statusText.textContent = lovesMe ? 'Loves me!' : 'Loves me not...';
  }
}

function resetGame() {
  // Reset game state
  currentPetal = 0;
  lovesMe = true;
  yoshiEmotion = 'neutral';
  emotionEndTimeMs = 0;
  // Remove any lingering corner letter
  hideCornerLetter();
  // Clear particles
  for (const p of activeParticles) {
    scene.remove(p.mesh);
  }
  activeParticles = [];
  
  // Clean up pink character if it exists
  removePinkCharacter();
  
  // Random number of petals
  totalPetals = 6 + Math.floor(Math.random() * 5); // Random 6-10 petals
  
  // Create new petals
  createPetals();
  // Rebuild 3D held flower to match new petal count
  rebuildHeldFlower(totalPetals);
  
  // Reset face
  updateFlowerFace(true);
  
  // Reset text
  statusText.textContent = `Will ${crushName || 'Your Crush'} love me? Click a petal to find out!`;
  statusText.classList.remove('loves-me', 'loves-me-not');
}

// Event listeners
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Toggle camera info with 'm' key, but ignore when typing in inputs/textarea
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key.toLowerCase() === 'm') {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    cameraInfoVisible = !cameraInfoVisible;
    const div = document.getElementById('camera-info');
    if (div) div.style.display = cameraInfoVisible ? 'block' : 'none';
  }
});

// Initialize UI
createUI();
createLoveLetterOverlay();

// Update camera info display
function updateCameraInfo() {
  const cameraInfo = document.getElementById('camera-info');
  if (cameraInfo) {
    if (!cameraInfoVisible) return; // skip updates when hidden
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

  const nowMs = performance.now();
  const dtSeconds = Math.min(0.033, Math.max(0.001, (nowMs - lastFrameTimeMs) / 1000));
  lastFrameTimeMs = nowMs;
  const t = nowMs * 0.001;

  const isEmoting = yoshiEmotion !== 'neutral' && nowMs < emotionEndTimeMs;

  // Animate Yoshi idle/emotion
  yoshi.rotation.y = Math.sin(t * 1.0) * 0.1 * (isEmoting ? 0.3 : 1);
  yoshi.position.y = yoshiBaseY + Math.sin(t * 2.0) * 0.1 * (isEmoting ? 0.5 : 1);
  if (yoshiHeadGroup) {
    if (isEmoting && yoshiEmotion === 'happy') {
      yoshiHeadGroup.rotation.x = 0.12 + Math.sin(t * 6.0) * 0.06;
      yoshiHeadGroup.rotation.y = Math.sin(t * 3.0) * 0.08;
    } else if (isEmoting && yoshiEmotion === 'sad') {
      yoshiHeadGroup.rotation.x = -0.18 + Math.sin(t * 1.5) * 0.02;
      yoshiHeadGroup.rotation.y = 0;
    } else {
      yoshiHeadGroup.rotation.x = Math.sin(t * 0.9) * 0.03;
      yoshiHeadGroup.rotation.y = Math.sin(t * 0.5) * 0.03;
    }
  }
  if (yoshiTail) {
    yoshiTail.rotation.y = Math.sin(t * (isEmoting ? 5.0 : 2.0)) * (isEmoting && yoshiEmotion === 'happy' ? 0.5 : 0.3);
  }
  // Hands: idle fiddling unless emoting; during happy raise arms, during sad droop
  if (yoshiLeftElbow && yoshiRightElbow) {
    const lbase: THREE.Vector3 = yoshiLeftElbow.userData.base;
    const rbase: THREE.Vector3 = yoshiRightElbow.userData.base;
    if (isEmoting && yoshiEmotion === 'happy') {
      yoshiLeftElbow.position.set(lbase.x + 0.1, lbase.y + 0.5 + Math.sin(t * 6.0) * 0.05, lbase.z + 0.1);
      yoshiRightElbow.position.set(rbase.x - 0.1, rbase.y + 0.5 + Math.cos(t * 6.2) * 0.05, rbase.z + 0.1);
    } else if (isEmoting && yoshiEmotion === 'sad') {
      yoshiLeftElbow.position.set(lbase.x - 0.05, lbase.y - 0.35, lbase.z + 0.05);
      yoshiRightElbow.position.set(rbase.x + 0.05, rbase.y - 0.35, rbase.z + 0.05);
    } else {
      const amp = 0.05;
      const phase = Math.sin(t * 3.0) * amp;
      yoshiLeftElbow.position.set(lbase.x + phase, lbase.y + Math.sin(t * 4.0) * amp, lbase.z + Math.cos(t * 2.5) * amp);
      yoshiRightElbow.position.set(rbase.x - phase, rbase.y + Math.cos(t * 4.0) * amp, rbase.z + Math.sin(t * 2.8) * amp);
    }
  }
  // Eye blink/expressions
  if (yoshiLeftEye && yoshiRightEye) {
    let eyeScaleY = 1.0;
    if (isEmoting && yoshiEmotion === 'happy') {
      eyeScaleY = 1.0 + Math.sin(t * 8.0) * 0.05;
    } else if (isEmoting && yoshiEmotion === 'sad') {
      eyeScaleY = 0.6 + Math.sin(t * 2.0) * 0.02;
    } else {
      const blinkPhase = t % 4.0;
      eyeScaleY = blinkPhase < 0.06 ? 0.15 : (blinkPhase < 0.08 ? 0.4 : (blinkPhase < 0.10 ? 0.15 : 1.0));
    }
    yoshiLeftEye.scale.y = eyeScaleY;
    yoshiRightEye.scale.y = eyeScaleY;
  }

  // End emotion after timer
  if (yoshiEmotion !== 'neutral' && nowMs >= emotionEndTimeMs) {
    yoshiEmotion = 'neutral';
  }

  // Particles
  updateParticles(dtSeconds);
  // 3D petal anims
  for (let i = activePetalAnims.length - 1; i >= 0; i--) {
    const p = activePetalAnims[i];
    p.velocity.addScaledVector(p.accel, dtSeconds);
    p.mesh.position.addScaledVector(p.velocity, dtSeconds);
    p.mesh.rotation.x += p.angularVelocity.x * dtSeconds;
    p.mesh.rotation.y += p.angularVelocity.y * dtSeconds;
    p.mesh.rotation.z += p.angularVelocity.z * dtSeconds;
    const age = performance.now() - p.spawnTimeMs;
    const life = p.lifeTimeMs;
    const a = 1 - Math.min(1, age / life);
    const mat = p.mesh.material as THREE.MeshPhongMaterial;
    mat.opacity = a;
    mat.transparent = true;
    if (age >= life) {
      scene.remove(p.mesh);
      activePetalAnims.splice(i, 1);
    }
  }

  // Subtle water motion
  if (waterSurface && deepWaterSurface) {
    waterSurface.rotation.z += 0.0005;
    deepWaterSurface.rotation.z -= 0.0004;
  }

  // Drift clouds
  for (const cg of cloudGroups) {
    cg.position.x += (cg.userData.speed || 0.2) * 0.18;
    cg.position.y += Math.sin(t * 0.5) * 0.002 * (cg.userData.amp || 2.5);
    if (cg.position.x > 100) cg.position.x = -100;
  }
  
  // Animate pink character
  if (pinkCharacter) {
    if (isPinkCharacterWalking) {
      const walkElapsed = nowMs - pinkWalkStartTime;
      const walkProgress = Math.min(1, walkElapsed / pinkWalkDuration);
      
      // Walk from z=55 to z=23 (stop a bit further back)
      pinkCharacter.position.z = 55 - (walkProgress * 32);
      
      // Walking animation: bob up and down, swing legs
      pinkCharacter.position.y = 4 + Math.sin(walkElapsed * 0.008) * 0.15;
      
      // Animate legs
      const leftLeg = pinkCharacter.getObjectByName('leftLeg') as THREE.Group;
      const rightLeg = pinkCharacter.getObjectByName('rightLeg') as THREE.Group;
      if (leftLeg && rightLeg) {
        leftLeg.rotation.x = Math.sin(walkElapsed * 0.008) * 0.3;
        rightLeg.rotation.x = -Math.sin(walkElapsed * 0.008) * 0.3;
      }
      
      if (walkProgress >= 1) {
        // Finished walking, start waving
        isPinkCharacterWalking = false;
        isPinkCharacterWaving = true;
        pinkWaveStartTime = nowMs;
      }
    } else if (isPinkCharacterWalkingAway) {
      const walkElapsed = nowMs - pinkWalkStartTime;
      const walkProgress = Math.min(1, walkElapsed / pinkWalkAwayDuration);
      
      // Walk away from z=25 to z=215 (extremely far into the distance)
      pinkCharacter.position.z = 25 + (walkProgress * 190);
      
      // Walking animation: bob up and down, swing legs
      pinkCharacter.position.y = 4 + Math.sin(walkElapsed * 0.008) * 0.15;
      
      // Animate legs
      const leftLeg = pinkCharacter.getObjectByName('leftLeg') as THREE.Group;
      const rightLeg = pinkCharacter.getObjectByName('rightLeg') as THREE.Group;
      if (leftLeg && rightLeg) {
        leftLeg.rotation.x = Math.sin(walkElapsed * 0.008) * 0.3;
        rightLeg.rotation.x = -Math.sin(walkElapsed * 0.008) * 0.3;
      }
      
      // Fade out as they walk away - wait 2 seconds then fade quickly
      if (walkElapsed > 2000) { // Wait 2 seconds before starting fade
        const fadeStartProgress = (walkElapsed - 2000) / pinkWalkAwayDuration;
        const fadeProgress = Math.min(1, fadeStartProgress * 2); // Accelerate the fade after delay
        const opacity = Math.max(0, 1 - fadeProgress); // Fade to fully transparent
        pinkCharacter.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshPhongMaterial;
            if (!mat.transparent) {
              mat.transparent = true;
            }
            mat.opacity = opacity;
            mat.needsUpdate = true;
          }
        });
        if (pinkNametagSprite) {
          const mat = pinkNametagSprite.material as THREE.SpriteMaterial;
          mat.opacity = opacity;
          mat.needsUpdate = true;
        }
      }
    } else if (isPinkCharacterWaving) {
      const waveElapsed = nowMs - pinkWaveStartTime;
      
      // Continuous wave animation (no longer stops)
      const leftArm = pinkCharacter.getObjectByName('leftArm') as THREE.Group;
      if (leftArm) {
        // Raise arm straight up above head and wave
        leftArm.rotation.z = -Math.PI + Math.sin(waveElapsed * 0.006) * 0.25; // Arm pointing up with wave motion
        leftArm.rotation.x = 0; // Keep facing forward
        leftArm.rotation.y = Math.sin(waveElapsed * 0.008) * 0.15; // Slight side-to-side
      }
      
      // Subtle body movement while waving
      pinkCharacter.rotation.y = Math.PI + Math.sin(waveElapsed * 0.002) * 0.1;
      // Keep the bobbing animation while waving
      pinkCharacter.position.y = 4 + Math.sin(t * 2.0) * 0.08;
    } else {
      // Idle animation when not walking or waving
      pinkCharacter.position.y = 4 + Math.sin(t * 2.0) * 0.08;
    }
  }
  
  // Update camera info
  updateCameraInfo();
  // Update camera flight if active
  updateCameraFlight(nowMs);
  
  controls.update();
  renderer.render(scene, camera);
}

animate();
