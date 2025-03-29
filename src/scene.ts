// src/main.ts (or scene.ts)

// --- IMPORTS (Keep all imports) ---
import { gsap } from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- CONFIGURATION (Keep all config constants) ---
const PARTICLE_COUNT = 4000;
const PARTICLE_SPREAD = 90;
const BLACK_HOLE_PLANE_SIZE = 3.0;
const BLACK_HOLE_COLLISION_CENTER_RADIUS = 0.4;
const BLACK_HOLE_COLLISION_RING_WIDTH = 0.2;
const COLLISION_PADDING = 0.05;
const STAR_OUTER_RADIUS = 0.5;
const STAR_INNER_RADIUS = STAR_OUTER_RADIUS * 0.4;
const STAR_POINTS = 4;
const BLACK_HOLE_MOVEMENT_BOUNDS_X = 7;
const BLACK_HOLE_MOVEMENT_BOUNDS_Y = 3.5;
const BASE_GAME_SPEED = 25.0; // Increased from 18.0 to 25.0 for faster starting speed
const SLOW_MO_FACTOR = 0.2;
const SPEED_INCREASE_INTERVAL = 15; // Number of stars needed to trigger speed increase
const SPEED_INCREASE_AMOUNT = 3.0; // Amount to increase speed by
const MAX_GAME_SPEED = 45.0; // Maximum speed cap
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
const COLLISION_RING_FORGIVENESS = 0.4; // Added to make collision detection more forgiving

// --- UI Constants ---
const INITIAL_BLACK_HOLE_MASS = 1; // Initial mass in solar masses (whole number)
const MASS_INCREASE_AMOUNT = 1; // Mass increase per 15 stars (whole number)

// --- Colors ---
const FLASH_COLOR = new THREE.Color(0xADD8E6); // Light Blue Flash
const STAR_COLOR = new THREE.Color(0xffffff);
const BACKGROUND_COLOR = new THREE.Color(0x000000);
const FOG_COLOR = BACKGROUND_COLOR;

// --- Game State ---
let gameSpeed = BASE_GAME_SPEED;
let score = 0;
let lastSpeedIncreaseScore = 0;
let blackHoleMass = INITIAL_BLACK_HOLE_MASS;
let elapsedTime = 0;
let isSlowMo = false;
let gameActive = true;
const stars: THREE.Mesh[] = [];

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

float calculateLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 textureColor = texture2D(uTexture, vUv);

  vec3 baseColor = textureColor.rgb * uIntensity;
  baseColor += uFlashColor * uFlashIntensity;

  float brightness = calculateLuminance(textureColor.rgb);
  float alpha = smoothstep(0.03, 0.25, brightness);

  gl_FragColor = vec4(baseColor, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// --- Texture Loader ---
const textureLoader = new THREE.TextureLoader();
let blackHoleTexture: THREE.Texture | null = null;
const texturePath = '/textures/black-hole-texture.png'; // Verify path

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
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(BACKGROUND_COLOR, 1);

// --- Post Processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  1.7,
  0.9,
  0.70
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
const ORIGINAL_BLOOM_STRENGTH = bloomPass.strength;

// --- Mouse Tracking ---
const mousePosition = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
  mousePosition.x = (event.clientX / sizes.width) * 2 - 1;
  mousePosition.y = -(event.clientY / sizes.height) * 2 + 1;
});

// --- Game Objects ---
const playerGroup = new THREE.Group();
playerGroup.position.z = 0;
scene.add(playerGroup);
const blackHoleGeometry = new THREE.PlaneGeometry(BLACK_HOLE_PLANE_SIZE, BLACK_HOLE_PLANE_SIZE, 32, 32);

