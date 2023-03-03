import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

const decomposeVector = ({x, y, z}: {x: number, y: number, z:number}): [number, number, number] => [x,y,z];

const getBoundingBox = (obj: THREE.Object3D) => new THREE.Box3().setFromObject(obj);

export const getCenter = (obj: THREE.Object3D) => {
    const bbox = getBoundingBox(obj);
    const vec = new THREE.Vector3();
    bbox.getCenter(vec);
    return vec;
}

const getVectorDiff = (vec1: THREE.Vector3, vec2: THREE.Vector3) => (
    new THREE.Vector3(
        vec1.x - vec2.x, 
        vec1.y - vec2.y, 
        vec1.z - vec2.z
    )
)

const getThreeVector = ({x, y, z}: {x: number, y: number, z:number}) => (
    new THREE.Vector3(x, y, z)
);

const getThreeQuaternion = (
    {x, y, z, w}: 
    {x: number, y: number, z: number, w: number}
) => new THREE.Quaternion(x, y, z, w);

const getCannonVector = (
    {x, y, z}: 
    {x: number, y: number, z: number}
) => new CANNON.Vec3(x,y,z);

const getCannonQuaternion = (
    {x, y, z, w}: 
    {x: number, y: number, z: number, w: number}
) => new CANNON.Quaternion(x,y,z,w);

const getGlobalPosition = (obj: THREE.Object3D) => {
    const vec = new THREE.Vector3();
    obj.getWorldPosition(vec);
    return vec;
}

abstract class ThreeObject<Type extends THREE.Object3D> {
    name: string;
    object: Type;
    inheritedOffset: THREE.Vector3;
    offsetFromParent: THREE.Vector3;

    constructor(object: Type, inheritedOffset: THREE.Vector3=new THREE.Vector3()){
        this.name = object.name || object.uuid;
        this.object = object;
        this.inheritedOffset = inheritedOffset;

        const parentCenter = object.parent ? getCenter(object.parent) : new THREE.Vector3();
        this.offsetFromParent = getVectorDiff(parentCenter, getCenter(object));
    }

    abstract shift(): void;
    abstract rotate(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3): void;
    abstract rotateExtra(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3): void;
    abstract getLocalPosition(): THREE.Vector3;
}

export class Vehicle {
    cannonVehicle: CANNON.RigidVehicle;

    constructor(
    { chassis, wheelFL, wheelFR, wheelBL, wheelBR }:
    { 
        chassis: ThreeObject<any>, 
        wheelFL: ThreeObject<any>, 
        wheelFR: ThreeObject<any>, 
        wheelBL: ThreeObject<any>, 
        wheelBR: ThreeObject<any> 
    }){
        console.log({name1: chassis.name, center1: getCenter(chassis.object)})

        const chassisBody = new ThreeObjectPhysicsBox(chassis).cannonObject;
        this.cannonVehicle = new CANNON.RigidVehicle({ chassisBody });

        const centerOfChassisOffset = getCenter(chassis.object).negate();

        for (const threeWheel of [wheelFL, wheelFR, wheelBL, wheelBR]){
            const wheelPhysics = new ThreeObjectPhysicsWheel(threeWheel);

            const localPosition = getCenter(threeWheel.object);
            const localPositionFromCenter = new THREE.Vector3()
                .copy(localPosition)
                .add(centerOfChassisOffset);

            this.cannonVehicle.addWheel({
                body: wheelPhysics.cannonObject,
                position: getCannonVector(localPositionFromCenter),
                axis: new CANNON.Vec3(1, 0, 0),
                direction: new CANNON.Vec3(0, -1, 0)
            })
        }
    }

    move(dist: number, dAngle: number){
        for (const iWheel of [0, 1]){
            this.cannonVehicle.setWheelForce(dist*100, iWheel);
            this.cannonVehicle.setSteeringValue(dAngle * Math.PI/8, iWheel);
        }
    }
}

