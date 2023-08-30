# Home Assistant Linky Add-on

## Running locally

- Open in VSCode with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) installed
- If not in a container already, click on "Reopen in container" when prompted
- Click Terminal > Run Task > Start Home Assistant
- Open [localhost:7123](http://localhost:7123)
- Install the add-on and configure it
- Enjoy!

## Building locally

```bash
docker run --rm --privileged \
	-v ~/.docker:/root/.docker \
	-v ./:/data \
	homeassistant/amd64-builder --all -t /data
```
