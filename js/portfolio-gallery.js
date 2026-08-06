import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'https://esm.sh/ogl@1.0.11';

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

function autoBind(instance) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });
}

function getFontSize(font) {
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1], 10) : 30;
}

function createTextTexture(gl, text, font = 'bold 30px monospace', color = 'black') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font;
  const metrics = context.measureText(text);
  const textWidth = Math.max(1, Math.ceil(metrics.width));
  const textHeight = Math.max(1, Math.ceil(getFontSize(font) * 1.2));
  canvas.width = textWidth + 20;
  canvas.height = textHeight + 20;
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

class Title {
  constructor({ gl, plane, text, textColor = '#545050', font = '30px sans-serif' }) {
    autoBind(this);
    this.gl = gl;
    this.plane = plane;
    this.text = text;
    this.textColor = textColor;
    this.font = font;
    this.createMesh();
  }

  createMesh() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geometry = new Plane(this.gl);
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        uniform float uFocus;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1 || uFocus < 0.55) discard;
          gl_FragColor = vec4(color.rgb, color.a * uFocus);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uFocus: { value: 0 }
      },
      transparent: true
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;
    this.mesh.setParent(this.plane);
  }

  setFocus(value) {
    this.mesh.program.uniforms.uFocus.value = value;
  }
}