export abstract class ThreeObjectPhysics<Type extends ThreeObject<THREE.Object3D>> {
    threeObject: Type;
    cannonObject: CANNON.Body;
    offset: THREE.Vector3;
    static instances: ThreeObjectPhysics<any>[] = [];

    constructor(threeObject: Type){
        this.threeObject = threeObject;
        this.cannonObject = this.getCannonObject();
        this.offset = getVectorDiff(
            getCenter(this.threeObject.object), 
            this.threeObject.object.position
        );
        console.log({
            name: this.threeObject.name,
            offset: this.offset, 
            global: getGlobalPosition(this.threeObject.object)
        });
        ThreeObjectPhysics.instances.push(this);
    }

    abstract getCannonObject(): CANNON.Body;

    updateThreeObject() {
        const cannonObj = this.cannonObject;
        const threeObj = this.threeObject.object;

        const euler = new THREE.Euler().setFromQuaternion(getThreeQuaternion(cannonObj.quaternion));
        const vec = new THREE.Vector3().setFromEuler(euler);
       
        ['x','y','z'].forEach((axis) => {
            this.threeObject.rotate((vec as any)[axis], axis as 'x'|'y'|'z');
        })

        threeObj.position.copy(
            getVectorDiff(
                getThreeVector(cannonObj.position),
                this.offset
            )
        )
    }
}

export class ThreeObjectPhysicsBox<Type extends ThreeObject<THREE.Object3D>> extends ThreeObjectPhysics<Type> {

    getCannonObject() {
        const bboxVec = new THREE.Vector3();
        const bbox = getBoundingBox(this.threeObject.object);
        bbox.getSize(bboxVec);
        bboxVec.multiplyScalar(1/2); // half bounding box

        console.log({name: this.threeObject.name, center: getCenter(this.threeObject.object)})

        return new CANNON.Body({
            mass: 1,
            position: getCannonVector(getCenter(this.threeObject.object)),
            shape: new CANNON.Box(getCannonVector(bboxVec)),
            quaternion: getCannonQuaternion(this.threeObject.object.quaternion)

        });
    }
}

export class ThreeObjectPhysicsWheel<Type extends ThreeObject<THREE.Object3D>> extends ThreeObjectPhysics<Type> {

    getCannonObject() {
        const bboxVec = new THREE.Vector3();
        const bbox = getBoundingBox(this.threeObject.object);
        bbox.getSize(bboxVec);

        const zhalf = bboxVec.z/2;

        return new CANNON.Body({
            mass: 10,
            shape: new CANNON.Sphere(zhalf),
            quaternion: getCannonQuaternion(this.threeObject.object.quaternion),
            angularDamping: 0.4,
            material: new CANNON.Material('wheel')
        });
    }
}

export class ThreeMesh extends ThreeObject<THREE.Mesh> {

    rotate(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3){
        point = point ?? new THREE.Vector3(0, 0, 0);

        const { x: origX, y: origY, z: origZ } = this.object.position;
        this.object.position.set(point.x, point.y, point.z);
        this.object.rotation[axis] = angle;
        this.object.position.set(origX, origY, origZ);

        // no use of Object3D.geometry, which is recommended for real-time updates
    }

    rotateExtra(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3){
        this.rotate(this.object.rotation[axis] + angle, axis, point);
    }

    getLocalPosition(): THREE.Vector3 {
        return this.object.position;
    }

    shift() {
        const offset = new THREE.Vector3().copy(this.inheritedOffset).add(this.offsetFromParent);
        this.object.geometry.translate(...decomposeVector(offset));
        this.object.position.copy(new THREE.Vector3().copy(this.offsetFromParent).negate());
    }
}

type GroupComponents = { [name: string]: ThreeObject<THREE.Object3D> };

export class ThreeGroup extends ThreeObject<THREE.Group> {
    components: GroupComponents;
    directComponents: GroupComponents;
    rotation: { x: number, y: number, z: number };
    offset: THREE.Vector3;

