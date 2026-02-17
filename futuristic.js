'use strict';

// =========================================================
// FUTURISTIC WEBSITE INTERACTIONS
// =========================================================

// ---------------------------------------------------------
// 1. Theme System
// ---------------------------------------------------------

const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  const effective = theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
  root.style.colorScheme = effective;
  localStorage.setItem('theme', theme);
}

function getTheme() {
  return localStorage.getItem('theme') || 'auto';
}

if (themeToggle) {
  themeToggle.addEventListener('change', (e) => {
    setTheme(e.target.value);
  });
}

if (mql.addEventListener) {
  mql.addEventListener('change', () => {
    if (getTheme() === 'auto') setTheme('auto');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const initial = getTheme();
  setTheme(initial);
  if (themeToggle) themeToggle.value = initial;
});


// ---------------------------------------------------------
// 2. Particle Canvas Background
// ---------------------------------------------------------

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouseX = 0;
let mouseY = 0;
let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

class Particle {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Mouse interaction
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 100) {
      const force = (100 - distance) / 100;
      this.x -= dx * force * 0.03;
      this.y -= dy * force * 0.03;
    }

    // Wrap around screen
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  draw() {
    const theme = root.getAttribute('data-theme');
    const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
    ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Initialize particles
for (let i = 0; i < 100; i++) {
  particles.push(new Particle());
}

function connectParticles() {
  const theme = root.getAttribute('data-theme');
  const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 150) {
        const opacity = (150 - distance) / 150 * 0.15;
        ctx.strokeStyle = isLight ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, width, height);

  particles.forEach(particle => {
    particle.update();
    particle.draw();
  });

  connectParticles();
  requestAnimationFrame(animateParticles);
}

animateParticles();

// Handle window resize
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

// Track mouse position
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});


// ---------------------------------------------------------
// 3. Elastic Name Hover Effect
// ---------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  const heroTitle = document.querySelector('.hero-title');
  if (!heroTitle) return;

  const text = heroTitle.textContent;
  heroTitle.textContent = '';
  heroTitle.style.display = 'inline-flex';
  heroTitle.style.gap = '0';

  // Create spans for each letter
  const letters = text.split('').map(char => {
    const span = document.createElement('span');
    span.textContent = char;
    span.style.display = 'inline-block';
    span.style.transition = 'transform 0.2s ease-out';
    span.style.transformOrigin = 'center';
    heroTitle.appendChild(span);
    return span;
  });

  // Track mouse movement
  heroTitle.addEventListener('mousemove', (e) => {
    const rect = heroTitle.getBoundingClientRect();

    letters.forEach((letter) => {
      const letterRect = letter.getBoundingClientRect();
      const letterCenterX = letterRect.left + letterRect.width / 2;
      const letterCenterY = letterRect.top + letterRect.height / 2;

      const distanceX = e.clientX - letterCenterX;
      const distanceY = e.clientY - letterCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // Invert the effect - letters close to cursor stay narrow, others stretch
      const maxDistance = 150;
      const proximity = Math.max(0, 1 - Math.min(distance / maxDistance, 1));

      // Inverse scale - closer = narrower, farther = wider
      const scaleX = 1 - proximity * 0.5; // Letter under cursor gets narrower (0.5x)
      const scaleY = 1 + proximity * 0.3; // Gets slightly taller

      // Stretch effect for letters NOT under cursor
      const stretchAmount = (1 - proximity) * 0.4;
      const finalScaleX = scaleX + stretchAmount;
      const finalScaleY = scaleY + stretchAmount * 0.5;

      letter.style.transform = `scale(${finalScaleX}, ${finalScaleY})`;
    });
  });

  // Reset on mouse leave
  heroTitle.addEventListener('mouseleave', () => {
    letters.forEach(letter => {
      letter.style.transform = 'scale(1)';
    });
  });
});


// ---------------------------------------------------------
// 4. Smooth Scroll Navigation
// ---------------------------------------------------------

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    const targetSection = document.querySelector(targetId);

    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // Update active link
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    }
  });
});

// Update active link on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';

  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    if (window.pageYOffset >= sectionTop - 100) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
});


// ---------------------------------------------------------
// 5. 3D Project Graph with Three.js
// ---------------------------------------------------------

