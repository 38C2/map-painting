const defaultCountryFill = "#e8e1d5";
const countryStroke = "#2b2b2b";
const mapSvgPath = "./worldmap-done.svg";
const countryCodeCsvPath = "./country_code.csv";
// const zoomStep = 0.25;
const minMapScale = 0.5;
const maxMapScale = 5;

const TOOL_PAINT = "paint";
const TOOL_ERASE = "erase";
const TOOL_DRAG = "drag";

// 当前正在使用的颜色，由 palette manager 统一管理。
let activeColor = null;
let activeTool = TOOL_PAINT;
let mapScale = 1;
let currentSvgRoot = null;
let paintToolButton;
let eraseToolButton;
let clearAllToolButton;
let dragToolButton;
let isDraggingMap = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartScrollLeft = 0;
let dragStartScrollTop = 0;
let baseStatusText = "正在加载地图…";

// 这里记录“每个区域当前用了什么颜色”，给自动图例使用。
const paintedCountries = new Map();
const countryNamesByCode = new Map();

// 先把页面里后面要操作到的元素拿出来，避免反复查询。
const paintToolsEl = document.getElementById("paint-tools");
const mapToolsEl = document.getElementById("map-tools");
const paletteEl = document.getElementById("color-palette");
const currentColorChipEl = document.getElementById("current-color-chip");
const currentColorLabelEl = document.getElementById("current-color-label");
const mapLegendEl = document.getElementById("map-legend");
const mapLegendFr = document.getElementById("map-legend-frame");
const legendEditorRootEl = document.getElementById("legend-editor-root");
const legendPlainToggleEl = document.getElementById("legend-plain-toggle");
const legendFontSizeSliderEl = document.getElementById("legend-font-size-slider");
const legendFontSizeValueEl = document.getElementById("legend-font-size-value");
const legendRootEl = document.getElementById("legend-root");
const statusEl = document.getElementById("status");
const mapContainerEl = document.getElementById("map-container");
const zoomSliderEl = document.getElementById("zoom-slider");
const zoomResetButtonEl = document.getElementById("zoom-reset-button");
const zoomLabelEl = document.getElementById("zoom-label");
const exportJpgButtonEl = document.getElementById("export-jpg-button");

const paletteManager = createPaletteManager({
  paletteEl,
  onActiveColorChange(color) {
    activeColor = color;
    updateCurrentColor();

    if (activeTool === TOOL_PAINT) {
      updateToolStatus();
    }

    refreshLegend();
  },
  onPaletteChange() {
    refreshLegend();
  },
});

const legendManager = createLegendManager({
  mapLegendEl,
  mapLegendFr,
  legendEditorRootEl,
  legendPlainToggleEl,
  legendFontSizeSliderEl,
  legendFontSizeValueEl,
  legendRootEl,
});

// 页面启动后，先生成色板，再显示当前颜色，最后从文件加载地图。
renderTools();
activeColor = paletteManager.getActiveColor();
updateCurrentColor();
updateToolStatus();
initZoomControls();
bindDragInteractions();
bindExportActions();
refreshLegend();
initMap();

function setActiveTool(tool) {
  activeTool = tool;

  paintToolButton?.classList.toggle("is-active", tool === TOOL_PAINT);
  eraseToolButton?.classList.toggle("is-active", tool === TOOL_ERASE);
  dragToolButton?.classList.toggle("is-active", tool === TOOL_DRAG);
  mapContainerEl.classList.toggle("is-drag-mode", tool === TOOL_DRAG);

  if (tool !== TOOL_DRAG) {
    stopMapDragging();
  }
}

function updateToolStatus() {
  if (activeTool === TOOL_DRAG) {
    setBaseStatus("当前工具：拖动");
    return;
  }

  if (activeTool === TOOL_ERASE) {
    setBaseStatus("当前工具：擦除");
    return;
  }

  setBaseStatus(`当前工具：填色 ${activeColor.name}`);
}