class Media {
  constructor({
    geometry,
    gl,
    image,
    index,
    length,
    renderer,
    scene,
    screen,
    text,
    viewport,
    bend,
    textColor,
    borderRadius = 0,
    font
  }) {
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    this.index = index;
    this.length = length;
    this.renderer = renderer;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor;
    this.borderRadius = borderRadius;
    this.font = font;
    this.focus = 0;
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + abs(uSpeed) * 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        uniform float uFocus;
        varying vec2 vUv;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          vec3 dimmed = mix(vec3(gray), color.rgb, 0.34) * 0.58;
          vec3 lit = color.rgb * vec3(1.12, 1.1, 1.04);
          vec3 finalColor = mix(dimmed, lit, smoothstep(0.08, 0.92, uFocus));
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float alpha = 1.0 - smoothstep(-0.002, 0.002, d);
          gl_FragColor = vec4(finalColor, alpha * mix(0.76, 1.0, uFocus));
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [1, 1] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius },
        uFocus: { value: 0 }
      },
      transparent: true
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }

  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program
    });
    this.plane.setParent(this.scene);
  }

  createTitle() {
    this.title = new Title({
      gl: this.gl,
      plane: this.plane,
      renderer: this.renderer,
      text: this.text,
      textColor: this.textColor,
      font: this.font
    });
  }

  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;
    const bend = this.activeBend ?? this.bend;

    if (bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B_abs = Math.abs(bend);
      const R = (H * H + B_abs * B_abs) / (2 * B_abs);
      const effectiveX = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      if (bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
      }
    }

    this.speed = scroll.current - scroll.last;
    this.focus = Math.max(0, 1 - Math.abs(x) / Math.max(this.width * 1.2, 0.001));
    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = this.speed;
    this.program.uniforms.uFocus.value = this.focus;
    this.title.setFocus(this.focus);

    this.isBefore = this.isAfter = false;
  }

  onResize({ screen, viewport } = {}) {
    if (screen) this.screen = screen;
    if (viewport) this.viewport = viewport;
    this.scale = this.screen.height / 1500;
    const compact = this.screen.width <= 760;
    this.activeBend = compact ? this.bend * 0.42 : this.bend;
    const planeHeight = compact ? 1000 : 940;
    const planeWidth = compact ? 830 : 775;
    this.plane.scale.y = (this.viewport.height * (planeHeight * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width * (planeWidth * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding = compact ? 2.6 : 2;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

class CircularGalleryApp {
  constructor(
    container,
    {
      items,
      bend,
      textColor = '#ffffff',
      borderRadius = 0,
      font = 'bold 30px Arial',
      scrollSpeed = 2,
      scrollEase = 0.05,
      onActiveChange
    } = {}
  ) {
    this.container = container;
    this.items = items || [];
    this.scrollSpeed = scrollSpeed;
    this.onActiveChange = onActiveChange;
    this.activeIndex = -1;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this.onCheck, 200);
    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias(items, bend, textColor, borderRadius, font);
    this.currentSlot = this.items.length * this.middleCopy;
    this.setScrollToCurrentSlot();
    this.update();
    this.addEventListeners();
  }

  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }

  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }

  createScene() {
    this.scene = new Transform();
  }

  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 50,
      widthSegments: 100
    });
  }

  createMedias(items, bend = 1, textColor, borderRadius, font) {
    const galleryItems = items && items.length ? items : [];
    this.copyCount = 9;
    this.middleCopy = Math.floor(this.copyCount / 2);
    this.mediasImages = Array.from({ length: this.copyCount }, () => galleryItems).flat();
    this.medias = this.mediasImages.map((data, index) => {
      return new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image: data.image,
        index,
        length: this.mediasImages.length,
        renderer: this.renderer,
        scene: this.scene,
        screen: this.screen,
        text: data.text,
        viewport: this.viewport,
        bend,
        textColor,
        borderRadius,
        font
      });
    });
  }

  getItemWidth() {
    return this.medias?.[0]?.width || 1;
  }

  goTo(index) {
    const total = this.items.length;
    if (!total) return;
    this.keepSlotInRange();
    this.currentSlot = index;
    this.scroll.target = this.getItemWidth() * this.currentSlot;
    this.onCheckDebounce();
  }

  next() {
    this.keepSlotInRange();
    this.goTo(this.currentSlot + 1);
  }

  previous() {
    this.keepSlotInRange();
    this.goTo(this.currentSlot - 1);
  }

  getCurrentIndex() {
    const total = this.items.length || 1;
    const width = this.getItemWidth();
    return ((Math.round(Math.abs(this.scroll.target) / width) % total) + total) % total;
  }

  normalizeSlot() {
    const total = this.items.length;
    const width = this.getItemWidth();
    if (!total || !width) return;
    const middleStart = total * this.middleCopy;
    const current = Math.round(this.scroll.target / width);
    const minSafeSlot = total * 2;
    const maxSafeSlot = total * (this.copyCount - 2) - 1;
    if (current >= minSafeSlot && current <= maxSafeSlot) return;
    const normalized = ((current % total) + total) % total;
    const centeredSlot = middleStart + normalized;
    const offset = (centeredSlot - current) * width;
    this.currentSlot = centeredSlot;
    this.scroll.current += offset;
    this.scroll.target += offset;
    this.scroll.last += offset;
  }

  keepSlotInRange() {
    const total = this.items.length;
    const width = this.getItemWidth();
    if (!total || !width || this.currentSlot === undefined) return;
    const minSafeSlot = total * 2;
    const maxSafeSlot = total * (this.copyCount - 2) - 1;
    if (this.currentSlot >= minSafeSlot && this.currentSlot <= maxSafeSlot) return;

    const middleStart = total * this.middleCopy;
    const normalized = ((this.currentSlot % total) + total) % total;
    const centeredSlot = middleStart + normalized;
    const offset = (centeredSlot - this.currentSlot) * width;
    this.currentSlot = centeredSlot;
    this.scroll.current += offset;
    this.scroll.target += offset;
    this.scroll.last += offset;
  }

  setScrollToCurrentSlot() {
    const width = this.getItemWidth();
    this.scroll.current = this.scroll.target = this.scroll.last = this.currentSlot * width;
  }

  findMediaAtPoint(clientX, clientY) {
    if (!this.medias?.length || !this.viewport) return null;
    const rect = this.container.getBoundingClientRect();
    const localY = clientY - rect.top;
    if (localY < 0 || localY > rect.height) return null;

    let closest = null;
    let closestDistance = Infinity;

    this.medias.forEach((media) => {
      const screenX = rect.left + rect.width / 2 + (media.plane.position.x / this.viewport.width) * rect.width;
      const screenY = rect.top + rect.height / 2 - (media.plane.position.y / this.viewport.height) * rect.height;
      const mediaWidth = (media.plane.scale.x / this.viewport.width) * rect.width;
      const mediaHeight = (media.plane.scale.y / this.viewport.height) * rect.height;
      const dx = Math.abs(clientX - screenX);
      const dy = Math.abs(clientY - screenY);

      if (dx <= mediaWidth * 0.58 && dy <= mediaHeight * 0.62 && dx < closestDistance) {
        closest = media;
        closestDistance = dx;
      }
    });

    return closest;
  }

  onTouchDown(e) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = e.touches ? e.touches[0].clientX : e.clientX;
    this.pointerStart = {
      x: e.touches ? e.touches[0].clientX : e.clientX,
      y: e.touches ? e.touches[0].clientY : e.clientY
    };
  }

  onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
  }

  onTouchUp(e) {
    const point = this.pointerStart;
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const moved = point ? Math.hypot(endX - point.x, endY - point.y) : 0;
    this.isDown = false;
    if (point && moved < 8) {
      const media = this.findMediaAtPoint(endX, endY);
      if (media) {
        this.goTo(media.index);
        this.pointerStart = null;
        return;
      }
    }
    this.pointerStart = null;
    this.onCheck();
  }

  onWheel(e) {
    if (!this.container.contains(e.target)) return;
    const delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  }

  onKeyDown(e) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.previous();
        break;
      case 'Home':
        e.preventDefault();
        this.goTo(0);
        break;
      default:
        break;
    }
  }

  onCheck() {
    if (!this.medias || !this.medias[0]) return;
    const width = this.medias[0].width;
    const itemIndex = Math.round(this.scroll.target / width);
    this.currentSlot = itemIndex;
    this.scroll.target = width * itemIndex;
    this.normalizeSlot();
  }

  onResize() {
    this.screen = {
      width: this.container.clientWidth,
      height: this.container.clientHeight
    };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({
      aspect: this.screen.width / this.screen.height
    });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) {
      this.medias.forEach((media) => media.onResize({ screen: this.screen, viewport: this.viewport }));
      if (this.currentSlot !== undefined) {
        this.setScrollToCurrentSlot();
      }
    }
  }

  updateActiveProject() {
    const current = this.getCurrentIndex();
    if (current === this.activeIndex) return;
    this.activeIndex = current;
    this.onActiveChange?.(this.items[current], current);
  }

  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll, direction));
    }
    this.updateActiveProject();
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update.bind(this));
  }

  addEventListeners() {
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);

    window.addEventListener('resize', this.boundOnResize);
    window.addEventListener('wheel', this.boundOnWheel, { passive: true });
    this.container.addEventListener('mousedown', this.boundOnTouchDown);
    window.addEventListener('mousemove', this.boundOnTouchMove);
    window.addEventListener('mouseup', this.boundOnTouchUp);
    this.container.addEventListener('touchstart', this.boundOnTouchDown, { passive: true });
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true });
    window.addEventListener('touchend', this.boundOnTouchUp);
    this.container.addEventListener('keydown', this.boundOnKeyDown);
  }

  destroy() {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundOnResize);
    window.removeEventListener('wheel', this.boundOnWheel);
    this.container.removeEventListener('mousedown', this.boundOnTouchDown);
    window.removeEventListener('mousemove', this.boundOnTouchMove);
    window.removeEventListener('mouseup', this.boundOnTouchUp);
    this.container.removeEventListener('touchstart', this.boundOnTouchDown);
    window.removeEventListener('touchmove', this.boundOnTouchMove);
    window.removeEventListener('touchend', this.boundOnTouchUp);
    this.container.removeEventListener('keydown', this.boundOnKeyDown);
    this.renderer?.gl?.canvas?.parentNode?.removeChild(this.renderer.gl.canvas);
  }
}