// Black Hole Material
const blackHoleMaterial = new THREE.ShaderMaterial({
  vertexShader: blackHoleVertexShader,
  fragmentShader: blackHoleFragmentShader,
  uniforms: {
    uTexture: { value: blackHoleTexture },
    uIntensity: { value: 1.15 },
    uFlashColor: { value: FLASH_COLOR },
    uFlashIntensity: { value: 0.0 },
  },
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Load texture after material is created
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

const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
playerGroup.add(blackHole);

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
  depthWrite: false
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
particles.rotation.x = Math.random() * 0.1;
particles.rotation.y = Math.random() * 0.1;
scene.add(particles);

// --- Star Collectible Geometry/Material ---
function createStarGeometry(outerRadius: number, innerRadius: number, points: number): THREE.ShapeGeometry {
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

const starGeometry = createStarGeometry(STAR_OUTER_RADIUS, STAR_INNER_RADIUS, STAR_POINTS);
const starMaterial = new THREE.MeshBasicMaterial({
  color: STAR_COLOR,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false
});

// --- Shared Cue Border Geometry & Material ---
const cueBorderPlaneGeometry = new THREE.PlaneGeometry(CUE_BORDER_BASE_SIZE, CUE_BORDER_BASE_SIZE);
const cueBorderEdgesGeometry = new THREE.EdgesGeometry(cueBorderPlaneGeometry);
const cueBorderLineMaterial = new THREE.LineBasicMaterial({
  color: CUE_BORDER_COLOR,
  transparent: true,
  opacity: CUE_BORDER_OPACITY,
  depthWrite: false
});

// --- UI Setup ---
function createUI() {
  const uiContainer = document.createElement('div');
  uiContainer.style.position = 'fixed';
  uiContainer.style.top = '20px';
  uiContainer.style.right = '20px';
  uiContainer.style.color = '#ffffff';
  uiContainer.style.fontFamily = 'Arial, sans-serif';
  uiContainer.style.fontSize = '24px';
  uiContainer.style.textAlign = 'right';
  uiContainer.style.zIndex = '1000';
  uiContainer.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
  
  const scoreElement = document.createElement('div');
  scoreElement.id = 'score-display';
  scoreElement.style.marginBottom = '10px';
  
  const massElement = document.createElement('div');
  massElement.id = 'mass-display';
  
  uiContainer.appendChild(scoreElement);
  uiContainer.appendChild(massElement);
  document.body.appendChild(uiContainer);
  
  updateUI();
}

function updateUI() {
  const scoreElement = document.getElementById('score-display');
  const massElement = document.getElementById('mass-display');
  
  if (scoreElement && massElement) {
    scoreElement.textContent = `Stars eaten: ${score}`;
    massElement.textContent = `Black Hole Mass: ${blackHoleMass} M☉`;
  }
}

// --- Star Spawning ---
function spawnStar() {
  if (stars.length > 0) return;
  
  const star = new THREE.Mesh(starGeometry, starMaterial.clone());
  const spawnAreaX = BLACK_HOLE_MOVEMENT_BOUNDS_X * 2.0; // Increased from 1.5
  const spawnAreaY = BLACK_HOLE_MOVEMENT_BOUNDS_Y * 2.0; // Increased from 1.5
  const initialX = (Math.random() - 0.5) * spawnAreaX * 2;
  const initialY = (Math.random() - 0.5) * spawnAreaY * 2;
  const initialZ = SPAWN_DISTANCE_Z - Math.random() * 30;
  
  star.position.set(initialX, initialY, initialZ);
  const initialPos = star.position.clone();
  star.rotation.z = Math.random() * Math.PI * 2;
  
  // Modified target position calculation to create more diverse paths
  const targetAngle = Math.random() * Math.PI * 2;
  const targetRadius = STAR_TARGET_RADIUS * (0.5 + Math.random() * 0.5); // Random radius between 50% and 100% of STAR_TARGET_RADIUS
  const targetX = Math.cos(targetAngle) * targetRadius;
  const targetY = Math.sin(targetAngle) * targetRadius;
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
    cueOffsetY: cueOffsetY
  };
  
  scene.add(star);
  stars.push(star);
}

// --- Input Handling (Slow-motion) ---
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !isSlowMo && gameActive) {
    isSlowMo = true;
    gsap.to({ speed: gameSpeed }, {
      speed: BASE_GAME_SPEED * SLOW_MO_FACTOR,
      duration: 0.2,
      onUpdate: (tween) => gameSpeed = tween.targets()[0].speed
    });
    gsap.to(bloomPass, {
      strength: ORIGINAL_BLOOM_STRENGTH * 0.85,
      duration: 0.2
    });
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' && isSlowMo && gameActive) {
    isSlowMo = false;
    gsap.to({ speed: gameSpeed }, {
      speed: BASE_GAME_SPEED,
      duration: 0.5,
      ease: 'power1.out',
      onUpdate: (tween) => gameSpeed = tween.targets()[0].speed
    });
    gsap.to(bloomPass, {
      strength: ORIGINAL_BLOOM_STRENGTH,
      duration: 0.5
    });
  }
});