const projectsData = [
  {
    name: 'Vayu',
    fullName: 'Founder, Vayu',
    description: 'Building an operating system for autonomous AI agents that treats agents as kernel-level primitives with built‑in safety, compliance, and reliability. It features capability‑based security, goal‑aware scheduling, and cryptographically verified audit systems for mission‑critical AI infrastructure.',
    links: [
      { label: 'Visit site', url: 'https://aniketh.net/vayu' }
    ],
    color: 0xffffff,
    position: [0, 2.5, 0]
  },
  {
    name: 'OCRadar',
    fullName: 'Founder & President, OCRadar',
    description: 'AI-powered mobile platform for early oral cancer detection, combining computer vision with cross-platform development to drive global health impact.',
    links: [
      { label: 'Visit site', url: 'https://ocradar.com/' }
    ],
    color: 0xffffff,
    position: [3.5, 1.5, 2]
  },
  {
    name: 'FRC Software',
    fullName: 'FRC Robotics, Software Lead',
    description: 'Led systems engineering and control software for competition robots, integrating advanced algorithms, CAD, electronics, and autonomous functions in high-pressure team environments.',
    links: [
      { label: 'View repo', url: 'https://github.com/OaktonCougarRobotics' }
    ],
    color: 0xffffff,
    position: [-3.5, 0.5, 1.5]
  },
  {
    name: 'EdgeFabric',
    fullName: 'EdgeFabric',
    description: 'Synthesize distributed intelligence from ambient compute with instantaneous inference.',
    links: [
      { label: 'View repo', url: 'https://github.com/ankthba/EdgeFabric.git' }
    ],
    color: 0xffffff,
    position: [2.5, -2, -1]
  },
  {
    name: 'CNN OCSCC',
    fullName: 'Designing a CNN for High-Accuracy OCSCC Detection',
    description: 'This work presents a CNN trained on image datasets for high-accuracy OCSCC detection, with custom hardware for optimal image capture. Testing across resolutions showed logarithmic accuracy improvements with diminishing returns at high pixel counts. An open-access application enables broader CNN utilization for early detection.',
    links: [
      { label: 'View paper', url: 'https://arxiv.org/abs/2510.16235' }
    ],
    color: 0xffffff,
    position: [-2.5, 1.5, -2.5]
  },
  {
    name: 'IllumiSign',
    fullName: 'IllumiSign: Eye-Tracking Communication Software',
    description: 'IllumiSign is an open-source, browser-based communication tool that helps people with ALS and mobility impairments communicate using only their eyes. Built at Hack the Nest 2025 (Social Justice Track winner), it uses real-time eye tracking to select letters and phrases and speaks them aloud, with no special hardware required.',
    links: [
      { label: 'View project', url: 'https://devpost.com/software/illumisign' }
    ],
    color: 0xffffff,
    position: [0, -1.5, 3.5]
  },
  {
    name: 'CS DS&A',
    fullName: 'CS DS&A Classwork',
    description: 'Assignments for the Oakton Highschool AV CS Data Structures & Algorithms course.',
    links: [
      { label: 'View repo', url: 'https://github.com/ankthba/csdsav.git' }
    ],
    color: 0xffffff,
    position: [1.5, 2.5, -2]
  },
  {
    name: 'Oakton Codebase',
    fullName: 'Oakton Codebase Co-President',
    description: 'Leading Oakton HS\'s premier coding club, organizing competitive programming, web dev, and USACO/LeetCode prep. Mentoring members, coordinating workshops and hackathons.',
    links: [
      { label: 'View site', url: 'https://oaktoncodebase.com/' }
    ],
    color: 0xffffff,
    position: [-1.5, -2.5, 2.5]
  },
  {
    name: 'PCB Design',
    fullName: 'PCB Design',
    description: 'Developing compact, efficient PCBs for USB-C storage and embedded applications with a focus on signal integrity, thermal performance, and real-world manufacturability.',
    links: [],
    color: 0xffffff,
    position: [3.5, 0, -1.5]
  },
  {
    name: 'Apple Silicon',
    fullName: 'Chip Design & Analysis',
    description: 'Reverse-engineered Apple Silicon to model CPU/GPU/Neural Engine integration, cache hierarchies, and power efficiency strategies using ARM architecture insights.',
    links: [],
    color: 0xffffff,
    position: [-3.5, -1.5, 0]
  },
  {
    name: 'FTC Captain',
    fullName: 'FTC Robotics, Team Captain',
    description: 'Served as outreach lead and team captain, contributing to robot design, code, and advancement while mentoring and managing STEM workshops.',
    links: [],
    color: 0xffffff,
    position: [0, -3, -2]
  }
];

