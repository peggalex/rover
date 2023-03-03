import React, { useEffect, useRef } from 'react';
import logo from './logo.svg';
import './App.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getCenter, ThreeGroup, ThreeObjectPhysics, Vehicle } from './model';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';

const degreesToRadians = (angleDegrees: number) => (angleDegrees * Math.PI) / 180;
const radiansToDegrees = (angleRadians: number) => (angleRadians * 180) / Math.PI;

const initCannon = () => {
  const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  });
  groundBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
  physicsWorld.addBody(groundBody);
  return physicsWorld;
}

const updateOrbitControls = (controls: OrbitControls) => controls.update();

const initOrbitControls = (camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
  const controls = new OrbitControls( camera, renderer.domElement);
  updateOrbitControls(controls);
  return controls;
}

const addLight = (scene: THREE.Scene) => {
  var light = new THREE.AmbientLight(0xffffff);
  scene.add(light);
}

const initScene = (): [THREE.Scene, THREE.PerspectiveCamera, THREE.WebGLRenderer, OrbitControls] => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set(1,20,10);
  //camera.rotateZ(Math.PI/2);
  //camera.rotateOnAxis(new THREE.Vector3( 0, 1, 0 ), Math.PI/2);
  camera.lookAt(0,0,0);
  
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight);

  addLight(scene);

  const controls = initOrbitControls(camera, renderer);
  return [scene, camera, renderer, controls];
}

var jeep: THREE.Group | null = null;

const keysPressed = new Set<string>();

document.addEventListener("keyup", ({code}) => {
  if (keysPressed.has(code)){
    keysPressed.delete(code);
  }
  console.log({msg: 'keydown', code});
})

document.addEventListener("keydown", ({code}) => {
  keysPressed.add(code);
  console.log({msg: 'keydown', code});
});

document.addEventListener("visibilitychange", () => {
  keysPressed.clear();
  console.log({msg: 'visibilitychange'});
});

const getKeys = (): { dAngle: number, dist: number } => {
  var dAngle = 0;
  var dist = 0;

  for (const key of Array.from(keysPressed)){
    switch (key){
      case 'KeyW':
        dist += 1;
        break;
      case 'KeyS':
        dist -= 1;
        break;
      case 'KeyA':
        dAngle += 1;
        break;
      case 'KeyD':
        dAngle -= 1;
        break;
      default:
        // pass
    }
  }

  return { dAngle, dist };
}

(window as any).THREE = THREE;

var vehicle: Vehicle;

const addJeep = async (scene: THREE.Scene) => {
  // const loader = new OBJLoader();
  /* const loader = new GLTFLoader();

  loader.load(
    //process.env.PUBLIC_URL + 'Jeep.obj', 
    process.env.PUBLIC_URL + 'Jeep.glb', 
    (model) => {
      console.log('model loaded!');

      // changeColorOfModel(model.scene, 0x00FF00);
      jeep = model.scene;
      (window as any).jeep = jeep;
      (window as any).scene = scene;

      jeep.position.y = 5;
      jeep.position.x = 5;
      scene.add(model.scene);       
    },
    () => console.log('loading model...'),
    (error) => alert('Error! ' + error)
  )*/

  const group = await ThreeGroup.load('Jeep2.glb', scene);
  jeep = group.object;
  jeep.position.y = 5;
  (window as any).jeep = group;
}

const addCube = (scene: THREE.Scene) => {
  const geometry = new THREE.BoxGeometry( 1, 1, 1 );
  const material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
  const cube = new THREE.Mesh( geometry, material );
  scene.add(cube);
}

const addSphereAndCube = (world: CANNON.World) => {
  const sphere = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(1)
  });
  sphere.position.set(0, 7, 0);
  world.addBody(sphere);

  const box = new CANNON.Body({
    mass: 5,
    position: new CANNON.Vec3(0, 10, 1),
    shape: new CANNON.Box(new CANNON.Vec3(1,1,1))
  });
  box.position.set(0, 10, 1);
  world.addBody(box);
}

const [scene, camera, renderer, controls] = initScene();
const world = initCannon();
// addSphereAndCube(world);

const cannonDebugger = CannonDebugger(scene, world, {});
const axesHelper = new THREE.AxesHelper(5);
(window as any).axesHelper = axesHelper;
scene.add(axesHelper);

// addCube(scene);
addJeep(scene);

camera.position.z = 5;

/*
const getOpposite = (hypotenuse: number, angle: number) => {
  const oppositeOverHypotenuse = Math.abs(Math.sin(angle));
  const opposite = oppositeOverHypotenuse * hypotenuse;
  return opposite * (angle < Math.PI ? -1 : 1);
}

const getAdjacent = (hypotenuse: number, angle: number) => {
  const adjacentOverHypotenuse = Math.abs(Math.cos(angle));
  const adjacent =  adjacentOverHypotenuse * hypotenuse;
  return adjacent * (Math.PI/2 < angle && angle < (Math.PI*3)/2 ? -1 : 1);
}
*/

let addedJeep = false;
let rerenderedBeforeAddingJeep = false;

let movedYet = false;

function animate() {

  if (jeep !== null){
    /* console.log({
      name3: (window as any).jeep.getDescendant('Chassis').name, 
      center3: getCenter((window as any).jeep.getDescendant('Chassis').object)
    }); */

    if (!addedJeep){
      if (rerenderedBeforeAddingJeep){
        addedJeep = true;
        const group = (window as any).jeep;
        console.log({name0: group.getDescendant('Chassis').name, center0: getCenter(group.getDescendant('Chassis').object)})

        vehicle = new Vehicle({
          chassis: group.getDescendant('Chassis'),
          wheelFL: group.getDescendant('WheelFL'),
          wheelFR: group.getDescendant('WheelFR'),
          wheelBL: group.getDescendant('WheelBL'),
          wheelBR: group.getDescendant('WheelBR'),
        });

        vehicle.cannonVehicle.addToWorld(world);
      } else {
        rerenderedBeforeAddingJeep = true;
      }
    }

    jeep.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // child.rotation.x += 0.01;
        // child.rotation.y += 0.01;
      }
    });

    let { dAngle, dist } = getKeys();

    if ((dist || dAngle) || movedYet){
      movedYet = true;
      vehicle.move(dist, dAngle);
    }
    /*const wDir = new THREE.Vector3(0, 0, -1).applyQuaternion(jeep.quaternion);
    wDir.normalize().multiplyScalar(-1).add(new THREE.Vector3(0,.3,0));

    let cameraPos = getCenter(jeep).add(wDir);
    camera.position.copy(cameraPos);
    camera.lookAt(getCenter(jeep));

    //camera.position.set(1,20,10);
    console.log(JSON.stringify({cameraPos: camera.position, jeepPos: jeep.position}));
    //camera.rotateZ(Math.PI/2);
    //camera.rotateOnAxis(new THREE.Vector3( 0, 1, 0 ), Math.PI/2);
    //camera.lookAt(0,0,0);
    */
  }

  updateOrbitControls(controls);

	renderer.render(scene, camera);
  world.fixedStep();
  cannonDebugger.update();
  ThreeObjectPhysics.instances.forEach(i => i.updateThreeObject());
  requestAnimationFrame(animate);
}

function App() {

  const threeCanvasRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    const threeCanvas = threeCanvasRef.current;
    if (threeCanvas != null){
      console.log('hey');
      threeCanvas.appendChild(renderer.domElement);
      animate();
    } else {
      console.log('nah');
    }
  }, []);

  return (
    <div className="App">
      <div ref={threeCanvasRef}></div>
    </div>
  );
}

export default App;
