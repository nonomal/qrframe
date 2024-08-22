export const paramsSchema = {
  Image: {
    type: "File",
  },
  Contrast: {
    type: "number",
    min: 0,
    max: 10,
    step: 0.1,
    default: 1,
  },
  Brightness: {
    type: "number",
    min: 0,
    max: 5,
    step: 0.1,
    default: 1.8,
  },
  "QR background": {
    type: "boolean",
  },
  "Alignment pattern": {
    type: "boolean",
    default: true,
  },
  "Timing pattern": {
    type: "boolean",
  },
  Margin: {
    type: "number",
    min: 0,
    max: 10,
    default: 2,
  },
  Foreground: {
    type: "Color",
    default: "#000000",
  },
  Background: {
    type: "Color",
    default: "#ffffff",
  },
};

const Module = {
  DataOFF: 0,
  DataON: 1,
  FinderOFF: 2,
  FinderON: 3,
  AlignmentOFF: 4,
  AlignmentON: 5,
  TimingOFF: 6,
  TimingON: 7,
  FormatOFF: 8,
  FormatON: 9,
  VersionOFF: 10,
  VersionON: 11,
  SeparatorOFF: 12,
};

export async function renderCanvas(qr, params, canvas) {
  const unit = 3;
  const pixel = 1;

  const matrixWidth = qr.version * 4 + 17;
  const margin = params["Margin"];
  const fg = params["Foreground"];
  const bg = params["Background"];
  const alignment = params["Alignment pattern"];
  const timing = params["Timing pattern"];
  let file = params["Image"];
  if (file == null) {
    file = await fetch(
      "https://upload.wikimedia.org/wikipedia/commons/1/14/The_Widow_%28Boston_Public_Library%29_%28cropped%29.jpg"
    ).then((res) => res.blob());
  }
  const image = await createImageBitmap(file)

  const pixelWidth = matrixWidth + 2 * margin;
  const canvasSize = pixelWidth * unit;
  const ctx = canvas.getContext("2d");
  ctx.canvas.width = canvasSize;
  ctx.canvas.height = canvasSize;

  if (params["QR background"]) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = fg;
    for (let y = 0; y < matrixWidth; y++) {
      for (let x = 0; x < matrixWidth; x++) {
        const module = qr.matrix[y * matrixWidth + x];
        if (module & 1) {
          const px = x + margin;
          const py = y + margin;
          ctx.fillRect(px * unit, py * unit, unit, unit);
        }
      }
    }
  }

  ctx.filter = `brightness(${params["Brightness"]}) contrast(${params["Contrast"]})`;
  ctx.drawImage(image, 0, 0, canvasSize, canvasSize);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
  const data = imageData.data;

  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const i = (y * canvasSize + x) * 4;

      if (data[i + 3] === 0) continue;
      // Convert to grayscale and normalize to 0-255
      const oldPixel =
        (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;

      let newPixel;
      if (oldPixel < 128) {
        newPixel = 0;
        ctx.fillStyle = fg;
      } else {
        newPixel = 255;
        ctx.fillStyle = bg;
      }
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);

      data[i] = data[i + 1] = data[i + 2] = newPixel;
      const error = oldPixel - newPixel;

      // Distribute error to neighboring pixels
      if (x < canvasSize - 1) {
        data[i + 4] += (error * 7) / 16;
      }
      if (y < canvasSize - 1) {
        if (x > 0) {
          data[i + canvasSize * 4 - 4] += (error * 3) / 16;
        }
        data[i + canvasSize * 4] += (error * 5) / 16;
        if (x < canvasSize - 1) {
          data[i + canvasSize * 4 + 4] += (error * 1) / 16;
        }
      }
    }
  }

  const dataOffset = (unit - pixel) / 2;

  for (let y = 0; y < matrixWidth; y++) {
    for (let x = 0; x < matrixWidth; x++) {
      const module = qr.matrix[y * matrixWidth + x];
      if (module & 1) {
        ctx.fillStyle = fg;
      } else {
        ctx.fillStyle = bg;
      }

      const px = x + margin;
      const py = y + margin;

      const type = module | 1;
      if (
        type === Module.FinderON ||
        (alignment && type === Module.AlignmentON) ||
        (timing && type === Module.TimingON)
      ) {
        ctx.fillRect(px * unit, py * unit, unit, unit);
      } else {
        ctx.fillRect(
          px * unit + dataOffset,
          py * unit + dataOffset,
          pixel,
          pixel
        );
      }
    }
  }
}