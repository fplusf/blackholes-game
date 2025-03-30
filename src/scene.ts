// TODO:
// + Add a "game over" screen with a "restart" button
// + Create a controller for the black hole on mobile (similar to pieter's game)
// - Add a "leaderboard" screen

// --- IMPORTS (Keep all imports) ---
import { gsap } from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- Audio Setup ---
const backgroundMusic = new Audio('/Interstellar.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.1; // Set initial volume to 30% to make room for sound effects

// Sound effects
const starCatchSound = new Audio('/star-catch.mp3');
starCatchSound.volume = 0.1;

const rivalCollisionSound = new Audio('/rival-collision.mp3');
rivalCollisionSound.volume = 0.3;

const gameOverSound = new Audio('/game-over.mp3');
gameOverSound.volume = 0.3;

// --- CONFIGURATION (Keep all config constants) ---
const PARTICLE_COUNT = 4000;
const PARTICLE_SPREAD = 90;
const BLACK_HOLE_PLANE_SIZE = 2.8; // Player size
const RIVAL_BLACK_HOLE_PLANE_SIZE = 2.0; // Rival size (smaller)
const BLACK_HOLE_COLLISION_CENTER_RADIUS = 0.4;
const BLACK_HOLE_COLLISION_RING_WIDTH = 0.2;
const COLLISION_PADDING = 0.05;
const STAR_OUTER_RADIUS = 0.5;
const STAR_INNER_RADIUS = STAR_OUTER_RADIUS * 0.4;
const STAR_POINTS = 4;
const BLACK_HOLE_MOVEMENT_BOUNDS_X = 7;
const BLACK_HOLE_MOVEMENT_BOUNDS_Y = 3.5;
const BASE_GAME_SPEED = 25.0;
const SLOW_MO_FACTOR = 0.2;
const SPEED_INCREASE_INTERVAL = 10;
const SPEED_INCREASE_AMOUNT = 3.0;
const MAX_GAME_SPEED = 45.0;
const SPAWN_DISTANCE_Z = -80;
const CLEANUP_DISTANCE_Z = 12;
const COLLISION_THRESHOLD_XY_FACTOR = 0.8;
const STAR_TARGET_RADIUS = 4.0;
const CUE_BORDER_COLOR = new THREE.Color(0xaaaaaa);
const CUE_BORDER_OPACITY = 0.6;
const CUE_BORDER_BASE_SIZE = STAR_OUTER_RADIUS * 2.2;
const CUE_BORDER_MIN_SCALE = 1.0;
const CUE_BORDER_MAX_SCALE = 8.0;
const CUE_BORDER_MAX_OFFSET = STAR_OUTER_RADIUS * 0.5;
const CUE_BORDER_FADE_START_Z = -20.0;
const CUE_BORDER_FADE_END_Z = -5.0;
const COLLISION_RING_FORGIVENESS = 0.4;

// --- Rival Black Hole Constants ---
const RIVAL_BLACK_HOLE_COUNT = 2; // Maximum number of rivals
const INITIAL_RIVAL_BLACK_HOLE_COUNT = 1; // Start with no rivals
const RIVAL_BLACK_HOLE_MIN_SPAWN_INTERVAL = 2; // Minimum stars between spawns (reduced from 5)
const RIVAL_BLACK_HOLE_COLOR = new THREE.Color(0xff0000); // Red color for rival black holes
const RIVAL_BLACK_HOLE_SPAWN_CHANCE = 0.7; // 70% chance to spawn when conditions are met
const RIVAL_BLACK_HOLE_CLEANUP_Z = 5; // Cleanup Z position (before CLEANUP_DISTANCE_Z)
const RIVAL_BLACK_HOLE_INCREASE_INTERVAL = 20; // Number of stars needed to increase rival count
const RIVAL_BLACK_HOLE_INCREASE_AMOUNT = 1; // Number of rivals to add when increasing
const RIVAL_BLACK_HOLE_DAMAGE = 1; // Amount of mass lost when colliding with a rival

// --- UI Constants ---
const INITIAL_BLACK_HOLE_MASS = 1; // Initial mass in solar masses (whole number)
const MASS_INCREASE_AMOUNT = 1; // Mass increase per 10 stars (whole number)

// --- Player Tilt ---
const PLAYER_TILT_FACTOR = 0.05; // How much to tilt based on X position
const MAX_PLAYER_TILT_ANGLE = Math.PI / 12; // Max tilt angle (15 degrees)
const INITIAL_MOBILE_Y_RATIO = -0.4; // -1 is bottom, 1 is top. -0.4 is 30% from bottom.

// --- Colors ---
const FLASH_COLOR = new THREE.Color(0xadd8e6); // Light Blue Flash
const DAMAGE_FLASH_COLOR = new THREE.Color(0xff0000); // Red Flash for damage
const STAR_COLOR = new THREE.Color(0xffffff);
const BACKGROUND_COLOR = new THREE.Color(0x000000);
const FOG_COLOR = BACKGROUND_COLOR;

// --- Mobile Scaling ---
const MOBILE_BREAKPOINT = 768;
const MOBILE_SCALE_FACTOR = 0.8;
const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

const EFFECTIVE_BLACK_HOLE_PLANE_SIZE =
  BLACK_HOLE_PLANE_SIZE * (isMobile ? MOBILE_SCALE_FACTOR : 1);
const EFFECTIVE_RIVAL_BLACK_HOLE_PLANE_SIZE =
  RIVAL_BLACK_HOLE_PLANE_SIZE * (isMobile ? MOBILE_SCALE_FACTOR : 1); // Add effective rival size
const EFFECTIVE_STAR_OUTER_RADIUS = STAR_OUTER_RADIUS * (isMobile ? MOBILE_SCALE_FACTOR : 1);
const EFFECTIVE_STAR_INNER_RADIUS = STAR_INNER_RADIUS * (isMobile ? MOBILE_SCALE_FACTOR : 1);
const EFFECTIVE_CUE_BORDER_BASE_SIZE = CUE_BORDER_BASE_SIZE * (isMobile ? MOBILE_SCALE_FACTOR : 1);
const EFFECTIVE_COLLISION_CENTER_RADIUS =
  BLACK_HOLE_COLLISION_CENTER_RADIUS * (isMobile ? MOBILE_SCALE_FACTOR : 1);
const EFFECTIVE_COLLISION_RING_WIDTH =
  BLACK_HOLE_COLLISION_RING_WIDTH * (isMobile ? MOBILE_SCALE_FACTOR : 1);

// --- Game State ---
let gameSpeed = BASE_GAME_SPEED;
let score = 0;
let totalStarsSpawned = 0; // Add counter for total stars spawned
let lastSpeedIncreaseScore = 0;
let blackHoleMass = INITIAL_BLACK_HOLE_MASS;
let elapsedTime = 0;
let isSlowMo = false;
let gameActive = true;
let audioInitialized = false; // Flag to track if audio context is unlocked
let soundEnabled = true; // Flag to track if sound is enabled
const stars: THREE.Mesh[] = [];
const rivalBlackHoles: THREE.Mesh[] = [];
let lastRivalSpawnScore = 0;
let currentMaxRivals = INITIAL_RIVAL_BLACK_HOLE_COUNT; // Track current maximum number of rivals
let damageOverlay: HTMLDivElement | null = null; // Track the damage overlay element
let hasFirstRivalSpawned = false; // Track if the first rival has spawned

// --- Joystick State ---
let joystickBase: HTMLDivElement | null = null;
let joystickStick: HTMLDivElement | null = null;
let joystickActive = false;
let joystickRadius = 60; // Half of the base size
let joystickCenter = { x: 0, y: 0 };
let currentTouchId: number | null = null;

// High Score Management
const HIGH_SCORE_KEY = 'blackHoleGameHighScore';
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');

// Function to show congratulatory message
function showHighScoreMessage() {
  const messageContainer = document.createElement('div');
  messageContainer.style.position = 'fixed';
  messageContainer.style.top = '50%';
  messageContainer.style.left = '50%';
  messageContainer.style.transform = 'translate(-50%, -50%)';
  messageContainer.style.color = '#ffffff';
  messageContainer.style.fontFamily = 'Arial, sans-serif';
  messageContainer.style.fontSize = isMobile ? '24px' : '48px'; // Make font smaller on mobile
  messageContainer.style.textAlign = 'center';
  messageContainer.style.zIndex = '1000';
  messageContainer.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
  messageContainer.style.animation = 'fadeInOut 2s ease-in-out forwards';

  const message = document.createElement('div');
  message.textContent = `🎉 New High Score! ${score} 🎉`;
  messageContainer.appendChild(message);
  document.body.appendChild(messageContainer);

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
      40% { transform: translate(-50%, -50%) scale(1); }
      60% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
  `;
  document.head.appendChild(style);

  // Remove the message after animation
  setTimeout(() => {
    messageContainer.remove();
    style.remove();
  }, 2000);
}

// --- Black Hole Shaders ---
const blackHoleVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const blackHoleFragmentShader = `
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float uIntensity;
uniform vec3 uFlashColor;
uniform float uFlashIntensity;
uniform bool uIsRival; // New uniform
uniform vec3 uRivalGlowColor; // New uniform (e.g., RIVAL_BLACK_HOLE_COLOR)

float calculateLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 textureColor = texture2D(uTexture, vUv);

  vec3 baseColor = textureColor.rgb * uIntensity;
  baseColor += uFlashColor * uFlashIntensity;

  // Add rival glow
  if (uIsRival) {
    float dist = length(vUv - vec2(0.5)); // Distance from center (0.0 to 0.5)
    // Create a glow effect concentrated near the edge (adjust smoothstep values for thickness/falloff)
    float glowAmount = smoothstep(0.35, 0.5, dist) * (1.0 - smoothstep(0.48, 0.5, dist));
    baseColor += uRivalGlowColor * glowAmount * 0.6; // Reduced multiplier further from 1.0 to 0.6
  }

  float brightness = calculateLuminance(textureColor.rgb);
  // Adjust alpha calculation slightly to account for potential glow brightness
  float alpha = smoothstep(0.03, 0.3, brightness + (uIsRival ? 0.1 : 0.0));

  gl_FragColor = vec4(baseColor, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// --- Texture Loader ---
const textureLoader = new THREE.TextureLoader();
let blackHoleTexture: THREE.Texture | null = null;
let rivalBlackHoleTexture: THREE.Texture | null = null;
const texturePath = '/textures/black-hole-texture.png'; // Verify path
const rivalTexturePath = '/textures/rival-black-hole.png'; // New path for rival texture

// Load textures after material is created
textureLoader.load(
  texturePath,
  (texture) => {
    console.log(`Black hole texture loaded successfully from: ${texturePath}`);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    blackHoleTexture = texture;
    if (blackHoleMaterial) {
      blackHoleMaterial.uniforms.uTexture.value = texture;
      blackHoleMaterial.needsUpdate = true;
    }
  },
  undefined,
  (error) => {
    console.error(`!!! ERROR LOADING BLACK HOLE TEXTURE !!! Attempted path: ${texturePath}`, error);
  }
);

textureLoader.load(
  rivalTexturePath,
  (texture) => {
    console.log(`Rival black hole texture loaded successfully from: ${rivalTexturePath}`);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    rivalBlackHoleTexture = texture;
  },
  undefined,
  (error) => {
    console.error(
      `!!! ERROR LOADING RIVAL BLACK HOLE TEXTURE !!! Attempted path: ${rivalTexturePath}`,
      error
    );
  }
);

// --- Basic Scene Setup ---
const scene = new THREE.Scene();
const sizes = { width: window.innerWidth, height: window.innerHeight };
scene.background = BACKGROUND_COLOR;
scene.fog = new THREE.Fog(FOG_COLOR, 80, PARTICLE_SPREAD * 1.2);
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 180);
camera.position.z = 11;
scene.add(camera);
const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas element with ID 'webgl-canvas' not found!");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(BACKGROUND_COLOR, 1);

// --- Post Processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 1.7, 0.9, 0.7);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
const ORIGINAL_BLOOM_STRENGTH = bloomPass.strength;

// --- Window Resize Handling ---
window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Ensure pixel ratio is updated

  // Update composer
  composer.setSize(sizes.width, sizes.height); // Ensure composer resolution matches
});