let scene, camera, renderer, nodes = [], edges = [], controls;
let selectedNode = null;
let isDragging = false;
let autoRotate = true;

function init3DGraph() {
  const container = document.getElementById('projects-3d-container');
  if (!container || typeof THREE === 'undefined') return;

  // Scene setup
  scene = new THREE.Scene();
  const theme = root.getAttribute('data-theme');
  const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
  scene.background = null; // Transparent background

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 8;

  // Renderer with high pixel ratio for crisp rendering
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0); // Transparent clear color
  container.appendChild(renderer.domElement);

  // Create stunning nodes with glow effect
  projectsData.forEach((project, index) => {
    // Inner glowing core
    const coreGeometry = new THREE.SphereGeometry(0.35, 64, 64);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: isLight ? 0x000000 : 0xffffff,
      emissive: isLight ? 0x000000 : 0xffffff,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.95
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);

    // Outer glow shell
    const glowGeometry = new THREE.SphereGeometry(0.5, 64, 64);
    const glowMaterial = new THREE.MeshPhysicalMaterial({
      color: isLight ? 0x666666 : 0xffffff,
      emissive: isLight ? 0x333333 : 0xffffff,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);

    // Create group for node
    const nodeGroup = new THREE.Group();
    nodeGroup.add(core);
    nodeGroup.add(glow);
    nodeGroup.position.set(...project.position);
    nodeGroup.userData = { project, core, glow };
    scene.add(nodeGroup);
    nodes.push(nodeGroup);

    // Elegant label with gradient background
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1400;
    canvas.height = 380;

    // Create gradient background
    const gradient = context.createLinearGradient(0, 0, 1400, 380);
    if (isLight) {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      gradient.addColorStop(0.5, 'rgba(250, 250, 250, 0.95)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.92)');
    } else {
      gradient.addColorStop(0, 'rgba(10, 10, 10, 0.92)');
      gradient.addColorStop(0.5, 'rgba(20, 20, 20, 0.95)');
      gradient.addColorStop(1, 'rgba(10, 10, 10, 0.92)');
    }

    // Draw blurred shadow layer
    context.fillStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.3)';
    context.filter = 'blur(30px)';
    context.fillRect(100, 100, 1200, 180);

    // Reset filter
    context.filter = 'none';

    // Draw main background with gradient
    context.fillStyle = gradient;
    const radius = 20;
    context.beginPath();
    context.roundRect(100, 100, 1200, 180, radius);
    context.fill();

    // Draw elegant border with subtle gradient
    const borderGradient = context.createLinearGradient(100, 100, 1300, 280);
    if (isLight) {
      borderGradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
      borderGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
      borderGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    } else {
      borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      borderGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    }
    context.strokeStyle = borderGradient;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(100, 100, 1200, 180, radius);
    context.stroke();

    // Title with subtle shadow
    context.shadowColor = isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 2;
    context.fillStyle = isLight ? '#000000' : '#ffffff';
    context.font = 'bold 64px "Instrument Serif", serif';
    context.textAlign = 'center';
    context.fillText(project.fullName, 700, 175);

    // Reset shadow
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Accent line under title
    const lineGradient = context.createLinearGradient(400, 200, 1000, 200);
    if (isLight) {
      lineGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      lineGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
      lineGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      lineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
      lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    context.strokeStyle = lineGradient;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(400, 200);
    context.lineTo(1000, 200);
    context.stroke();

    // Elegant description
    context.fillStyle = isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.7)';
    context.font = '36px "Inter", sans-serif';
    const desc = project.description.substring(0, 60) + '...';
    context.fillText(desc, 700, 245);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(...project.position);
    sprite.position.y += 1.3;
    sprite.scale.set(5.5, 1.5, 1);
    sprite.userData = { nodeGroup, initialOpacity: 0.95 };
    scene.add(sprite);
    nodeGroup.userData.label = sprite;
  });

  // Create elegant curved connections with glow
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = nodes[i].position.distanceTo(nodes[j].position);
      if (distance < 4.5) {
        // Create smooth curve
        const start = nodes[i].position.clone();
        const end = nodes[j].position.clone();
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += distance * 0.15; // Slight arc

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Main line with gradient effect
        const material = new THREE.LineBasicMaterial({
          color: isLight ? 0x999999 : 0xcccccc,
          transparent: true,
          opacity: 0.15,
          linewidth: 1
        });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        edges.push({ line, curve, progress: Math.random() });

        // Glow line
        const glowMaterial = new THREE.LineBasicMaterial({
          color: isLight ? 0x666666 : 0xffffff,
          transparent: true,
          opacity: 0.08,
          linewidth: 2
        });
        const glowLine = new THREE.Line(geometry, glowMaterial);
        scene.add(glowLine);
      }
    }
  }

  // Dramatic lighting setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(5, 8, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(isLight ? 0x999999 : 0xaaaaaa, 0.6);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(isLight ? 0x555555 : 0xffffff, 1.5);
  rimLight.position.set(0, 0, -10);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(isLight ? 0x333333 : 0xffffff, 0.8);
  accentLight.position.set(8, -5, 3);
  scene.add(accentLight);

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Mouse events
  let mouseDownTime = 0;
  let hoveredNode = null;

  renderer.domElement.addEventListener('mousedown', (event) => {
    isDragging = false;
    mouseDownTime = Date.now();
    autoRotate = false;
  });

  renderer.domElement.addEventListener('mousemove', (event) => {
    if (Date.now() - mouseDownTime > 100) {
      isDragging = true;
    }

    mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;

    // Hover effect with smooth scaling
    raycaster.setFromCamera(mouse, camera);

    // Get all meshes from node groups
    const meshes = [];
    nodes.forEach(nodeGroup => {
      nodeGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
        }
      });
    });

    const intersects = raycaster.intersectObjects(meshes);

    // Reset all nodes
    nodes.forEach(nodeGroup => {
      nodeGroup.userData.targetScale = 1.0;
      if (nodeGroup.userData.label) {
        nodeGroup.userData.label.userData.targetOpacity = 0.95;
      }
    });

    if (intersects.length > 0 && !isDragging) {
      const intersectedMesh = intersects[0].object;
      const nodeGroup = intersectedMesh.parent;

      if (nodeGroup && nodeGroup.userData.project) {
        hoveredNode = nodeGroup;
        nodeGroup.userData.targetScale = 1.35;
        if (nodeGroup.userData.label) {
          nodeGroup.userData.label.userData.targetOpacity = 1.0;
        }
        renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      hoveredNode = null;
      renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  });

  renderer.domElement.addEventListener('mouseup', (event) => {
    if (!isDragging && hoveredNode) {
      selectNode(hoveredNode);
    }
    setTimeout(() => {
      autoRotate = true;
    }, 3000);
  });

  // Removed wheel zoom for cleaner interaction

  // Manual rotation
  let previousMouseX = 0;
  let previousMouseY = 0;
  let isMouseDown = false;

  renderer.domElement.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
  });

  renderer.domElement.addEventListener('mousemove', (event) => {
    if (isMouseDown) {
      const deltaX = event.clientX - previousMouseX;
      const deltaY = event.clientY - previousMouseY;

      scene.rotation.y += deltaX * 0.005;
      scene.rotation.x += deltaY * 0.005;

      previousMouseX = event.clientX;
      previousMouseY = event.clientY;
    }
  });

  renderer.domElement.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    isMouseDown = false;
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  animate3DGraph();
}

