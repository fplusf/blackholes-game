
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from './gsap';

// --- Configuration ---
const PARTICLE_COUNT = 3000;
const PARTICLE_SPREAD = 60;
const RING_RADIUS = 1.5; // *** Smaller Ring ***
const RING_THICKNESS = 0.20; // Thinner ring
const PLAYER_DOT_RADIUS = 0.0; // *** Hide the dot, ring is the player ***
const BUBBLE_RADIUS = 0.5; // Bubbles slightly smaller relative to ring

// Movement bounds for the ring (relative to screen center)
const RING_MOVEMENT_BOUNDS_X = 8;
const RING_MOVEMENT_BOUNDS_Y = 4;

const BASE_GAME_SPEED = 10.0; // Speed bubbles move towards player
const SLOW_MO_FACTOR = 0.2;

const SPAWN_INTERVAL_BUBBLE = 0.6; // Spawn a bit more frequently
const SPAWN_DISTANCE_Z = -50; // Start bubbles further back
const CLEANUP_DISTANCE_Z = 10;
const COLLISION_THRESHOLD_Z = 0.5; // Z-distance check remains similar

const RING_COLOR = new THREE.Color(0xE0F8FF);
const BUBBLE_COLOR = new THREE.Color(0xE0F8FF);
const BACKGROUND_COLOR = new THREE.Color(0x1a2a3f);
const FOG_COLOR = BACKGROUND_COLOR;
const CLOUD_COLOR = new THREE.Color(0xaaaaaa);

// --- Game State ---
let gameSpeed = BASE_GAME_SPEED;
let score = 0;
let elapsedTime = 0;
let isSlowMo = false;
let timeSinceLastBubble = 0;
let gameActive = true;
const bubbles: THREE.Mesh[] = [];

// --- Basic Setup ---
const scene = new THREE.Scene();
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};
scene.background = BACKGROUND_COLOR;
scene.fog = new THREE.Fog(FOG_COLOR, 20, PARTICLE_SPREAD * 0.9); // Adjust fog

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 10; // Camera further back to see movement area
scene.add(camera);

// Renderer
const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas not found!");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Post Processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(sizes.width, sizes.height),
    1.3,  // Moderate strength
    0.6,  // Soft spread
    0.8   // Threshold
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Mouse Tracking ---
const mousePosition = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mousePosition.x = (event.clientX / sizes.width) * 2 - 1;
    mousePosition.y = -(event.clientY / sizes.height) * 2 + 1; // Invert Y for intuitive control
});

// --- Objects ---

// Player Group (Contains Ring and optionally a dot)
const playerGroup = new THREE.Group();
scene.add(playerGroup);
playerGroup.position.z = 0; // Keep the player group at Z=0 plane

// Ring (Now part of playerGroup)
const ringGeometry = new THREE.RingGeometry(
    RING_RADIUS - RING_THICKNESS / 2,
    RING_RADIUS + RING_THICKNESS / 2,
    128
);
const ringMaterial = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
});
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
// Ring position is local to playerGroup, should be at its center
ring.position.set(0, 0, 0);
playerGroup.add(ring);

// (Optional) Player Dot - If needed, add it here, centered in playerGroup
// const playerDotGeometry = new THREE.CircleGeometry(PLAYER_DOT_RADIUS, 32);
// const playerDotMaterial = new THREE.MeshBasicMaterial({...});
// const playerDot = new THREE.Mesh(playerDotGeometry, playerDotMaterial);
// playerDot.position.set(0, 0, 0.01); // Slightly in front
// playerGroup.add(playerDot);

// Particle Field (Keep similar)
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
// ... (particle generation logic - can remain largely the same) ...
for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * PARTICLE_SPREAD * 1.5;
    positions[i3 + 1] = (Math.random() - 0.5) * PARTICLE_SPREAD * 0.8;
    positions[i3 + 2] = (Math.random() - 1.0) * PARTICLE_SPREAD * 0.8 - 10; // Push further back

    // Minimal avoidance of the very center near camera start
    const distSq = positions[i3]**2 + positions[i3 + 1]**2;
     if (distSq < 5**2 && Math.abs(positions[i3+2]) < 15) {
         positions[i3+2] -= 15;
     }
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particlesMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.04, // Slightly larger ?
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// Simple Cloud Layer (Keep similar)
const cloudPlanes: THREE.Mesh[] = [];
// ... (cloud plane creation logic - same as before) ...
const createCloudPlane = (zPos: number, scale: number, opacity: number) => {
    const planeGeo = new THREE.PlaneGeometry(PARTICLE_SPREAD * scale, PARTICLE_SPREAD * scale * 0.3);
    const planeMat = new THREE.MeshBasicMaterial({
        color: CLOUD_COLOR,
        transparent: true,
        opacity: opacity * 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.z = zPos;
    plane.position.y = (Math.random() - 0.5) * 3; // Wider vertical offset
    scene.add(plane);
    cloudPlanes.push(plane);
};
createCloudPlane(-20, 2.0, 0.5);
createCloudPlane(-35, 2.5, 0.4);
createCloudPlane(-50, 3.0, 0.3);

// --- Bubble Spawning ---
const bubbleGeometry = new THREE.SphereGeometry(BUBBLE_RADIUS, 16, 8);
const bubbleMaterial = new THREE.MeshBasicMaterial({
    color: BUBBLE_COLOR,
    transparent: true,
    opacity: 0.5, // Slightly more opaque bubbles
    blending: THREE.AdditiveBlending
});

function spawnBubble() {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial.clone());

    // Spawn at random X/Y within wider bounds, far back in Z
    const spawnAreaX = RING_MOVEMENT_BOUNDS_X * 1.5; // Spawn in wider area than ring moves
    const spawnAreaY = RING_MOVEMENT_BOUNDS_Y * 1.5;
    bubble.position.x = (Math.random() - 0.5) * spawnAreaX * 2;
    bubble.position.y = (Math.random() - 0.5) * spawnAreaY * 2;
    bubble.position.z = SPAWN_DISTANCE_Z - Math.random() * 10; // Add some Z variance

    scene.add(bubble);
    bubbles.push(bubble);
}

// --- Input Handling (Slow-mo) --- (Keep same as before)
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSlowMo) {
        isSlowMo = true;
        gsap.to({ speed: gameSpeed }, { speed: BASE_GAME_SPEED * SLOW_MO_FACTOR, duration: 0.2, onUpdate: (tween) => gameSpeed = tween.targets()[0].speed });
        gsap.to(bloomPass, { strength: bloomPass.strength * 0.7, duration: 0.2 });
    }
});
window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && isSlowMo) {
        isSlowMo = false;
         gsap.to({ speed: gameSpeed }, { speed: BASE_GAME_SPEED, duration: 0.5, onUpdate: (tween) => gameSpeed = tween.targets()[0].speed });
        gsap.to(bloomPass, { strength: 1.3, duration: 0.5 }); // Restore original strength
    }
});