// --- Mouse and Touch Tracking ---
const mousePosition = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
  mousePosition.x = (event.clientX / sizes.width) * 2 - 1;
  mousePosition.y = -(event.clientY / sizes.height) * 2 + 1;
});

// Remove the old simple touchmove listener
// window.addEventListener(
//   'touchmove',
//   (event) => {
//     event.preventDefault(); // Prevent scrolling
//     if (event.touches.length > 0) {
//       const touch = event.touches[0];
//       mousePosition.x = (touch.clientX / sizes.width) * 2 - 1;
//       mousePosition.y = -(touch.clientY / sizes.height) * 2 + 1;
//     }
//   },
//   { passive: false }
// );

// --- Joystick Touch Handlers ---
function handleTouchStart(event: TouchEvent) {
  if (!isMobile || joystickActive) return; // Only handle first touch on mobile

  event.preventDefault(); // Prevent default actions like scrolling or zooming

  const touch = event.changedTouches[0];
  currentTouchId = touch.identifier;
  joystickCenter.x = touch.clientX;
  joystickCenter.y = touch.clientY;

  if (joystickBase && joystickStick) {
    joystickBase.style.left = `${joystickCenter.x}px`;
    joystickBase.style.top = `${joystickCenter.y}px`;
    joystickBase.style.display = 'block';

    joystickStick.style.left = `${joystickCenter.x}px`;
    joystickStick.style.top = `${joystickCenter.y}px`;
    joystickStick.style.display = 'block';
  }
  joystickActive = true;
  // Set initial mouse position based on joystick center? Or keep it (0,0)? Let's keep (0,0) for now.
  // mousePosition.set(0, 0);
}

function handleTouchMove(event: TouchEvent) {
  if (!isMobile || !joystickActive) return;

  event.preventDefault(); // Prevent scrolling during drag

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    if (touch.identifier === currentTouchId) {
      const currentX = touch.clientX;
      const currentY = touch.clientY;

      const deltaX = currentX - joystickCenter.x;
      const deltaY = currentY - joystickCenter.y;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      let stickX = joystickCenter.x + deltaX;
      let stickY = joystickCenter.y + deltaY;
      let normalizedX = deltaX / joystickRadius;
      let normalizedY = deltaY / joystickRadius; // Screen Y is downwards

      if (distance > joystickRadius) {
        // Clamp stick position to the edge of the base
        const ratio = joystickRadius / distance;
        stickX = joystickCenter.x + deltaX * ratio;
        stickY = joystickCenter.y + deltaY * ratio;
        normalizedX = (deltaX * ratio) / joystickRadius;
        normalizedY = (deltaY * ratio) / joystickRadius;
      }

      // Update stick visual position
      if (joystickStick) {
        joystickStick.style.left = `${stickX}px`;
        joystickStick.style.top = `${stickY}px`;
      }

      // Update mousePosition for black hole control
      // Clamp normalized values to [-1, 1] just in case
      mousePosition.x = Math.max(-1, Math.min(1, normalizedX));
      // Invert Y-axis: screen down is positive, game world up is positive
      mousePosition.y = Math.max(-1, Math.min(1, -normalizedY));

      break; // Found the controlling touch, exit loop
    }
  }
}

function handleTouchEnd(event: TouchEvent) {
  if (!isMobile || !joystickActive) return;

  let touchEnded = false;
  for (let i = 0; i < event.changedTouches.length; i++) {
    if (event.changedTouches[i].identifier === currentTouchId) {
      touchEnded = true;
      break;
    }
  }

  if (touchEnded) {
    if (joystickBase && joystickStick) {
      joystickBase.style.display = 'none';
      joystickStick.style.display = 'none';
    }
    joystickActive = false;
    currentTouchId = null;
    // Reset mouse position to stop movement when touch ends
    // Keep X at center, reset Y to initial mobile position
    mousePosition.x = 0;
    // Recalculate the normalized Y based on the initial ratio
    // (This ensures it respects the current camera position/FOV if they were dynamic,
    // though in this case camera.position.z is static)
    const halfVisibleHeight =
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const initialPlayerY = INITIAL_MOBILE_Y_RATIO * halfVisibleHeight;
    const initialNormalizedY = halfVisibleHeight !== 0 ? initialPlayerY / halfVisibleHeight : 0;
    mousePosition.y = Math.max(-1, Math.min(1, initialNormalizedY));
  }
}

