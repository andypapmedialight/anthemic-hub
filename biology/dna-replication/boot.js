import init from "./dna_replication_rs.js";

const status = document.getElementById("gpu-status");

if (!navigator.gpu) {
  status.textContent = "This browser has no WebGPU. A current Chrome, Edge, or Firefox will run it.";
} else {
  init().catch(function (err) {
    status.textContent = err && err.message ? err.message : String(err);
  });
}