function selectNode(nodeGroup) {
  selectedNode = nodeGroup;
  const project = nodeGroup.userData.project;

  // Show popup overlay
  const popup = document.getElementById('project-popup');
  const overlay = document.getElementById('popup-overlay');

  document.getElementById('popup-project-name').textContent = project.fullName;
  document.getElementById('popup-project-description').textContent = project.description;

  const linksContainer = document.getElementById('popup-project-links');
  linksContainer.innerHTML = '';

  if (project.links && project.links.length > 0) {
    project.links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.textContent = link.label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'popup-link';
      linksContainer.appendChild(a);
    });
  }

  // Show popup with animation
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);

  // Highlight selected node
  const theme = root.getAttribute('data-theme');
  const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);

  nodes.forEach(n => {
    const core = n.userData.core;
    const glow = n.userData.glow;

    if (n === nodeGroup) {
      core.material.emissiveIntensity = 1.2;
      glow.material.emissiveIntensity = 0.8;
      glow.material.opacity = 0.5;
    } else {
      core.material.emissiveIntensity = 0.8;
      glow.material.emissiveIntensity = 0.4;
      glow.material.opacity = 0.3;
    }
  });
}

function animate3DGraph() {
  requestAnimationFrame(animate3DGraph);

  if (autoRotate) {
    scene.rotation.y += 0.0015;
  }

  const time = Date.now() * 0.001;

  // Smooth animations for nodes
  nodes.forEach((nodeGroup, index) => {
    // Gentle floating animation
    const floatOffset = Math.sin(time + index * 0.5) * 0.015;
    const baseY = nodeGroup.userData.project.position[1];
    nodeGroup.position.y = baseY + floatOffset;

    // Smooth scale transition with elastic easing
    const currentScale = nodeGroup.scale.x;
    const targetScale = nodeGroup.userData.targetScale || 1.0;
    const newScale = currentScale + (targetScale - currentScale) * 0.12;
    nodeGroup.scale.set(newScale, newScale, newScale);

    // Gentle pulsing glow
    const glow = nodeGroup.userData.glow;
    if (glow) {
      const pulseFactor = Math.sin(time * 1.5 + index) * 0.05 + 0.95;
      glow.scale.set(pulseFactor, pulseFactor, pulseFactor);
    }

    // Smooth label opacity transition
    const label = nodeGroup.userData.label;
    if (label) {
      const currentOpacity = label.material.opacity;
      const targetOpacity = label.userData.targetOpacity || 0.95;
      const newOpacity = currentOpacity + (targetOpacity - currentOpacity) * 0.15;
      label.material.opacity = newOpacity;
    }
  });

  // Subtle edge animation
  edges.forEach((edgeData, index) => {
    if (edgeData.curve) {
      // Gentle opacity pulsing
      const pulseFactor = Math.sin(time * 0.5 + index * 0.3) * 0.05 + 0.95;
      edgeData.line.material.opacity = 0.15 * pulseFactor;
    }
  });

  renderer.render(scene, camera);
}