// Add Joystick Listeners
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: false });
window.addEventListener('touchcancel', handleTouchEnd, { passive: false }); // Also handle cancel

// --- Game Objects ---
const playerGroup = new THREE.Group();
playerGroup.position.z = 0;
scene.add(playerGroup);
const blackHoleGeometry = new THREE.PlaneGeometry(
  EFFECTIVE_BLACK_HOLE_PLANE_SIZE,
  EFFECTIVE_BLACK_HOLE_PLANE_SIZE,
  32,
  32
);

// Create separate geometry for rivals
const rivalBlackHoleGeometry = new THREE.PlaneGeometry(
  EFFECTIVE_RIVAL_BLACK_HOLE_PLANE_SIZE,
  EFFECTIVE_RIVAL_BLACK_HOLE_PLANE_SIZE,
  32,
  32
);

// Black Hole Material
const blackHoleMaterial = new THREE.ShaderMaterial({
  vertexShader: blackHoleVertexShader,
  fragmentShader: blackHoleFragmentShader,
  uniforms: {
    uTexture: { value: blackHoleTexture },
    uIntensity: { value: 1.15 },
    uFlashColor: { value: FLASH_COLOR },
    uFlashIntensity: { value: 0.0 },
    uIsRival: { value: false }, // Player is not a rival
    uRivalGlowColor: { value: new THREE.Color(0x000000) }, // No glow color for player
  },
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
playerGroup.add(blackHole);

// Set initial position for mobile (30% from bottom)
if (isMobile) {
  // const initialYRatio = -0.4; // Use the constant instead
  // Calculate visible height at Z=0 for initial positioning
  const halfVisibleHeightInitial =
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const initialPlayerY = INITIAL_MOBILE_Y_RATIO * halfVisibleHeightInitial;
  playerGroup.position.y = initialPlayerY;

  // Also set the initial mousePosition.y to match, avoiding a jump on first touch
  // Map the world Y back to the normalized [-1, 1] range relative to VISIBLE height
  mousePosition.y = halfVisibleHeightInitial !== 0 ? initialPlayerY / halfVisibleHeightInitial : 0;
  // Clamp initial mousePosition.y just in case
  mousePosition.y = Math.max(-1, Math.min(1, mousePosition.y));
}

// --- Starfield Particle System ---
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3 = i * 3;
  const radius = Math.random() * PARTICLE_SPREAD * 0.7 + PARTICLE_SPREAD * 0.2;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = radius * Math.cos(phi) - PARTICLE_SPREAD * 0.4;

  const intensity = Math.random() * 0.5 + 0.5;
  colors[i3] = STAR_COLOR.r * intensity;
  colors[i3 + 1] = STAR_COLOR.g * intensity;
  colors[i3 + 2] = STAR_COLOR.b * intensity;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particlesMaterial = new THREE.PointsMaterial({
  vertexColors: true,
  size: 0.06,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
particles.rotation.x = Math.random() * 0.1;
particles.rotation.y = Math.random() * 0.1;
scene.add(particles);

// --- Star Collectible Geometry/Material ---
function createStarGeometry(
  outerRadius: number,
  innerRadius: number,
  points: number
): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  const angleStep = Math.PI / points;
  shape.moveTo(outerRadius, 0);
  for (let i = 1; i <= points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = angleStep * i;
    shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const starGeometry = createStarGeometry(
  EFFECTIVE_STAR_OUTER_RADIUS,
  EFFECTIVE_STAR_INNER_RADIUS,
  STAR_POINTS
);
const starMaterial = new THREE.MeshBasicMaterial({
  color: STAR_COLOR,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});

// --- Shared Cue Border Geometry & Material ---
const cueBorderPlaneGeometry = new THREE.PlaneGeometry(
  EFFECTIVE_CUE_BORDER_BASE_SIZE,
  EFFECTIVE_CUE_BORDER_BASE_SIZE
);
const cueBorderEdgesGeometry = new THREE.EdgesGeometry(cueBorderPlaneGeometry);
const cueBorderLineMaterial = new THREE.LineBasicMaterial({
  color: CUE_BORDER_COLOR,
  transparent: true,
  opacity: CUE_BORDER_OPACITY,
  depthWrite: false,
});

// --- UI Setup ---
function createUI() {
  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  uiContainer.style.position = 'fixed';
  uiContainer.style.top = '20px';
  uiContainer.style.right = '20px';
  uiContainer.style.color = '#ffffff';
  uiContainer.style.fontFamily = 'Arial, sans-serif';
  uiContainer.style.fontSize = '20px';
  uiContainer.style.textAlign = 'right';
  uiContainer.style.zIndex = '1000';
  uiContainer.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';

  const scoreElement = document.createElement('div');
  scoreElement.id = 'score-display';
  scoreElement.style.marginBottom = '10px';

  const massElement = document.createElement('div');
  massElement.id = 'mass-display';

  const highScoreElement = document.createElement('div');
  highScoreElement.id = 'high-score-display';
  highScoreElement.style.marginTop = '10px';
  highScoreElement.style.fontSize = '16px';

  uiContainer.appendChild(scoreElement);
  uiContainer.appendChild(massElement);
  uiContainer.appendChild(highScoreElement);
  document.body.appendChild(uiContainer);

  // Create three-dot menu button
  const menuButton = document.createElement('div');
  menuButton.id = 'menu-button';
  menuButton.innerHTML = '⋮';
  menuButton.style.position = 'fixed';
  menuButton.style.top = '20px';
  menuButton.style.left = '20px';
  menuButton.style.fontSize = '32px';
  menuButton.style.color = '#ffffff';
  menuButton.style.cursor = 'pointer';
  menuButton.style.zIndex = '1000';
  menuButton.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
  menuButton.style.transition = 'transform 0.2s ease';
  menuButton.style.userSelect = 'none';

  // Create menu container
  const menuContainer = document.createElement('div');
  menuContainer.id = 'menu-container';
  menuContainer.style.position = 'fixed';
  menuContainer.style.top = '70px';
  menuContainer.style.left = '20px';
  menuContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  menuContainer.style.borderRadius = '10px';
  menuContainer.style.padding = '10px';
  menuContainer.style.zIndex = '1001';
  menuContainer.style.display = 'none';
  menuContainer.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.2)';

  // Create menu items
  const soundMenuItem = document.createElement('div');
  soundMenuItem.className = 'menu-item';
  soundMenuItem.innerHTML = `
    <span style="margin-right: 10px;">🔊</span>
    <span id="sound-text" style="color: #ffffff;">Sound: On</span>
  `;
  soundMenuItem.style.padding = '10px';
  soundMenuItem.style.cursor = 'pointer';
  soundMenuItem.style.transition = 'all 0.2s ease';
  soundMenuItem.style.borderRadius = '5px';
  soundMenuItem.style.color = '#ffffff';
  soundMenuItem.style.fontSize = '16px';

  const howToPlayMenuItem = document.createElement('div');
  howToPlayMenuItem.className = 'menu-item';
  howToPlayMenuItem.innerHTML = `
    <span style="margin-right: 10px;">❓</span>
    <span style="color: #ffffff;">How to Play</span>
  `;
  howToPlayMenuItem.style.padding = '10px';
  howToPlayMenuItem.style.cursor = 'pointer';
  howToPlayMenuItem.style.transition = 'all 0.2s ease';
  howToPlayMenuItem.style.borderRadius = '5px';
  howToPlayMenuItem.style.color = '#ffffff';
  howToPlayMenuItem.style.fontSize = '16px';

  menuContainer.appendChild(soundMenuItem);
  menuContainer.appendChild(howToPlayMenuItem);
  document.body.appendChild(menuContainer);
  document.body.appendChild(menuButton);

  // Create dialog for How to Play
  const dialog = document.createElement('div');
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  dialog.style.padding = '30px';
  dialog.style.borderRadius = '15px';
  dialog.style.color = '#ffffff';
  dialog.style.fontFamily = 'Arial, sans-serif';
  dialog.style.maxWidth = '500px';
  dialog.style.width = '90%';
  dialog.style.zIndex = '1002';
  dialog.style.display = 'none';
  dialog.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.2)';

  const dialogContent = document.createElement('div');
  dialogContent.innerHTML = `
    <h2 style="margin-top: 0; color: #add8e6;">Black Hole Game</h2>
    <p>Welcome to the Black Hole Game! Guide your black hole through space, collect stars to grow stronger, and avoid rival black holes.</p>

    <h3 style="color: #add8e6;">How to Play:</h3>
    <ul style="text-align: left;">
      <li>Move your black hole with the mouse/touch</li>
      <li>Collect stars to increase your mass and score</li>
      <li>Hold SPACE for slow-motion to help with precise movements (Desktop only)</li>
      <li>Avoid rival black holes (red) - they reduce your mass</li>
      <li>Game ends if your mass reaches zero</li>
    </ul>

    <h3 style="color: #add8e6;">Tips:</h3>
    <ul style="text-align: left;">
      <li>Watch for the transparent border around stars - it shows the collection zone</li>
      <li>As you collect more stars, the game speeds up</li>
      <li>More rival black holes appear as your score increases</li>
    </ul>
  `;

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '20px';
  closeButton.style.padding = '10px 20px';
  closeButton.style.backgroundColor = '#add8e6';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '5px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '16px';
  closeButton.style.color = '#000000';
  closeButton.style.transition = 'background-color 0.2s ease';

  dialog.appendChild(dialogContent);
  dialog.appendChild(closeButton);
  document.body.appendChild(dialog);

  // Add hover effects
  menuButton.addEventListener('mouseenter', () => {
    menuButton.style.transform = 'scale(1.2)';
  });

  menuButton.addEventListener('mouseleave', () => {
    menuButton.style.transform = 'scale(1)';
  });

  soundMenuItem.addEventListener('mouseenter', () => {
    soundMenuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    soundMenuItem.style.color = '#add8e6';
  });

  soundMenuItem.addEventListener('mouseleave', () => {
    soundMenuItem.style.backgroundColor = 'transparent';
    soundMenuItem.style.color = '#ffffff';
  });

  howToPlayMenuItem.addEventListener('mouseenter', () => {
    howToPlayMenuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    howToPlayMenuItem.style.color = '#add8e6';
  });

  howToPlayMenuItem.addEventListener('mouseleave', () => {
    howToPlayMenuItem.style.backgroundColor = 'transparent';
    howToPlayMenuItem.style.color = '#ffffff';
  });

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = '#ffffff';
  });

  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = '#add8e6';
  });

  // Handle menu toggle
  menuButton.addEventListener('click', () => {
    menuContainer.style.display = menuContainer.style.display === 'none' ? 'block' : 'none';
  });

  // Handle sound toggle
  soundMenuItem.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const soundText = document.getElementById('sound-text');
    if (soundText) {
      soundText.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
    }

    // Update audio volumes
    backgroundMusic.volume = soundEnabled ? 0.1 : 0;
    starCatchSound.volume = soundEnabled ? 0.1 : 0;
    rivalCollisionSound.volume = soundEnabled ? 0.3 : 0;
    gameOverSound.volume = soundEnabled ? 0.3 : 0;
  });

  // Handle How to Play click
  howToPlayMenuItem.addEventListener('click', () => {
    menuContainer.style.display = 'none';
    dialog.style.display = 'block';
    gameActive = false;
  });

  // Handle dialog close
  closeButton.addEventListener('click', () => {
    dialog.style.display = 'none';
    gameActive = true;
  });

  // Close dialog when clicking outside
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.style.display = 'none';
      gameActive = true;
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuButton.contains(e.target as Node) && !menuContainer.contains(e.target as Node)) {
      menuContainer.style.display = 'none';
    }
  });

  // Add Media Query Styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @media (max-width: 768px) {
      #ui-container {
        font-size: 12px;
        top: 10px;
        right: 10px;
      }
      #high-score-display {
        font-size: 12px;
      }
      #menu-button {
        font-size: 24px;
        top: 10px;
        left: 10px;
      }
      #menu-container {
        top: 50px;
        left: 10px;
      }
    }
  `;
  document.head.appendChild(styleSheet);

  updateUI();
}

function updateUI() {
  const scoreElement = document.getElementById('score-display');
  const massElement = document.getElementById('mass-display');
  const highScoreElement = document.getElementById('high-score-display');

  if (scoreElement && massElement && highScoreElement) {
    scoreElement.textContent = `Stars hunted: ${score}`;
    massElement.textContent = `Mass: ${blackHoleMass} M☉`;
    highScoreElement.textContent = `Highest Score: ${highScore}`;
    highScoreElement.style.fontSize = '16px';

    // Check for new high score but don't show message yet
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
    }
  }
}

// --- Star Spawning ---
function spawnStar() {
  const star = new THREE.Mesh(starGeometry, starMaterial.clone());
  const spawnAreaX = BLACK_HOLE_MOVEMENT_BOUNDS_X * 2.0;
  const spawnAreaY = BLACK_HOLE_MOVEMENT_BOUNDS_Y * 2.0;
  const initialX = (Math.random() - 0.5) * spawnAreaX * 2;
  const initialY = (Math.random() - 0.5) * spawnAreaY * 2;
  const initialZ = SPAWN_DISTANCE_Z - Math.random() * 30;

  star.position.set(initialX, initialY, initialZ);
  const initialPos = star.position.clone();
  star.rotation.z = Math.random() * Math.PI * 2;

  // Modified target position calculation to create more diverse paths
  const isMobile = sizes.width <= 768; // Check if screen is narrow
  const targetAngle = isMobile
    ? Math.PI + Math.random() * Math.PI // Bias angle to bottom half (PI to 2*PI) on mobile
    : Math.random() * Math.PI * 2; // Full circle on desktop

  const targetRadius = STAR_TARGET_RADIUS * (0.5 + Math.random() * 0.5);
  const targetX = Math.cos(targetAngle) * targetRadius;
  const targetY = Math.sin(targetAngle) * targetRadius; // targetY will be mostly negative on mobile
  const targetPos = new THREE.Vector3(targetX, targetY, 0);
  const direction = targetPos.clone().sub(initialPos).normalize();

  const offsetAngle = Math.random() * Math.PI * 2;
  const offsetMagnitude = Math.random() * CUE_BORDER_MAX_OFFSET;
  const cueOffsetX = Math.cos(offsetAngle) * offsetMagnitude;
  const cueOffsetY = Math.sin(offsetAngle) * offsetMagnitude;

  const borderMaterialClone = cueBorderLineMaterial.clone();
  borderMaterialClone.opacity = 0;
  const cueBorder = new THREE.LineSegments(cueBorderEdgesGeometry, borderMaterialClone);
  cueBorder.position.set(cueOffsetX, cueOffsetY, 0);
  star.add(cueBorder);

  star.userData = {
    previousPosition: initialPos.clone(),
    direction: direction,
    cueBorder: cueBorder,
    cueOffsetX: cueOffsetX,
    cueOffsetY: cueOffsetY,
    targetPos: targetPos.clone(),
  };

  scene.add(star);
  stars.push(star);
  totalStarsSpawned++; // Increment total stars spawned counter
  console.log(`Star ${totalStarsSpawned} spawned.`); // Log star spawn

  // Ensure at least one rival can spawn after 15 stars
  if (totalStarsSpawned >= 15 && currentMaxRivals < 1) {
    console.log(`Star ${totalStarsSpawned}: Setting currentMaxRivals from 0 to 1.`);
    currentMaxRivals = 1;
  }

  // Check if we should spawn a rival black hole
  if (totalStarsSpawned >= 15) {
    console.log(
      `Star ${totalStarsSpawned}: Checking rival spawn. hasFirstRivalSpawned: ${hasFirstRivalSpawned}, currentMaxRivals: ${currentMaxRivals}, rivals.length: ${rivalBlackHoles.length}`
    );
    if (!hasFirstRivalSpawned) {
      console.log(`Star ${totalStarsSpawned}: Attempting to spawn FIRST rival.`);
      spawnRivalBlackHole(star); // Attempt to spawn
      // Check if spawn was successful (i.e., if a rival was actually added)
      console.log(
        `Star ${totalStarsSpawned}: After first spawn attempt. rivals.length: ${rivalBlackHoles.length}`
      );
      if (rivalBlackHoles.length > 0 && !hasFirstRivalSpawned) {
        console.log(`Star ${totalStarsSpawned}: FIRST rival spawn SUCCESSFUL. Setting flag.`);
        hasFirstRivalSpawned = true;
        lastRivalSpawnScore = totalStarsSpawned;
      } else if (!hasFirstRivalSpawned) {
        console.warn(`Star ${totalStarsSpawned}: FIRST rival spawn FAILED or flag already set?.`);
      }
    } else if (totalStarsSpawned >= lastRivalSpawnScore + RIVAL_BLACK_HOLE_MIN_SPAWN_INTERVAL) {
      console.log(`Star ${totalStarsSpawned}: Checking subsequent rival spawn interval.`);
      // For subsequent rivals, use the spawn interval
      const shouldSpawn = Math.random() < RIVAL_BLACK_HOLE_SPAWN_CHANCE;
      console.log(`Star ${totalStarsSpawned}: Should spawn subsequent? ${shouldSpawn}`);
      if (shouldSpawn) {
        console.log(`Star ${totalStarsSpawned}: Attempting to spawn SUBSEQUENT rival.`);
        spawnRivalBlackHole(star);
        lastRivalSpawnScore = totalStarsSpawned;
      }
    }
  }
}

// --- Input Handling (Slow-motion) ---
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !isSlowMo && gameActive) {
    isSlowMo = true;
    gsap.to(
      {},
      {
        duration: 0.2,
        onUpdate: () => {
          gameSpeed = BASE_GAME_SPEED * SLOW_MO_FACTOR;
        },
      }
    );
    gsap.to(bloomPass, {
      strength: ORIGINAL_BLOOM_STRENGTH * 0.85,
      duration: 0.2,
    });
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' && isSlowMo && gameActive) {
    isSlowMo = false;
    gsap.to(
      {},
      {
        duration: 0.5,
        ease: 'power1.out',
        onUpdate: () => {
          gameSpeed = BASE_GAME_SPEED;
        },
      }
    );
    gsap.to(bloomPass, {
      strength: ORIGINAL_BLOOM_STRENGTH,
      duration: 0.5,
    });
  }
});

// --- Rival Black Hole Spawning ---
function spawnRivalBlackHole(star: THREE.Mesh) {
  console.log(
    `spawnRivalBlackHole called. currentMaxRivals: ${currentMaxRivals}, rivalBlackHoles.length: ${rivalBlackHoles.length}`
  );
  if (rivalBlackHoles.length >= currentMaxRivals) {
    console.warn(
      `spawnRivalBlackHole: PREVENTED spawn because length (${rivalBlackHoles.length}) >= max (${currentMaxRivals})`
    );
    return; // Prevent spawn if limit reached
  }

  // Create a consistent material for all rival black holes
  const rivalMaterial = new THREE.ShaderMaterial({
    vertexShader: blackHoleVertexShader,
    fragmentShader: blackHoleFragmentShader,
    uniforms: {
      uTexture: { value: rivalBlackHoleTexture },
      uIntensity: { value: 1.15 }, // Keep base intensity same as player for consistency
      uFlashColor: { value: RIVAL_BLACK_HOLE_COLOR }, // Flash color remains red
      uFlashIntensity: { value: 0.0 },
      uIsRival: { value: true }, // This IS a rival
      uRivalGlowColor: { value: RIVAL_BLACK_HOLE_COLOR }, // Use the rival color for the glow
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const rivalBlackHole = new THREE.Mesh(rivalBlackHoleGeometry, rivalMaterial);

  // Spawn position near the star at the same Z distance
  const starPos = star.position;
  const starTarget = star.userData.targetPos as THREE.Vector3;

  // Calculate position with more random offset
  const offsetAngle = Math.random() * Math.PI * 2;
  const offsetDistance = STAR_OUTER_RADIUS * (1.5 + Math.random() * 2); // Random offset between 1.5 and 3.5 star diameters
  const offsetX = Math.cos(offsetAngle) * offsetDistance;
  const offsetY = Math.sin(offsetAngle) * offsetDistance;

  // Spawn at the same Z distance as the star
  const initialX = starPos.x + offsetX;
  const initialY = starPos.y + offsetY;
  const initialZ = SPAWN_DISTANCE_Z - Math.random() * 30; // Same Z range as stars

  rivalBlackHole.position.set(initialX, initialY, initialZ);
  const initialPos = rivalBlackHole.position.clone();

  // Calculate target position with slight variation from star's path
  const targetVariation = 0.5 + Math.random() * 0.5; // Random variation between 0.5 and 1.0
  const targetX = starTarget.x + offsetX * targetVariation;
  const targetY = starTarget.y + offsetY * targetVariation;
  const targetPos = new THREE.Vector3(targetX, targetY, 0);
  const direction = targetPos.clone().sub(initialPos).normalize();

  rivalBlackHole.userData = {
    previousPosition: initialPos.clone(),
    direction: direction,
    lastWarningTime: 0,
    associatedStar: star, // Reference to the associated star
    speedMultiplier: 1.5, // Make rival black holes move 50% faster than stars
  };

  scene.add(rivalBlackHole);
  rivalBlackHoles.push(rivalBlackHole);
  console.log(
    `spawnRivalBlackHole: Rival successfully created and added. New length: ${rivalBlackHoles.length}`
  );
}

// --- Game Over Function ---
function handleGameOver() {
  gameActive = false;

  // --- Disable Joystick ---
  if (isMobile) {
    console.log('Game Over: Disabling joystick.');
    if (joystickBase) joystickBase.style.display = 'none';
    if (joystickStick) joystickStick.style.display = 'none';
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchEnd);
    joystickActive = false;
    currentTouchId = null;
    // Reset mouse position just in case
    mousePosition.set(0, 0);
  }
  // --- End Disable Joystick ---

  // Play game over sound
  playSound(gameOverSound);

  // Create blurred backdrop
  const backdrop = document.createElement('div');
  backdrop.style.position = 'fixed';
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.width = '100%';
  backdrop.style.height = '100%';
  backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  backdrop.style.backdropFilter = 'blur(4px)';
  backdrop.style.zIndex = '999';
  document.body.appendChild(backdrop);

  // Create game over UI
  const gameOverContainer = document.createElement('div');
  gameOverContainer.style.position = 'fixed';
  gameOverContainer.style.top = '50%';
  gameOverContainer.style.left = '50%';
  gameOverContainer.style.transform = 'translate(-50%, -50%)';
  gameOverContainer.style.color = '#ffffff';
  gameOverContainer.style.fontFamily = 'Arial, sans-serif';
  gameOverContainer.style.fontSize = '48px';
  gameOverContainer.style.textAlign = 'center';
  gameOverContainer.style.zIndex = '1000';
  gameOverContainer.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
  gameOverContainer.style.padding = '40px';
  if (isMobile) {
    gameOverContainer.style.padding = '10px';
  }
  gameOverContainer.style.borderRadius = '20px';
  gameOverContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  gameOverContainer.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.5)';

  const gameOverText = document.createElement('div');
  gameOverText.textContent = 'GAME OVER';
  gameOverText.style.marginBottom = '20px';
  // Make GAME OVER text smaller on mobile
  if (isMobile) {
    gameOverText.style.fontSize = '36px'; // Adjust size for mobile
  }

  const scoreText = document.createElement('div');
  scoreText.textContent = `Final Score: ${score}`;
  scoreText.style.fontSize = '32px';
  // Adjust score/high score text size on mobile
  if (isMobile) {
    scoreText.style.fontSize = '24px';
  }

  const highScoreText = document.createElement('div');
  highScoreText.textContent = `Highest Score: ${highScore}`;
  highScoreText.style.fontSize = '32px';
  highScoreText.style.marginTop = '10px';
  if (isMobile) {
    highScoreText.style.fontSize = '24px';
  }

  const massText = document.createElement('div');
  massText.textContent = `Your black hole was destroyed!`;
  massText.style.fontSize = '24px';
  massText.style.marginTop = '10px';
  if (isMobile) {
    massText.style.fontSize = '18px';
  }

  const restartText = document.createElement('div');
  restartText.textContent = 'Press R to Restart';
  restartText.style.fontSize = '24px';
  restartText.style.marginTop = '20px';
  if (isMobile) {
    restartText.style.fontSize = '18px';
  }

  // Add a Restart Button
  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart Game';
  restartButton.style.marginTop = '30px';
  restartButton.style.padding = '15px 30px';
  restartButton.style.fontSize = '20px';
  restartButton.style.backgroundColor = '#add8e6';
  restartButton.style.border = 'none';
  restartButton.style.borderRadius = '8px';
  restartButton.style.cursor = 'pointer';
  restartButton.style.color = '#000000';
  restartButton.style.transition = 'background-color 0.2s ease';

  restartButton.addEventListener('mouseenter', () => {
    restartButton.style.backgroundColor = '#ffffff';
  });
  restartButton.addEventListener('mouseleave', () => {
    restartButton.style.backgroundColor = '#add8e6';
  });
  restartButton.addEventListener('click', () => {
    window.location.reload();
  });

  gameOverContainer.appendChild(gameOverText);
  gameOverContainer.appendChild(scoreText);
  gameOverContainer.appendChild(highScoreText);
  gameOverContainer.appendChild(massText);
  gameOverContainer.appendChild(restartText); // Keep the 'Press R' text
  gameOverContainer.appendChild(restartButton); // Add the button
  document.body.appendChild(gameOverContainer);

  // Show high score message if a new high score was achieved
  if (score === highScore && score > parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0')) {
    showHighScoreMessage();
  }
}

// --- Collision Detection ---
const FLASH_INTENSITY_MAX = 1.8;
const FLASH_DURATION = 0.3;

// Add this function to create the damage overlay
function createDamageOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.bottom = '0';
  overlay.style.right = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.border = '2px solid #ff0000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s ease-out';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1000';
  overlay.style.boxShadow = `
    0 0 10px #ff0000,
    0 0 20px #ff0000,
    0 0 30px #ff0000,
    0 0 40px #ff0000,
    inset 0 0 10px #ff0000,
    inset 0 0 20px #ff0000,
    inset 0 0 30px #ff0000,
    inset 0 0 40px #ff0000
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function checkCollisions() {
  const starEffectiveRadius = EFFECTIVE_STAR_OUTER_RADIUS * COLLISION_THRESHOLD_XY_FACTOR;
  const blackHoleInnerRadius =
    EFFECTIVE_COLLISION_CENTER_RADIUS - EFFECTIVE_COLLISION_RING_WIDTH / 2;
  const blackHoleOuterRadius =
    EFFECTIVE_COLLISION_CENTER_RADIUS + EFFECTIVE_COLLISION_RING_WIDTH / 2;
  const minCollisionDist = Math.max(
    0,
    blackHoleInnerRadius - starEffectiveRadius - COLLISION_PADDING
  );
  const minCollisionDistSq = minCollisionDist * minCollisionDist;
  const maxCollisionDist = blackHoleOuterRadius + starEffectiveRadius + COLLISION_PADDING;
  const maxCollisionDistSq = maxCollisionDist * maxCollisionDist;

  // Define specific collision distance for player-rival interaction
  const playerCollisionRadius = blackHoleOuterRadius; // Player's outer ring radius
  const rivalCollisionRadius = blackHoleOuterRadius; // Rival BH has same size
  const rivalMaxCollisionDist = playerCollisionRadius + rivalCollisionRadius + COLLISION_PADDING;
  const rivalMaxCollisionDistSq = rivalMaxCollisionDist * rivalMaxCollisionDist; // Squared distance for efficiency

  const blackHoleZPlane = playerGroup.position.z;

  // Check star collisions
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    if (
      !star ||
      !star.userData ||
      !(star.userData.previousPosition instanceof THREE.Vector3) ||
      !(star.userData.cueBorder instanceof THREE.LineSegments) ||
      typeof star.userData.cueOffsetX !== 'number' ||
      typeof star.userData.cueOffsetY !== 'number'
    )
      continue;

    const prevPos = star.userData.previousPosition as THREE.Vector3;
    const currPos = star.position;
    // const cueBorder = star.userData.cueBorder as THREE.LineSegments;
    const cueOffsetX = star.userData.cueOffsetX as number;
    const cueOffsetY = star.userData.cueOffsetY as number;

    if (prevPos.z < blackHoleZPlane && currPos.z >= blackHoleZPlane) {
      const zMovement = currPos.z - prevPos.z;
      if (zMovement > 1e-6) {
        const tZCrossing = (blackHoleZPlane - prevPos.z) / zMovement;
        const intersectX = prevPos.x + (currPos.x - prevPos.x) * tZCrossing;
        const intersectY = prevPos.y + (currPos.y - prevPos.y) * tZCrossing;

        // Calculate cue border scale with more forgiving bounds
        const startZ_scale = SPAWN_DISTANCE_Z;
        const endZ_scale = 0;
        let tScale = (blackHoleZPlane - startZ_scale) / (endZ_scale - startZ_scale);
        tScale = Math.max(0, Math.min(1, tScale));
        const cueBorderScale =
          CUE_BORDER_MIN_SCALE + tScale * (CUE_BORDER_MAX_SCALE - CUE_BORDER_MIN_SCALE);
        const cueBorderHalfSize = (EFFECTIVE_CUE_BORDER_BASE_SIZE * cueBorderScale) / 2.0;
        const cueCenterX = intersectX + cueOffsetX;
        const cueCenterY = intersectY + cueOffsetY;

        // More forgiving cue border check
        const playerX = playerGroup.position.x;
        const playerY = playerGroup.position.y;
        const dx = playerX - cueCenterX;
        const dy = playerY - cueCenterY;
        const distanceToCueCenter = Math.sqrt(dx * dx + dy * dy);
        const maxAllowedDistance = cueBorderHalfSize * COLLISION_RING_FORGIVENESS;

        // Check if player is within the cue border with more forgiving bounds
        const isPlayerInCueBorder = distanceToCueCenter <= maxAllowedDistance;

        // More forgiving ring collision check
        const dxToStar = intersectX - playerX;
        const dyToStar = intersectY - playerY;
        const distanceSq = dxToStar * dxToStar + dyToStar * dyToStar;
        const isWithinCollisionRing =
          distanceSq >= minCollisionDistSq * 0.8 && distanceSq <= maxCollisionDistSq * 1.2;

        // Trigger catch if either condition is met with more forgiving checks
        if (isPlayerInCueBorder || isWithinCollisionRing) {
          score++;

          // Play star catch sound
          playSound(starCatchSound);

          // Check if we should increase speed and mass
          if (score - lastSpeedIncreaseScore >= SPEED_INCREASE_INTERVAL) {
            const newSpeed = Math.min(gameSpeed + SPEED_INCREASE_AMOUNT, MAX_GAME_SPEED);
            if (newSpeed !== gameSpeed) {
              gameSpeed = newSpeed;
              lastSpeedIncreaseScore = score;
              // Mass increase now happens every 10 stars
              if (score % 10 === 0) {
                blackHoleMass += MASS_INCREASE_AMOUNT;
              }

              // Visual feedback for speed increase
              gsap.to(bloomPass, {
                strength: ORIGINAL_BLOOM_STRENGTH * 1.2,
                duration: 0.3,
                yoyo: true,
                repeat: 1,
              });
            }
          }

          // Check if we should increase rival count
          if (score % RIVAL_BLACK_HOLE_INCREASE_INTERVAL === 0) {
            currentMaxRivals = Math.min(
              currentMaxRivals + RIVAL_BLACK_HOLE_INCREASE_AMOUNT,
              RIVAL_BLACK_HOLE_COUNT
            );
          }

          // Update UI
          updateUI();

          gsap.killTweensOf(blackHoleMaterial.uniforms.uFlashIntensity);
          blackHoleMaterial.uniforms.uFlashIntensity.value = FLASH_INTENSITY_MAX;
          gsap.to(blackHoleMaterial.uniforms.uFlashIntensity, {
            value: 0.0,
            duration: FLASH_DURATION,
            ease: 'power2.out',
          });

          const cueBorderToDispose = star.userData.cueBorder as THREE.LineSegments;
          stars.splice(i, 1);
          spawnStar();

          gsap.to(star.scale, {
            x: 1.8,
            y: 1.8,
            z: 1.8,
            duration: 0.15,
            ease: 'power1.out',
            onComplete: () => {
              scene.remove(star);
              (star.material as THREE.Material).dispose();
            },
          });

          gsap.to(star.material as THREE.MeshBasicMaterial, {
            opacity: 0,
            duration: 0.15,
          });

          if (cueBorderToDispose) {
            (cueBorderToDispose.material as THREE.Material).dispose();
          }
          return;
        }
      }
    }
    if (star.userData.previousPosition) {
      prevPos.copy(currPos);
    }
  }

  // Check rival black hole collisions
  for (let i = rivalBlackHoles.length - 1; i >= 0; i--) {
    const rival = rivalBlackHoles[i];
    if (!rival || !rival.userData || !(rival.userData.previousPosition instanceof THREE.Vector3))
      continue;

    const prevPos = rival.userData.previousPosition as THREE.Vector3;
    const currPos = rival.position;

    if (prevPos.z < blackHoleZPlane && currPos.z >= blackHoleZPlane) {
      const zMovement = currPos.z - prevPos.z;
      if (zMovement > 1e-6) {
        const tZCrossing = (blackHoleZPlane - prevPos.z) / zMovement;
        const intersectX = prevPos.x + (currPos.x - prevPos.x) * tZCrossing;
        const intersectY = prevPos.y + (currPos.y - prevPos.y) * tZCrossing;

        const playerX = playerGroup.position.x;
        const playerY = playerGroup.position.y;
        const dxToRival = intersectX - playerX;
        const dyToRival = intersectY - playerY;
        const distanceSq = dxToRival * dxToRival + dyToRival * dyToRival;

        // Check for collision with rival black hole using the specific rival distance and no multiplier
        if (distanceSq <= rivalMaxCollisionDistSq) {
          // Play rival collision sound
          playSound(rivalCollisionSound);

          // Reduce player's mass
          blackHoleMass = Math.max(0, blackHoleMass - RIVAL_BLACK_HOLE_DAMAGE);

          // Visual feedback for damage
          gsap.to(bloomPass, {
            strength: ORIGINAL_BLOOM_STRENGTH * 1.5,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
          });

          // Red flash effect
          gsap.killTweensOf(blackHoleMaterial.uniforms.uFlashColor);
          blackHoleMaterial.uniforms.uFlashColor.value = DAMAGE_FLASH_COLOR;
          blackHoleMaterial.uniforms.uFlashIntensity.value = FLASH_INTENSITY_MAX;
          gsap.to(blackHoleMaterial.uniforms.uFlashIntensity, {
            value: 0.0,
            duration: FLASH_DURATION,
            ease: 'power2.out',
            onComplete: () => {
              blackHoleMaterial.uniforms.uFlashColor.value = FLASH_COLOR;
            },
          });

          // Shake effect
          const originalX = playerGroup.position.x;
          const originalY = playerGroup.position.y;
          const shakeAmount = 0.3;
          const shakeDuration = 0.2;

          gsap.to(playerGroup.position, {
            x: originalX + (Math.random() - 0.5) * shakeAmount,
            y: originalY + (Math.random() - 0.5) * shakeAmount,
            duration: shakeDuration / 4,
            yoyo: true,
            repeat: 3,
            ease: 'power1.inOut',
            onComplete: () => {
              gsap.to(playerGroup.position, {
                x: originalX,
                y: originalY,
                duration: 0.1,
              });
            },
          });

          // Red border overlay effect
          if (!damageOverlay) {
            damageOverlay = createDamageOverlay();
          }

          // Show the overlay
          damageOverlay.style.opacity = '1';

          // Hide the overlay after a short delay
          setTimeout(() => {
            if (damageOverlay) {
              damageOverlay.style.opacity = '0';
            }
          }, 200);

          // Update UI
          updateUI();

          // Remove the rival black hole
          scene.remove(rival);
          rivalBlackHoles.splice(i, 1);
          (rival.material as THREE.Material).dispose();

          // Check if game should end
          if (blackHoleMass <= 0) {
            handleGameOver();
            return;
          }
        }
      }
    }

    if (rival.userData.previousPosition) {
      prevPos.copy(currPos);
    }
  }
}