function renderTools() {
  const paintButton = document.createElement("button");
  paintButton.type = "button";
  paintButton.className = "tool-button is-active";
  paintButton.textContent = "填色";

  const eraseButton = document.createElement("button");
  eraseButton.type = "button";
  eraseButton.className = "tool-button";
  eraseButton.textContent = "擦除";

  const clearAllButton = document.createElement("button");
  clearAllButton.type = "button";
  clearAllButton.className = "tool-button";
  clearAllButton.textContent = "清空";

  const dragButton = document.createElement("button");
  dragButton.type = "button";
  dragButton.className = "tool-button";
  dragButton.textContent = "拖动";

  paintToolButton = paintButton;
  eraseToolButton = eraseButton;
  clearAllToolButton = clearAllButton;
  dragToolButton = dragButton;

  paintButton.addEventListener("click", () => {
    setActiveTool(TOOL_PAINT);
    updateToolStatus();
  });

  eraseButton.addEventListener("click", () => {
    setActiveTool(TOOL_ERASE);
    updateToolStatus();
  });

  clearAllButton.addEventListener("click", () => {
    clearAllPaint();
  });

  dragButton.addEventListener("click", () => {
    setActiveTool(TOOL_DRAG);
    updateToolStatus();
  });

  paintToolsEl.appendChild(paintButton);
  paintToolsEl.appendChild(eraseButton);
  paintToolsEl.appendChild(clearAllButton);
  mapToolsEl.appendChild(dragButton);
}

function updateCurrentColor() {
  // 左侧“当前颜色”那一行，只是做界面同步显示。
  if (!activeColor) {
    currentColorChipEl.style.backgroundColor = "#ffffff";
    currentColorLabelEl.textContent = "";
    return;
  }

  currentColorChipEl.style.backgroundColor = activeColor.value;
  currentColorLabelEl.textContent = `${activeColor.name} ${activeColor.value}`;
}

function refreshLegend() {
  const usedColorValues = new Set(paintedCountries.values());
  const usedColors = paletteManager
    .getPalette()
    .filter((color) => usedColorValues.has(color.value));
  legendManager.render(usedColors);
}

function setBaseStatus(text) {
  baseStatusText = text;
  statusEl.textContent = text;
}

function showHoverStatus(text) {
  statusEl.textContent = text;
}

// 缩放
function initZoomControls() {
  zoomResetButtonEl.addEventListener("click", () => {
    setMapScale(1);
  });

  zoomSliderEl.addEventListener("input", () => {
    setMapScale(Number(zoomSliderEl.value) / 100);
  });

  updateZoomUi();
}

function setMapScale(nextScale) {
  const clampedScale = Math.max(minMapScale, Math.min(maxMapScale, nextScale));
  mapScale = Math.round(clampedScale * 100) / 100;
  applyMapScale();
  updateZoomUi();
}

function applyMapScale() {
  if (!currentSvgRoot) {
    return;
  }

  currentSvgRoot.style.width = `${mapScale * 100}%`;
}

function updateZoomUi() {
  zoomLabelEl.textContent = `${Math.round(mapScale * 100)}%`;
  zoomSliderEl.value = String(Math.round(mapScale * 100));
}