const fallbackProjects = [
  {
    name: 'MixIndex',
    intro: '以连续动效串联身份、兴趣、博客与旅行的混合风格个人主页。',
    image: 'images/portfolio/project-mixindex.png',
    href: '#stage',
    text: ''
  },
  {
    name: 'WBlog',
    intro: '记录大模型架构、训练方法与学习过程的个人技术博客。',
    image: 'images/blog/blog-preview.png',
    href: 'https://blog.wpixiu.cn/',
    text: ''
  },
  {
    name: 'Asri-w',
    intro: '为思源笔记补充导出封面、标题图标与 macOS 风格代码块。',
    image: 'images/portfolio/project-asri-w.png',
    href: 'https://github.com/libertysea/Asri-w',
    text: ''
  },
  {
    name: '炒股日记',
    intro: '记录缅 A 学习、交易思考与盘后复盘的长期投资笔记。',
    image: 'images/portfolio/project-stock-diary.png',
    href: '#daily',
    text: ''
  },
  {
    name: 'Stanford CS336',
    intro: '从零实现 Stanford CS336 语言模型训练的核心环节。',
    image: 'images/portfolio/project-cs336.png',
    href: 'https://github.com/libertysea/Stanford-CS336',
    text: ''
  }
];

const projects = Array.isArray(window.SITE_CONFIG?.portfolio?.projects) && window.SITE_CONFIG.portfolio.projects.length
  ? window.SITE_CONFIG.portfolio.projects.map((project) => ({ ...project, text: project.text || '' }))
  : fallbackProjects;

const section = document.getElementById('projects');
const root = document.getElementById('portfolio-gallery');
const nameEl = document.querySelector('[data-project-name]');
const introEl = document.querySelector('[data-project-intro]');
const visitEl = document.querySelector('[data-project-visit]');
const prevButton = document.querySelector('[data-project-prev]');
const nextButton = document.querySelector('[data-project-next]');

if (section && root && nameEl && introEl && visitEl) {
  const renderProject = (project) => {
    nameEl.textContent = project.name;
    introEl.textContent = project.intro;
    visitEl.href = project.href;
    visitEl.target = '_blank';
    visitEl.rel = 'noopener noreferrer';
  };

  renderProject(projects[0]);

  const app = new CircularGalleryApp(root, {
    items: projects,
    bend: 2.6,
    textColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 0.045,
    font: 'bold 1px Arial',
    scrollSpeed: 2,
    scrollEase: 0.055,
    onActiveChange: renderProject
  });

  prevButton?.addEventListener('click', () => app.previous());
  nextButton?.addEventListener('click', () => app.next());

  section.addEventListener('pointermove', (event) => {
    const rect = section.getBoundingClientRect();
    section.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    section.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  }, { passive: true });
}