// --- Animation Loop ---
const clock = new THREE.Clock();
const animate = () => {
  const deltaTime = clock.getDelta();
  elapsedTime += deltaTime;

  if (gameActive) {
    const effectiveSpeed = gameSpeed * deltaTime;

    // --- Calculate Screen Bounds in World Coords (Needs to be done first!) ---
    const halfVisibleHeight =
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfVisibleWidth = halfVisibleHeight * camera.aspect;

    // --- Calculate Target Position ---
    let targetX: number;
    let targetY: number;

    if (isMobile) {
      // Mobile: Map joystick [-1, 1] directly to visible screen bounds in world coords
      targetX = mousePosition.x * halfVisibleWidth;
      targetY = mousePosition.y * halfVisibleHeight;
    } else {
      // Desktop: Map mouse [-1, 1] to configured movement bounds
      targetX = mousePosition.x * BLACK_HOLE_MOVEMENT_BOUNDS_X;
      targetY = mousePosition.y * BLACK_HOLE_MOVEMENT_BOUNDS_Y;
    }

    // --- Apply Clamping ---
    const blackHoleRadius = EFFECTIVE_BLACK_HOLE_PLANE_SIZE / 2.0;

    // Calculate the world-space equivalent of 30px horizontal offset for mobile
    const horizontalPixelOffset = 50; // Allow 30px overshoot
    const worldOffsetX =
      isMobile && sizes.width > 0
        ? horizontalPixelOffset * ((2 * halfVisibleWidth) / sizes.width)
        : 0; // No offset for desktop or if width is zero

    // Horizontal clamping: Respect the minimum of configured bounds and screen width, plus offset
    const clampBoundX = Math.min(
      BLACK_HOLE_MOVEMENT_BOUNDS_X, // Configured game bound
      halfVisibleWidth // Actual visible screen edge
    );
    targetX = Math.max(
      -clampBoundX - worldOffsetX + blackHoleRadius, // Clamp left edge with offset
      Math.min(clampBoundX + worldOffsetX - blackHoleRadius, targetX) // Clamp right edge with offset
    );

    // Vertical clamping: Respect the minimum of configured bounds and screen height
    // Allow bottom edge to reach screen bottom (-halfVisibleHeight)
    const clampBoundYTop = Math.min(
      BLACK_HOLE_MOVEMENT_BOUNDS_Y, // Configured game bound
      halfVisibleHeight // Actual visible screen top edge
    );
    const clampBoundYBottom = -halfVisibleHeight; // Screen bottom edge

    targetY = Math.max(
      clampBoundYBottom + blackHoleRadius, // Clamp bottom edge
      Math.min(clampBoundYTop - blackHoleRadius, targetY) // Clamp top edge
    );

    // --- Animate to Target ---
    gsap.to(playerGroup.position, {
      x: targetX,
      y: targetY,
      duration: isMobile ? 0.2 : 0.15, // Increased mobile duration for smoother movement
      ease: 'power1.out',
      overwrite: true,
    });

    // Update Player Tilt based on horizontal position
    const targetRotationZ = Math.max(
      -MAX_PLAYER_TILT_ANGLE,
      Math.min(MAX_PLAYER_TILT_ANGLE, -playerGroup.position.x * PLAYER_TILT_FACTOR)
    );
    gsap.to(playerGroup.rotation, {
      z: targetRotationZ,
      duration: 0.2,
      ease: 'power1.out',
      overwrite: true,
    });

    // Update Star & Cue Border
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      if (
        !star.userData ||
        !(star.userData.direction instanceof THREE.Vector3) ||
        !(star.userData.cueBorder instanceof THREE.LineSegments)
      )
        continue;

      const direction = star.userData.direction as THREE.Vector3;
      const cueBorder = star.userData.cueBorder as THREE.LineSegments;
      const cueBorderMat = cueBorder.material as THREE.LineBasicMaterial;

      // Move Star
      star.position.addScaledVector(direction, effectiveSpeed);
      const currentZ = star.position.z;

      // Update Cue Border Scale
      const scaleT = Math.max(
        0,
        Math.min(1, (currentZ - SPAWN_DISTANCE_Z) / (0 - SPAWN_DISTANCE_Z))
      );
      const scale = CUE_BORDER_MIN_SCALE + scaleT * (CUE_BORDER_MAX_SCALE - CUE_BORDER_MIN_SCALE);
      cueBorder.scale.set(scale, scale, 1);

      // Update Cue Border Opacity - Make it disappear after passing black hole
      let targetOpacity = 0;
      if (currentZ > CUE_BORDER_FADE_START_Z) {
        if (currentZ > CUE_BORDER_FADE_END_Z) {
          targetOpacity = 0; // Changed to 0 to make it disappear after passing
        } else {
          const fadeRange = CUE_BORDER_FADE_END_Z - CUE_BORDER_FADE_START_Z;
          const progressInFade = currentZ - CUE_BORDER_FADE_START_Z;
          const fadeT = Math.max(0, Math.min(1, progressInFade / fadeRange));
          targetOpacity = fadeT * CUE_BORDER_OPACITY;
        }
      }
      cueBorderMat.opacity = targetOpacity;

      // Border Orientation
      cueBorder.rotation.z = -star.rotation.z;

      // Rotate Star
      star.rotation.z += deltaTime * (isSlowMo ? 0.1 : 0.5);

      // Cleanup Star
      if (currentZ > CLEANUP_DISTANCE_Z) {
        const cueBorderToDispose = star.userData.cueBorder as THREE.LineSegments;
        scene.remove(star);
        stars.splice(i, 1);
        // Only spawn a new star if we're below the maximum number of stars
        if (stars.length < 3) {
          // Allow up to 3 stars at once
          spawnStar();
        }
        (star.material as THREE.Material).dispose();
        if (cueBorderToDispose) {
          (cueBorderToDispose.material as THREE.Material).dispose();
        }
        break;
      }
    }

    // Update Rival Black Holes
    for (let i = rivalBlackHoles.length - 1; i >= 0; i--) {
      const rival = rivalBlackHoles[i];
      if (!rival.userData || !(rival.userData.direction instanceof THREE.Vector3)) continue;

      const direction = rival.userData.direction as THREE.Vector3;

      // Move Rival Black Hole with increased speed
      const rivalSpeed = effectiveSpeed * rival.userData.speedMultiplier;
      rival.position.addScaledVector(direction, rivalSpeed);
      const currentZ = rival.position.z;

      // Rotate Rival Black Hole
      rival.rotation.z += deltaTime * (isSlowMo ? 0.05 : 0.25);

      // Cleanup Rival Black Hole
      if (currentZ > RIVAL_BLACK_HOLE_CLEANUP_Z) {
        scene.remove(rival);
        rivalBlackHoles.splice(i, 1);
        // Only spawn a new rival if there's an active star and we're below the max count
        if (stars.length > 0 && rivalBlackHoles.length < currentMaxRivals) {
          spawnRivalBlackHole(stars[0]);
        }
        (rival.material as THREE.Material).dispose();
        break;
      }
    }

    // Update Particles
    particles.position.z += effectiveSpeed * 0.015;
    if (particles.position.z > 30) {
      particles.position.z -= PARTICLE_SPREAD + 50;
    }

    // Check Collisions
    checkCollisions();
  }

  composer.render();
  requestAnimationFrame(animate);
};