// --- Collision Detection ---
function checkCollisions() {
    // Calculate collision radius squared once
    // Check collision with the *inner edge* of the ring? Or center +/- thickness?
    // Let's check if bubble center is within RING_RADIUS of the playerGroup center.
    const collisionDistSq = (RING_RADIUS + BUBBLE_RADIUS * 0.5)**2; // Generous collision

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];

        // Check if bubble is near the player's Z plane
        // Using playerGroup.position.z which should be 0
        if (Math.abs(bubble.position.z - playerGroup.position.z) < COLLISION_THRESHOLD_Z) {

            // Calculate distance squared between bubble center and playerGroup center
            const dx = bubble.position.x - playerGroup.position.x;
            const dy = bubble.position.y - playerGroup.position.y;
            const distanceSq = dx*dx + dy*dy;

            if (distanceSq < collisionDistSq) {
                score++;
                console.log("Score:", score); // UI Update

                // Pop animation
                 gsap.to(bubble.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.15, ease: 'power1.out', onComplete: () => {
                     scene.remove(bubble);
                 }});
                 gsap.to(bubble.material as THREE.MeshBasicMaterial, { opacity: 0, duration: 0.15 });

                bubbles.splice(i, 1);
            }
        }
    }
}

// --- Animation Loop ---
const clock = new THREE.Clock();

const animate = () => {
    const deltaTime = clock.getDelta();
    elapsedTime += deltaTime;

    if (!gameActive) {
        requestAnimationFrame(animate);
        composer.render();
        return;
    }

    const effectiveSpeed = gameSpeed * deltaTime;

    // --- Update Player Group Position ---
    // Map mouse position to world coordinates within bounds
    const targetX = mousePosition.x * RING_MOVEMENT_BOUNDS_X;
    const targetY = mousePosition.y * RING_MOVEMENT_BOUNDS_Y;

    // Smoothly move playerGroup towards mouse position
    gsap.to(playerGroup.position, {
        x: targetX,
        y: targetY,
        duration: 0.15, // Slightly smoother interpolation
        ease: 'power1.out',
        overwrite: true // Ensure only one tween runs
    });

    // --- Move Bubbles ---
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.position.z += effectiveSpeed; // Move towards camera

        // Cleanup
        if (bubble.position.z > CLEANUP_DISTANCE_Z) {
            scene.remove(bubble);
            bubbles.splice(i, 1);
        }
    }

    // --- Spawn New Bubbles ---
    timeSinceLastBubble += deltaTime;
    const currentSpawnInterval = SPAWN_INTERVAL_BUBBLE / (isSlowMo ? SLOW_MO_FACTOR : 1);
    if (timeSinceLastBubble > currentSpawnInterval) {
         spawnBubble();
         timeSinceLastBubble = 0;
    }

    // --- Move Background Elements ---
    particles.position.z += effectiveSpeed * 0.05; // Particles move very slowly
     if (particles.position.z > 10) particles.position.z -= (PARTICLE_SPREAD * 0.8 + 10); // Wrap further back

     cloudPlanes.forEach((plane, index) => {
         plane.position.z += effectiveSpeed * (0.1 + index * 0.03); // Clouds move slowly
         if (plane.position.z > CLEANUP_DISTANCE_Z) {
             plane.position.z = SPAWN_DISTANCE_Z - 10 - Math.random() * 15; // Reset further back
         }
     });

    // --- Check Collisions ---
    checkCollisions();

    // --- Render ---
    composer.render();

    requestAnimationFrame(animate);
};

// --- Handle Resize --- (Same as before)
window.addEventListener('resize', () => {
    // ... (resize handling code remains the same) ...
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
animate();