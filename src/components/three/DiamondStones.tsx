import * as THREE from 'three';

export const createDiamondStones = (parentMesh: THREE.Mesh, color: string) => {
  const COUNT = 1500;
  const geometry = new THREE.OctahedronGeometry(1.5);
  const material = new THREE.MeshPhysicalMaterial({
    color: color,
    metalness: 1,
    roughness: 0.0,
    transmission: 0.8,
    thickness: 2.0,
    envMapIntensity: 5.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    ior: 2.42,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.6,
    attenuationColor: new THREE.Color(color),
    attenuationDistance: 0.5,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.2,
    sheen: 0.0,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(color),
  });

  const instancedMesh = new THREE.InstancedMesh(geometry, material, COUNT);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  // Get vertices and faces of the parent mesh
  const vertices = parentMesh.geometry.attributes.position;
  const faces = parentMesh.geometry.index;

  if (!faces) return instancedMesh;

  for (let i = 0; i < COUNT; i++) {
    // Get random face
    const faceIndex = Math.floor((Math.random() * faces.count) / 3) * 3;

    // Get vertices of the face
    const v1 = new THREE.Vector3(
      vertices.getX(faces.array[faceIndex]),
      vertices.getY(faces.array[faceIndex]),
      vertices.getZ(faces.array[faceIndex])
    );
    const v2 = new THREE.Vector3(
      vertices.getX(faces.array[faceIndex + 1]),
      vertices.getY(faces.array[faceIndex + 1]),
      vertices.getZ(faces.array[faceIndex + 1])
    );
    const v3 = new THREE.Vector3(
      vertices.getX(faces.array[faceIndex + 2]),
      vertices.getY(faces.array[faceIndex + 2]),
      vertices.getZ(faces.array[faceIndex + 2])
    );

    // Get random point on the face using barycentric coordinates
    let r1 = Math.random();
    let r2 = Math.random();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    const r3 = 1 - r1 - r2;

    position
      .copy(v1.multiplyScalar(r1))
      .add(v2.multiplyScalar(r2))
      .add(v3.multiplyScalar(r3));

    // Orient stones to face normal
    const normal = new THREE.Vector3()
      .crossVectors(v2.clone().sub(v1), v3.clone().sub(v1))
      .normalize();

    quaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        position,
        position.clone().add(normal),
        new THREE.Vector3(0, 1, 0)
      )
    );

    const size = 0.1 + Math.random() * 0.2;
    scale.set(size, size, size);

    matrix.compose(position, quaternion, scale);
    instancedMesh.setMatrixAt(i, matrix);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  return instancedMesh;
};
