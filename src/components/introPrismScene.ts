import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// イントロ演出のWebGLシーン。
// クリスタルの三角プリズム（MR刻印）が加速回転し、砕けて星屑になって消える。
// three.js はこのモジュールごと動的importされ、初回表示時のみロードされる。

const SPIN_END = 2.7 // 回転フェーズ終了（ここで砕ける）
const FADE_START = 3.6 // フェードアウト開始
const TOTAL = 4.6 // 全体の長さ
const TURNS = 3 // 回転数

// ---- テクスチャ生成（外部アセットなしで完結させる） ----

// 「MR」の刻印。ガラス越しに光る白銀の文字
function makeLabelTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 288
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 168px Georgia, "Times New Roman", serif'
  // 外側のにじみ（ガラス内で光が回っている感じ）
  ctx.shadowColor = 'rgba(190, 215, 255, 0.9)'
  ctx.shadowBlur = 26
  const grad = ctx.createLinearGradient(0, 40, 0, 250)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.5, '#dbe8ff')
  grad.addColorStop(1, '#9db8e8')
  ctx.fillStyle = grad
  ctx.fillText('MR', 256, 150)
  // エッジのハイライトで彫り込み感を出す
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 3
  ctx.strokeText('MR', 256, 150)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// 柔らかい光芒＋4条のスパイク（星屑・レンズフレア用）
