import * as THREE from 'three';
import { BlockMesh } from './BlockMesh.ts';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  private readonly scene: THREE.Scene;
  private particles: Particle[] = [];
  private cameraShake: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  planeClearEffect(width: number, depth: number, y: number, colorId: number): void {
    const color = BlockMesh.getColor(colorId);
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const count = 4;
        for (let i = 0; i < count; i++) {
          const mat = new THREE.MeshPhysicalMaterial({
            color,
            transmission: 0.85,
            roughness: 0.1,
            thickness: 0.5,
            ior: 1.5,
            clearcoat: 1.0,
            transparent: true,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(
            x + (Math.random() - 0.5) * 0.5,
            y + (Math.random() - 0.5) * 0.5,
            z + (Math.random() - 0.5) * 0.5,
          );
          this.scene.add(mesh);

          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 5 + 2,
            (Math.random() - 0.5) * 4,
          );
          const maxLife = 1.0 + Math.random() * 0.5;

          this.particles.push({ mesh, velocity, life: maxLife, maxLife });
        }
      }
    }

    this.cameraShake = 0.15;
  }

  gameOverEffect(w: number, d: number, h: number): void {
    // Use parameters to avoid unused-parameter lint error
    void w;
    void d;
    void h;
    this.cameraShake = 0.3;
  }

  update(dt: number, camera: THREE.Camera): void {
    const gravity = 9.8;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.material instanceof THREE.Material) {
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Apply gravity
      p.velocity.y -= gravity * dt;

      // Update position
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Fade opacity based on remaining life
      if (p.mesh.material instanceof THREE.Material) {
        p.mesh.material.opacity = p.life / p.maxLife;
      }
    }

    // Camera shake
    if (this.cameraShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake *= 0.9;
    } else {
      this.cameraShake = 0;
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      if (p.mesh.material instanceof THREE.Material) {
        p.mesh.material.dispose();
      }
    }
    this.particles = [];
  }
}
