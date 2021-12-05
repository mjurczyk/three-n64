import * as Three from 'three';
import GameboyRoomModel from '../assets/models/gameboy-room.glb';
import envMapReflections from '../assets/hdri/reflection.jpg';

import {
  ViewClass,
  Preloader,
  AssetsService,
  CameraService,
  SceneService,
  RenderService,
  TimeService,
  UtilsService,
  MathService
} from 'three-default-cube';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';

/* eslint-disable */
import romN64 from '!!binary-loader!./n64/games/rom';

export class GameboyRoomView extends ViewClass {
  onCreate() {
    const scene = RenderService.getScene();
    const renderer = RenderService.getRenderer();

    document.body.appendChild(VRButton.createButton(RenderService.getRenderer()));

    const controller1 = renderer.xr.getController(0);
    scene.add(controller1);

    const controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();

    const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    const controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    controller1.addEventListener('selectstart', () => controller1.userData.active = true);
    controller1.addEventListener('selectend', () => controller1.userData.active = false);

    controller2.addEventListener('selectstart', () => controller2.userData.active = true);
    controller2.addEventListener('selectend', () => controller2.userData.active = false);

    let vrPickable = [];

    const registerVRRaycasting = (controllers = []) => {
      const raycaster = UtilsService.getRaycaster();
      const matrix4 = new Three.Matrix4();

      const holdItem = (controller, pivot) => {
        controller.userData.holding = pivot;
        pivot.visible = false;

        controller.userData.target = null;
      };

      const dropItem = (controller) => {
        if (controller.userData.holding) {
          const pivot = controller.userData.holding;

          pivot.visible = true;

          controller.userData.holding = null;
        }
      };

      TimeService.registerFrameListener(() => {
        controllers.forEach(controller => {
          if (controller.userData.holding) {
            if (!controller.userData.active) {
              dropItem(controller);
            } else {
              const item = controller.userData.holding.parent;

              const position = new Three.Vector3();
              const quaternion = new Three.Quaternion();

              controller.getWorldPosition(position);
              controller.getWorldQuaternion(quaternion);

              item.position.lerp(position, 0.25);
              item.quaternion.slerp(quaternion, 0.25);
            }

            return;
          }

          matrix4.identity().extractRotation(controller.matrixWorld);

          raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
          raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix4);
          raycaster.near = 0.01;
          raycaster.far = 5.0;

          const intersections = raycaster.intersectObjects(vrPickable, false);

          if (intersections.length) {
            controller.userData.target = intersections[0].object;

            if (controller.userData.target) {
              controller.userData.target.traverse(child => {
                if (child.material) {
                  child.material.opacity = 1.0;
                }
              });
            }
          } else {
            if (controller.userData.target) {
              controller.userData.target.traverse(child => {
                if (child.material) {
                  child.material.opacity = 0.5;
                }
              });
            }

            controller.userData.target = null;
          }

          if (controller.userData.active && controller.userData.target) {
            const parent = controller.userData.target.parent;
            const parentPosition = MathService.getVec3();
            const controllerPosition = MathService.getVec3();

            parent.getWorldPosition(parentPosition);
            controller.getWorldPosition(controllerPosition);

            const direction = controllerPosition.sub(parentPosition);

            if (direction.length() <= 1.0) {
              holdItem(controller, controller.userData.target);
            } else {
              parent.position.add(direction.normalize().multiplyScalar(0.01));
            }

            MathService.releaseVec3(parentPosition);
          }
        });
      });
    };

    registerVRRaycasting([ controller1, controller2 ]);

    new Preloader({
      requireAssets: [
        AssetsService.getModel(GameboyRoomModel)
      ],
      onComplete: ([
        worldModel
      ]) => {
        RenderService.getScene().background = new Three.Color(0x010101);

        AssetsService.getImage(envMapReflections).then(texture => {
          // NOTE Move to DefaultCube
          const renderer = RenderService.getRenderer();
          const generator = new Three.PMREMGenerator(renderer);
          const renderTarget = generator.fromEquirectangular(texture);
          const hdri = renderTarget.texture;
          hdri.encoding = Three.sRGBEncoding;
          AssetsService.registerDisposable(hdri);
          AssetsService.registerDisposable(renderTarget);
          texture.dispose();
          generator.dispose();

          scene.environment = hdri;
        });
        scene.add(AssetsService.getAmbientLight(0xffffff, 0x30304d, 1.0));

        SceneService.parseScene({
          target: worldModel,
          gameObjects: {
            screen: (object) => {
              const screenTexture = new Three.CanvasTexture(document.querySelector('#canvas'));
              screenTexture.minFilter = Three.NearestFilter;
              screenTexture.magFilter = Three.NearestFilter;

              object.traverse(child => {
                if (child.material) {
                  child.material = new Three.MeshBasicMaterial({
                    map: screenTexture
                  });
                }
              });

              TimeService.registerFrameListener(() => {
                screenTexture.needsUpdate = true;
              });
            },
            transparentGlass: (object) => {
              object.traverse(child => {
                if (child.material) {
                  child.material = new Three.MeshPhysicalMaterial({
                    transmission: 0.9,
                    transparent: true,
                    opacity: 1.0,
                    roughness: 0,
                    metalness: 0,
                    depthWrite: false
                  })
                }
              });
            },
          },
          actions: {
            
          },
          onCreate: () => {
            if (RenderService.getRenderer().xr.enabled) {
              CameraService.detachCamera();
            } else {
              CameraService.useCamera(CameraService.getCamera('noVR'));
  
              setTimeout(() => {
                CameraService.detachCamera();
              }, 3000);
            }

            scene.add(worldModel);

            scene.traverse(child => {
              if (child.userData.vrPickable) {
                const pivot = new Three.Mesh(
                  new Three.SphereGeometry(0.25, 4, 3),
                  new Three.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.5,
                    side: Three.DoubleSide
                  })
                );
  
                child.add(pivot);
                vrPickable.push(pivot);
              }
            });

            window["myApp"].uploadRom(romN64);
          }
        });
      }
    });
  }
}
