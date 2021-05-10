let sound;
let picture;
let download;

let container = document.querySelector(".container");
let bitrates = Object.fromEntries(["audio", "video"].map(e => [e, document.querySelector("."+e+"Bitrate")]));
function syncChange(range) {
  range.parentNode.querySelector("output").textContent = range.value + "kbps";
}
Object.values(bitrates).forEach(e => {
  e.addEventListener("input", event => syncChange(event.target));
  syncChange(e);
});
let convertImmedately = document.querySelector(".convertImmedately");

function captureStream(source) {
  if (source.mozCaptureStream) {
    return source.mozCaptureStream();
  } else {
    return source.captureStream();
  }
}

function checkLoaded() {
  if (!sound || !picture) return;
  let muxStream;
  let canvas = picture.canvas;
  let audio = sound.audio;

  let canvasStream = captureStream(canvas);
  let audioStream = captureStream(audio);
  muxStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.getAudioTracks()
  ]);
  console.log(muxStream.getAudioTracks());
  console.log(muxStream.getVideoTracks());
  let mimeType = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9,vorbis",
    "video/webm;codecs=h264,aac",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8,vorbis",
    "video/webm"
  ].find(e => MediaRecorder.isTypeSupported(e));
  console.log("mimeType:", mimeType);
  let recorder = new MediaRecorder(muxStream, {
    audioBitsPerSecond: +bitrates.audio.value*1000,
    videoBitsPerSecond: +bitrates.video.value*1000,
    mimeType
  });
  let chunks = [];
  recorder.addEventListener("dataavailable", event => {
    let blob = event.data;
    console.log("Data: ", blob, blob.size / 1024);
    chunks.push(blob);
  });

  recorder.addEventListener("stop", _ => {
    console.log("Recorder stopped at", audio.currentTime);
    let a = document.createElement("a");
    let now = new Date();
    let fn = [now.getFullYear(), now.getMonth()+1, now.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds(), ".webm"].join("");
    let blob = new Blob(chunks, {type: "video/webm"});
    let blobUrl = URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = fn;
    a.textContent = fn+" ("+(blob.size/1048576).toFixed(2)+" MB)";
    container.appendChild(a);
    let video = document.createElement("video");
    video.controls = true;
    video.src = blobUrl;
    container.appendChild(video);
    if (download) download.remove();
    download = {
      remove() {
        a.remove();
        video.remove();
        URL.revokeObjectURL(blobUrl);
      }
    };
  });
  audio.addEventListener("ended", _ => {
    console.log("Audio has ended");
    recorder.stop();
  });
  audio.addEventListener("play", _ => {
    console.log("Start recording");
    recorder.start(5000);
  });
  if (convertImmedately.checked)
    audio.play();
}

function createBlurred(img, radius) {
  let canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  let ctx = canvas.getContext("2d");
  ctx.filter = "blur("+radius+"px)"
  ctx.drawImage(img, 0, 0);
  return canvas;
}

dropHandler(document.body, file => {
  let blobUrl = URL.createObjectURL(file);
  if (download) {
    download.remove();
    download = null;
  }
  if (file.type.startsWith("image/")) {
    let img = document.createElement("img");
    img.addEventListener("load", _ => {
      if (picture) picture.remove();
      let canvas = document.createElement("canvas");
      picture = {
        canvas,
        remove() {
          URL.revokeObjectURL(blobUrl);
          canvas.remove();
        }
      };

      let boxes = [[426, 240], [640, 360], [854, 480], [1280, 720], [1920, 1080]];
      let imgDim = [img.naturalWidth, img.naturalHeight];
      let { size, contain, cover } = boxes
        .reduceRight((acc, box, i) => {
          if (acc) return acc;
          let scales = imgDim.map((e, i) => box[i] / e);
          let containScale = Math.min(...scales);
          let coverScale = Math.max(...scales);
          console.log(box, scales, acc, containScale);
          if (containScale < 1 || i <= 0) {
            return {
              size: box,
              contain: imgDim.map(e => e*containScale),
              cover: imgDim.map(e => e*coverScale)
            };
          }
          return null;
        }, null);

      let blurred = createBlurred(img, 0.5 * imgDim[0] / contain[0]);
      canvas.width = size[0];
      canvas.height = size[1];
      let ctx = canvas.getContext("2d");
      let blur = size[1]/128;
      ctx.filter = "blur("+blur+"px)";
      ctx.drawImage(img,
        0.5*(canvas.width - cover[0]),
        0.5*(canvas.height - cover[1]),
        cover[0], cover[1]);
      ctx.filter = "";
      ctx.fillStyle = "#0008";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = "drop-shadow(0 0 "+blur*8+"px #0008)";
      ctx.drawImage(blurred,
        0.5*(canvas.width - contain[0]),
        0.5*(canvas.height - contain[1]),
        contain[0], contain[1]);

      container.appendChild(canvas);
      checkLoaded();
    });
    img.src = blobUrl;
  } else {
    if (sound) sound.remove();
    let audio = document.createElement("audio");
    audio.src = blobUrl;
    audio.controls = true;
    audio.addEventListener("loadeddata", _ => {
      container.appendChild(audio);
      sound = {
        audio,
        remove() {
          URL.revokeObjectURL(blobUrl);
          audio.remove();
        }
      };
      checkLoaded();
    });
  }
});