// --- Start Game ---
createUI();
setupJoystickUI(); // Call the joystick setup

// Function to initialize audio after user interaction
function initializeAudio() {
  if (audioInitialized) return;

  console.log('Initializing audio...');

  // Try playing background music
  if (soundEnabled) {
    backgroundMusic.play().catch((error) => {
      console.warn('Could not play background music initially:', error);
      // Attempt to resume context if needed (often required by browsers)
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (context.state === 'suspended') {
        context.resume();
      }
    });
  }

  // Unlock sound effects by playing and pausing them (or playing silent sound)
  // This helps ensure they can play later on mobile
  if (soundEnabled) {
    starCatchSound
      .play()
      .then(() => starCatchSound.pause())
      .catch(() => {});
    rivalCollisionSound
      .play()
      .then(() => rivalCollisionSound.pause())
      .catch(() => {});
    gameOverSound
      .play()
      .then(() => gameOverSound.pause())
      .catch(() => {});
  }

  audioInitialized = true;
  console.log('Audio initialized.');

  // Remove the listener after the first interaction
  document.body.removeEventListener('pointerdown', initializeAudio);
  document.body.removeEventListener('touchstart', initializeAudio);
}

// Add event listeners for the first user interaction
document.body.addEventListener('pointerdown', initializeAudio, { once: true });
document.body.addEventListener('touchstart', initializeAudio, { once: true });

