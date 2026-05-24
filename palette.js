const PALETTE_FULL = [
  { name: "珊瑚红", value: "#ff6b6b" },
  { name: "蜜橙", value: "#ff9f43" },
  { name: "暖阳黄", value: "#feca57" },
  { name: "青苹果绿", value: "#7bed9f" },
  { name: "湖蓝", value: "#4b86c5" },
  { name: "薰衣草紫", value: "#a55eea" },
  { name: "石墨黑", value: "#4c4c52" },
  { name: "陶红", value: "#d96c5f" },
  { name: "琥珀黄", value: "#d8a739" },
  { name: "松石绿", value: "#4f9d7a" },
  { name: "深紫灰", value: "#756783" },
  { name: "砖红", value: "#b8574f" },
  { name: "赭石", value: "#b9703c" },
  { name: "金黄", value: "#d9b23d" },
  { name: "橄榄绿", value: "#748d42" },
  { name: "森林绿", value: "#3e7a4f" },
  { name: "青绿", value: "#3e978d" },
  { name: "海蓝", value: "#3f7fa8" },
  { name: "靛蓝", value: "#4d5f99" },
  { name: "酒红", value: "#8a4f61" },
  { name: "灰褐", value: "#7a6b5d" },
  { name: "芭比粉", value: "#ff6eb4" },
  { name: "琥珀", value: "#e67e22" },
  { name: "芥末黄", value: "#f1c40f" },
  { name: "翡翠绿", value: "#27ae60" }
  
];

const PALETTE_PRESET = [0, 1, 2, 3, 4, 5];