    constructor(group: THREE.Group, inheritedOffset?: THREE.Vector3){
        super(group, inheritedOffset);
        const {components, directComponents} = this.getComponents();
        this.components = components;
        this.directComponents = directComponents;
        this.rotation = { x: 0, y: 0, z: 0 };
        this.offset = this.getLocalPosition();

        if (this.object.parent == null){
            this.shift();
        }
    }

    getDescendant(name: string) {
        if (name in this.components){
            return this.components[name];
        }
        const errorMsg = `Could not find descendant ${name} in ${this.name}`;
        console.error({errorMsg, descendants: Object.keys(this.components).join(' ,')});
        throw new Error();
    }

    getComponent(obj: THREE.Object3D){
        const offset = new THREE.Vector3().copy(this.inheritedOffset).add(this.offsetFromParent);

        if (obj instanceof THREE.Mesh){
            return new ThreeMesh(obj, offset);
        } else if (obj instanceof THREE.Group){
            return new ThreeGroup(obj, offset);
        } else {
            throw new Error('unhandled Object3D type:' + obj.constructor.name);
        }
    }

    /*
     * Update $components object to include entries from $childGroup
    */
    static inheritComponents(components: GroupComponents, childGroup: ThreeGroup) {
        for (const [name, component] of Object.entries(childGroup.components)){
            components[name] = component;
        }
    }

    getComponents(){
        const components: GroupComponents = {};
        const directComponents: GroupComponents = {};
        const groups = [this.object];

        while (groups.length !== 0){
            const group = groups.pop()!;
            for (const child of group.children){
                const component = this.getComponent(child);
                components[component.name] = component;
                directComponents[component.name] = component;
                if (component instanceof ThreeGroup){
                    ThreeGroup.inheritComponents(components, component);
                }
            }
        }

        return { components, directComponents };
    }

    static load(path: string, scene: THREE.Scene) {
        const loader = new GLTFLoader();

        return new Promise<ThreeGroup>((resolve, reject) => {
            loader.load(
                process.env.PUBLIC_URL + path, 
                (model) => {
                    console.log(`model at ${path} loaded!`); 
                    const group = model.scene;
                    // group.scale.set(.1,.1,.1);
                    const component = new ThreeGroup(group);

                    console.log({
                        name00: component.getDescendant('Chassis').name, 
                        center00: getCenter(component.getDescendant('Chassis').object)
                    })

                    component.addToScene(scene);
                    resolve(component);
                },
                () => console.log(`loading model at ${path}...`),
                (error) => {
                    const errorMsg = `Error loading model at ${path}! ${error?.message ?? error}`
                    console.error(errorMsg);
                    reject(errorMsg);
                }
            )
        });
    }

    async addToScene(scene: THREE.Scene) {
        scene.add(this.object);
    }

    getLocalPosition(){
        if (this.object.parent != null){
            const parentPosition = getGlobalPosition(this.object.parent);
            const objectCenter = getCenter(this.object); // world position of child is the same as parent, need to use center
            return getVectorDiff(objectCenter, parentPosition);
        } else {
            return new THREE.Vector3(0, 0, 0);
        }
    }

    rotate(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3){
        point = point ?? new THREE.Vector3(0, 0, 0);

        const oldPosition = new THREE.Vector3().copy(this.object.position);
        this.object.position.set(0, 0, 0);
        this.object.rotation[axis] = angle;
        this.object.position.copy(oldPosition);
    }

    rotateExtra(angle: number, axis: 'x'|'y'|'z', point?: THREE.Vector3){
        this.rotate(this.rotation[axis] + angle, axis, point);
    }

    shift() {
        for (const child of Object.values(this.directComponents)){
            child.shift();
        }
        this.object.position.copy(new THREE.Vector3().copy(this.offsetFromParent).negate());
    }
}