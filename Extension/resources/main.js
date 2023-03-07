document.getElementById("connected_ssh").style.display = "none";
const vscode = acquireVsCodeApi();

document.querySelector("#connect").addEventListener("click", () => {
  vscode.postMessage({
    command: "connect",
    ip: document.querySelector("#ip").value.split("@")[1],
    username: document.querySelector("#ip").value.split("@")[0],
  });
});

window.addEventListener("message", (event) => {

  let message = event.data;
  switch (message.type) {
    case "connected_complete":
      document.querySelector("#connected_ip").textContent = message.ip;

      document.getElementById("connect_ssh").style.display = "none";
      document.getElementById("connected_ssh").style.display = "flex";
      document.querySelector("#ip").value = "Connected!";
      document.querySelector("#connect").disabled = true;
      break;
    case "disconnected_complete":
      document.getElementById("connect_ssh").style.display = "flex";
      document.getElementById("connected_ssh").style.display = "none";
      document.querySelector("#ip").value = "";
      document.querySelector("#connect").disabled = false;
      break;
  }
});

document.querySelector("#exit").addEventListener("click", () => {
  vscode.postMessage({
    command: "exit",
  });
});

document.querySelector("#upload").addEventListener("click", () => {
  vscode.postMessage({
    command: "upload",
  });
});