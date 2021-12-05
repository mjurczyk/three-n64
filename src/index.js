import * as Three from 'three';
import {
  RenderService,
  SystemService,
  DebugFlags,
  DummyDebug,
  GameInfoService
} from 'three-default-cube';
import { GameboyRoomView } from './game-views/gameboy-room';

// NOTE Enable FPS and memory metrics
// DummyDebug.on(DebugFlags.DEBUG_ENABLE);
// DummyDebug.on(DebugFlags.DEBUG_LIVE);
// DummyDebug.on(DebugFlags.DEBUG_LOG_ASSETS);
// DummyDebug.on(DebugFlags.DEBUG_LOG_MEMORY);
// DummyDebug.on(DebugFlags.DEBUG_LOG_POOLS);
// DummyDebug.on(DebugFlags.DEBUG_STORAGE);
// DummyDebug.on(DebugFlags.DEBUG_TIME_LISTENERS);

const VR_MODE = true;

GameInfoService
  .system(60, window.devicePixelRatio, true, !VR_MODE, 0x000000)
  .camera(50, 0.1, 1000.0)
  .texture('spinner', require('./assets/ui/spinner-default.png'))
  .font('default', require('./assets/ui/font.ttf'));

SystemService.init();
SystemService.onReady(async () => {
  const rootElement = document.querySelector('#root');

  RenderService.init({ domElement: rootElement });

  RenderService.getRenderer().xr.enabled = VR_MODE;

  RenderService.renderView(new GameboyRoomView());

  RenderService.run();
});
