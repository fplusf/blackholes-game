// src/main.ts

import { gsap } from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// No need for ImprovedNoise if clouds are removed
// import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// --- Configuration ---
const PARTICLE_COUNT = 4000;
const PARTICLE_SPREAD = 90;
const RING_RADIUS = 1.5; // *** Slightly Smaller Ring ***
const RING_THICKNESS = 0.20; // Adjusted thickness
const BUBBLE_RADIUS = 0.5;

const RING_MOVEMENT_BOUNDS_X = 7;
const RING_MOVEMENT_BOUNDS_Y = 3.5;

const BASE_GAME_SPEED = 9.0;
const SLOW_MO_FACTOR = 0.2;

const SPAWN_INTERVAL_BUBBLE = 0.65;
const SPAWN_DISTANCE_Z = -80;
const CLEANUP_DISTANCE_Z = 12;
const COLLISION_THRESHOLD_Z = 0.6;

// --- Colors ---
const RING_COLOR = new THREE.Color(0xd0f0ff);
const FLASH_COLOR = new THREE.Color(0x44ffaa); // Vibrant Green Flash Color
const BUBBLE_COLOR = new THREE.Color(0xd0f0ff);
const STAR_COLOR = new THREE.Color(0xffffff);
const BACKGROUND_COLOR = new THREE.Color(0x030510);
const FOG_COLOR = BACKGROUND_COLOR;

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
scene.fog = new THREE.Fog(FOG_COLOR, 50, PARTICLE_SPREAD * 1.1);

// Camera
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 180);
camera.position.z = 11;
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
    1.0,
    0.7,
    0.9
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Mouse Tracking --- (Same)
const mousePosition = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mousePosition.x = (event.clientX / sizes.width) * 2 - 1;
    mousePosition.y = -(event.clientY / sizes.height) * 2 + 1;
});

// --- Objects ---

// Player Group
const playerGroup = new THREE.Group();
scene.add(playerGroup);
playerGroup.position.z = 0;

// Ring (Now uses updated RING_RADIUS)
const ringGeometry = new THREE.RingGeometry(
    RING_RADIUS - RING_THICKNESS / 2,
    RING_RADIUS + RING_THICKNESS / 2,
    128
);
const ringMaterial = new THREE.MeshBasicMaterial({
    color: RING_COLOR.clone(), // Clone color for safe modification
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
});
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
playerGroup.add(ring);

// Starfield Particle System (Same as previous)
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
// ... (particle generation logic - same starfield code) ...
for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const radius = Math.random() * PARTICLE_SPREAD * 0.6 + PARTICLE_SPREAD * 0.1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi) - PARTICLE_SPREAD * 0.3;
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

// --- Bubble Spawning --- (Same)
const bubbleGeometry = new THREE.SphereGeometry(BUBBLE_RADIUS, 16, 8);
const bubbleMaterial = new THREE.MeshBasicMaterial({
    color: BUBBLE_COLOR,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
});

// ... (spawnBubble function remains the same) ...
function spawnBubble() {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial.clone());
    const spawnAreaX = RING_MOVEMENT_BOUNDS_X * 1.6;
    const spawnAreaY = RING_MOVEMENT_BOUNDS_Y * 1.6;
    bubble.position.x = (Math.random() - 0.5) * spawnAreaX * 2;
    bubble.position.y = (Math.random() - 0.5) * spawnAreaY * 2;
    bubble.position.z = SPAWN_DISTANCE_Z - Math.random() * 25;
    scene.add(bubble);
    bubbles.push(bubble);
}

// --- Input Handling (Slow-mo) --- (Same)
// ... (keydown/keyup event listeners remain the same) ...
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSlowMo) {
        isSlowMo = true;
        gsap.to({ speed: gameSpeed }, { speed: BASE_GAME_SPEED * SLOW_MO_FACTOR, duration: 0.2, onUpdate: (tween) => gameSpeed = tween.targets()[0].speed });
        gsap.to(bloomPass, { strength: bloomPass.strength * 0.8, duration: 0.2 });
    }
});
window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && isSlowMo) {
        isSlowMo = false;
         gsap.to({ speed: gameSpeed }, { speed: BASE_GAME_SPEED, duration: 0.5, onUpdate: (tween) => gameSpeed = tween.targets()[0].speed });
        gsap.to(bloomPass, { strength: 1.0, duration: 0.5 });
    }
});


// --- Collision Detection --- (Added Flash Animation)
function checkCollisions() {
    const collisionDistSq = (RING_RADIUS + BUBBLE_RADIUS * 0.5)**2; // Keep generous collision

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        if (Math.abs(bubble.position.z - playerGroup.position.z) < COLLISION_THRESHOLD_Z) {
            const dx = bubble.position.x - playerGroup.position.x;
            const dy = bubble.position.y - playerGroup.position.y;
            const distanceSq = dx*dx + dy*dy;

            if (distanceSq < collisionDistSq) {
                score++;
                console.log("Score:", score); // UI Update

                // --- Trigger Flash Animation ---
                gsap.to(ring.material.color, {
                    r: FLASH_COLOR.r,
                    g: FLASH_COLOR.g,
                    b: FLASH_COLOR.b,
                    duration: 0.1, // Quick change to green
                    yoyo: true, // Animate back
                    repeat: 1, // Play forward then backward once
                    ease: 'power1.inOut'
                });
                // Optional: Add slight scale pulse
                gsap.to(ring.scale, {
                    x: 1.1, // Scale up slightly
                    y: 1.1,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                    ease: 'power1.inOut'
                });
                // --- End Flash Animation ---


                // Bubble pop animation
                 gsap.to(bubble.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.15, ease: 'power1.out', onComplete: () => {
                     scene.remove(bubble);
                 }});
                 gsap.to(bubble.material as THREE.MeshBasicMaterial, { opacity: 0, duration: 0.15 });

                bubbles.splice(i, 1);
            }
        }
    }
}

// --- Animation Loop --- (Same logic)
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

    // --- Update Player Group Position --- (Same)
    const targetX = mousePosition.x * RING_MOVEMENT_BOUNDS_X;
    const targetY = mousePosition.y * RING_MOVEMENT_BOUNDS_Y;
    gsap.to(playerGroup.position, {
        x: targetX,
        y: targetY,
        duration: 0.15,
        ease: 'power1.out',
        overwrite: true
    });

    // --- Move Bubbles --- (Same)
     for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.position.z += effectiveSpeed;
        if (bubble.position.z > CLEANUP_DISTANCE_Z) {
            scene.remove(bubble);
            bubbles.splice(i, 1);
        }
    }

    // --- Spawn New Bubbles --- (Same)
     timeSinceLastBubble += deltaTime;
    const currentSpawnInterval = SPAWN_INTERVAL_BUBBLE / (isSlowMo ? SLOW_MO_FACTOR : 1);
    if (timeSinceLastBubble > currentSpawnInterval) {
         spawnBubble();
         timeSinceLastBubble = 0;
    }

    // --- Move Background Elements --- (Same - only particles)
    particles.position.z += effectiveSpeed * 0.01;
     if (particles.position.z > 20) particles.position.z -= (PARTICLE_SPREAD + 40);

    // --- Check Collisions --- (Now triggers flash)
    checkCollisions();

    // --- Render ---
    composer.render();

    requestAnimationFrame(animate);
};

// --- Handle Resize --- (Same)
// ... (resize handling code) ...
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
animate();