// --- Collision Detection ---
const FLASH_INTENSITY_MAX = 1.8;
const FLASH_DURATION = 0.30;

function checkCollisions() {
  const starEffectiveRadius = STAR_OUTER_RADIUS * COLLISION_THRESHOLD_XY_FACTOR;
  const blackHoleInnerRadius = BLACK_HOLE_COLLISION_CENTER_RADIUS - BLACK_HOLE_COLLISION_RING_WIDTH / 2;
  const blackHoleOuterRadius = BLACK_HOLE_COLLISION_CENTER_RADIUS + BLACK_HOLE_COLLISION_RING_WIDTH / 2;
  const minCollisionDist = Math.max(0, blackHoleInnerRadius - starEffectiveRadius - COLLISION_PADDING);
  const minCollisionDistSq = minCollisionDist * minCollisionDist;
  const maxCollisionDist = blackHoleOuterRadius + starEffectiveRadius + COLLISION_PADDING;
  const maxCollisionDistSq = maxCollisionDist * maxCollisionDist;
  const blackHoleZPlane = playerGroup.position.z;
  
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    if (!star || !star.userData || !(star.userData.previousPosition instanceof THREE.Vector3) || 
        !(star.userData.cueBorder instanceof THREE.LineSegments) || 
        typeof star.userData.cueOffsetX !== 'number' || 
        typeof star.userData.cueOffsetY !== 'number') continue;
        
    const prevPos = star.userData.previousPosition as THREE.Vector3;
    const currPos = star.position;
    const cueBorder = star.userData.cueBorder as THREE.LineSegments;
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
        const cueBorderScale = CUE_BORDER_MIN_SCALE + tScale * (CUE_BORDER_MAX_SCALE - CUE_BORDER_MIN_SCALE);
        const cueBorderHalfSize = (CUE_BORDER_BASE_SIZE * cueBorderScale) / 2.0;
        const cueCenterX = intersectX + cueOffsetX;
        const cueCenterY = intersectY + cueOffsetY;
        
        // More forgiving cue border check
        const playerX = playerGroup.position.x;
        const playerY = playerGroup.position.y;
        const dx = playerX - cueCenterX;
        const dy = playerY - cueCenterY;
        const distanceToCueCenter = Math.sqrt(dx * dx + dy * dy);
        const maxAllowedDistance = cueBorderHalfSize * COLLISION_RING_FORGIVENESS; // More forgiving distance check
        
        // Check if player is within the cue border with more forgiving bounds
        const isPlayerInCueBorder = distanceToCueCenter <= maxAllowedDistance;
        
        // More forgiving ring collision check
        const dxToStar = intersectX - playerX;
        const dyToStar = intersectY - playerY;
        const distanceSq = dxToStar * dxToStar + dyToStar * dyToStar;
        const isWithinCollisionRing = (distanceSq >= minCollisionDistSq * 0.8 && // More forgiving inner radius
                                      distanceSq <= maxCollisionDistSq * 1.2);   // More forgiving outer radius
        
        // Trigger catch if either condition is met with more forgiving checks
        if (isPlayerInCueBorder || isWithinCollisionRing) {
          score++;
          
          // Check if we should increase speed and mass
          if (score - lastSpeedIncreaseScore >= SPEED_INCREASE_INTERVAL) {
            const newSpeed = Math.min(gameSpeed + SPEED_INCREASE_AMOUNT, MAX_GAME_SPEED);
            if (newSpeed !== gameSpeed) {
              gameSpeed = newSpeed;
              lastSpeedIncreaseScore = score;
              blackHoleMass += MASS_INCREASE_AMOUNT;
              
              // Visual feedback for speed increase
              gsap.to(bloomPass, {
                strength: ORIGINAL_BLOOM_STRENGTH * 1.2,
                duration: 0.3,
                yoyo: true,
                repeat: 1
              });
            }
          }
          
          // Update UI
          updateUI();
          
          gsap.killTweensOf(blackHoleMaterial.uniforms.uFlashIntensity);
          blackHoleMaterial.uniforms.uFlashIntensity.value = FLASH_INTENSITY_MAX;
          gsap.to(blackHoleMaterial.uniforms.uFlashIntensity, {
            value: 0.0,
            duration: FLASH_DURATION,
            ease: 'power2.out'
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
            }
          });
          
          gsap.to(star.material as THREE.MeshBasicMaterial, {
            opacity: 0,
            duration: 0.15
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
}

// --- Animation Loop ---
const clock = new THREE.Clock();
const animate = () => {
  const deltaTime = clock.getDelta();
  elapsedTime += deltaTime;
  
  if (gameActive) {
    const effectiveSpeed = gameSpeed * deltaTime;
    
    // Update Player
    const targetX = mousePosition.x * BLACK_HOLE_MOVEMENT_BOUNDS_X;
    const targetY = mousePosition.y * BLACK_HOLE_MOVEMENT_BOUNDS_Y;
    gsap.to(playerGroup.position, {
      x: targetX,
      y: targetY,
      duration: 0.15,
      ease: 'power1.out',
      overwrite: true
    });
    
    // Update Star & Cue Border
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      if (!star.userData || !(star.userData.direction instanceof THREE.Vector3) || 
          !(star.userData.cueBorder instanceof THREE.LineSegments)) continue;
          
      const direction = star.userData.direction as THREE.Vector3;
      const cueBorder = star.userData.cueBorder as THREE.LineSegments;
      const cueBorderMat = cueBorder.material as THREE.LineBasicMaterial;
      
      // Move Star
      star.position.addScaledVector(direction, effectiveSpeed);
      const currentZ = star.position.z;
      
      // Update Cue Border Scale
      const scaleT = Math.max(0, Math.min(1, (currentZ - SPAWN_DISTANCE_Z) / (0 - SPAWN_DISTANCE_Z)));
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
        spawnStar();
        (star.material as THREE.Material).dispose();
        if (cueBorderToDispose) {
          (cueBorderToDispose.material as THREE.Material).dispose();
        }
        break;
      }
    }
    
    // Update Particles
    particles.position.z += effectiveSpeed * 0.015;
    if (particles.position.z > 30) {
      particles.position.z -= (PARTICLE_SPREAD + 50);
    }
    
    // Check Collisions
    checkCollisions();
  }
  
  composer.render();
  requestAnimationFrame(animate);
};

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(sizes.width, sizes.height);
  bloomPass.setSize(sizes.width, sizes.height);
});

// --- Start Game ---
createUI();
spawnStar();
animate();

// --- Cleanup Shared Resources ---
window.addEventListener('beforeunload', () => {
  console.log("Disposing shared resources...");
  cueBorderPlaneGeometry.dispose();
  cueBorderEdgesGeometry.dispose();
  cueBorderLineMaterial.dispose();
  starGeometry.dispose();
  starMaterial.dispose();
  particlesGeometry.dispose();
  particlesMaterial.dispose();
  blackHoleGeometry.dispose();
  blackHoleMaterial.dispose();
  if (blackHoleTexture) blackHoleTexture.dispose();
});