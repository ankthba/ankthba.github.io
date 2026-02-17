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
// 3. Smooth Scroll Navigation
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
// 4. 3D Project Graph with Three.js
// ---------------------------------------------------------

const projectsData = [
  {
    name: 'Founder, Vayu',
    description: 'Building an operating system for autonomous AI agents that treats agents as kernel-level primitives with built‑in safety, compliance, and reliability. It features capability‑based security, goal‑aware scheduling, and cryptographically verified audit systems for mission‑critical AI infrastructure.',
    links: [
      { label: 'Visit site', url: 'https://aniketh.net/vayu' }
    ],
    color: 0xffffff,
    position: [0, 2.5, 0]
  },
  {
    name: 'Founder & President, OCRadar',
    description: 'AI-powered mobile platform for early oral cancer detection, combining computer vision with cross-platform development to drive global health impact.',
    links: [
      { label: 'Visit site', url: 'https://ocradar.com/' }
    ],
    color: 0xffffff,
    position: [3.5, 1.5, 2]
  },
  {
    name: 'FRC Robotics, Software Lead',
    description: 'Led systems engineering and control software for competition robots, integrating advanced algorithms, CAD, electronics, and autonomous functions in high-pressure team environments.',
    links: [
      { label: 'View repo', url: 'https://github.com/OaktonCougarRobotics' }
    ],
    color: 0xffffff,
    position: [-3.5, 0.5, 1.5]
  },
  {
    name: 'EdgeFabric',
    description: 'Synthesize distributed intelligence from ambient compute with instantaneous inference.',
    links: [
      { label: 'View repo', url: 'https://github.com/ankthba/EdgeFabric.git' }
    ],
    color: 0xffffff,
    position: [2.5, -2, -1]
  },
  {
    name: 'Designing a CNN for High-Accuracy OCSCC Detection',
    description: 'This work presents a CNN trained on image datasets for high-accuracy OCSCC detection, with custom hardware for optimal image capture. Testing across resolutions showed logarithmic accuracy improvements with diminishing returns at high pixel counts. An open-access application enables broader CNN utilization for early detection.',
    links: [
      { label: 'View paper', url: 'https://arxiv.org/abs/2510.16235' }
    ],
    color: 0xffffff,
    position: [-2.5, 1.5, -2.5]
  },
  {
    name: 'IllumiSign: Eye-Tracking Communication Software',
    description: 'IllumiSign is an open-source, browser-based communication tool that helps people with ALS and mobility impairments communicate using only their eyes. Built at Hack the Nest 2025 (Social Justice Track winner), it uses real-time eye tracking to select letters and phrases and speaks them aloud, with no special hardware required.',
    links: [
      { label: 'View project', url: 'https://devpost.com/software/illumisign' }
    ],
    color: 0xffffff,
    position: [0, -1.5, 3.5]
  },
  {
    name: 'CS DS&A Classwork',
    description: 'Assignments for the Oakton Highschool AV CS Data Structures & Algorithms course.',
    links: [
      { label: 'View repo', url: 'https://github.com/ankthba/csdsav.git' }
    ],
    color: 0xffffff,
    position: [1.5, 2.5, -2]
  },
  {
    name: 'Oakton Codebase Co-President',
    description: 'Leading Oakton HS\'s premier coding club, organizing competitive programming, web dev, and USACO/LeetCode prep. Mentoring members, coordinating workshops and hackathons.',
    links: [
      { label: 'View site', url: 'https://oaktoncodebase.com/' }
    ],
    color: 0xffffff,
    position: [-1.5, -2.5, 2.5]
  },
  {
    name: 'PCB Design',
    description: 'Developing compact, efficient PCBs for USB-C storage and embedded applications with a focus on signal integrity, thermal performance, and real-world manufacturability.',
    links: [],
    color: 0xffffff,
    position: [3.5, 0, -1.5]
  },
  {
    name: 'Chip Design & Analysis',
    description: 'Reverse-engineered Apple Silicon to model CPU/GPU/Neural Engine integration, cache hierarchies, and power efficiency strategies using ARM architecture insights.',
    links: [],
    color: 0xffffff,
    position: [-3.5, -1.5, 0]
  },
  {
    name: 'FTC Robotics, Team Captain',
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
  scene.background = new THREE.Color(isLight ? 0xffffff : 0x000000);

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
  container.appendChild(renderer.domElement);

  // Create nodes
  projectsData.forEach((project, index) => {
    const geometry = new THREE.SphereGeometry(0.3, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: isLight ? 0x000000 : project.color,
      emissive: isLight ? 0x222222 : 0x333333,
      shininess: 100
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(...project.position);
    sphere.userData = project;
    scene.add(sphere);
    nodes.push(sphere);

    // Add label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = isLight ? '#000000' : '#ffffff';
    context.font = '32px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText(project.name, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(...project.position);
    sprite.position.y += 0.7;
    sprite.scale.set(2, 0.5, 1);
    scene.add(sprite);
  });

  // Create edges (connections between nodes)
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: isLight ? 0x666666 : 0x888888,
    transparent: true,
    opacity: 0.3
  });

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = nodes[i].position.distanceTo(nodes[j].position);
      if (distance < 4) {
        const points = [nodes[i].position, nodes[j].position];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, edgeMaterial);
        scene.add(line);
        edges.push(line);
      }
    }
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0xffffff, 0.8);
  pointLight1.position.set(10, 10, 10);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xffffff, 0.5);
  pointLight2.position.set(-10, -10, -10);
  scene.add(pointLight2);

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Mouse events
  let mouseDownTime = 0;

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

    // Hover effect
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);

    nodes.forEach(node => {
      node.scale.set(1, 1, 1);
    });

    if (intersects.length > 0 && !isDragging) {
      const hoveredNode = intersects[0].object;
      hoveredNode.scale.set(1.2, 1.2, 1.2);
      renderer.domElement.style.cursor = 'pointer';
    } else {
      renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  });

  renderer.domElement.addEventListener('mouseup', (event) => {
    if (!isDragging) {
      mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
      mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodes);

      if (intersects.length > 0) {
        selectNode(intersects[0].object);
      }
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

function selectNode(node) {
  selectedNode = node;
  const project = node.userData;

  // Show popup overlay
  const popup = document.getElementById('project-popup');
  const overlay = document.getElementById('popup-overlay');

  document.getElementById('popup-project-name').textContent = project.name;
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
  nodes.forEach(n => {
    if (n === node) {
      n.material.emissive.setHex(0x666666);
    } else {
      const theme = root.getAttribute('data-theme');
      const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
      n.material.emissive.setHex(isLight ? 0x222222 : 0x333333);
    }
  });
}

function animate3DGraph() {
  requestAnimationFrame(animate3DGraph);

  if (autoRotate) {
    scene.rotation.y += 0.002;
  }

  // Floating animation for nodes
  nodes.forEach((node, index) => {
    node.position.y += Math.sin(Date.now() * 0.001 + index) * 0.0005;
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
        n.material.emissive.setHex(isLight ? 0x222222 : 0x333333);
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
// 5. Featured Logo Marquee
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
// 6. Update theme for 3D scene
// ---------------------------------------------------------

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    if (scene) {
      const theme = root.getAttribute('data-theme');
      const isLight = theme === 'light' || (theme === 'auto' && !mql.matches);
      scene.background = new THREE.Color(isLight ? 0xffffff : 0x000000);

      nodes.forEach(node => {
        node.material.color.setHex(isLight ? 0x000000 : 0xffffff);
        node.material.emissive.setHex(isLight ? 0x222222 : 0x333333);
      });

      edges.forEach(edge => {
        edge.material.color.setHex(isLight ? 0x666666 : 0x888888);
      });
    }
  });
}