function makeStarTexture(): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  const half = s / 2
  const core = ctx.createRadialGradient(half, half, 0, half, half, half)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.18, 'rgba(255,255,255,0.85)')
  core.addColorStop(0.45, 'rgba(200,220,255,0.22)')
  core.addColorStop(1, 'rgba(200,220,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, s, s)
  // 十字のスパイク
  ctx.globalCompositeOperation = 'lighter'
  for (const rot of [0, Math.PI / 2]) {
    ctx.save()
    ctx.translate(half, half)
    ctx.rotate(rot)
    const spike = ctx.createLinearGradient(-half, 0, half, 0)
    spike.addColorStop(0, 'rgba(255,255,255,0)')
    spike.addColorStop(0.5, 'rgba(255,255,255,0.9)')
    spike.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = spike
    ctx.fillRect(-half, -2.2, s, 4.4)
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 床にたまる光だまり（放射グラデーション）
function makeGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---- 破片パーティクル（GPUで軌道・きらめきを計算） ----

const PARTICLE_COUNT = 1100

function makeBurstPoints(starTex: THREE.Texture): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const pos = new Float32Array(PARTICLE_COUNT * 3)
  const vel = new Float32Array(PARTICLE_COUNT * 3)
  const col = new Float32Array(PARTICLE_COUNT * 3)
  const size = new Float32Array(PARTICLE_COUNT)
  const phase = new Float32Array(PARTICLE_COUNT)
  // 白銀を基調に、青・金・虹色を少し混ぜる（参考画像の星屑の色味）
  const palette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#cfe0ff'),
    new THREE.Color('#9ec5ff'),
    new THREE.Color('#ffd9a0'),
    new THREE.Color('#e8c8ff'),
  ]
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // プリズム（円錐）内部からサンプリング
    const h = Math.random() // 0=底面 1=頂点
    const r = (1 - h) * 1.05 * Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    const x = Math.cos(a) * r
    const y = h * 1.6 - 0.8
    const z = Math.sin(a) * r
    pos.set([x, y, z], i * 3)
    // 外向き＋ランダム。少し上に吹き上がってから落ちる
    const dir = new THREE.Vector3(x, 0.25 + Math.random() * 0.55, z).normalize()
    const speed = 0.9 + Math.random() * 2.6
    vel.set([dir.x * speed, dir.y * speed, dir.z * speed], i * 3)
    const c = palette[(Math.random() * palette.length) | 0]
    col.set([c.r, c.g, c.b], i * 3)
    size[i] = 0.35 + Math.random() * 1.15
    phase[i] = Math.random() * Math.PI * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uMap: { value: starTex } },
    vertexShader: /* glsl */ `
      uniform float uT;
      attribute vec3 aVel;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        // 減衰しつつ飛び、重力でゆっくり落ちる
        float damp = 1.0 - exp(-uT * 1.6);
        vec3 p = position + aVel * damp * 1.2 + vec3(0.0, -0.55, 0.0) * uT * uT;
        float life = clamp(uT / 1.8, 0.0, 1.0);
        float twinkle = 0.55 + 0.45 * sin(uT * 12.0 + aPhase);
        vColor = aColor;
        vAlpha = twinkle * (1.0 - life * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (36.0 + life * 14.0) / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, material)
  points.visible = false
  points.frustumCulled = false
  return { points, material }
}

// ---- メイン ----

export function mountIntroScene(container: HTMLDivElement, onDone: () => void): () => void {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  } catch {
    onDone() // WebGL不可ならスキップ
    return () => {}
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor('#04050a')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 50)
  camera.position.set(0, 1.05, 4.9)
  camera.lookAt(0, 0.05, 0)

  // スタジオ環境マップ（ファセットの映り込みの源）
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex

  // ライティング：強めのキーライト＋暖色/寒色のアクセント（虹色の火花を誘発）
  const key = new THREE.DirectionalLight('#ffffff', 1.4)
  key.position.set(2.5, 4, 2)
  scene.add(key)
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5)
  fill.position.set(0, 1, 5)
  scene.add(fill)
  const warm = new THREE.PointLight('#ffc978', 10, 12)
  warm.position.set(-2.2, 0.4, 1.6)
  scene.add(warm)
  const cool = new THREE.PointLight('#7fb4ff', 8, 12)
  cool.position.set(2.4, 1.8, -1.4)
  scene.add(cool)

  const labelTex = makeLabelTexture()
  const starTex = makeStarTexture()

  // ---- プリズム本体 ----
  const prism = new THREE.Group()
  scene.add(prism)

  // 外殻：分光する無色クリスタル。面がカメラ正面（+z）を向くよう回しておく
  const glassGeo = new THREE.ConeGeometry(1.25, 1.6, 3, 1)
  glassGeo.rotateY(-Math.PI / 3)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 1,
    thickness: 1.2,
    attenuationColor: '#dfeaff',
    attenuationDistance: 2.5,
    roughness: 0.03,
    metalness: 0,
    ior: 2.3,
    dispersion: 6, // プリズムらしい虹の分光
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    specularIntensity: 1,
    envMapIntensity: 1.2,
    flatShading: true,
  })
  const glass = new THREE.Mesh(glassGeo, glassMat)
  prism.add(glass)

  // ファセットの稜線を光らせる（カットガラスのエッジ）
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassGeo),
    new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  prism.add(edges)

  // 内側のファセット：虹色の玉虫反射でガラス内部のきらめきを作る
  const innerGeo = new THREE.ConeGeometry(0.82, 1.06, 3, 1)
  innerGeo.rotateY(-Math.PI / 3)
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: '#8fa3c8',
    metalness: 0.9,
    roughness: 0.22,
    iridescence: 1,
    iridescenceIOR: 1.9,
    envMapIntensity: 0.7,
    flatShading: true,
  })
  const inner = new THREE.Mesh(innerGeo, innerMat)
  inner.position.y = -0.18
  prism.add(inner)

  // 頂点で瞬くレンズフレア（回転に合わせて光を拾ったように見せる）
  const glintDefs = [
    { pos: new THREE.Vector3(0, 0.8, 0), scale: 0.85 },
    { pos: new THREE.Vector3(-1.08, -0.8, 0.62), scale: 0.6 },
    { pos: new THREE.Vector3(1.08, -0.8, 0.62), scale: 0.6 },
    { pos: new THREE.Vector3(0, -0.8, -1.25), scale: 0.55 },
    { pos: new THREE.Vector3(0.54, 0, 0.31), scale: 0.45 },
    { pos: new THREE.Vector3(-0.54, 0, 0.31), scale: 0.45 },
  ]
  const glints = glintDefs.map((def, i) => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      })
    )
    sp.position.copy(def.pos)
    sp.scale.setScalar(def.scale)
    sp.userData = { phase: i * 1.7, base: def.scale }
    prism.add(sp)
    return sp
  })

  // 「MR」刻印。正面ファセットの内側（内殻より手前）に浮かべる。
  // alphaTestで不透過扱いにして、透過ガラス越しにも見えるようにする
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTex,
    alphaTest: 0.06,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.6), labelMat)
  label.position.set(0, -0.28, 0.5)
  prism.add(label)

  // ---- 床の光だまり＆分光のかけら ----
  const groundGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture('rgba(150,185,255,0.34)', 'rgba(150,185,255,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  groundGlow.rotation.x = -Math.PI / 2
  groundGlow.position.y = -0.86
  scene.add(groundGlow)

  const causticColors = ['rgba(255,120,170,0.5)', 'rgba(120,190,255,0.5)', 'rgba(255,210,130,0.5)']
  const caustics: THREE.Mesh[] = causticColors.map((color, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture(color, color.replace(/0\.5\)$/, '0)')),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    m.rotation.x = -Math.PI / 2
    const a = (i / causticColors.length) * Math.PI * 2 + 0.6
    m.position.set(Math.cos(a) * 1.7, -0.85, Math.sin(a) * 1.2)
    scene.add(m)
    return m
  })

  // ---- 周囲を漂う塵（回転中のきらめき） ----
  const dustCount = 90
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 1.7 + Math.random() * 2.2
    dustPos.set([Math.cos(a) * r, -0.6 + Math.random() * 2.2, Math.sin(a) * r - 0.4], i * 3)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = new THREE.PointsMaterial({
    map: starTex,
    size: 0.07,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: '#cfe0ff',
    opacity: 0.8,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  scene.add(dust)

  // ---- 破裂：星屑パーティクル＋閃光 ----
  const { points: burst, material: burstMat } = makeBurstPoints(starTex)
  scene.add(burst)

  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    })
  )
  flash.position.y = 0
  flash.scale.setScalar(0.1)
  scene.add(flash)

  // ---- アニメーションループ ----
  // 実時間ではなくクランプ付きデルタの累積で進める。
  // 初回フレームのシェーダーコンパイル等でカクついても演出が飛ばない。
  let t = 0
  let last = performance.now()
  let burstAt = -1
  let finished = false
  let raf = 0

  const easeInCubic = (x: number) => x * x * x

  function finish() {
    if (finished) return
    finished = true
    onDone()
  }

  function animate() {
    raf = requestAnimationFrame(animate)
    const now = performance.now()
    t += Math.min((now - last) / 1000, 1 / 20)
    last = now

    if (t < SPIN_END) {
      // 登場（ふわっと拡大）＋ 加速回転
      const appear = Math.min(t / 0.5, 1)
      const s = 0.65 + 0.35 * (1 - Math.pow(1 - appear, 3))
      prism.scale.setScalar(s)
      prism.rotation.y = easeInCubic(t / SPIN_END) * Math.PI * 2 * TURNS
      prism.position.y = 0.05 + Math.sin(t * 1.8) * 0.04 // わずかに浮遊
      groundGlow.material.opacity = 0.75 + Math.sin(t * 3.2) * 0.25
      // 面が光を拾った瞬間のきらめき
      for (const g of glints) {
        const tw = Math.pow(Math.max(0, Math.sin(prism.rotation.y * 3 + g.userData.phase)), 6)
        ;(g.material as THREE.SpriteMaterial).opacity = tw * 0.9
        g.scale.setScalar(g.userData.base * (0.7 + tw * 0.6))
      }
    } else {
      if (burstAt < 0) {
        // 砕ける瞬間：プリズムを消して星屑と閃光に切り替え
        burstAt = t
        prism.visible = false
        burst.visible = true
        flash.material.opacity = 1
      }
      const bt = t - burstAt
      burstMat.uniforms.uT.value = bt
      flash.scale.setScalar(0.1 + Math.min(bt / 0.45, 1) * 7)
      flash.material.opacity = Math.max(0, 1 - bt / 0.5)
      groundGlow.material.opacity = Math.max(0, 1 - bt / 1.6)
    }

    dust.rotation.y = t * 0.05
    const dustTwinkle = 0.5 + 0.5 * Math.sin(t * 5)
    dustMat.opacity = (t < SPIN_END ? 0.8 : Math.max(0, 0.8 - (t - SPIN_END))) * (0.6 + 0.4 * dustTwinkle)
    caustics.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = (t < SPIN_END ? 1 : Math.max(0, 1 - (t - SPIN_END))) * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 2.1))
    })

    if (t > FADE_START) {
      container.style.opacity = String(Math.max(0, 1 - (t - FADE_START) / (TOTAL - FADE_START)))
    }
    if (t > TOTAL) {
      finish()
      return
    }
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(animate)

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // ---- 後始末（スキップ時・終了時共通） ----
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m?.dispose())
      }
    })
    labelTex.dispose()
    starTex.dispose()
    envTex.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}
