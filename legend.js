function createLegendManager(options) {
  const legendRootEl = options.legendRootEl;
  const legendEditorRootEl = options.legendEditorRootEl;
  const legendContainerEl = options.mapLegendEl;
  const legendFrameEl = options.mapLegendFr;
  const legendPlainToggleEl = options.legendPlainToggleEl;
  const legendFontSizeSliderEl = options.legendFontSizeSliderEl;
  const legendFontSizeValueEl = options.legendFontSizeValueEl;
  const notesByColor = new Map();

  let usedColorsSnapshot = [];
  let legendFontSize = Number(legendFontSizeSliderEl?.value ?? 13);
  // let legendFontSize = 13;
  let isDragging = false;
  let isResizing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartLeft = 0;
  let dragStartBottom = 0;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  const resizeHandleEl = document.createElement("div");
  resizeHandleEl.className = "map-legend__resize-handle";
  resizeHandleEl.setAttribute("aria-hidden", "true");
  legendContainerEl.appendChild(resizeHandleEl);

  legendPlainToggleEl.addEventListener("change", () => {
    legendFrameEl.style.visibility = legendPlainToggleEl.checked ? "hidden" : "visible";
  });

  legendFontSizeSliderEl?.addEventListener("input", () => {
    setFontSize(Number(legendFontSizeSliderEl.value));
  });

  legendContainerEl.addEventListener("mousedown", onLegendMouseDown);
  resizeHandleEl.addEventListener("mousedown", onResizeMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", stopInteractions);

  setFontSize(legendFontSize);

  function getNote(color) {
    return notesByColor.get(color.value) ?? "";
  }

  function setFontSize(nextSize) {
    legendFontSize = nextSize;

    document.documentElement.style.setProperty("--legend-font-size", `${legendFontSize}px`);
    document.documentElement.style.setProperty("--legend-swatch-size", `${Math.round(legendFontSize * 1.23)}px`);

    if (legendFontSizeSliderEl) {
      legendFontSizeSliderEl.value = String(legendFontSize);
    }

    if (legendFontSizeValueEl) {
      legendFontSizeValueEl.textContent = `${legendFontSize}px`;
    }
  }

  function onLegendMouseDown(event) {
    if (event.target === resizeHandleEl) {
      return;
    }

    if (event.target instanceof HTMLInputElement) {
      return;
    }

    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartLeft = legendContainerEl.offsetLeft;
    dragStartBottom = parseFloat(window.getComputedStyle(legendContainerEl).bottom) || 0;
    legendContainerEl.classList.add("is-dragging");
    event.preventDefault();
  }

  function onResizeMouseDown(event) {
    isResizing = true;
    resizeStartX = event.clientX;
    resizeStartWidth = legendContainerEl.getBoundingClientRect().width;
    legendContainerEl.classList.add("is-resizing");
    event.preventDefault();
    event.stopPropagation();
  }

  function onMouseMove(event) {
    if (isDragging) {
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      legendContainerEl.style.left = `${Math.max(0, dragStartLeft + deltaX)}px`;
      legendContainerEl.style.bottom = `${Math.max(0, dragStartBottom - deltaY)}px`;
      return;
    }

    if (isResizing) {
      const deltaX = event.clientX - resizeStartX;
      const nextWidth = Math.max(120, resizeStartWidth + deltaX);
      legendContainerEl.style.width = `${nextWidth}px`;
    }
  }

  function stopInteractions() {
    if (!isDragging && !isResizing) {
      return;
    }

    isDragging = false;
    isResizing = false;
    legendContainerEl.classList.remove("is-dragging");
    legendContainerEl.classList.remove("is-resizing");
  }

  function renderMapLegend(usedColors) {
    legendRootEl.innerHTML = "";

    if (usedColors.length === 0) {
      legendContainerEl.style.visibility = "hidden";
      return;
    }

    legendContainerEl.style.visibility = "visible";

    usedColors.forEach((color) => {
      const rowEl = document.createElement("div");
      rowEl.className = "legend-item";

      const swatchEl = document.createElement("span");
      swatchEl.className = "legend-swatch";
      swatchEl.style.backgroundColor = color.value;
      swatchEl.title = color.name;

      const textEl = document.createElement("div");
      textEl.className = "legend-text";
      textEl.textContent = getNote(color) || color.name;

      rowEl.appendChild(swatchEl);
      rowEl.appendChild(textEl);
      legendRootEl.appendChild(rowEl);
    });
  }

  function renderEditorList(usedColors) {
    legendEditorRootEl.innerHTML = "";

    if (usedColors.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.className = "legend-empty";
      emptyEl.textContent = "先给地图填色，再编辑图例文本。";
      legendEditorRootEl.appendChild(emptyEl);
      return;
    }

    usedColors.forEach((color) => {
      const rowEl = document.createElement("div");
      rowEl.className = "legend-editor-item";

      const swatchEl = document.createElement("span");
      swatchEl.className = "legend-swatch";
      swatchEl.style.backgroundColor = color.value;
      swatchEl.title = color.name;

      const inputEl = document.createElement("input");
      inputEl.className = "legend-note-input";
      inputEl.type = "text";
      inputEl.placeholder = `${color.name} 的说明`;
      inputEl.value = getNote(color);
      inputEl.setAttribute("aria-label", `${color.name} 图例说明编辑`);

      inputEl.addEventListener("input", () => {
        notesByColor.set(color.value, inputEl.value);
        renderMapLegend(usedColorsSnapshot);
      });

      rowEl.appendChild(swatchEl);
      rowEl.appendChild(inputEl);
      legendEditorRootEl.appendChild(rowEl);
    });
  }

  return {
    getState() {
      return {
        isVisible: legendContainerEl.style.visibility !== "hidden",
        fontSize: legendFontSize,
        width: legendContainerEl.getBoundingClientRect().width,
        left: legendContainerEl.offsetLeft,
        bottom: parseFloat(window.getComputedStyle(legendContainerEl).bottom) || 0,
        isPlain: legendPlainToggleEl.checked,
        items: usedColorsSnapshot.map((color) => ({
          color: color.value,
          label: getNote(color) || color.name
        }))
      };
    },
    render(usedColors) {
      usedColorsSnapshot = usedColors.slice();
      renderMapLegend(usedColorsSnapshot);
      renderEditorList(usedColorsSnapshot);
    }
  };
}
