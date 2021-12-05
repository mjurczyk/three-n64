<img width="1151" alt="Screenshot 2021-12-05 at 12 20 08" src="https://user-images.githubusercontent.com/9549760/144744412-a17e6772-449e-4124-80b6-f26a0630db65.png">

### How to run

* Clone

* Add valid N64 ROM to `src/game-views/n64/games` (Same directory as a markdown file `PUT-DOM-HERE.md`)

* Run: `npm i && npm start`

* Open localhost:3000

## How to run in VR

* Do steps above

* Download https://ngrok.com/

* Run: `ngrok http 3000`

* Use the `https` version of the ngrok tunnel to connect via Oculus Browser

## Editing the environment

To edit the scene, open `design/gameboy-room.blend` in Blender. Export it to `src/assets/models/gameboy-room.glb` (**NOTE:** Be sure to check "Export custom properties" in the exporter settings.)
