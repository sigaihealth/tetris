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
    // Scene — bright blue-gray background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x354060);

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
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting — bright and well-lit
    const ambient = new THREE.AmbientLight(0xa0b0e0, 1.2);
    this.scene.add(ambient);

    // Main key light from above
    const directional = new THREE.DirectionalLight(0xffffff, 2.5);
    directional.position.set(5, 15, 5);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    this.scene.add(directional);

    // Fill light from opposite side
    const fill = new THREE.DirectionalLight(0xb0c0ff, 0.8);
    fill.position.set(-5, 8, -5);
    this.scene.add(fill);

    // Bottom-up light to illuminate the floor and lower blocks
    const bottomLight = new THREE.DirectionalLight(0x8090cc, 0.6);
    bottomLight.position.set(0, -3, 0);
    bottomLight.target.position.set(0, 5, 0);
    this.scene.add(bottomLight);
    this.scene.add(bottomLight.target);

    // Bright point light inside the well — illuminates blocks
    const wellLight = new THREE.PointLight(0x80a0ff, 1.5, 40);
    wellLight.position.set(2, 6, 2);
    this.scene.add(wellLight);

    // Floor glow — strong up-light from below
    const floorLight = new THREE.PointLight(0x6688dd, 2.0, 20);
    floorLight.position.set(2, -0.5, 2);
    this.scene.add(floorLight);

    // Second floor light for even coverage
    const floorLight2 = new THREE.PointLight(0x5577cc, 1.5, 15);
    floorLight2.position.set(0, 0, 0);
    this.scene.add(floorLight2);

    // Environment map — brighter for better glass reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x506080);
    const envTexture = pmremGenerator.fromScene(envScene).texture;
    this.scene.environment = envTexture;
    pmremGenerator.dispose();

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45, 0.4, 0.8,
    ));
    this.composer.addPass(new FXAAPass());

    this.clock = new THREE.Clock();
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

  render(): void { this.composer.render(); }
  getDeltaTime(): number { return this.clock.getDelta(); }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.composer.dispose();
  }
}