// Spawn initial stars
for (let i = 0; i < 3; i++) {
  spawnStar();
}
animate();

// --- Cleanup Shared Resources ---
window.addEventListener('beforeunload', () => {
  console.log('Disposing shared resources...');
  // Stop and cleanup audio
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  starCatchSound.pause();
  starCatchSound.currentTime = 0;
  rivalCollisionSound.pause();
  rivalCollisionSound.currentTime = 0;
  gameOverSound.pause();
  gameOverSound.currentTime = 0;

  cueBorderPlaneGeometry.dispose();
  cueBorderEdgesGeometry.dispose();
  cueBorderLineMaterial.dispose();
  starGeometry.dispose();
  starMaterial.dispose();
  particlesGeometry.dispose();
  particlesMaterial.dispose();
  blackHoleGeometry.dispose();
  rivalBlackHoleGeometry.dispose(); // Dispose rival geometry
  blackHoleMaterial.dispose();
  if (blackHoleTexture) blackHoleTexture.dispose();
  if (rivalBlackHoleTexture) rivalBlackHoleTexture.dispose();

  // Cleanup joystick elements
  if (joystickBase) joystickBase.remove();
  if (joystickStick) joystickStick.remove();

  // Cleanup rival black holes
  for (const rival of rivalBlackHoles) {
    if (rival.userData && rival.userData.warningBorder) {
      const warningBorder = rival.userData.warningBorder as THREE.LineSegments;
      if (warningBorder.material) {
        (warningBorder.material as THREE.Material).dispose();
      }
    }
    if (rival.material) {
      (rival.material as THREE.Material).dispose();
    }
  }

  // Cleanup damage overlay
  if (damageOverlay) {
    damageOverlay.remove();
    damageOverlay = null;
  }
});

