precision highp float;

uniform sampler2D u_background;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_isDark;
uniform vec2 u_mouse;
uniform float u_mouseInfluence;

varying vec2 v_texCoord;

// Simplex noise for surface perturbation
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Calculate surface normal from procedural height map with mouse interaction
vec3 calculateNormal(vec2 uv, float time, vec2 mouse, float influence) {
  float scale = 6.5;
  float speed = 0.35;

  // Mouse distance influence
  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);
  float mouseWave = sin(mouseDist * 25.0 - time * 4.0) * 0.5 + 0.5;
  float mouseEffect = exp(-mouseDist * 3.5) * influence * mouseWave;

  // Multi-octave noise for liquid glass turbulence
  float h = snoise(uv * scale + time * speed) * 0.6;
  h += snoise(uv * scale * 2.3 + time * speed * 1.4) * 0.3;
  h += snoise(uv * scale * 4.7 + time * speed * 2.1) * 0.1;
  h += mouseEffect * 2.5;

  float hx = snoise((uv + vec2(0.008, 0.0)) * scale + time * speed) * 0.6;
  hx += snoise((uv + vec2(0.008, 0.0)) * scale * 2.3 + time * speed * 1.4) * 0.3;
  hx += mouseEffect * 2.5;

  float hy = snoise((uv + vec2(0.0, 0.008)) * scale + time * speed) * 0.6;
  hy += snoise((uv + vec2(0.0, 0.008)) * scale * 2.3 + time * speed * 1.4) * 0.3;
  hy += mouseEffect * 2.5;

  // Enhanced gradient for liquid glass
  vec2 gradient = vec2(hx - h, hy - h) * 120.0;

  // Add mouse directional influence
  gradient += toMouse * mouseEffect * 45.0;

  return normalize(vec3(-gradient.x, -gradient.y, 1.0));
}

// Fresnel effect - more reflection at grazing angles
float fresnel(vec3 normal, vec3 viewDir, float ior) {
  float cosTheta = abs(dot(normal, viewDir));
  float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}

// Refract ray through glass interface
vec2 refractRay(vec3 normal, vec3 incident, float eta) {
  vec3 refracted = refract(incident, normal, eta);
  return refracted.xy * 1.2; // WATER BUBBLE refraction displacement
}

void main() {
  vec2 uv = v_texCoord;
  vec2 pixelSize = 1.0 / u_resolution;

  // View direction (looking down Z axis)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Calculate surface normal from procedural noise with mouse interaction
  vec3 normal = calculateNormal(uv, u_time, u_mouse, u_mouseInfluence);

  // Index of refraction (liquid glass water bubble = 1.45 for enhanced effect)
  float iorGlass = 1.45;
  float eta = 1.0 / iorGlass;

  // Calculate incident ray
  vec3 incident = -viewDir;

  // REFRACTION: Bend light based on surface normal and IOR
  vec2 refraction = refractRay(normal, incident, eta);
  vec2 refractedUV = uv + refraction;

  // FRESNEL: Calculate reflection amount based on viewing angle
  float fresnelFactor = fresnel(normal, viewDir, iorGlass);

  // Edge detection for interface boundaries - Creates bubble-like distortion at edges
  float edgeTop = smoothstep(0.0, 0.08, uv.y);
  float edgeBottom = smoothstep(1.0, 0.92, uv.y);
  float edgeLeft = smoothstep(0.0, 0.06, uv.x);
  float edgeRight = smoothstep(1.0, 0.94, uv.x);
  float edgeMask = edgeTop * edgeBottom * edgeLeft * edgeRight;

  // MASSIVE refraction at edges (where water bubble bends light most)
  float edgeRefraction = (1.0 - edgeMask) * 0.75;
  refractedUV += normal.xy * edgeRefraction;

  // Mouse proximity enhances local distortion
  vec2 toMouse = uv - u_mouse;
  float mouseDist = length(toMouse);
  float mouseDistortion = exp(-mouseDist * 4.0) * u_mouseInfluence * 0.12;
  refractedUV += toMouse * mouseDistortion;

  // ENHANCED CHROMATIC DISPERSION: Separate RGB channels like real glass prism
  float baseDispersion = 0.018;
  float dynamicDispersion = baseDispersion + mouseDistortion * 0.8;

  // Angular dispersion based on normal
  vec2 disperseDir = normal.xy;

  // Sample each color channel at different positions
  float r = texture2D(u_background, refractedUV + disperseDir * dynamicDispersion * 1.5).r;
  float g = texture2D(u_background, refractedUV).g;
  float b = texture2D(u_background, refractedUV - disperseDir * dynamicDispersion * 1.5).b;

  // Add secondary dispersion for more rainbow effect
  r += texture2D(u_background, refractedUV + vec2(disperseDir.y, -disperseDir.x) * dynamicDispersion * 0.8).r * 0.2;
  b += texture2D(u_background, refractedUV - vec2(disperseDir.y, -disperseDir.x) * dynamicDispersion * 0.8).b * 0.2;

  vec3 refractedColor = vec3(r, g, b);

  // REFLECTION: Sample for reflection component with subtle offset
  vec2 reflectUV = uv - normal.xy * 0.2;
  vec3 reflectedColor = texture2D(u_background, reflectUV).rgb;

  // Mix refraction and reflection based on Fresnel
  vec3 color = mix(refractedColor, reflectedColor, fresnelFactor * 0.4);

  // Add subtle iridescence (like soap bubble)
  float iridescence = sin(normal.x * 30.0 + u_time) * 0.5 + 0.5;
  iridescence *= sin(normal.y * 30.0 + u_time * 1.3) * 0.5 + 0.5;
  color += vec3(
    sin(iridescence * 6.28 + 0.0) * 0.03,
    sin(iridescence * 6.28 + 2.09) * 0.03,
    sin(iridescence * 6.28 + 4.18) * 0.03
  ) * (1.0 - edgeMask) * 0.6;

  // Theme adjustment - brightness and saturation
  if (u_isDark == 1) {
    color *= 1.05;
    color = mix(color, color * color, 0.1); // slight saturation boost
  } else {
    color *= 1.18;
    color = mix(color, color * color, 0.15);
  }

  // Edge highlight for glass rim effect
  float rimLight = (1.0 - edgeMask) * 0.15;
  color += vec3(rimLight);

  gl_FragColor = vec4(color, 1.0);
}
