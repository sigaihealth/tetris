import * as THREE from 'three';

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private targetAngle: number = 0;
  private currentAngle: number = 0;
  private orbitRadius: number;
  private elevation: number;
  private center: THREE.Vector3;

  constructor(camera: THREE.PerspectiveCamera, w: number, d: number, h: number) {
    this.camera = camera;
    this.center = new THREE.Vector3(w / 2 - 0.5, h / 4, d / 2 - 0.5);
    this.orbitRadius = Math.max(w, d) * 2.2;
    this.elevation = h * 0.6;
    this.updateCamera();
  }

  orbitLeft(): void {
    this.targetAngle -= Math.PI / 4;
  }

  orbitRight(): void {
    this.targetAngle += Math.PI / 4;
  }

  update(dt: number): void {
    const speed = 5;
    const diff = this.targetAngle - this.currentAngle;
    this.currentAngle += diff * speed * dt;
    this.updateCamera();
  }

  reset(w: number, d: number, h: number): void {
    this.center.set(w / 2 - 0.5, h / 4, d / 2 - 0.5);
    this.orbitRadius = Math.max(w, d) * 2.2;
    this.elevation = h * 0.6;
    this.targetAngle = 0;
    this.currentAngle = 0;
    this.updateCamera();
  }

  private updateCamera(): void {
    const x = this.center.x + Math.sin(this.currentAngle) * this.orbitRadius;
    const z = this.center.z + Math.cos(this.currentAngle) * this.orbitRadius;
    this.camera.position.set(x, this.elevation, z);
    this.camera.lookAt(this.center);
  }
}
