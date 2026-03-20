import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  private readonly clock: THREE.Clock;

  constructor(canvas: HTMLCanvasElement) {
    // Scene — lighter blue-gray background for a refreshing look
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1e2e);

    // Subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x1a1e2e, 0.02);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting — bright and clear
    const ambient = new THREE.AmbientLight(0x8090c0, 1.0);
    this.scene.add(ambient);

    // Main key light from above
    const directional = new THREE.DirectionalLight(0xffffff, 2.0);
    directional.position.set(5, 15, 5);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    this.scene.add(directional);

    // Fill light from opposite side
    const fill = new THREE.DirectionalLight(0xa0b0ff, 0.6);
    fill.position.set(-5, 8, -5);
    this.scene.add(fill);

    // Bright point light inside the well area — illuminates blocks from within
    const wellLight = new THREE.PointLight(0x7090ff, 1.2, 40);
    wellLight.position.set(0, 6, 0);
    this.scene.add(wellLight);

    // Floor up-light — makes the bottom of the well glow
    const floorLight = new THREE.PointLight(0x4466cc, 1.5, 15);
    floorLight.position.set(0, -1, 0);
    this.scene.add(floorLight);

    // Environment map for glass reflections — brighter
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x2a3050);
    const envTexture = pmremGenerator.fromScene(envScene).texture;
    this.scene.environment = envTexture;
    pmremGenerator.dispose();

    // Post-processing
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,  // strength
      0.4,  // radius
      0.75, // threshold
    );
    this.composer.addPass(bloomPass);

    const fxaaPass = new FXAAPass();
    this.composer.addPass(fxaaPass);

    // Clock
    this.clock = new THREE.Clock();

    // Resize handler
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  render(): void {
    this.composer.render();
  }

  getDeltaTime(): number {
    return this.clock.getDelta();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.composer.dispose();
  }
}