// Initialize 3D graph when DOM is ready
window.addEventListener('load', () => {
  init3DGraph();
});

// Close popup functionality
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('popup-overlay');
  const closeBtn = document.getElementById('close-popup');

  function closePopup() {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);

    // Reset node highlighting
    if (nodes.length > 0) {
      const theme = root.getAttribute('data-theme');
      const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
      nodes.forEach(n => {
        const core = n.userData.core;
        const glow = n.userData.glow;
        if (core && glow) {
          core.material.emissiveIntensity = 0.8;
          glow.material.emissiveIntensity = 0.4;
          glow.material.opacity = 0.3;
        }
      });
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closePopup);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePopup();
      }
    });
  }

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closePopup();
    }
  });
});


// ---------------------------------------------------------
// 6. Photo Marquee
// ---------------------------------------------------------

window.addEventListener('load', () => {
  const photoTrack = document.querySelector('.photo-track');
  if (photoTrack) {
    const originalWidth = Math.round(photoTrack.scrollWidth);
    Array.from(photoTrack.children).forEach(n => photoTrack.appendChild(n.cloneNode(true)));
    photoTrack.style.setProperty('--marquee-distance', `${originalWidth}px`);
    const duration = originalWidth / 60;
    photoTrack.style.setProperty('--photo-marquee-duration', `${duration}s`);
  }
});


// ---------------------------------------------------------
// 7. Featured Logo Marquee
// ---------------------------------------------------------

window.addEventListener('load', () => {
  const track = document.querySelector('.logo-track');
  if (!track) return;

  const originalWidth = Math.round(track.scrollWidth);
  Array.from(track.children).forEach(n => track.appendChild(n.cloneNode(true)));
  track.style.setProperty('--marquee-distance', `${originalWidth}px`);
  const duration = originalWidth / 50;
  track.style.setProperty('--marquee-duration', `${duration}s`);
});


// ---------------------------------------------------------
// 8. Update theme for 3D scene
// ---------------------------------------------------------

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    if (scene) {
      const theme = root.getAttribute('data-theme');
      const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
      // Keep background transparent
      scene.background = null;

      nodes.forEach(nodeGroup => {
        const core = nodeGroup.userData.core;
        const glow = nodeGroup.userData.glow;

        if (core) {
          core.material.color.setHex(isLight ? 0x000000 : 0xffffff);
          core.material.emissive.setHex(isLight ? 0x000000 : 0xffffff);
        }

        if (glow) {
          glow.material.color.setHex(isLight ? 0x666666 : 0xffffff);
          glow.material.emissive.setHex(isLight ? 0x333333 : 0xffffff);
        }
      });

      edges.forEach(edgeData => {
        if (edgeData.line) {
          edgeData.line.material.color.setHex(isLight ? 0x999999 : 0xcccccc);
        }
      });
    }
  });
}
