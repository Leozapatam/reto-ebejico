import * as THREE from 'three';
import { Track } from '@core/track';
import { GameSnapshot } from '@core/types';

export type Camera3DMode = 'fixed_iso' | 'dynamic_iso';

export class ThreeGameRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Por defecto: Isométrica Fija Norte (Maqueta / Diorama tipo Imagen 2)
  public cameraMode: Camera3DMode = 'fixed_iso';

  private cartGroup: THREE.Group;
  private frontAxleGroup!: THREE.Group;
  private bearings: THREE.Mesh[] = [];
  private roadGroup: THREE.Group;
  private bridgeGroup: THREE.Group;
  private sceneryGroup: THREE.Group;
  private terrainGroup: THREE.Group;
  private cloudGroup: THREE.Group;
  private sparkPoints!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkVelocities: { x: number; y: number; z: number; life: number }[] = [];

  private smoothCamPos: THREE.Vector3 = new THREE.Vector3(2160, 2220, 2160);
  private smoothTarget: THREE.Vector3 = new THREE.Vector3(1975, 2010, 1975);
  private trackBuilt: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.container = canvas.parentElement || document.body;

    // 1. Escena con cielo andino brillante y diorama diurno vibrante
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7AC7E7'); // Azul cielo brillante de montaña antioqueña
    this.scene.fog = new THREE.FogExp2('#A7DAEB', 0.00014); // Niebla atmosférica suave de cordillera

    // 2. Cámara isométrica diorama (34° FOV para proyección axonométrica nítida)
    this.camera = new THREE.PerspectiveCamera(
      34,
      window.innerWidth / window.innerHeight,
      1,
      45000
    );

    // 3. Renderizador WebGL con sombras suaves y nítidas
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Iluminación solar vibrante: luz cenital cálida que resalta los bordes y barrancos
    const hemiLight = new THREE.HemisphereLight('#FFF6E5', '#5D4037', 0.85);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight('#E3F2FD', 0.65);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#FFF9E6', 1.85);
    sunLight.position.set(800, 2400, 1000);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 7000;
    const d = 1800;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // Luz de rebote para caídas y cañones
    const bounceLight = new THREE.DirectionalLight('#80CBC4', 0.4);
    bounceLight.position.set(-600, -200, -700);
    this.scene.add(bounceLight);

    // 5. Grupos de la maqueta
    this.roadGroup = new THREE.Group();
    this.bridgeGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.terrainGroup = new THREE.Group();
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);
    this.scene.add(this.cloudGroup);
    this.scene.add(this.roadGroup);
    this.scene.add(this.bridgeGroup);
    this.scene.add(this.sceneryGroup);

    // 6. Carro de Rodillos tradicional
    this.cartGroup = this.buildCarritoDeRodillos();
    this.scene.add(this.cartGroup);

    // 7. Sistema de chispas y fricción de las balineras
    this.buildSparkParticles();

    // 8. Nubes voxel en el cielo
    this.buildVoxelClouds();

    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  toggleCameraMode(): Camera3DMode {
    this.cameraMode = this.cameraMode === 'fixed_iso' ? 'dynamic_iso' : 'fixed_iso';
    return this.cameraMode;
  }

  /**
   * Construye el Carro de Rodillos tradicional de Ebéjico con acabados estilizados diorama:
   * Chasis de tablones de cedro, 4 balineras de acero pulido giratorias,
   * timón de lazo móvil, palanca de freno con taco de llanta y piloto con casco.
   */
  private buildCarritoDeRodillos(): THREE.Group {
    const root = new THREE.Group();

    const woodPlankMat = new THREE.MeshStandardMaterial({
      color: '#B56529', // Cedro cálido
      roughness: 0.6,
      flatShading: true,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: '#6E3411', // Roble oscuro
      roughness: 0.75,
      flatShading: true,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#F5F5F5', // Acero reluciente de balinera
      metalness: 0.95,
      roughness: 0.12,
      flatShading: true,
    });
    const hubMat = new THREE.MeshStandardMaterial({
      color: '#212121', // Núcleo oscuro de la balinera
      roughness: 0.5,
      flatShading: true,
    });
    const jerseyMat = new THREE.MeshStandardMaterial({
      color: '#E53935', // Rojo institucional de Ebéjico
      roughness: 0.5,
      flatShading: true,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF', // Casco blanco de seguridad
      metalness: 0.3,
      roughness: 0.2,
      flatShading: true,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#263238', // Visera oscura
      metalness: 0.8,
      roughness: 0.1,
      flatShading: true,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFD700', // Oro artesanal
      metalness: 0.6,
      roughness: 0.3,
      flatShading: true,
    });

    // 1. Chasis de 3 tablones de cedro
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3.8, 44),
        i === 0 ? darkWoodMat : woodPlankMat
      );
      plank.position.set(i * 8.4, 7.2, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      root.add(plank);
    }

    // Travesaño trasero
    const rearCross = new THREE.Mesh(new THREE.BoxGeometry(29, 3.8, 6.5), darkWoodMat);
    rearCross.position.set(0, 8.4, -14);
    rearCross.castShadow = true;
    root.add(rearCross);

    // Eje metálico trasero
    const rearAxle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 33, 10), steelMat);
    rearAxle.rotation.z = Math.PI / 2;
    rearAxle.position.set(0, 5.2, -14);
    root.add(rearAxle);

    // Balineras traseras de acero
    const addBearing = (x: number, y: number, z: number) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 4.4, 16), steelMat);
      ring.rotation.z = Math.PI / 2;
      ring.castShadow = true;
      g.add(ring);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 4.6, 12), hubMat);
      hub.rotation.z = Math.PI / 2;
      g.add(hub);

      g.position.set(x, y, z);
      root.add(g);
      this.bearings.push(ring);
    };

    addBearing(-16.8, 5.4, -14);
    addBearing(16.8, 5.4, -14);

    // 2. Eje delantero articulado (gira con la dirección)
    this.frontAxleGroup = new THREE.Group();
    this.frontAxleGroup.position.set(0, 5.4, 15);

    const frontCross = new THREE.Mesh(new THREE.BoxGeometry(29, 3.8, 6.5), darkWoodMat);
    frontCross.position.set(0, 2.2, 0);
    frontCross.castShadow = true;
    this.frontAxleGroup.add(frontCross);

    const frontAxleBar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 33, 10), steelMat);
    frontAxleBar.rotation.z = Math.PI / 2;
    this.frontAxleGroup.add(frontAxleBar);

    // Balineras delanteras
    const fRingL = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 4.4, 16), steelMat);
    fRingL.rotation.z = Math.PI / 2;
    fRingL.position.set(-16.8, 0, 0);
    fRingL.castShadow = true;
    this.frontAxleGroup.add(fRingL);
    this.bearings.push(fRingL);

    const fRingR = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 4.4, 16), steelMat);
    fRingR.rotation.z = Math.PI / 2;
    fRingR.position.set(16.8, 0, 0);
    fRingR.castShadow = true;
    this.frontAxleGroup.add(fRingR);
    this.bearings.push(fRingR);

    // Timón de lazo / mecate artesanal
    const rope = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.0, 6, 16, Math.PI), goldMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(0, 7.8, 2.5);
    this.frontAxleGroup.add(rope);

    root.add(this.frontAxleGroup);

    // 3. Palanca de freno lateral de mano (con taco de caucho de llanta)
    const brakeLever = new THREE.Mesh(new THREE.BoxGeometry(2.0, 17, 2.4), darkWoodMat);
    brakeLever.position.set(13.8, 13.5, -3);
    brakeLever.rotation.x = 0.35;
    brakeLever.castShadow = true;
    root.add(brakeLever);

    const rubberPad = new THREE.Mesh(new THREE.BoxGeometry(4.0, 4.2, 5.5), hubMat);
    rubberPad.position.set(15.2, 5.4, -9);
    root.add(rubberPad);

    // 4. Placa dorsal frontal: "01" dorada
    const plate = new THREE.Mesh(new THREE.BoxGeometry(16, 9.5, 1.2), goldMat);
    plate.position.set(0, 11.5, 23.0);
    plate.rotation.x = -0.22;
    plate.castShadow = true;
    root.add(plate);

    // 5. Piloto en postura de carrera de rodillos
    const torso = new THREE.Mesh(new THREE.BoxGeometry(12.5, 14.5, 9.5), jerseyMat);
    torso.position.set(0, 16.0, -4);
    torso.rotation.x = 0.16;
    torso.castShadow = true;
    root.add(torso);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 14), jerseyMat);
    armL.position.set(-7.2, 15.0, 3.2);
    armL.rotation.y = 0.24;
    armL.castShadow = true;
    root.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 14), jerseyMat);
    armR.position.set(7.2, 15.0, 3.2);
    armR.rotation.y = -0.24;
    armR.castShadow = true;
    root.add(armR);

    // Guantes amarillos
    const gloveMat = new THREE.MeshStandardMaterial({ color: '#FDD835', roughness: 0.6 });
    const gloveL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.6, 4.0), gloveMat);
    gloveL.position.set(-8.2, 13.5, 10.5);
    root.add(gloveL);

    const gloveR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.6, 4.0), gloveMat);
    gloveR.position.set(8.2, 13.5, 10.5);
    root.add(gloveR);

    // Casco y visor
    const head = new THREE.Mesh(new THREE.SphereGeometry(4.8, 10, 10), helmetMat);
    head.position.set(0, 24.5, -3);
    head.castShadow = true;
    root.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(7.8, 2.4, 2.4), visorMat);
    visor.position.set(0, 25.0, 1.4);
    root.add(visor);

    return root;
  }

  /**
   * Partículas de chispas y fricción de las balineras sobre el asfalto
   */
  private buildSparkParticles(): void {
    const count = 48;
    const geo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.sparkPositions[i * 3] = 0;
      this.sparkPositions[i * 3 + 1] = -100; // Ocultas al inicio
      this.sparkPositions[i * 3 + 2] = 0;
      this.sparkVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#FFB300',
      size: 2.8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    this.sparkPoints = new THREE.Points(geo, mat);
    this.scene.add(this.sparkPoints);
  }

  /**
   * Nubes voxel tridimensionales en el cielo andino
   */
  private buildVoxelClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.85,
      flatShading: true,
    });

    const cloudClusterCoords = [
      { x: 1800, y: 1650, z: 1800 },
      { x: 1200, y: 1750, z: 1100 },
      { x: 400, y: 1600, z: 200 },
      { x: -600, y: 1700, z: -800 },
      { x: -1600, y: 1550, z: -2000 },
      { x: -2800, y: 1680, z: -3500 },
      { x: -4200, y: 1600, z: -4800 },
      { x: -5800, y: 1720, z: -3200 },
      { x: -7500, y: 1580, z: -1500 },
      { x: -9500, y: 1650, z: 200 },
      { x: -11500, y: 1620, z: 1200 },
      { x: -13500, y: 1500, z: 1400 },
    ];

    cloudClusterCoords.forEach((coord) => {
      const g = new THREE.Group();
      // Bloques cúbicos escalonados que forman una nube esponjosa voxel
      const blocks = [
        { w: 90, h: 28, d: 60, ox: 0, oy: 0, oz: 0 },
        { w: 60, h: 22, d: 45, ox: -35, oy: -3, oz: 10 },
        { w: 70, h: 24, d: 50, ox: 38, oy: -2, oz: -8 },
        { w: 45, h: 20, d: 35, ox: 0, oy: 16, oz: 5 },
      ];

      blocks.forEach((b) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), cloudMat);
        m.position.set(b.ox, b.oy, b.oz);
        g.add(m);
      });

      g.position.set(coord.x, coord.y, coord.z);
      this.cloudGroup.add(g);
    });
  }

  /**
   * Construye el trazado con el estilo exacto de las imágenes de referencia:
   * 1. Calzada de asfalto continuo oscuro con línea discontinua central blanca.
   * 2. Bordillo acera de hormigón (sidewalk) claro.
   * 3. Pianos de curva (bordillos) ajedrezados en bloques individuales rojos y blancos.
   * 4. Franja de pasto superior verde brillante.
   * 5. Dientes de pasto voxel (voxel fringe) colgando sobre la pared de roca.
   * 6. Paredes de caída vertical de terracota cálida (se notan claramente los desniveles).
   * 7. Viaductos y puentes 3D con cañón profundo y ríos rápidos.
   */
  buildTrack3D(track: Track): void {
    if (this.trackBuilt) return;
    this.trackBuilt = true;

    const pts = track.points;
    const n = pts.length;
    if (n < 2) return;

    // Buffers para Asfalto
    const roadVerts: number[] = [];
    const roadIndices: number[] = [];
    let rOffset = 0;

    // Buffer para Línea Central Discontinua Blanca
    const centerLineVerts: number[] = [];
    const centerLineIndices: number[] = [];
    let clOffset = 0;

    // Buffer para Acera / Bordillo Base de Hormigón
    const sidewalkVerts: number[] = [];
    const sidewalkIndices: number[] = [];
    let swOffset = 0;

    // Buffers para Bordillos / Pianos (Rojos y Blancos por separado, sin cruces)
    const curbRedVerts: number[] = [];
    const curbRedIndices: number[] = [];
    let crOffset = 0;

    const curbWhiteVerts: number[] = [];
    const curbWhiteIndices: number[] = [];
    let cwOffset = 0;

    // Buffer para Labio de Pasto Superior
    const grassLipVerts: number[] = [];
    const grassLipIndices: number[] = [];
    let glOffset = 0;

    // Buffer para Dientes de Pasto Voxel (Fringe)
    const fringeVerts: number[] = [];
    const fringeIndices: number[] = [];
    let frOffset = 0;

    // Buffer para Paredes de Caída / Barrancos de Terracota
    const cliffVerts: number[] = [];
    const cliffIndices: number[] = [];
    let cfOffset = 0;

    // Función auxiliar para agregar quads rectangulares limpios
    const addQuad = (verts: number[], indices: number[], offset: number, v0: number[], v1: number[], v2: number[], v3: number[]) => {
      verts.push(...v0, ...v1, ...v2, ...v3);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
      return offset + 4;
    };

    for (let i = 0; i < n - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];

      // Tangente y perpendiculares del segmento
      const dxA = (pB.x - (pts[Math.max(0, i - 1)].x || pA.x)) || 1;
      const dyA = (pB.y - (pts[Math.max(0, i - 1)].y || pA.y)) || 1;
      const angleA = Math.atan2(dyA, dxA);
      const perpAx = -Math.sin(angleA);
      const perpAy = Math.cos(angleA);

      const nextNext = pts[Math.min(n - 1, i + 2)];
      const dxB = (nextNext.x - pA.x) || 1;
      const dyB = (nextNext.y - pA.y) || 1;
      const angleB = Math.atan2(dyB, dxB);
      const perpBx = -Math.sin(angleB);
      const perpBy = Math.cos(angleB);

      const halfWA = pA.width / 2;
      const halfWB = pB.width / 2;

      // Anchos escalonados del corte transversal:
      const curbWA = halfWA + 5.5;      // Ancho pianos
      const curbWB = halfWB + 5.5;

      const sideWA = curbWA + 4.0;      // Acera de hormigón
      const sideWB = curbWB + 4.0;

      const grassWA = sideWA + 8.5;     // Pasto verde superior
      const grassWB = sideWB + 8.5;

      const cyA = (pA.z || 0) * 0.52 + 5.0;
      const cyB = (pB.z || 0) * 0.52 + 5.0;

      // Profundidad de caída vertical del relieve
      const dropA = pA.isBridge ? (pA.canyonDepth || 85) : Math.max(26, 18 + Math.abs(cyA * 0.12));
      const dropB = pB.isBridge ? (pB.canyonDepth || 85) : Math.max(26, 18 + Math.abs(cyB * 0.12));

      // Coordenadas Asfalto
      const alxA = pA.x - perpAx * halfWA;
      const alzA = pA.y - perpAy * halfWA;
      const arxA = pA.x + perpAx * halfWA;
      const arzA = pA.y + perpAy * halfWA;

      const alxB = pB.x - perpBx * halfWB;
      const alzB = pB.y - perpBy * halfWB;
      const arxB = pB.x + perpBx * halfWB;
      const arzB = pB.y + perpBy * halfWB;

      // 1. ASFALTO CONTINUO
      rOffset = addQuad(
        roadVerts, roadIndices, rOffset,
        [alxA, cyA, alzA], [arxA, cyA, arzA],
        [arxB, cyB, arzB], [alxB, cyB, alzB]
      );

      // 2. LÍNEA CENTRAL DISCONTINUA BLANCA
      if (i % 2 === 0) {
        const lineHalfW = 1.6;
        const clxA0 = pA.x - perpAx * lineHalfW;
        const clzA0 = pA.y - perpAy * lineHalfW;
        const clxA1 = pA.x + perpAx * lineHalfW;
        const clzA1 = pA.y + perpAy * lineHalfW;

        const clxB0 = pB.x - perpBx * lineHalfW;
        const clzB0 = pB.y - perpBy * lineHalfW;
        const clxB1 = pB.x + perpBx * lineHalfW;
        const clzB1 = pB.y + perpBy * lineHalfW;

        clOffset = addQuad(
          centerLineVerts, centerLineIndices, clOffset,
          [clxA0, cyA + 0.18, clzA0], [clxA1, cyA + 0.18, clzA1],
          [clxB1, cyB + 0.18, clzB1], [clxB0, cyB + 0.18, clzB0]
        );
      }

      // 3. PIANOS / BORDILLOS AJEDREZADOS (Rojo y Blanco)
      const isRed = Math.floor(i / 2) % 2 === 0;

      // Bordillo Izquierdo
      const clAx0 = alxA;
      const clAz0 = alzA;
      const clAx1 = pA.x - perpAx * curbWA;
      const clAz1 = pA.y - perpAy * curbWA;

      const clBx0 = alxB;
      const clBz0 = alzB;
      const clBx1 = pB.x - perpBx * curbWB;
      const clBz1 = pB.y - perpBy * curbWB;

      if (isRed) {
        crOffset = addQuad(
          curbRedVerts, curbRedIndices, crOffset,
          [clAx1, cyA + 0.45, clAz1], [clAx0, cyA + 0.45, clAz0],
          [clBx0, cyB + 0.45, clBz0], [clBx1, cyB + 0.45, clBz1]
        );
      } else {
        cwOffset = addQuad(
          curbWhiteVerts, curbWhiteIndices, cwOffset,
          [clAx1, cyA + 0.45, clAz1], [clAx0, cyA + 0.45, clAz0],
          [clBx0, cyB + 0.45, clBz0], [clBx1, cyB + 0.45, clBz1]
        );
      }

      // Bordillo Derecho
      const crAx0 = arxA;
      const crAz0 = arzA;
      const crAx1 = pA.x + perpAx * curbWA;
      const crAz1 = pA.y + perpAy * curbWA;

      const crBx0 = arxB;
      const crBz0 = arzB;
      const crBx1 = pB.x + perpBx * curbWB;
      const crBz1 = pB.y + perpBy * curbWB;

      if (isRed) {
        crOffset = addQuad(
          curbRedVerts, curbRedIndices, crOffset,
          [crAx0, cyA + 0.45, crAz0], [crAx1, cyA + 0.45, crAz1],
          [crBx1, cyB + 0.45, crBz1], [crBx0, cyB + 0.45, crBz0]
        );
      } else {
        cwOffset = addQuad(
          curbWhiteVerts, curbWhiteIndices, cwOffset,
          [crAx0, cyA + 0.45, crAz0], [crAx1, cyA + 0.45, crAz1],
          [crBx1, cyB + 0.45, crBz1], [crBx0, cyB + 0.45, crBz0]
        );
      }

      // 4. ACERA DE HORMIGÓN (Banda clara exterior al bordillo)
      const swAxL = pA.x - perpAx * sideWA;
      const swAzL = pA.y - perpAy * sideWA;
      const swBxL = pB.x - perpBx * sideWB;
      const swBzL = pB.y - perpBy * sideWB;

      swOffset = addQuad(
        sidewalkVerts, sidewalkIndices, swOffset,
        [swAxL, cyA + 0.3, swAzL], [clAx1, cyA + 0.3, clAz1],
        [clBx1, cyB + 0.3, clBz1], [swBxL, cyB + 0.3, swBzL]
      );

      const swAxR = pA.x + perpAx * sideWA;
      const swAzR = pA.y + perpAy * sideWA;
      const swBxR = pB.x + perpBx * sideWB;
      const swBzR = pB.y + perpBy * sideWB;

      swOffset = addQuad(
        sidewalkVerts, sidewalkIndices, swOffset,
        [crAx1, cyA + 0.3, crAz1], [swAxR, cyA + 0.3, swAzR],
        [swBxR, cyB + 0.3, swBzR], [crBx1, cyB + 0.3, crBz1]
      );

      // 5. FRANJA DE PASTO VERDE SUPERIOR
      const glAxL = pA.x - perpAx * grassWA;
      const glAzL = pA.y - perpAy * grassWA;
      const glBxL = pB.x - perpBx * grassWB;
      const glBzL = pB.y - perpBy * grassWB;

      glOffset = addQuad(
        grassLipVerts, grassLipIndices, glOffset,
        [glAxL, cyA, glAzL], [swAxL, cyA, swAzL],
        [swBxL, cyB, swBzL], [glBxL, cyB, glBzL]
      );

      const glAxR = pA.x + perpAx * grassWA;
      const glAzR = pA.y + perpAy * grassWA;
      const glBxR = pB.x + perpBx * grassWB;
      const glBzR = pB.y + perpBy * grassWB;

      glOffset = addQuad(
        grassLipVerts, grassLipIndices, glOffset,
        [swAxR, cyA, swAzR], [glAxR, cyA, glAzR],
        [glBxR, cyB, glBzR], [swBxR, cyB, swBzR]
      );

      // 6. DIENTES DE PASTO VOXEL (Fringe colgante sobre el barranco)
      const toothDepth = (i % 2 === 0) ? 3.2 : 1.8;
      frOffset = addQuad(
        fringeVerts, fringeIndices, frOffset,
        [glAxL, cyA, glAzL], [glBxL, cyB, glBzL],
        [glBxL, cyB - toothDepth, glBzL], [glAxL, cyA - toothDepth, glAzL]
      );

      frOffset = addQuad(
        fringeVerts, fringeIndices, frOffset,
        [glAxR, cyA, glAzR], [glAxR, cyA - toothDepth, glAzR],
        [glBxR, cyB - toothDepth, glBzR], [glBxR, cyB, glBzR]
      );

      // 7. PAREDES DE CAÍDA VERTICAL (BARRANCOS DE TERRACOTA)
      cfOffset = addQuad(
        cliffVerts, cliffIndices, cfOffset,
        [glAxL, cyA - toothDepth, glAzL], [glBxL, cyB - toothDepth, glBzL],
        [glBxL, cyB - dropB, glBzL], [glAxL, cyA - dropA, glAzL]
      );

      cfOffset = addQuad(
        cliffVerts, cliffIndices, cfOffset,
        [glAxR, cyA - toothDepth, glAzR], [glAxR, cyA - dropA, glAzR],
        [glBxR, cyB - dropB, glBzR], [glBxR, cyB - toothDepth, glBzR]
      );

      // 8. PUENTES VIADUCTOS 3D
      if (pA.isBridge && i % 3 === 0) {
        this.buildVoxelBridge(pA.x, cyA, pA.y, perpAx, perpAy, halfWA, angleA, dropA, pA.bridgeName);
      }

      // 9. ESCENOGRAFÍA ANTIOQUEÑA (Pinos, cafetales y casas)
      if (i % 6 === 0 && !pA.isBridge) {
        this.buildVoxelScenery(pA.x, cyA, pA.y, perpAx, perpAy, grassWA, angleA);
      }
    }

    // Material Asfalto
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#2D313A', // Asfalto pizarra oscuro y elegante
      roughness: 0.85,
      flatShading: true,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.roadGroup.add(roadMesh);

    // Material Línea Central Blanca
    if (centerLineVerts.length > 0) {
      const clGeo = new THREE.BufferGeometry();
      clGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerLineVerts, 3));
      clGeo.setIndex(centerLineIndices);
      clGeo.computeVertexNormals();
      const clMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.35,
        flatShading: true,
      });
      this.roadGroup.add(new THREE.Mesh(clGeo, clMat));
    }

    // Material Acera de Hormigón
    if (sidewalkVerts.length > 0) {
      const swGeo = new THREE.BufferGeometry();
      swGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidewalkVerts, 3));
      swGeo.setIndex(sidewalkIndices);
      swGeo.computeVertexNormals();
      const swMat = new THREE.MeshStandardMaterial({
        color: '#D8DEE4', // Hormigón claro pulido
        roughness: 0.7,
        flatShading: true,
      });
      const swMesh = new THREE.Mesh(swGeo, swMat);
      swMesh.receiveShadow = true;
      this.roadGroup.add(swMesh);
    }

    // Material Bordillos Rojos
    if (curbRedVerts.length > 0) {
      const crGeo = new THREE.BufferGeometry();
      crGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbRedVerts, 3));
      crGeo.setIndex(curbRedIndices);
      crGeo.computeVertexNormals();
      const crMat = new THREE.MeshStandardMaterial({
        color: '#E53935', // Rojo carrera brillante
        roughness: 0.35,
        flatShading: true,
      });
      this.roadGroup.add(new THREE.Mesh(crGeo, crMat));
    }

    // Material Bordillos Blancos
    if (curbWhiteVerts.length > 0) {
      const cwGeo = new THREE.BufferGeometry();
      cwGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbWhiteVerts, 3));
      cwGeo.setIndex(curbWhiteIndices);
      cwGeo.computeVertexNormals();
      const cwMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.35,
        flatShading: true,
      });
      this.roadGroup.add(new THREE.Mesh(cwGeo, cwMat));
    }

    // Material Pasto Superior Verde Brillante
    if (grassLipVerts.length > 0) {
      const glGeo = new THREE.BufferGeometry();
      glGeo.setAttribute('position', new THREE.Float32BufferAttribute(grassLipVerts, 3));
      glGeo.setIndex(grassLipIndices);
      glGeo.computeVertexNormals();
      const glMat = new THREE.MeshStandardMaterial({
        color: '#52B848', // Verde pradera vibrante
        roughness: 0.8,
        flatShading: true,
      });
      const glMesh = new THREE.Mesh(glGeo, glMat);
      glMesh.receiveShadow = true;
      this.roadGroup.add(glMesh);
    }

    // Material Dientes de Pasto Voxel (Fringe colgante)
    if (fringeVerts.length > 0) {
      const frGeo = new THREE.BufferGeometry();
      frGeo.setAttribute('position', new THREE.Float32BufferAttribute(fringeVerts, 3));
      frGeo.setIndex(fringeIndices);
      frGeo.computeVertexNormals();
      const frMat = new THREE.MeshStandardMaterial({
        color: '#2D7528', // Verde bosque oscuro para los dientes
        roughness: 0.85,
        flatShading: true,
      });
      this.roadGroup.add(new THREE.Mesh(frGeo, frMat));
    }

    // Material Paredes de Caída / Barrancos de Terracota
    if (cliffVerts.length > 0) {
      const cfGeo = new THREE.BufferGeometry();
      cfGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffVerts, 3));
      cfGeo.setIndex(cliffIndices);
      cfGeo.computeVertexNormals();
      const cfMat = new THREE.MeshStandardMaterial({
        color: '#B57454', // Terracota arcillosa cálida (como en la Imagen 2)
        roughness: 0.92,
        flatShading: true,
      });
      const cliffMesh = new THREE.Mesh(cfGeo, cfMat);
      cliffMesh.castShadow = true;
      cliffMesh.receiveShadow = true;
      this.roadGroup.add(cliffMesh);
    }

    // 10. Portal de Salida: Boca del Túnel de Occidente
    this.buildTunnelPortal(pts[0], pts[1]);

    // 11. Montañas y valles escalonados de fondo
    this.buildTerracedMountains(track);
  }

  /**
   * Construye el portal de salida del Túnel de Occidente con sillería de piedra y arco
   */
  private buildTunnelPortal(p0: Track['points'][0], p1: Track['points'][1]): void {
    const portalGroup = new THREE.Group();

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    const cx = p0.x;
    const cy = (p0.z || 0) * 0.52 + 5.0;
    const cz = p0.y;
    const halfW = p0.width / 2;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#CFD8DC',
      roughness: 0.8,
      flatShading: true,
    });
    const brickMat = new THREE.MeshStandardMaterial({
      color: '#B71C1C', // Ladrillo rojo oscuro
      roughness: 0.75,
      flatShading: true,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFD700',
      metalness: 0.5,
      roughness: 0.3,
      flatShading: true,
    });
    const checkerDarkMat = new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.5 });
    const checkerLightMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 });

    const portalRotY = -angle + Math.PI / 2;

    // Pilares macizos de piedra a los lados de la calzada
    for (const side of [-1, 1]) {
      const px = cx + perpX * (halfW + 11) * side;
      const pz = cz + perpY * (halfW + 11) * side;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(16, 54, 18), stoneMat);
      pillar.position.set(px, cy + 27, pz);
      pillar.rotation.y = portalRotY;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      portalGroup.add(pillar);

      // Cornisas
      const cap = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 22), brickMat);
      cap.position.set(px, cy + 54, pz);
      cap.rotation.y = portalRotY;
      cap.castShadow = true;
      portalGroup.add(cap);
    }

    // Dintel principal cruzando de lado a lado
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(p0.width + 38, 18, 20), brickMat);
    lintel.position.set(cx, cy + 52, cz);
    lintel.rotation.y = portalRotY;
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    portalGroup.add(lintel);

    // Frontispicio ajedrezado de meta/salida (como en la Imagen 1)
    const span = p0.width + 24;
    const blocksCount = 10;
    const blockW = span / blocksCount;
    for (let b = 0; b < blocksCount; b++) {
      const bx = -span / 2 + blockW * (b + 0.5);
      const isBlack = b % 2 === 0;
      const cb = new THREE.Mesh(
        new THREE.BoxGeometry(blockW, 6, 2.8),
        isBlack ? checkerDarkMat : checkerLightMat
      );
      cb.position.set(bx, 0, 10.5);
      // Adjuntar a lintel temporal
    }

    // Letrero oficial rotulado: "TÚNEL DE OCCIDENTE · 1.907 MSNM"
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d')!;
    bctx.fillStyle = '#C8A96E';
    bctx.fillRect(0, 0, 512, 128);
    bctx.strokeStyle = '#152E22';
    bctx.lineWidth = 10;
    bctx.strokeRect(5, 5, 502, 118);
    bctx.fillStyle = '#152E22';
    bctx.font = '900 36px Georgia, serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('TÚNEL DE OCCIDENTE', 256, 44);
    bctx.font = 'bold 22px sans-serif';
    bctx.fillStyle = '#8B1A1A';
    bctx.fillText('SALIDA · 1.907 MSNM', 256, 88);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });

    const banner = new THREE.Mesh(new THREE.BoxGeometry(p0.width + 10, 10, 2.0), bannerMat);
    banner.position.set(cx - Math.sin(portalRotY) * 10.5, cy + 52, cz + Math.cos(portalRotY) * 10.5);
    banner.rotation.y = portalRotY;
    banner.castShadow = true;
    portalGroup.add(banner);

    this.roadGroup.add(portalGroup);
  }

  /**
   * Construye puentes viaductos 3D con cañones rocosos y ríos encajonados
   */
  private buildVoxelBridge(
    cx: number,
    cy: number,
    cz: number,
    perpX: number,
    perpY: number,
    halfW: number,
    angle: number,
    canyonDepth: number,
    name?: string
  ): void {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#78909C', // Hormigón gris azulado
      roughness: 0.85,
      flatShading: true,
    });
    const gorgeWallMat = new THREE.MeshStandardMaterial({
      color: '#5D4037', // Paredes rocosas del cañón
      roughness: 0.95,
      flatShading: true,
    });
    const riverMat = new THREE.MeshStandardMaterial({
      color: '#00ACC1', // Turquesa vivo de torrente de montaña
      roughness: 0.18,
      metalness: 0.25,
      flatShading: true,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: '#E0F7FA', // Espuma blanca de rápidos
      roughness: 0.3,
      flatShading: true,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      metalness: 0.4,
      roughness: 0.25,
      flatShading: true,
    });
    const railPostMat = new THREE.MeshStandardMaterial({
      color: '#E53935',
      roughness: 0.4,
      flatShading: true,
    });

    // Pilares macizos de hormigón que bajan al fondo del cañón
    const pWidth = 12;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pWidth, canyonDepth + 10, pWidth), pillarMat);
    pillar.position.set(cx, cy - canyonDepth / 2, cz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.bridgeGroup.add(pillar);

    // Paredes rocosas del desfiladero a los costados
    for (const side of [-1, 1]) {
      const gx = cx + perpX * (halfW + 18) * side;
      const gz = cz + perpY * (halfW + 18) * side;
      const gorge = new THREE.Mesh(new THREE.BoxGeometry(24, canyonDepth, 48), gorgeWallMat);
      gorge.position.set(gx, cy - canyonDepth / 2, gz);
      gorge.rotation.y = -angle;
      gorge.castShadow = true;
      gorge.receiveShadow = true;
      this.bridgeGroup.add(gorge);
    }

    // Barandas de protección del puente
    for (const side of [-1, 1]) {
      const bx = cx + perpX * (halfW + 4.5) * side;
      const bz = cz + perpY * (halfW + 4.5) * side;

      const post = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10.5, 2.2), railPostMat);
      post.position.set(bx, cy + 5.5, bz);
      post.castShadow = true;
      this.bridgeGroup.add(post);

      const railUpper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 38), railMat);
      railUpper.position.set(bx, cy + 10, bz);
      railUpper.rotation.y = -angle;
      this.bridgeGroup.add(railUpper);

      const railLower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 38), railMat);
      railLower.position.set(bx, cy + 5.5, bz);
      railLower.rotation.y = -angle;
      this.bridgeGroup.add(railLower);
    }

    // Río corriendo encajonado en el fondo del desfiladero
    const river = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 24, 4, 36), riverMat);
    river.position.set(cx, cy - canyonDepth + 2.0, cz);
    river.rotation.y = -angle + Math.PI / 2;
    this.bridgeGroup.add(river);

    // Espuma blanca de rápidos
    const foam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.4, 4.4, 16), foamMat);
    foam.position.set(cx, cy - canyonDepth + 2.3, cz);
    foam.rotation.y = -angle + Math.PI / 2;
    this.bridgeGroup.add(foam);
  }

  /**
   * Vegetación andina estilizada y arquitectura tradicional campesina
   */
  private buildVoxelScenery(
    cx: number,
    cy: number,
    cz: number,
    perpX: number,
    perpY: number,
    grassW: number,
    angle: number
  ): void {
    const foliageDark = new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.8, flatShading: true });
    const foliageLight = new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 0.75, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.9, flatShading: true });

    // Casas campesinas con zócalos de colores vivos
    const houseWallMat = new THREE.MeshStandardMaterial({ color: '#FDFEFE', roughness: 0.8, flatShading: true });
    const zocaloColors = ['#1565C0', '#2E7D32', '#C62828', '#F57F17'];
    const roofMat = new THREE.MeshStandardMaterial({ color: '#D35400', roughness: 0.75, flatShading: true }); // Teja de barro

    // Arbustos de café con frutos rojos
    const coffeeFoliageMat = new THREE.MeshStandardMaterial({ color: '#1B5E20', roughness: 0.85, flatShading: true });
    const cherryMat = new THREE.MeshStandardMaterial({ color: '#D32F2F', roughness: 0.4, flatShading: true });

    for (const side of [-1, 1]) {
      const dist = grassW + 36 + ((cx * 5 + cz * 11) % 48);
      const sx = cx + perpX * dist * side;
      const sz = cz + perpY * dist * side;

      const hash = Math.abs(Math.sin(cx * 0.045 + cz * 0.082));

      if (hash < 0.55) {
        // Pino andino por niveles (como en la Imagen 1)
        const pino = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 15, 3.6), trunkMat);
        trunk.position.set(0, 7.5, 0);
        trunk.castShadow = true;
        pino.add(trunk);

        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(15, 16, 6), foliageDark);
        cone1.position.set(0, 19, 0);
        cone1.castShadow = true;
        pino.add(cone1);

        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(11, 14, 6), foliageLight);
        cone2.position.set(0, 28, 0);
        cone2.castShadow = true;
        pino.add(cone2);

        const cone3 = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 6), foliageDark);
        cone3.position.set(0, 36, 0);
        cone3.castShadow = true;
        pino.add(cone3);

        pino.position.set(sx, cy, sz);
        this.sceneryGroup.add(pino);
      } else if (hash >= 0.55 && hash < 0.80) {
        // Cafetal antioqueño (arbusto de café con granos maduros)
        const cafetal = new THREE.Group();
        const bush = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), coffeeFoliageMat);
        bush.position.set(0, 6, 0);
        bush.castShadow = true;
        cafetal.add(bush);

        // Granos de café rojos
        for (let k = 0; k < 6; k++) {
          const berry = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), cherryMat);
          berry.position.set(
            (k % 2 === 0 ? 1 : -1) * 7.2,
            5 + (k % 3) * 2.5,
            (k > 2 ? 1 : -1) * 6.5
          );
          cafetal.add(berry);
        }

        cafetal.position.set(sx, cy, sz);
        this.sceneryGroup.add(cafetal);
      } else if (hash > 0.86) {
        // Casa campesina antioqueña tradicional con zócalo
        const casa = new THREE.Group();
        const zColor = zocaloColors[Math.floor(hash * 100) % zocaloColors.length];
        const zocaloMat = new THREE.MeshStandardMaterial({ color: zColor, roughness: 0.7, flatShading: true });

        const base = new THREE.Mesh(new THREE.BoxGeometry(28, 4.5, 20), zocaloMat);
        base.position.set(0, 2.25, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        casa.add(base);

        const wall = new THREE.Mesh(new THREE.BoxGeometry(27.5, 13, 19.5), houseWallMat);
        wall.position.set(0, 11, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        casa.add(wall);

        // Tejado a dos aguas de teja de barro
        const roof = new THREE.Mesh(new THREE.ConeGeometry(22, 11, 4), roofMat);
        roof.position.set(0, 22.5, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        casa.add(roof);

        casa.position.set(sx, cy, sz);
        casa.rotation.y = -angle;
        this.sceneryGroup.add(casa);
      }
    }
  }

  /**
   * Montañas y valles escalonados tipo maqueta diorama (Cordillera Occidental)
   */
  private buildTerracedMountains(track: Track): void {
    const pts = track.points;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - 3000;
    const maxX = Math.max(...xs) + 3000;
    const minZ = Math.min(...ys) - 3000;
    const maxZ = Math.max(...ys) + 3000;

    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const terrainGeo = new THREE.PlaneGeometry(spanX + 10000, spanZ + 10000, 90, 90);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Relieve que desciende gradualmente desde Túnel (1907m) hacia Ebéjico (1141m)
      const distFromStart = Math.hypot(vx - pts[0].x, vz - pts[0].y);
      const baseAlt = Math.max(10, 480 - distFromStart * 0.024);

      // Ondulaciones montañosas escalonadas (terrazas andinas)
      const wave =
        Math.sin(vx * 0.0012) * Math.cos(vz * 0.0012) * 110 +
        Math.sin(vx * 0.0028) * 45;

      pos.setY(i, baseAlt + wave);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: '#43A047', // Verde montaña andina vivo
      roughness: 0.92,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set(midX, 0, midZ);
    terrainMesh.receiveShadow = true;
    this.terrainGroup.add(terrainMesh);
  }

  render(track: Track, snapshot: GameSnapshot): void {
    this.buildTrack3D(track);

    const v = snapshot.vehicle;

    // 1. Posicionar el Carrito de Rodillos sobre el asfalto
    const cartX = v.x;
    const cartY = (v.z || 0) * 0.52 + 5.0;
    const cartZ = v.y;

    // Micro-vibración auténtica de balineras de acero sobre asfalto
    const rattle = v.speed > 10 ? (Math.random() - 0.5) * Math.min(0.35, v.speed * 0.002) : 0;
    this.cartGroup.position.set(cartX, cartY + rattle, cartZ);

    this.cartGroup.rotation.y = -v.angle + Math.PI / 2;
    this.cartGroup.rotation.x = v.pitch || 0;
    this.cartGroup.rotation.z = -(v.roll || 0);

    // 2. Giro del eje delantero con el timón de mecate
    if (this.frontAxleGroup) {
      this.frontAxleGroup.rotation.y = Math.max(
        -0.45,
        Math.min(0.45, (v.vx * Math.sin(v.angle) - v.vy * Math.cos(v.angle)) * 0.02)
      );
    }

    // 3. Rodamiento continuo de las 4 balineras de acero
    const rollSpeed = v.speed * 0.085;
    for (const b of this.bearings) {
      b.rotation.x += rollSpeed;
    }

    // 4. Actualizar partículas de chispas de balinera
    this.updateSparks(cartX, cartY, cartZ, v.speed);

    // 5. CÁMARA DIORAMA / ISOMÉTRICA (Control según la solicitud del usuario)
    if (this.cameraMode === 'fixed_iso') {
      // VISTA ISOMÉTRICA FIJA NORTE (PREDETERMINADA):
      // Maqueta axonométrica diorama clásica (como en la Imagen 2).
      // El horizonte se mantiene fijo y estable sin giros bruscos.
      const isoDist = 165;
      const isoHeight = 195;

      const targetCamX = cartX + isoDist;
      const targetCamY = cartY + isoHeight;
      const targetCamZ = cartZ + isoDist;

      const targetLookX = cartX - 25;
      const targetLookY = cartY + 10;
      const targetLookZ = cartZ - 25;

      this.smoothCamPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.12);
      this.smoothTarget.lerp(new THREE.Vector3(targetLookX, targetLookY, targetLookZ), 0.15);

      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothTarget);
    } else {
      // VISTA ISOMÉTRICA DINÁMICA (SEGUIMIENTO SUAVE DE TRAYECTORIA):
      const fwdX = Math.cos(v.angle);
      const fwdZ = Math.sin(v.angle);

      const distanceBehind = 145;
      const cameraHeight = 175;

      const targetCamX = cartX - fwdX * distanceBehind;
      const targetCamY = cartY + cameraHeight;
      const targetCamZ = cartZ - fwdZ * distanceBehind;

      const lookAhead = 85;
      const targetLookX = cartX + fwdX * lookAhead;
      const targetLookY = cartY + 12;
      const targetLookZ = cartZ + fwdZ * lookAhead;

      this.smoothCamPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.12);
      this.smoothTarget.lerp(new THREE.Vector3(targetLookX, targetLookY, targetLookZ), 0.14);

      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothTarget);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateSparks(cx: number, cy: number, cz: number, speed: number): void {
    if (!this.sparkPositions) return;

    const count = this.sparkPositions.length / 3;
    const isFast = speed > 40;

    for (let i = 0; i < count; i++) {
      const v = this.sparkVelocities[i];
      if (v.life > 0) {
        this.sparkPositions[i * 3] += v.x;
        this.sparkPositions[i * 3 + 1] += v.y;
        this.sparkPositions[i * 3 + 2] += v.z;
        v.y -= 0.18; // Gravedad
        v.life -= 0.05;
      } else if (isFast && Math.random() < 0.25) {
        // Generar nueva chispa desde las balineras traseras
        const side = Math.random() < 0.5 ? -14 : 14;
        this.sparkPositions[i * 3] = cx + side + (Math.random() - 0.5) * 4;
        this.sparkPositions[i * 3 + 1] = cy + 1.2;
        this.sparkPositions[i * 3 + 2] = cz - 12 + (Math.random() - 0.5) * 4;
        v.x = (Math.random() - 0.5) * 1.5;
        v.y = 1.0 + Math.random() * 1.8;
        v.z = -1.5 - Math.random() * 2.0;
        v.life = 1.0;
      } else {
        this.sparkPositions[i * 3 + 1] = -500; // Esconder
      }
    }

    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
  }
}
