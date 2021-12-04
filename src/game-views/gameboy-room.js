import * as Three from 'three';
import GameboyRoomModel from '../assets/models/gameboy-room.glb';
import envMapLight from '../assets/hdri/env-map-light.hdr';
import envMapReflections from '../assets/hdri/reflection.jpg';

// GameBoy Online (https://github.com/taisel/GameBoy-Online)
import { initGameboy } from './gameboy/GameBoyIO';

import {
  ViewClass,
  Preloader,
  AssetsService,
  CameraService,
  SceneService,
  RenderService,
  TimeService,
  UtilsService,
  MathService,
  VarService,
  InputService,
  AnimationService,
  MathUtils,
  mathPi2,
} from 'three-default-cube';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/* eslint-disable */
import romHarryPotterGBC from '!!binary-loader!./gameboy/games/harry-potter';
import romZeldaN64 from '!!binary-loader!./n64/games/zelda-n64';

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

    const {
      start: startGameboy,
      gameBoyKeyDown,
      gameBoyKeyUp,
    } = initGameboy();

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 160;
    screenCanvas.height = 144;
    const screenContext = screenCanvas.getContext('2d');
    screenContext.fillStyle = '#110011';
    screenContext.fillRect(0, 0, 160, 144);

    const screenTexture = new Three.CanvasTexture(screenCanvas);
    screenTexture.minFilter = Three.NearestFilter;
    screenTexture.magFilter = Three.NearestFilter;

    const tiltBox = new Three.Group();
    const tilt = {
      x: 0.0,
      y: 0.0,
    };

    const selectGame = (then) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.addEventListener('change', function () {
        if (typeof this.files === 'undefined' || !this.files.length) {
          return;
        }

        const reader = new FileReader();
        reader.onload = function () {
          if (this.readyState === 2) {
            then(this.result);
          }
        };
        reader.readAsBinaryString(this.files[this.files.length - 1]);
      });
      input.click();
    };

    const createClickableButton = (button, key, callback) => {
      let enabled = false;

      TimeService.registerFrameListener(() => {
        const keyValue = InputService.keys[key];

        if (keyValue) {
          if (!enabled) {
            enabled = true;
            callback(true);
          }
        } else {
          if (enabled) {
            enabled = false;
            callback(false);
          }
        }

        button.position.x = Three.MathUtils.lerp(button.position.x, keyValue ? -0.09 : 0.0, 0.4);
      });
    };

    new Preloader({
      requireAssets: [
        AssetsService.getModel(GameboyRoomModel)
      ],
      onComplete: ([
        worldModel
      ]) => {
        RenderService.getScene().background = new Three.Color(0x010101);

        AssetsService.getImage(envMapReflections).then(texture => {
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
            cartridgePreview: (object) => {
              cartridgePreview = object;
            },
            screen: (object) => {
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
            powerLight: (object) => {
              const originalMaterial = AssetsService.cloneMaterial(object.material);
              const enabledMaterial = new Three.MeshBasicMaterial({
                color: 0xff0000
              });

              VarService.getVar('powerOn', (value) => {
                if (value) {
                  object.material = enabledMaterial;
                } else {
                  object.material = originalMaterial;
                }
              });
            },
            ctrlDPad: (object) => {
              TimeService.registerFrameListener(() => {
                const keyW = InputService.keys['w'];
                const keyS = InputService.keys['s'];
                const keyA = InputService.keys['a'];
                const keyD = InputService.keys['d'];

                let angleY = 0.0;
                let angleZ = 0.0;

                if (keyW) {
                  angleY = MathUtils.degToRad(-9.0);
                } else if (keyS) {
                  angleY = MathUtils.degToRad(9.0);
                } else {
                  angleY = 0.0;
                }

                if (keyA) {
                  angleZ = MathUtils.degToRad(9.0);
                } else if (keyD) {
                  angleZ = MathUtils.degToRad(-9.0);
                } else {
                  angleZ = 0.0;
                }

                keyW ? gameBoyKeyDown('up') : gameBoyKeyUp('up');
                keyS ? gameBoyKeyDown('down') : gameBoyKeyUp('down');
                keyA ? gameBoyKeyDown('left') : gameBoyKeyUp('left');
                keyD ? gameBoyKeyDown('right') : gameBoyKeyUp('right');

                object.rotation.z = Three.MathUtils.lerp(object.rotation.z, -mathPi2 + angleY, 0.2);
                object.rotation.y = Three.MathUtils.lerp(object.rotation.y, angleZ, 0.2);
              });
            },
            ctrlA: (object) => {
              createClickableButton(object, 'k', (status) => {
                const key = 'b';

                if (status) {
                  gameBoyKeyDown(key);
                } else {
                  gameBoyKeyUp(key);
                }
              });
            },
            ctrlB: (object) => {
              createClickableButton(object, 'o', (status) => {
                const key = 'a';

                if (status) {
                  gameBoyKeyDown(key);
                } else {
                  gameBoyKeyUp(key);
                }
              });
            },
            ctrlStart: (object) => {
              createClickableButton(object, 'c', (status) => {
                const key = 'start';

                if (status) {
                  gameBoyKeyDown(key);
                } else {
                  gameBoyKeyUp(key);
                }
              });
            },
            ctrlSelect: (object) => {
              createClickableButton(object, 'v', (status) => {
                const key = 'select';

                if (status) {
                  gameBoyKeyDown(key);
                } else {
                  gameBoyKeyUp(key);
                }
              });
            },
          },
          actions: {
            cartridge: (target) => {
              const { userData } = target;

              selectedRom = userData.propRom;

              if (userData.propRom === 'local') {
                selectGame((game) => {
                  startGame(game);
                });
              } else {
                startGame();
              }
            },
            uploadRom: () => {
              alert('upload');
            }
          },
          onCreate: () => {
            CameraService.detachCamera();

            scene.add(worldModel);
            scene.add(tiltBox);

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

            // startGameboy(screenCanvas, romHarryPotterGBC);
            // startN64(screenCanvas, romZeldaN64);

            // const tiltElements = [];

            // worldModel.traverse(child => {
            //   if (child.userData.propTilt) {
            //     tiltElements.push(child);
            //   }
            // });

            // tiltElements.forEach(child => tiltBox.add(child));

            // TimeService.registerFrameListener(() => {
            //   const { keys } = InputService;
              
            //   tilt.x = 0.0;
            //   tilt.y = 0.0;
              
            //   if (keys['w']) tilt.x += 0.01;
            //   if (keys['s']) tilt.x -= 0.01;

            //   if (keys['a']) tilt.y -= 0.025;
            //   if (keys['o']) tilt.y += 0.025;

            //   if (keys['c'] || keys['v']) tilt.x -= 0.02;

            //   tiltBox.rotation.z = Three.MathUtils.lerp(tiltBox.rotation.z, tilt.x, 0.05);
            //   tiltBox.rotation.y = Three.MathUtils.lerp(tiltBox.rotation.y, tilt.y, 0.05);
            // });
          }
        });
      }
    });
  }
}
