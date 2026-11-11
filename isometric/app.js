// Isometric DC: Google photorealistic 3D tiles, seen through a locked isometric
// (orthographic) camera, clipped to DC + Northern Virginia and Charlottesville,
// and pushed through a pixel-art shader (low-res buffer, posterised colour, depth outlines).
(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ok = (s) => !!s && !s.startsWith('PASTE');
  const KEY = (window.GMAPS_KEY || '').trim();              // Google Maps key (needs billing)
  const ION = (window.CESIUM_ION_TOKEN || '').trim();       // free Cesium ion token (same Google tiles)
  const PROXY = (window.CESIUM_ION_PROXY || '').trim();     // or a server that holds the token (the public site)
  if (!ok(KEY) && !ok(ION) && !PROXY) {
    $('setup').classList.add('on');
    return;
  }
  if (PROXY) {
    // ion's endpoint request goes to the proxy, which adds the real token; the placeholder
    // only keeps Cesium from flagging its own demo token
    Cesium.Ion.defaultServer = PROXY.replace(/\/?$/, '/');
    Cesium.Ion.defaultAccessToken = 'held-by-proxy';
  } else if (ok(ION)) Cesium.Ion.defaultAccessToken = ION;

  const [regions, places, spots] = await Promise.all([
    fetch('data/regions.json').then((r) => r.json()),
    fetch('data/places.json').then((r) => r.json()),
    fetch('data/spots.local.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);

  // ------------------------------------------------------------------ viewer
  const viewer = new Cesium.Viewer('map', {
    globe: false, baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false,
    fullscreenButton: false, infoBox: false, selectionIndicator: false, skyBox: false,
    skyAtmosphere: false, msaaSamples: 1,
    requestRenderMode: true, maximumRenderTimeChange: Infinity,   // draw only when something changes
  });
  // the place labels come from OpenStreetMap (ODbL asks for this credit)
  viewer.creditDisplay.addStaticCredit(new Cesium.Credit(
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>', true));
  const scene = viewer.scene;
  const cam = viewer.camera;
  const canvas = viewer.canvas;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#0d1322');
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.fog.enabled = false;
  scene.postProcessStages.fxaa.enabled = false;
  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  scene.screenSpaceCameraController.enableInputs = false;   // our own isometric controls below
  viewer.useBrowserRecommendedResolution = true;

  let PIX = 3;                                   // screen px per art pixel ([ and ] change it)
  let tileset = null;
  let MSE_FIXED = 0;
  // tile detail follows the art-pixel size: bigger blocks hide finer detail, so fetch coarser (faster) tiles
  const mseFor = (p) => MSE_FIXED || Math.max(12, 8 * p);
  // the scene is drawn at full resolution (sharp textures); the shader snaps it to PIX-sized blocks
  const setPix = (p) => {
    PIX = Math.max(1, Math.min(6, p));
    if (typeof style !== 'undefined') style.pix = PIX;
    if (tileset) tileset.maximumScreenSpaceError = mseFor(PIX);
    scene.requestRender();
  };

  try {
    // loading knobs (overridable with ?mse=&skip=&req= for testing)
    const Q = new URLSearchParams(location.search);
    // defaults measured cold: ~1 s to first picture, ~2 s to sharp (was ~10 s / ~11 s)
    const TUNE = { mse: Number(Q.get('mse') || 0), skip: (Q.get('skip') || '1') === '1', req: Number(Q.get('req') || 48) };
    if (TUNE.req > 0) {
      Cesium.RequestScheduler.maximumRequestsPerServer = TUNE.req;
      Cesium.RequestScheduler.maximumRequests = Math.max(50, TUNE.req * 2);
    }
    MSE_FIXED = TUNE.mse;
    const opts = { showCreditsOnScreen: true, maximumScreenSpaceError: mseFor(PIX), cacheBytes: 768 * 1024 * 1024 };
    if (TUNE.skip) Object.assign(opts, { skipLevelOfDetail: true, baseScreenSpaceError: 1024, skipScreenSpaceErrorFactor: 16,
      skipLevels: 1, immediatelyLoadDesiredLevelOfDetail: false, loadSiblings: false });
    else opts.skipLevelOfDetail = false;
    tileset = ok(KEY)
      ? await Cesium.Cesium3DTileset.fromUrl('https://tile.googleapis.com/v1/3dtiles/root.json?key=' + encodeURIComponent(KEY), opts)
      : await Cesium.Cesium3DTileset.fromIonAssetId(2275207, opts);   // Google Photorealistic 3D Tiles on Cesium ion
    scene.primitives.add(tileset);
    tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
      polygons: Object.values(regions).map((ring) => new Cesium.ClippingPolygon({
        positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
      })),
      inverse: true,   // keep what is inside the two islands, drop everything else
    });
    tileset.loadProgress.addEventListener((pending, processing) => {
      $('loading').classList.toggle('on', pending + processing > 6);
    });
  } catch (err) {
    console.error('3D tiles failed', err);
    $('loading').textContent = ok(KEY) ? 'Google turned the key down (is the Map Tiles API enabled?)'
      : 'Cesium ion turned the token down (' + (err && (err.statusCode || err.message) || 'error') + ')';
    $('loading').classList.add('on');
  }

  // ------------------------------------------------------------------ pixel-art pass
  // 1) Kuwahara filter flattens the photo texture into solid shapes
  // 2) per-face shading from depth-derived normals (tops light, left walls lit, right walls dark)
  // 3) ordered dither + snap to a fixed pixel-art palette
  // 4) dark outlines where depth jumps
  const PAL = ['#14161f', '#262a36', '#3a3f4e', '#545a6b', '#6f7686', '#8e95a3', '#adb3bf', '#ccd0d8', '#e8eaee', '#f7f5ee',
    '#1b3326', '#24452f', '#2f5a37', '#3c6e3e', '#4e8545', '#66994f', '#82ad5c', '#a2c46c', '#c4d88a',
    '#3b2d22', '#5a4330', '#7a5c40', '#9c7a55', '#bd9b6e', '#dcc095', '#efdcb4',
    '#5c2525', '#7d3530', '#a04a3a', '#c06a4c', '#d98f69',
    '#14283d', '#1f3e5c', '#2c5880', '#3f78a3', '#5f9cc4', '#8ec0de',
    '#4a4f66', '#636b85', '#c9a83f', '#e8cf6e',
    '#5f8a3f', '#76a04a', '#8fb556', '#a9c766', '#6b7d4a', '#8a9a5e'];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const oklab = ([r, g, b]) => {
    const lin = (c) => Math.pow(c, 2.2);
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const q = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * q,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * q,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * q];
  };
  const v3 = (a) => `vec3(${a.map((x) => x.toFixed(5)).join(',')})`;
  const palGLSL = PAL.map((h) => v3(hex(h))).join(',\n      ');
  const labGLSL = PAL.map((h) => v3(oklab(hex(h)))).join(',\n      ');
  const FS = `
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;
    uniform float enabled;
    uniform float saturation;
    uniform float contrast;
    uniform float brightness;
    uniform float shadeAmt;
    uniform float dither;
    uniform float outline;
    uniform float edgeMeters;
    uniform float usePalette;
    uniform float heading;
    uniform float pix;
    in vec2 v_textureCoordinates;

    const int NP = ${PAL.length};
    const vec3 PAL[NP] = vec3[NP](
      ${palGLSL});
    const vec3 PLAB[NP] = vec3[NP](
      ${labGLSL});

    vec3 toLab(vec3 c) {
      vec3 l = pow(max(c, vec3(0.0)), vec3(2.2));
      float L = pow(0.4122214708 * l.r + 0.5363325363 * l.g + 0.0514459929 * l.b, 1.0 / 3.0);
      float M = pow(0.2119034982 * l.r + 0.6806995451 * l.g + 0.1073969566 * l.b, 1.0 / 3.0);
      float S = pow(0.0883024619 * l.r + 0.2817188376 * l.g + 0.6299787005 * l.b, 1.0 / 3.0);
      return vec3(0.2104542553 * L + 0.7936177850 * M - 0.0040720468 * S,
                  1.9779984951 * L - 2.4285922050 * M + 0.4505937099 * S,
                  0.0259040371 * L + 0.7827717662 * M - 0.8086757660 * S);
    }

    vec3 eyePos(vec2 uv) {
      float d = czm_readDepth(depthTexture, uv);
      vec4 e = czm_windowToEyeCoordinates(vec4(uv * czm_viewport.zw + czm_viewport.xy, d, 1.0));
      return e.xyz / e.w;
    }

    vec3 kuwahara(vec2 uv, vec2 px) {
      vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
      vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
      for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
          vec3 c = texture(colorTexture, uv + vec2(float(i), float(j)) * px).rgb;
          vec3 c2 = c * c;
          if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
          if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
          if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
          if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
        }
      }
      m0 /= 9.0; m1 /= 9.0; m2 /= 9.0; m3 /= 9.0;
      float v0 = dot(s0 / 9.0 - m0 * m0, vec3(1.0));
      float v1 = dot(s1 / 9.0 - m1 * m1, vec3(1.0));
      float v2 = dot(s2 / 9.0 - m2 * m2, vec3(1.0));
      float v3 = dot(s3 / 9.0 - m3 * m3, vec3(1.0));
      vec3 r = m0; float v = v0;
      if (v1 < v) { v = v1; r = m1; }
      if (v2 < v) { v = v2; r = m2; }
      if (v3 < v) { v = v3; r = m3; }
      return r;
    }

    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return B[y * 4 + x] / 16.0 - 0.47;
    }

    vec3 nearest(vec3 c) {
      vec3 q = toLab(c);
      vec3 best = PAL[0]; float bd = 1e9;
      for (int i = 0; i < NP; i++) {
        vec3 d = q - PLAB[i];
        float dist = d.x * d.x + 2.2 * (d.y * d.y + d.z * d.z);   // keep hue: chroma errors cost more
        if (dist < bd) { bd = dist; best = PAL[i]; }
      }
      return best;
    }

    // mean colour over one art pixel (2x2 taps), so photo noise inside a block averages out
    vec3 blockMean(vec2 c, vec2 bp) {
      vec2 o = bp * 0.25;
      return 0.25 * (texture(colorTexture, c + vec2(-o.x, -o.y)).rgb + texture(colorTexture, c + vec2(o.x, -o.y)).rgb +
                     texture(colorTexture, c + vec2(-o.x, o.y)).rgb + texture(colorTexture, c + vec2(o.x, o.y)).rgb);
    }

    // Kuwahara over art pixels: keeps edges, flattens texture
    vec3 kuwaharaBlocks(vec2 uv, vec2 bp) {
      vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
      vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
      for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
          vec3 c = blockMean(uv + vec2(float(i), float(j)) * bp, bp);
          vec3 c2 = c * c;
          if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
          if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
          if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
          if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
        }
      }
      m0 /= 9.0; m1 /= 9.0; m2 /= 9.0; m3 /= 9.0;
      float v0 = dot(s0 / 9.0 - m0 * m0, vec3(1.0));
      float v1 = dot(s1 / 9.0 - m1 * m1, vec3(1.0));
      float v2 = dot(s2 / 9.0 - m2 * m2, vec3(1.0));
      float v3 = dot(s3 / 9.0 - m3 * m3, vec3(1.0));
      vec3 r = m0; float v = v0;
      if (v1 < v) { v = v1; r = m1; }
      if (v2 < v) { v = v2; r = m2; }
      if (v3 < v) { v = v3; r = m3; }
      return r;
    }

    void main() {
      vec4 c = texture(colorTexture, v_textureCoordinates);
      if (enabled < 0.5) { out_FragColor = c; return; }
      // snap to the art-pixel grid: every screen pixel in a block shades the block's centre,
      // read from the full-resolution scene, so blocks stay crisp and detailed
      vec2 fc = gl_FragCoord.xy - czm_viewport.xy;
      vec2 cell = floor(fc / pix);
      vec2 px = 1.0 / czm_viewport.zw;
      vec2 uv = (cell + 0.5) * pix * px;
      vec2 bp = pix * px;                                   // one art pixel in uv
      float d0 = czm_readDepth(depthTexture, uv);
      if (d0 >= 1.0) { out_FragColor = texture(colorTexture, uv); return; }     // the void stays as it is

      // 1) flatten texture
      vec3 col = pix > 1.5 ? kuwaharaBlocks(uv, bp) : kuwahara(uv, px);
      float L = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(L), col, saturation);
      col = (col - 0.5) * contrast + 0.5 + brightness;

      // 2) face shading from the geometry
      vec3 p = eyePos(uv);
      vec3 pr = eyePos(uv + vec2(max(2.0, pix) * px.x, 0.0));
      vec3 pu = eyePos(uv + vec2(0.0, max(2.0, pix) * px.y));
      vec3 n = normalize(cross(pr - p, pu - p));
      if (n.z < 0.0) n = -n;
      vec3 nw = normalize(czm_inverseViewRotation * n);
      vec3 pw = (czm_inverseView * vec4(p, 1.0)).xyz;
      vec3 up = normalize(pw);
      vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), up));
      vec3 north = cross(up, east);
      vec3 nl = vec3(dot(nw, east), dot(nw, north), dot(nw, up));
      float top = smoothstep(0.62, 0.86, nl.z);
      vec2 fwd = vec2(sin(heading), cos(heading));
      vec2 rgt = vec2(cos(heading), -sin(heading));
      vec2 Lh = normalize(-rgt - fwd);                 // light from the viewer's upper left
      vec2 nh = nl.xy / max(1e-4, length(nl.xy));
      float wall = 0.64 + 0.30 * dot(nh, Lh);
      float f = mix(wall, 1.04, top);
      col *= mix(1.0, f, shadeAmt);

      // 3) dither + palette
      if (dither > 0.0) col += bayer4(cell) * dither;
      col = clamp(col, 0.0, 1.0);
      if (usePalette > 0.5) col = nearest(col);

      // 4) outlines where depth jumps (silhouettes, roof edges over the street, the island rim)
      float z0 = p.z;
      float zr = eyePos(uv + vec2(bp.x, 0.0)).z, zl = eyePos(uv - vec2(bp.x, 0.0)).z;
      float zu = eyePos(uv + vec2(0.0, bp.y)).z, zd = eyePos(uv - vec2(0.0, bp.y)).z;
      float behind = max(max(z0 - zr, z0 - zl), max(z0 - zu, z0 - zd));   // eye z is negative: larger = nearer
      float rim = 0.0;
      if (czm_readDepth(depthTexture, uv + vec2(bp.x, 0.0)) >= 1.0 || czm_readDepth(depthTexture, uv - vec2(bp.x, 0.0)) >= 1.0 ||
          czm_readDepth(depthTexture, uv + vec2(0.0, bp.y)) >= 1.0 || czm_readDepth(depthTexture, uv - vec2(0.0, bp.y)) >= 1.0) rim = 1.0;
      float edge = max(step(edgeMeters, behind), rim);
      col = mix(col, vec3(0.078, 0.086, 0.122), edge * outline);
      out_FragColor = vec4(col, 1.0);
    }`;
  let headingRad = Cesium.Math.toRadians(315);
  const style = { enabled: 1.0, saturation: 1.35, contrast: 1.15, brightness: 0.04, shadeAmt: 1.0, dither: 0.0,
    outline: 1.0, edgeMeters: 4.0, usePalette: 1.0, heading: () => headingRad, pix: PIX };
  const stage = new Cesium.PostProcessStage({ fragmentShader: FS, uniforms: style });
  scene.postProcessStages.add(stage);

  // ------------------------------------------------------------------ isometric camera
  const PITCH = Cesium.Math.toRadians(-35.264);
  const SINP = Math.sin(-PITCH);
  const BOUNDS = { w: -78.75, e: -76.80, s: 37.85, n: 39.25 };
  const REGION_H = (lat) => (lat < 38.4 ? 140 : 70);       // rough ground height (m) for each island
  cam.switchToOrthographicFrustum();
  const st = { lat: 38.8895, lon: -77.0353, h: 15, heading: 315, width: 6000 };

  function apply() {
    st.lat = Math.min(BOUNDS.n, Math.max(BOUNDS.s, st.lat));
    st.lon = Math.min(BOUNDS.e, Math.max(BOUNDS.w, st.lon));
    st.width = Math.min(260000, Math.max(120, st.width));
    const range = Math.max(12000, st.width * 1.6);
    headingRad = Cesium.Math.toRadians(st.heading);
    cam.frustum.width = st.width;
    cam.frustum.near = Math.max(1, range - st.width * 2.5);
    cam.frustum.far = range + st.width * 3 + 2000;
    const target = Cesium.Cartesian3.fromDegrees(st.lon, st.lat, st.h);
    cam.lookAt(target, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(st.heading), PITCH, range));
    cam.lookAtTransform(Cesium.Matrix4.IDENTITY);
    // Cesium resets an orthographic width to the camera distance on lookAt; put ours back
    headingRad = Cesium.Math.toRadians(st.heading);
    cam.frustum.width = st.width;
    cam.frustum.near = Math.max(1, range - st.width * 2.5);
    cam.frustum.far = range + st.width * 3 + 2000;
    writeHash();
    labelsDirty = true;
    scene.requestRender();
  }

  // metres on the ground -> lat/lon change, in the camera's screen frame
  function moveScreen(dxPx, dyPx) {
    const mpp = st.width / canvas.clientWidth;
    const h = Cesium.Math.toRadians(st.heading);
    const right = [Math.cos(h), -Math.sin(h)];          // east, north of screen-right
    const fwd = [Math.sin(h), Math.cos(h)];             // east, north of screen-up
    const rx = dxPx * mpp, fy = (-dyPx * mpp) / SINP;
    const dE = right[0] * rx + fwd[0] * fy;
    const dN = right[1] * rx + fwd[1] * fy;
    st.lat += dN / 111320;
    st.lon += dE / (111320 * Math.cos(Cesium.Math.toRadians(st.lat)));
  }

  // --- smooth moves
  let anim = null;
  function animateTo(to, ms = 1100) {
    const from = { ...st };
    let dh = ((to.heading ?? from.heading) - from.heading + 540) % 360 - 180;
    const t0 = performance.now();
    anim = (now) => {
      let t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      st.lat = from.lat + ((to.lat ?? from.lat) - from.lat) * e;
      st.lon = from.lon + ((to.lon ?? from.lon) - from.lon) * e;
      st.h = from.h + ((to.h ?? from.h) - from.h) * e;
      st.width = Math.exp(Math.log(from.width) + (Math.log(to.width ?? from.width) - Math.log(from.width)) * e);
      st.heading = (from.heading + dh * e + 360) % 360;
      apply();
      if (t >= 1) anim = null;
    };
    scene.requestRender();
  }
  scene.preRender.addEventListener(() => {
    if (anim) { anim(performance.now()); if (anim) setTimeout(() => scene.requestRender(), 0); }
    if (Math.abs(cam.frustum.width - st.width) > 1e-3) cam.frustum.width = st.width;
  });

  // --- pointer: drag to pan, pinch / wheel to zoom about the cursor
  const ptrs = new Map();
  let pinch0 = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anim = null;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), w: st.width };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { moveScreen(-dx, -dy); applySoon(); }
    else if (ptrs.size === 2 && pinch0) {
      const [a, b] = [...ptrs.values()];
      st.width = pinch0.w * pinch0.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      applySoon();
    }
  });
  let applyQueued = false;   // many pointer events per frame -> one camera update
  function applySoon() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(() => { applyQueued = false; apply(); });
  }
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    anim = null;
    const f = Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0022);
    zoomAt(f, e.clientX, e.clientY);
  }, { passive: false });
  function zoomAt(f, cx, cy) {
    const r = canvas.getBoundingClientRect();
    const ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
    const w0 = st.width;
    const w1 = Math.min(260000, Math.max(120, w0 * f));
    const k = 1 - w1 / w0;              // keep the point under the cursor where it is
    moveScreen(ox * k, oy * k);
    st.width = w1;
    apply();
  }

  // --- keys
  window.addEventListener('keydown', (e) => {
    if (e.target === $('q')) return;
    const k = e.key;
    if (k === '/') { e.preventDefault(); $('q').focus(); return; }
    if (k === 'q' || k === 'Q') rotate(-90);
    else if (k === 'e' || k === 'E') rotate(90);
    else if (k === '+' || k === '=') animateTo({ width: st.width / 1.6 }, 300);
    else if (k === '-' || k === '_') animateTo({ width: st.width * 1.6 }, 300);
    else if (k === '[') setPix(PIX - 1);
    else if (k === ']') setPix(PIX + 1);
    else if (k === 'p' || k === 'P') toggleStyle();
    else if (k.startsWith('Arrow')) {
      const s = 140;
      moveScreen(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0);
      apply();
    } else if (k === '?') $('help').classList.toggle('on');
  });
  function rotate(deg) { animateTo({ heading: (st.heading + deg + 360) % 360 }, 600); }
  function toggleStyle() {
    style.enabled = style.enabled > 0.5 ? 0 : 1;
    setPix(style.enabled ? 3 : 1);
    scene.requestRender();
    $('styleBtn').textContent = 'Pixel art: ' + (style.enabled ? 'on' : 'off');
  }
  $('rotL').onclick = () => rotate(-90);
  $('rotR').onclick = () => rotate(90);
  $('styleBtn').onclick = toggleStyle;
  $('dcBtn').onclick = () => animateTo({ lat: 38.875, lon: -77.22, h: 60, width: 60000 }, 1400);
  $('uvaBtn').onclick = () => animateTo({ lat: 38.036, lon: -78.503, h: 150, width: 2400 }, 1400);

  // ------------------------------------------------------------------ hash (shareable view)
  let hashT = 0;
  function writeHash() {
    clearTimeout(hashT);
    hashT = setTimeout(() => {
      history.replaceState(null, '', `#${st.lat.toFixed(5)}/${st.lon.toFixed(5)}/${Math.round(st.width)}/${Math.round(st.heading)}`);
    }, 250);
  }
  function readHash() {
    const m = location.hash.slice(1).split('/').map(Number);
    if (m.length >= 3 && m.every((x) => Number.isFinite(x))) {
      st.lat = m[0]; st.lon = m[1]; st.width = m[2]; if (m.length > 3) st.heading = m[3];
      st.h = REGION_H(st.lat);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ ground height under a point
  async function groundAt(lat, lon) {
    try {
      const c = Cesium.Cartographic.fromDegrees(lon, lat);
      const [r] = await scene.sampleHeightMostDetailed([c], [], 1.0);
      if (r && Number.isFinite(r.height)) return r.height;
    } catch (e) { /* tiles not ready */ }
    return REGION_H(lat);
  }

  // ------------------------------------------------------------------ labels + pin
  const toWin = Cesium.SceneTransforms.worldToWindowCoordinates || Cesium.SceneTransforms.wgs84ToWindowCoordinates;
  const BIGT = new Set(['Washington', 'Arlington', 'Alexandria', 'Charlottesville', 'Reston', 'Tysons', 'Fairfax', 'Herndon', 'Ashburn', 'Vienna', 'Falls Church', 'McLean', 'Centreville', 'Chantilly', 'Sterling', 'Springfield', 'Annandale', 'Burke', 'Great Falls']);
  const towns = places.filter((p) => /^place=(city|town|village|suburb|neighbourhood|quarter|borough)$/.test(p[1]) && !/^Ward \d/.test(p[0]))
    .map((p) => ({ name: p[0], lat: p[2], lon: p[3], big: BIGT.has(p[0]) || /city|town/.test(p[1]) }));
  towns.sort((a, b) => (b.big - a.big));
  const layer = $('labels');
  const live = new Map();
  let labelsDirty = true;
  let pin = null;
  const scratch = new Cesium.Cartesian2();
  function updateLabels() {
    const w = st.width;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const taken = [];
    const want = new Set();
    for (const t of towns) {
      const show = t.big ? (w > 6000 && w < 150000) : (w > 3200 && w < 14000);
      if (!show) continue;
      const pos = Cesium.Cartesian3.fromDegrees(t.lon, t.lat, REGION_H(t.lat));
      const s = toWin(scene, pos, scratch);
      if (!s) continue;
      const fs = t.big ? 16 : 12;
      const bw = t.name.length * fs * 0.62 + 12, bh = fs + 10;
      const box = [s.x - bw / 2, s.y - bh / 2, s.x + bw / 2, s.y + bh / 2];
      if (box[0] < 4 || box[2] > W - 4 || box[1] < 70 || box[3] > H - 60) continue;
      if (taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      taken.push(box);
      const id = t.name + t.lat;
      want.add(id);
      let el = live.get(id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'lbl' + (t.big ? ' big' : '');
        el.textContent = t.name;
        el.style.opacity = '0';
        layer.appendChild(el);
        live.set(id, el);
        requestAnimationFrame(() => (el.style.opacity = '1'));
      }
      el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-50%)`;
    }
    for (const [id, el] of live) if (!want.has(id)) { el.remove(); live.delete(id); }
    if (pin) {
      const s = toWin(scene, pin.pos, scratch);
      if (s) pin.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
  scene.postRender.addEventListener(() => { if (labelsDirty) { labelsDirty = false; updateLabels(); } });
  window.addEventListener('resize', () => (labelsDirty = true));

  function setPin(name, lat, lon, h) {
    if (pin) pin.el.remove();
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = '<b></b><i></i>';
    el.querySelector('b').textContent = name;
    layer.appendChild(el);
    pin = { el, pos: Cesium.Cartesian3.fromDegrees(lon, lat, h) };
    labelsDirty = true;
  }

  async function goTo(name, lat, lon, size) {
    const width = Math.min(6000, Math.max(700, (size || 300) * 3.2));
    const h0 = REGION_H(lat);
    animateTo({ lat, lon, h: h0, width }, 1300);
    setPin(name, lat, lon, h0);
    const h = await groundAt(lat, lon);
    if (Math.abs(h - h0) > 3) { anim = null; animateTo({ lat, lon, h, width }, 400); setPin(name, lat, lon, h); }
  }
  window.isoGoTo = goTo;   // handy for scripted previews

  // ------------------------------------------------------------------ search
  const q = $('q'), res = $('results');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const idx = places.map((p) => norm(p[0]));
  const catLabel = (c) => {
    const [k, v] = c.split('=');
    if (k === 'place') return v;
    if (k === 'building') return 'building';
    return (v || k).replace(/_/g, ' ');
  };
  let sel = -1, hits = [];
  function search(text) {
    const t = norm(text.trim());
    if (t.length < 2) { res.classList.remove('on'); hits = []; return; }
    const out = [];
    for (let i = 0; i < places.length; i++) {
      const n = idx[i];
      let s = n === t ? 3 : n.startsWith(t) ? 2 : n.includes(t) ? 1 : 0;
      if (!s) continue;
      out.push([s * 1e6 + Math.min(places[i][4], 9999) + (places[i][1].startsWith('place=') ? 5000 : 0), i]);
    }
    for (const sp of spots) if (norm(sp.name).includes(t)) out.push([5e6, -1 - spots.indexOf(sp)]);
    out.sort((a, b) => b[0] - a[0]);
    hits = out.slice(0, 8).map((o) => o[1]);
    res.innerHTML = '';
    hits.forEach((i, j) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      const name = i < 0 ? spots[-1 - i].name : places[i][0];
      const cat = i < 0 ? 'your spot' : catLabel(places[i][1]);
      li.innerHTML = '<span></span><small></small>';
      li.firstChild.textContent = name;
      li.lastChild.textContent = cat;
      li.onclick = () => pick(j);
      res.appendChild(li);
    });
    sel = hits.length ? 0 : -1;
    markSel();
    res.classList.toggle('on', hits.length > 0);
  }
  function markSel() { [...res.children].forEach((li, j) => li.setAttribute('aria-selected', j === sel)); }
  function pick(j) {
    const i = hits[j];
    if (i === undefined) return;
    if (i < 0) { const sp = spots[-1 - i]; goTo(sp.name, sp.lat, sp.lon, sp.w ? 900 : 350); }
    else { const p = places[i]; goTo(p[0], p[2], p[3], p[4]); }
    res.classList.remove('on');
    q.blur();
  }
  q.addEventListener('input', () => search(q.value));
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); markSel(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); markSel(); e.preventDefault(); }
    else if (e.key === 'Enter') pick(Math.max(0, sel));
    else if (e.key === 'Escape') { res.classList.remove('on'); q.blur(); }
  });

  // ------------------------------------------------------------------ spots menu
  const spotsEl = $('spots');
  if (!spots.length) $('spotsBtn').style.display = 'none';
  spots.forEach((sp) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'menuitem');
    li.innerHTML = '<span></span><small></small>';
    li.firstChild.textContent = sp.name;
    li.lastChild.textContent = sp.lat < 38.4 ? 'UVA' : 'DC / NoVA';
    li.onclick = () => { spotsEl.classList.remove('on'); $('spotsBtn').setAttribute('aria-expanded', 'false'); goTo(sp.name, sp.lat, sp.lon, sp.w ? 900 : 350); };
    spotsEl.appendChild(li);
  });
  $('spotsBtn').onclick = () => {
    const on = !spotsEl.classList.contains('on');
    spotsEl.classList.toggle('on', on);
    res.classList.remove('on');
    $('spotsBtn').setAttribute('aria-expanded', String(on));
  };

  // ------------------------------------------------------------------ go
  if (!readHash()) st.h = 15;
  apply();
  $('help').classList.add('on');
  setTimeout(() => $('help').classList.remove('on'), 9000);
  window.iso = { viewer, st, apply, style, setPix, animateTo };
})();