function createPaletteManager(options) {
  const paletteEl = options.paletteEl;
  const onActiveColorChange = options.onActiveColorChange;
  const onPaletteChange = options.onPaletteChange;

  const selectablePalette = PALETTE_PRESET
    .map((index) => PALETTE_FULL[index])
    .filter(Boolean)
    .map(cloneColor);
  const allKnownColors = new Map();
  let activeColorValue = selectablePalette[0]?.value ?? "";
  let isAddPanelOpen = false;

  PALETTE_FULL.forEach((color) => {
    allKnownColors.set(normalizeColorValue(color.value), cloneColor(color));
  });

  render();

  function cloneColor(color) {
    return { name: color.name, value: normalizeColorValue(color.value) };
  }

  function normalizeColorValue(value) {
    return value.trim().toLowerCase();
  }

  function getPalette() {
    return selectablePalette.map(cloneColor);
  }

  function getActiveColor() {
    return getColorMetaByValue(activeColorValue);
  }

  function getColorMetaByValue(value) {
    const normalizedValue = normalizeColorValue(value);
    const knownColor = allKnownColors.get(normalizedValue);

    if (knownColor) {
      return cloneColor(knownColor);
    }

    return {
      name: normalizedValue.toUpperCase(),
      value: normalizedValue,
    };
  }

  function setActiveColor(value) {
    const normalizedValue = normalizeColorValue(value);

    if (!selectablePalette.some((color) => color.value === normalizedValue)) {
      return;
    }

    activeColorValue = normalizedValue;
    render();
    notifyActiveColorChange();
  }

  function addColor(color) {
    const normalizedColor = cloneColor(color);

    if (selectablePalette.some((item) => item.value === normalizedColor.value)) {
      setActiveColor(normalizedColor.value);
      isAddPanelOpen = false;
      render();
      return;
    }

    selectablePalette.push(normalizedColor);
    allKnownColors.set(normalizedColor.value, normalizedColor);
    activeColorValue = normalizedColor.value;
    isAddPanelOpen = false;
    render();
    notifyActiveColorChange();
    notifyPaletteChange();
  }

  function removeColor(value) {
    if (selectablePalette.length <= 1) {
      return;
    }

    const normalizedValue = normalizeColorValue(value);
    const targetIndex = selectablePalette.findIndex((color) => color.value === normalizedValue);

    if (targetIndex === -1) {
      return;
    }

    selectablePalette.splice(targetIndex, 1);

    if (activeColorValue === normalizedValue) {
      const fallbackColor = selectablePalette[Math.max(0, targetIndex - 1)] ?? selectablePalette[0];
      activeColorValue = fallbackColor.value;
      notifyActiveColorChange();
    }

    render();
    notifyPaletteChange();
  }

  function notifyActiveColorChange() {
    onActiveColorChange?.(getActiveColor());
  }

  function notifyPaletteChange() {
    onPaletteChange?.(getPalette());
  }

  function render() {
    paletteEl.innerHTML = "";

    selectablePalette.forEach((color) => {
      const itemEl = document.createElement("div");
      itemEl.className = "palette-item";

      const swatchButton = document.createElement("button");
      swatchButton.type = "button";
      swatchButton.className = "color-swatch";
      swatchButton.style.backgroundColor = color.value;
      swatchButton.title = color.name;
      swatchButton.setAttribute("aria-label", `选择颜色：${color.name}`);

      if (color.value === activeColorValue) {
        swatchButton.classList.add("is-active");
      }

      swatchButton.addEventListener("click", () => {
        setActiveColor(color.value);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "palette-remove-button";
      removeButton.textContent = "×";
      removeButton.title = `删除颜色：${color.name}`;
      removeButton.setAttribute("aria-label", `删除颜色：${color.name}`);
      removeButton.disabled = selectablePalette.length <= 1;
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        removeColor(color.value);
      });

      itemEl.appendChild(swatchButton);
      itemEl.appendChild(removeButton);
      paletteEl.appendChild(itemEl);
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "color-swatch color-swatch--add";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "添加颜色");
    addButton.addEventListener("click", () => {
      isAddPanelOpen = !isAddPanelOpen;
      render();
    });
    paletteEl.appendChild(addButton);

    if (isAddPanelOpen) {
      paletteEl.appendChild(renderAddPanel());
    }
  }

  function renderAddPanel() {
    const panelEl = document.createElement("div");
    panelEl.className = "palette-add-panel";

    const fullTitle = document.createElement("p");
    fullTitle.className = "palette-add-panel__title";
    fullTitle.textContent = "预设颜色";
    panelEl.appendChild(fullTitle);

    const fullListEl = document.createElement("div");
    fullListEl.className = "palette-add-panel__list";

    PALETTE_FULL.forEach((color) => {
      const exists = selectablePalette.some((item) => item.value === normalizeColorValue(color.value));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-add-option";
      button.style.backgroundColor = color.value;
      button.title = color.name;
      button.setAttribute("aria-label", `添加颜色：${color.name}`);
      button.disabled = exists;

      if (exists) {
        button.classList.add("is-disabled");
      }

      button.addEventListener("click", () => {
        addColor(color);
      });

      fullListEl.appendChild(button);
    });

    panelEl.appendChild(fullListEl);

    const customTitle = document.createElement("p");
    customTitle.className = "palette-add-panel__title";
    customTitle.textContent = "自定义颜色";
    panelEl.appendChild(customTitle);

    const customRow = document.createElement("div");
    customRow.className = "palette-custom-row";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "palette-custom-color-input";
    colorInput.value = "#4b86c5";
    colorInput.setAttribute("aria-label", "选择自定义颜色");

    const addCustomButton = document.createElement("button");
    addCustomButton.type = "button";
    addCustomButton.className = "tool-button palette-custom-add-button";
    addCustomButton.textContent = "添加";
    addCustomButton.addEventListener("click", () => {
      const hexValue = normalizeColorValue(colorInput.value);
      addColor({
        name: `自定义 ${hexValue.toUpperCase()}`,
        value: hexValue,
      });
    });

    customRow.appendChild(colorInput);
    customRow.appendChild(addCustomButton);
    panelEl.appendChild(customRow);

    return panelEl;
  }

  return {
    getActiveColor,
    getColorMetaByValue,
    getPalette,
    setActiveColor,
  };
}
