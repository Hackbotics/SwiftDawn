import * as vscode from 'vscode';
import { NodeSSH, SSHPutFilesOptions } from 'node-ssh';
export function activate(context: vscode.ExtensionContext) {

	const provider = new SwiftDawn(context.extensionUri);

	// register the view provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SwiftDawn.viewType,
			provider,
		),
	);
}

// Create a webview view provider that we can register with the window
class SwiftDawn implements vscode.WebviewViewProvider {
	
	public static readonly viewType = 'swiftdawn-sidebar';

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		let ssh = new NodeSSH();

		webviewView.webview.onDidReceiveMessage(async (event) => {
			switch (event.command) {
				case "connect":
					vscode.window.showInformationMessage("Connecting to " + event.ip);
					// get password
					let password = await vscode.window.showInputBox({
						placeHolder: "Password for " + event.ip,
						password: true
					});

					try {
						ssh = await ssh.connect({
							host: event.ip,
							username: 'pi',
							password: password
						});

						vscode.window.showInformationMessage("Successfully Connected to " + event.ip);
						webviewView.webview.postMessage({
							"type": "connected_complete",
							"ip": event.ip
						});
					} catch (error) {
					vscode.window.showErrorMessage("Failed to connect to " + event.ip);
				}
				break;
				case "exit":
					try {
						ssh.dispose();
						vscode.window.showInformationMessage("Disconnecting from remote...");
						webviewView.webview.postMessage({
							"type": "disconnected_complete",
							"ip": event.ip
						});
					}
					catch (error) {
						vscode.window.showErrorMessage("Failed to disconnect from " + event.ip);
					}
				break;
				case "upload":
					try {
						if (!ssh.isConnected()) {
							vscode.window.showErrorMessage("Please connect to a remote before uploading a file.");
							return;
						}
						let uploads = await vscode.window.showOpenDialog({
							canSelectMany: false,
							canSelectFolders: false,
							defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
							canSelectFiles: true,
							openLabel: "Upload"
						});
	
						if (!uploads) {
							return;
						}
						let workspace = vscode.workspace.name || "Untitled Workspace";
	
						let filesupload: { local: string, remote: string }[] = [];
						for (let upload of uploads) {
							filesupload.push({
								local: upload.fsPath,
								remote: './Desktop/DawnUploads/' + workspace + '/' + upload.fsPath.split('\\').pop()
							})
						}
						vscode.window.showInformationMessage("Uploading files to remote...");
						await ssh.putFiles(filesupload);
						vscode.window.showInformationMessage("Successfully uploaded " + filesupload.length + " file(s). You can find them in the ~/Desktop/DawnUploads/" + workspace + " folder on the remote.");
					} catch (error) {
						vscode.window.showErrorMessage("Failed to upload files to remote.");
						console.error(error);
					}
					break;


			}
		})

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.css'));
		const vscodeStylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'vscode.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = this.getNonce();

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${styleUri}" rel="stylesheet">
			<link href="${vscodeStylesUri}" rel="stylesheet">
			<title>SwiftDawn</title>
		</head>
		<body>
			<div class="connection">
				<div class="inline-flex" id="connect_ssh">
					<input type="text" class="ip" placeholder="IP Address + Host" id="ip" />
					<button class="connect svgbutton" id="connect">
						<img width="25" height="15" src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'play.svg'))}" alt="Connect" />
					</button>
				</div>

				<div class="inline-flex" id="connected_ssh">
					<img width="25" height="15" src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'connected.svg'))}" alt="Connected" />
					<h1 id="connected_ip" style="margin-right: 5px;"></h1>
					<button class="connect svgbutton" id="exit">
						<img width="25" height="15" src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'close.svg'))}" alt="Close" />
					</button>
				</div>


				<button class="gamepad svgbutton" id="gamepad">
					<img width="25" height="15" src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'gamepad.svg'))}" alt="Gamepad" />
				</button>

				<button class="upload svgbutton" id="upload">
					<img width="15" height="15" src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'upload.svg'))}" alt="Upload" />
				</button>
			</div>

			<div>
			</div>

			<!-- <div class="guide">

				<h1>Welcome to SwiftDawn!</h1>
				<p>SwiftDawn is a tool that allows you to connect to your RaspberryPi and upload code directly to it! You can also upload
					a game controller to use as a controller for your robot as well as get instant feedback for if your code works or not!</p>
				</p>
				<p>
					First, connect to your device by entering the IP Address and Host. Then, upload your code to the device by clicking the upload button.
					You can also utilize a game controller by clicking the gamepad button. Once you have uploaded your code, you can click the play button to run your code.
					You can also click the stop button to stop your code from running.
				</p>
			</div> -->

			<script nonce="${nonce}" src="${scriptUri}" defer></script>
		</body>
		</html>`;
	}

	public getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

}