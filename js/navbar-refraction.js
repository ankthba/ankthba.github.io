/**
 * Navbar Refraction Effect
 * Implements liquid distortion, chromatic aberration, and magnification
 * Progressive enhancement: WebGL → CSS fallback
 */

class NavbarRefractionEffect {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    if (!this.navbar) {
      console.warn('Navbar not found');
      return;
    }

    console.log('NavbarRefractionEffect initialized');

    this.supportsWebGL = this.detectWebGL();
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.isLowPerformance = this.detectLowPerformance();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  detectLowPerformance() {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      return true;
    }

    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      return true;
    }

    return false;
  }

  init() {
    // Always setup basic mouse tracking for glow effect
    this.setupBasicMouseTracking();

    if (this.prefersReducedMotion || (this.isMobile && this.isLowPerformance)) {
      this.navbar.classList.add('refraction-simplified');
      return;
    }

    if (this.supportsWebGL) {
      this.initWebGL();
    }
  }

  setupBasicMouseTracking() {
    console.log('Setting up basic mouse tracking for glow effect');

    // Create a dedicated glow element
    this.glowElement = document.createElement('div');
    this.glowElement.className = 'navbar-glow';

    // Set styles individually for better Safari compatibility
    this.glowElement.style.position = 'absolute';
    this.glowElement.style.width = '200px';
    this.glowElement.style.height = '200px';
    this.glowElement.style.borderRadius = '50%';
    this.glowElement.style.backgroundImage = 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%)';
    this.glowElement.style.pointerEvents = 'none';
    this.glowElement.style.zIndex = '100';
    this.glowElement.style.opacity = '0';
    this.glowElement.style.transition = 'opacity 0.3s ease';
    this.glowElement.style.transform = 'translate(-50%, -50%)';
    this.glowElement.style.left = '0px';
    this.glowElement.style.top = '0px';

    this.navbar.appendChild(this.glowElement);
    console.log('Glow element created and appended to navbar');

    const updateGlowPosition = (clientX, clientY) => {
      const rect = this.navbar.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      this.glowElement.style.left = `${x}px`;
      this.glowElement.style.top = `${y}px`;
    };

    this.navbar.addEventListener('mousemove', (e) => {
      updateGlowPosition(e.clientX, e.clientY);
      this.glowElement.style.opacity = '1';
    });

    this.navbar.addEventListener('mouseenter', (e) => {
      updateGlowPosition(e.clientX, e.clientY);
      this.glowElement.style.opacity = '1';
    });

    this.navbar.addEventListener('mouseleave', () => {
      this.glowElement.style.opacity = '0';
    });

    this.navbar.addEventListener('mousedown', () => {
      this.glowElement.style.backgroundImage = 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 40%, transparent 70%)';
    });

    this.navbar.addEventListener('mouseup', () => {
      this.glowElement.style.backgroundImage = 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%)';
    });

    this.navbar.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateGlowPosition(touch.clientX, touch.clientY);
        this.glowElement.style.opacity = '1';
        this.glowElement.style.backgroundImage = 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 40%, transparent 70%)';
      }
    });

    this.navbar.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateGlowPosition(touch.clientX, touch.clientY);
      }
    });

    this.navbar.addEventListener('touchend', () => {
      this.glowElement.style.opacity = '0';
      this.glowElement.style.backgroundImage = 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%)';
    });
  }

  initWebGL() {
    const container = document.createElement('div');
    container.className = 'navbar-refraction-container';
    this.navbar.insertBefore(container, this.navbar.firstChild);

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;
    container.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    });

    if (!this.gl) {
      console.warn('WebGL context creation failed');
      return;
    }

    this.loadShaders();
  }

  async loadShaders() {
    try {
      const [vertSource, fragSource] = await Promise.all([
        fetch('/shaders/navbar-refraction.vert').then(r => r.text()),
        fetch('/shaders/navbar-refraction.frag').then(r => r.text())
      ]);

      this.program = this.createProgram(vertSource, fragSource);
      if (!this.program) {
        throw new Error('Shader program creation failed');
      }

      this.gl.useProgram(this.program);

      this.locations = {
        position: this.gl.getAttribLocation(this.program, 'a_position'),
        texCoord: this.gl.getAttribLocation(this.program, 'a_texCoord'),
        background: this.gl.getUniformLocation(this.program, 'u_background'),
        resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
        time: this.gl.getUniformLocation(this.program, 'u_time'),
        isDark: this.gl.getUniformLocation(this.program, 'u_isDark'),
        mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
        mouseInfluence: this.gl.getUniformLocation(this.program, 'u_mouseInfluence')
      };

      // Mouse tracking state
      this.mouse = { x: 0.5, y: 0.5 };
      this.targetMouse = { x: 0.5, y: 0.5 };
      this.mouseInfluence = 0.0;
      this.targetInfluence = 0.0;

      this.setupGeometry();
      this.captureBackgroundTexture();
      this.setupContextLossHandling();
      this.setupMouseTracking();
      this.observeThemeChanges();
      this.startRenderLoop();

    } catch (error) {
      console.error('Shader loading failed:', error);
    }
  }

  createProgram(vertSource, fragSource) {
    const vertShader = this.compileShader(vertSource, this.gl.VERTEX_SHADER);
    const fragShader = this.compileShader(fragSource, this.gl.FRAGMENT_SHADER);

    if (!vertShader || !fragShader) return null;

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  compileShader(source, type) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  setupGeometry() {
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]);

    const posBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 2, this.gl.FLOAT, false, 0, 0);

    const texBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(this.locations.texCoord);
    this.gl.vertexAttribPointer(this.locations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
  }

  captureBackgroundTexture() {
    const heroImage = new Image();
    heroImage.crossOrigin = 'anonymous';
    heroImage.src = '/hero.webp';

    heroImage.onload = () => {
      const texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        heroImage
      );

      this.backgroundTexture = texture;
    };

    heroImage.onerror = () => {
      console.warn('Failed to load hero image for refraction');
    };
  }

  setupContextLossHandling() {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }
    }, false);

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.loadShaders();
    }, false);
  }

  setupMouseTracking() {
    const updateMousePosition = (e) => {
      const rect = this.navbar.getBoundingClientRect();
      this.targetMouse.x = (e.clientX - rect.left) / rect.width;
      this.targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
    };

    // Mouse move over navbar
    this.navbar.addEventListener('mousemove', (e) => {
      updateMousePosition(e);
      this.targetInfluence = 1.0;
    });

    // Mouse enter navbar
    this.navbar.addEventListener('mouseenter', (e) => {
      updateMousePosition(e);
      this.targetInfluence = 1.0;
    });

    // Mouse leave navbar
    this.navbar.addEventListener('mouseleave', () => {
      this.targetInfluence = 0.0;
    });

    // Touch support for mobile
    this.navbar.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.navbar.getBoundingClientRect();
        this.targetMouse.x = (touch.clientX - rect.left) / rect.width;
        this.targetMouse.y = 1.0 - (touch.clientY - rect.top) / rect.height;
        this.targetInfluence = 1.0;
      }
    });

    this.navbar.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.navbar.getBoundingClientRect();
        this.targetMouse.x = (touch.clientX - rect.left) / rect.width;
        this.targetMouse.y = 1.0 - (touch.clientY - rect.top) / rect.height;
      }
    });

    this.navbar.addEventListener('touchend', () => {
      this.targetInfluence = 0.0;
    });
  }

  observeThemeChanges() {
    const observer = new MutationObserver(() => {
      this.updateTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    this.updateTheme();
  }

  updateTheme() {
    if (!this.gl || !this.locations.isDark) return;

    const theme = document.documentElement.getAttribute('data-theme');
    const effectiveTheme = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    const isDark = effectiveTheme === 'dark';
    this.gl.uniform1i(this.locations.isDark, isDark ? 1 : 0);
  }

  startRenderLoop() {
    const targetFPS = this.isLowPerformance ? 30 : 60;
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;

    const render = (time) => {
      if (time - lastFrameTime < frameInterval) {
        this.rafId = requestAnimationFrame(render);
        return;
      }

      lastFrameTime = time;

      this.resize();

      // Smooth mouse interpolation for fluid motion
      const lerpFactor = 0.15;
      this.mouse.x += (this.targetMouse.x - this.mouse.x) * lerpFactor;
      this.mouse.y += (this.targetMouse.y - this.mouse.y) * lerpFactor;

      // Smooth influence fade in/out
      const influenceLerp = 0.08;
      this.mouseInfluence += (this.targetInfluence - this.mouseInfluence) * influenceLerp;

      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      if (this.locations.resolution) {
        this.gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
      }
      if (this.locations.time) {
        this.gl.uniform1f(this.locations.time, time * 0.001);
      }
      if (this.locations.mouse) {
        this.gl.uniform2f(this.locations.mouse, this.mouse.x, this.mouse.y);
      }
      if (this.locations.mouseInfluence) {
        this.gl.uniform1f(this.locations.mouseInfluence, this.mouseInfluence);
      }

      if (this.backgroundTexture) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.backgroundTexture);
        this.gl.uniform1i(this.locations.background, 0);
      }

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      this.rafId = requestAnimationFrame(render);
    };

    this.rafId = requestAnimationFrame(render);
  }

  resize() {
    const rect = this.navbar.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.gl.viewport(0, 0, width, height);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new NavbarRefractionEffect();
  });
} else {
  new NavbarRefractionEffect();
}