function bindDragInteractions() {
  mapContainerEl.addEventListener("pointerdown", (event) => {
    if (activeTool !== TOOL_DRAG) {
      return;
    }

    isDraggingMap = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartScrollLeft = mapContainerEl.scrollLeft;
    dragStartScrollTop = mapContainerEl.scrollTop;
    mapContainerEl.classList.add("is-dragging");
    mapContainerEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  mapContainerEl.addEventListener("pointermove", (event) => {
    if (!isDraggingMap || activeTool !== TOOL_DRAG) {
      return;
    }

    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    mapContainerEl.scrollLeft = dragStartScrollLeft - deltaX;
    mapContainerEl.scrollTop = dragStartScrollTop - deltaY;
  });

  mapContainerEl.addEventListener("pointerup", () => {
    stopMapDragging();
  });

  mapContainerEl.addEventListener("pointercancel", () => {
    stopMapDragging();
  });
}

function bindExportActions() {
  exportJpgButtonEl.addEventListener("click", async () => {
    try {
      await exportVisibleMapAsJpg();
      setBaseStatus("已导出 JPG。");
    } catch (error) {
      if (error && error.name === "AbortError") {
        setBaseStatus("已取消导出。");
        return;
      }

      console.error("Failed to export JPG:", error);
      setBaseStatus("导出 JPG 失败。");
    }
  });
}

function stopMapDragging() {
  if (!isDraggingMap) {
    mapContainerEl.classList.remove("is-dragging");
    return;
  }

  isDraggingMap = false;
  mapContainerEl.classList.remove("is-dragging");
}

function clearAllPaint() {
  if (!currentSvgRoot) {
    return;
  }

  paintedCountries.clear();

  currentSvgRoot
    .querySelectorAll("#ne_10m_admin_0_countries_chn path[data-country-code]")
    .forEach((path) => {
      path.style.fill = defaultCountryFill;
    });

  refreshLegend();
  setActiveTool(TOOL_PAINT);
  setBaseStatus("已清空全部填色。");
}

async function exportVisibleMapAsJpg() {
  if (!currentSvgRoot) {
    throw new Error("SVG is not loaded.");
  }

  const exportMetrics = getMapExportMetrics();
  const canvasWidth = Math.round(exportMetrics.viewportWidth);
  const canvasHeight = Math.round(exportMetrics.viewportHeight);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  context.fillStyle = "rgb(255, 251, 245)";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const svgDataUrl = buildVisibleSvgDataUrl(exportMetrics);
  const mapImage = await loadImage(svgDataUrl);
  context.drawImage(
    mapImage,
    exportMetrics.paddingLeft,
    exportMetrics.paddingTop,
    exportMetrics.innerWidth,
    exportMetrics.innerHeight
  );

  drawLegendOnCanvas(context, canvasWidth, canvasHeight);

  const jpgBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  await saveBlobAsJpg(jpgBlob, "map-export.jpg");
}

function getMapExportMetrics() {
  const mapContainerStyle = window.getComputedStyle(mapContainerEl);
  const paddingLeft = parseFloat(mapContainerStyle.paddingLeft) || 0;
  const paddingTop = parseFloat(mapContainerStyle.paddingTop) || 0;
  const paddingRight = parseFloat(mapContainerStyle.paddingRight) || 0;
  const paddingBottom = parseFloat(mapContainerStyle.paddingBottom) || 0;
  const viewportWidth = mapContainerEl.clientWidth;
  const viewportHeight = mapContainerEl.clientHeight;
  const innerWidth = viewportWidth - paddingLeft - paddingRight;
  const innerHeight = viewportHeight - paddingTop - paddingBottom;
  const sourceViewBox = currentSvgRoot.viewBox.baseVal;
  const sourceWidth = sourceViewBox.width || currentSvgRoot.width.baseVal.value;
  const sourceHeight = sourceViewBox.height || currentSvgRoot.height.baseVal.value;
  const renderedWidth = currentSvgRoot.getBoundingClientRect().width;
  const renderedHeight = currentSvgRoot.getBoundingClientRect().height;
  const scaleX = sourceWidth / renderedWidth;
  const scaleY = sourceHeight / renderedHeight;

  return {
    paddingLeft,
    paddingTop,
    paddingRight,
    paddingBottom,
    viewportWidth,
    viewportHeight,
    innerWidth,
    innerHeight,
    cropX: mapContainerEl.scrollLeft * scaleX,
    cropY: mapContainerEl.scrollTop * scaleY,
    cropWidth: innerWidth * scaleX,
    cropHeight: innerHeight * scaleY,
  };
}

function buildVisibleSvgDataUrl(exportMetrics) {
  const svgClone = currentSvgRoot.cloneNode(true);
  svgClone.setAttribute(
    "viewBox",
    `${exportMetrics.cropX} ${exportMetrics.cropY} ${exportMetrics.cropWidth} ${exportMetrics.cropHeight}`
  );
  svgClone.setAttribute("width", String(exportMetrics.innerWidth));
  svgClone.setAttribute("height", String(exportMetrics.innerHeight));
  svgClone.style.width = `${exportMetrics.innerWidth}px`;
  svgClone.style.height = `${exportMetrics.innerHeight}px`;

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svgClone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

function drawLegendOnCanvas(context, canvasWidth, canvasHeight) {
  const legendState = legendManager.getState();

  if (!legendState.isVisible || legendState.items.length === 0) {
    return;
  }

  const mapContainerRect = mapContainerEl.getBoundingClientRect();
  const legendRect = mapLegendEl.getBoundingClientRect();
  const padding = 8;
  const fontSize = legendState.fontSize;
  const swatchSize = Math.round(fontSize * 1.23);
  const rowGap = 8;
  const textLineHeight = Math.round(fontSize * 1.3);
  const contentWidth = legendRect.width;
  const legendX = legendRect.left - mapContainerRect.left;
  const legendY = legendRect.top - mapContainerRect.top;
  const legendHeight = getLegendHeight(context, legendState, fontSize, swatchSize, rowGap, textLineHeight, contentWidth);

  if (!legendState.isPlain) {
    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    context.fillRect(legendX, legendY, contentWidth, legendHeight);
    context.strokeStyle = "#2a2520";
    context.lineWidth = 1;
    context.strokeRect(legendX, legendY, contentWidth, legendHeight);
  }

  context.font = `${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textBaseline = "top";

  let currentY = legendY + padding;
  const textX = legendX + padding + swatchSize + 8;
  const textWidth = contentWidth - padding * 2 - swatchSize - 8 - 8;

  legendState.items.forEach((item, index) => {
    context.fillStyle = item.color;
    context.fillRect(legendX + padding, currentY, swatchSize, swatchSize);
    context.strokeStyle = "#2a2520";
    context.lineWidth = 1;
    context.strokeRect(legendX + padding, currentY, swatchSize, swatchSize);

    context.fillStyle = "#1f1a15";
    const lines = wrapCanvasText(context, item.label, textWidth);
    lines.forEach((line, lineIndex) => {
      context.fillText(line, textX, currentY + lineIndex * textLineHeight);
    });

    const rowHeight = Math.max(swatchSize, lines.length * textLineHeight);
    currentY += rowHeight + (index === legendState.items.length - 1 ? 0 : rowGap);
  });
}

function getLegendHeight(context, legendState, fontSize, swatchSize, rowGap, textLineHeight, contentWidth) {
  const padding = 8;
  context.save();
  context.font = `${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;

  const textWidth = contentWidth - padding * 2 - swatchSize - 8 - 8;
  const rowsHeight = legendState.items.reduce((total, _item, index) => {
    const lines = wrapCanvasText(context, legendState.items[index].label, textWidth);
    const rowHeight = Math.max(swatchSize, lines.length * textLineHeight);
    return total + rowHeight + (index === legendState.items.length - 1 ? 0 : rowGap);
  }, 0);

  context.restore();
  return rowsHeight + padding * 2;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapCanvasText(context, text, maxWidth) {
  const characters = Array.from(text);
  const lines = [];
  let currentLine = "";

  characters.forEach((character) => {
    const testLine = currentLine + character;

    if (currentLine && context.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = character;
      return;
    }

    currentLine = testLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

async function saveBlobAsJpg(blob, suggestedName) {
  if ("showSaveFilePicker" in window) {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "JPEG Image",
          accept: {
            "image/jpeg": [".jpg", ".jpeg"],
          },
        },
      ],
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const blobUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = blobUrl;
  downloadLink.download = suggestedName;
  downloadLink.click();
  URL.revokeObjectURL(blobUrl);
}

async function initMap() {
  setBaseStatus("正在加载地图文件…");

  try {
    const [countryLookup, response] = await Promise.all([
      loadCountryNameLookup(),
      fetch(mapSvgPath),
    ]);

    countryNamesByCode.clear();
    countryLookup.forEach((name, code) => {
      countryNamesByCode.set(code, name);
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const svgText = await response.text();
    mountSvg(svgText);
  } catch (error) {
    mapContainerEl.innerHTML = "";
    setBaseStatus("地图加载失败。请用本地静态服务器访问，并确认资源文件存在。");
    console.error("Failed to load SVG map:", error);
  }
}

function mountSvg(svgText) {
  // 每次重新加载地图时，先清空旧地图和旧填色状态。
  mapContainerEl.innerHTML = svgText;
  paintedCountries.clear();
  refreshLegend();

  const svgRoot = mapContainerEl.querySelector("svg");

  if (!svgRoot) {
    setBaseStatus("地图加载失败。读取到的文件里没有 SVG 内容。");
    return;
  }

  currentSvgRoot = svgRoot;
  applyMapScale();
  bindMapInteractions(svgRoot);
}

function bindMapInteractions(svgRoot) {
  // 这个 id 来自你的原始 SVG 文件，对应国家图层。
  const countriesGroup = svgRoot.getElementById("ne_10m_admin_0_countries_chn");

  if (!countriesGroup) {
    setBaseStatus("没有找到国家图层。");
    return;
  }

  // 地图里的每个国家区域，目前基本都是一个 path。
  const countryPaths = Array.from(countriesGroup.querySelectorAll("path"));
  let interactiveCount = 0;

  countryPaths.forEach((path) => {
    const countryCode = (path.id || "").trim().toUpperCase();
    const countryName = countryNamesByCode.get(countryCode);

    if (!countryName) {
      path.style.pointerEvents = "none";
      return;
    }

    interactiveCount += 1;

    // 先给每个区域一个初始样式，让它看起来像可点击对象。
    path.dataset.countryCode = countryCode;
    path.dataset.countryName = countryName;
    path.style.fill = defaultCountryFill;
    path.style.stroke = countryStroke;
    path.style.strokeWidth = "0.3";
    path.style.transition = "fill 120ms ease, opacity 120ms ease, stroke 120ms ease";
    path.style.cursor = "pointer";

    path.addEventListener("mouseenter", () => {
      showHoverStatus(countryName);
    });

    path.addEventListener("mouseleave", () => {
      statusEl.textContent = baseStatusText;
    });

    path.addEventListener("click", () => {
      if (activeTool === TOOL_DRAG) {
        return;
      }

      if (activeTool === TOOL_ERASE) {
        path.style.fill = defaultCountryFill;
        paintedCountries.delete(countryCode);
        refreshLegend();
        setBaseStatus(`已擦除：${countryName}`);
        return;
      }

      // 真正的填色动作在这里：把当前选中的颜色写到这个区域的 fill。
      path.style.fill = activeColor.value;

      // 同时把颜色写入状态，图例就可以根据状态自动生成。
      paintedCountries.set(countryCode, activeColor.value);
      refreshLegend();

      setBaseStatus(`已填色：${countryName} -> ${activeColor.name}`);
    });
  });

  setBaseStatus(`地图加载完成，共绑定 ${interactiveCount} 个可点击区域。`);
}

async function loadCountryNameLookup() {
  const response = await fetch(countryCodeCsvPath);

  if (!response.ok) {
    throw new Error(`Failed to load CSV: HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return new Map();
  }

  const header = parseCsvLine(rows[0]);
  const codeIndex = header.indexOf("code");
  const cnIndex = header.indexOf("cn");

  if (codeIndex === -1 || cnIndex === -1) {
    throw new Error("CSV 缺少 code 或 cn 列。");
  }

  const lookup = new Map();

  rows.slice(1).forEach((line) => {
    const fields = parseCsvLine(line);
    const code = (fields[codeIndex] || "").trim().toUpperCase();
    const cnName = (fields[cnIndex] || "").trim();

    if (!code || !cnName) {
      return;
    }

    lookup.set(code, cnName);
  });

  return lookup;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  fields.push(current);
  return fields;
}
