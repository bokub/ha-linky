# Home Assistant APSystems Add-on

## Running locally

- Comment the `image` line in `config.yaml` so the add-on can be rebuilt locally
- Open in VSCode with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) installed
- If not in a container already, click on "Reopen in container" when prompted
- Click Terminal > Run Task > Start Home Assistant
- Open [localhost:7123](http://localhost:7123)
- Install the add-on and configure it
- To access the add-on logs, open the terminal in VSCode, and run `docker logs addon_local_linky -f`
- Click the "rebuild" button in the add-on configuration to rebuild the add-on
- Enjoy!

## Building locally

```bash
docker run --rm --privileged \
	-v ~/.docker:/root/.docker \
	-v ./:/data \
	homeassistant/amd64-builder --all -t /data --test --docker-hub ghcr.io/J-Phiz
```