// Function to play sound if enabled
function playSound(sound: HTMLAudioElement) {
  if (soundEnabled) {
    sound.currentTime = 0;
    sound.play().catch((error) => {
      console.warn('Could not play sound:', error);
    });
  }
}

// Add Joystick UI Setup function
function setupJoystickUI() {
  if (!isMobile) return; // Only setup for mobile

  const baseSize = 120;
  joystickRadius = baseSize / 2; // Update radius based on actual size

  joystickBase = document.createElement('div');
  joystickBase.id = 'joystick-base';
  joystickBase.style.position = 'fixed';
  joystickBase.style.width = `${baseSize}px`;
  joystickBase.style.height = `${baseSize}px`;
  joystickBase.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  joystickBase.style.borderRadius = '50%';
  joystickBase.style.display = 'none'; // Hidden initially
  joystickBase.style.zIndex = '1005';
  joystickBase.style.pointerEvents = 'none'; // Prevent blocking other UI
  joystickBase.style.transform = 'translate(-50%, -50%)'; // Center on touch point
  joystickBase.style.backdropFilter = 'blur(3px)'; // Add subtle blur

  joystickStick = document.createElement('div');
  joystickStick.id = 'joystick-stick';
  joystickStick.style.position = 'fixed';
  joystickStick.style.width = `${baseSize * 0.5}px`; // Stick is half the size
  joystickStick.style.height = `${baseSize * 0.5}px`;
  joystickStick.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
  joystickStick.style.borderRadius = '50%';
  joystickStick.style.display = 'none'; // Hidden initially
  joystickStick.style.zIndex = '1006';
  joystickStick.style.pointerEvents = 'none';
  joystickStick.style.transform = 'translate(-50%, -50%)'; // Center on touch point

  document.body.appendChild(joystickBase);
  document.body.appendChild(joystickStick);
}
