import { useState, useRef, useEffect, useCallback } from "react";
import AuthModal from "./AuthModal";
import ProjectsModal from "./ProjectsModal";
import { createProject, updateProject, getTemplates, getTemplate, createTemplate } from "./api";

const PRESETS = {
  A4:        { w: 595, h: 842,  label: "A4 (595×842)" },
  A5:        { w: 420, h: 595,  label: "A5 (420×595)" },
  Letter:    { w: 612, h: 792,  label: "Letter (612×792)" },
  Square:    { w: 600, h: 600,  label: "Квадрат 600×600" },
  Banner:    { w: 800, h: 300,  label: "Баннер 800×300" },
};

const FONTS = ["Georgia", "Playfair Display", "Arial", "Helvetica", "Verdana", "Courier New", "Impact", "Tahoma", "Times New Roman", "Trebuchet MS"];

const ICONS = {
  save:     "M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z",
  folder:   "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  upload:   "M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z",
  user:     "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  image:    "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
};

const ic = (k, size=13) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0,display:"inline-block",verticalAlign:"middle"}}><path d={ICONS[k]}/></svg>;

function serializeToXML(elements, bg, pw, ph, orientation) {
  const escXML = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const elXML = elements.map(el => {
    if (el.type === "text") {
      return `    <text id="${el.id}" x="${el.x}" y="${el.y}" width="${el.width}" fontSize="${el.fontSize}" fill="${el.fill}" fontFamily="${escXML(el.fontFamily)}" fontWeight="${el.fontWeight}" fontStyle="${el.fontStyle}" textAlign="${el.textAlign}" rotation="${el.rotation||0}" opacity="${el.opacity||1}">${escXML(el.text)}</text>`;
    } else {
      return `    <image id="${el.id}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rotation="${el.rotation||0}" opacity="${el.opacity||1}" src="${el.src.startsWith("data:") ? "[base64]" : escXML(el.src)}" />`;
    }
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<flyer>\n  <page width="${pw}" height="${ph}" orientation="${orientation}" background="${bg}" />\n  <elements>\n${elXML}\n  </elements>\n</flyer>`;
}

function parseFromXML(xmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "text/xml");
  const page = doc.querySelector("page");
  const pw = parseInt(page?.getAttribute("width") || 600);
  const ph = parseInt(page?.getAttribute("height") || 400);
  const orientation = page?.getAttribute("orientation") || "portrait";
  const bg = page?.getAttribute("background") || "#ffffff";
  const elements = [];
  doc.querySelectorAll("text").forEach(n => {
    elements.push({
      id: parseInt(n.getAttribute("id")) || Date.now(), type: "text", text: n.textContent,
      x: parseFloat(n.getAttribute("x")||100), y: parseFloat(n.getAttribute("y")||100),
      width: parseFloat(n.getAttribute("width")||200), fontSize: parseInt(n.getAttribute("fontSize")||24),
      fill: n.getAttribute("fill")||"#000000", fontFamily: n.getAttribute("fontFamily")||"Arial",
      fontWeight: n.getAttribute("fontWeight")||"normal", fontStyle: n.getAttribute("fontStyle")||"normal",
      textAlign: n.getAttribute("textAlign")||"left", rotation: parseFloat(n.getAttribute("rotation")||0),
      opacity: parseFloat(n.getAttribute("opacity")||1),
    });
  });
  doc.querySelectorAll("image").forEach(n => {
    if (n.getAttribute("src") !== "[base64]") {
      elements.push({
        id: parseInt(n.getAttribute("id")) || Date.now(), type: "image", src: n.getAttribute("src")||"",
        x: parseFloat(n.getAttribute("x")||100), y: parseFloat(n.getAttribute("y")||100),
        width: parseFloat(n.getAttribute("width")||200), height: parseFloat(n.getAttribute("height")||200),
        rotation: parseFloat(n.getAttribute("rotation")||0), opacity: parseFloat(n.getAttribute("opacity")||1),
      });
    }
  });
  return { pw, ph, orientation, bg, elements };
}

const HANDLES = [
  { id:"nw", x:0,   y:0,   cursor:"nw-resize" },
  { id:"n",  x:0.5, y:0,   cursor:"n-resize"  },
  { id:"ne", x:1,   y:0,   cursor:"ne-resize" },
  { id:"e",  x:1,   y:0.5, cursor:"e-resize"  },
  { id:"se", x:1,   y:1,   cursor:"se-resize" },
  { id:"s",  x:0.5, y:1,   cursor:"s-resize"  },
  { id:"sw", x:0,   y:1,   cursor:"sw-resize" },
  { id:"w",  x:0,   y:0.5, cursor:"w-resize"  },
];

export default function FlyerStudio() {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pageW, setPageW] = useState(600);
  const [pageH, setPageH] = useState(400);
  const [orientation, setOrientation] = useState("landscape");
  const [bg, setBg] = useState("#ffffff");
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSnap, setGridSnap] = useState(false);
  const GRID = 20;
  const [history, setHistory] = useState([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [editingText, setEditingText] = useState(null);
  const [editingVal, setEditingVal] = useState("");
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [activePanel, setActivePanel] = useState("tools");
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Новый проект");
  const [saveStatus, setSaveStatus] = useState("");
  const [serverTemplates, setServerTemplates] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [resizeSize, setResizeSize] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const stateRef = useRef({});
  stateRef.current = { elements, selectedId, selectedIds, histIdx, history, editingText, currentProjectId, projectName, bg, pageW, pageH, orientation, currentUser };
  const selected = elements.find(e => e.id === selectedId);

  useEffect(() => {
    getTemplates().then(data => { if (Array.isArray(data)) setServerTemplates(data); }).catch(() => {});
  }, []);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth - 40;
      const ch = containerRef.current.clientHeight - 40;
      setCanvasScale(Math.min(cw / pageW, ch / pageH, 1.5));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [pageW, pageH]);

  const pushHistory = useCallback((newEls) => {
    setHistory(h => { const slice = h.slice(0, stateRef.current.histIdx + 1); return [...slice, JSON.parse(JSON.stringify(newEls))]; });
    setHistIdx(i => i + 1);
  }, []);

  const updateElements = useCallback((newEls) => { setElements(newEls); pushHistory(newEls); }, [pushHistory]);

  const undo = useCallback(() => {
    const { histIdx, history } = stateRef.current;
    if (histIdx > 0) { setHistIdx(histIdx - 1); setElements(JSON.parse(JSON.stringify(history[histIdx - 1]))); setSelectedId(null); }
  }, []);

  const redo = useCallback(() => {
    const { histIdx, history } = stateRef.current;
    if (histIdx < history.length - 1) { setHistIdx(histIdx + 1); setElements(JSON.parse(JSON.stringify(history[histIdx + 1]))); setSelectedId(null); }
  }, []);

  const snap = v => gridSnap ? Math.round(v / GRID) * GRID : v;

  const getCanvasPos = (e) => {
    const rect = canvasWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left) / canvasScale, y: (e.clientY - rect.top) / canvasScale };
  };

 const handleMouseDown = (e, id, mode = "drag") => {
  e.stopPropagation();
  if (e.shiftKey && mode === "drag") {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    setSelectedId(id);
    return;
  }
  if (!selectedIds.includes(id)) setSelectedIds([]);
  setSelectedId(id);
  const pos = getCanvasPos(e);
  const el = elements.find(x => x.id === id);
  if (mode === "drag") {
    setDragging({ id, startX: pos.x - el.x, startY: pos.y - el.y });
  } else {
    setResizing({ id, handle: mode, startX: pos.x, startY: pos.y, origX: el.x, origY: el.y, origW: el.width, origH: el.height || (el.type==="text" ? el.fontSize*1.5 : 100), aspectRatio: el.width / (el.height || 100) });
  }
};

  const handleMouseMove = (e) => {
  if (!dragging && !resizing) return;
  const pos = getCanvasPos(e);
  if (dragging) {
    const newX = snap(pos.x - dragging.startX);
    const newY = snap(pos.y - dragging.startY);
    const allIds = selectedIds.length > 1 ? selectedIds : [dragging.id];
    setElements(prev => {
      const main = prev.find(el => el.id === dragging.id);
      const dX = newX - main.x;
      const dY = newY - main.y;
      return prev.map(el => {
        if (!allIds.includes(el.id)) return el;
        if (el.id === dragging.id) return { ...el, x: newX, y: newY };
        return { ...el, x: snap(el.x + dX), y: snap(el.y + dY) };
      });
    });
    return;
  }
  if (resizing) {
    const dx = pos.x - resizing.startX;
    const dy = pos.y - resizing.startY;
    const { handle, origX, origY, origW, origH, aspectRatio } = resizing;
    const shiftKey = e.shiftKey;
    let newX = origX, newY = origY, newW = origW, newH = origH;
    if (handle === "se") { newW = Math.max(20, snap(origW + dx)); newH = shiftKey ? newW / aspectRatio : Math.max(20, snap(origH + dy)); }
    else if (handle === "sw") { newW = Math.max(20, snap(origW - dx)); newH = shiftKey ? newW / aspectRatio : Math.max(20, snap(origH + dy)); newX = origX + origW - newW; }
    else if (handle === "ne") { newW = Math.max(20, snap(origW + dx)); newH = shiftKey ? newW / aspectRatio : Math.max(20, snap(origH - dy)); newY = origY + origH - newH; }
    else if (handle === "nw") { newW = Math.max(20, snap(origW - dx)); newH = shiftKey ? newW / aspectRatio : Math.max(20, snap(origH - dy)); newX = origX + origW - newW; newY = origY + origH - newH; }
    else if (handle === "e") { newW = Math.max(20, snap(origW + dx)); }
    else if (handle === "w") { newW = Math.max(20, snap(origW - dx)); newX = origX + origW - newW; }
    else if (handle === "s") { newH = Math.max(20, snap(origH + dy)); }
    else if (handle === "n") { newH = Math.max(20, snap(origH - dy)); newY = origY + origH - newH; }
    setResizeSize({ w: Math.round(newW), h: Math.round(newH) });
    setElements(prev => prev.map(el => el.id === resizing.id ? { ...el, x: newX, y: newY, width: newW, height: newH } : el));
  }
};

  const handleMouseUp = () => {
    if (dragging || resizing) { setDragging(null); setResizing(null); setResizeSize(null); pushHistory(stateRef.current.elements); }
  };

  const addText = useCallback(() => {
    const el = { id: Date.now(), type: "text", text: "Новый текст", x: 50, y: 50, fontSize: 28, fill: "#1a1a1a", fontFamily: "Georgia", fontWeight: "normal", fontStyle: "normal", textAlign: "left", width: 200, rotation: 0, opacity: 1 };
    const newEls = [...stateRef.current.elements, el];
    setElements(newEls); pushHistory(newEls); setSelectedId(el.id);
  }, [pushHistory]);

  const uploadImage = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 300, ratio = img.height / img.width;
        const w = Math.min(maxW, img.width), h = w * ratio;
        const el = { id: Date.now(), type: "image", src: reader.result, x: 50, y: 50, width: w, height: h, rotation: 0, opacity: 1 };
        updateElements([...stateRef.current.elements, el]); setSelectedId(el.id);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const loadImageFromURL = () => {
    const url = urlInput.trim(); if (!url) return;
    const el = { id: Date.now(), type: "image", src: url, x: 50, y: 50, width: 200, height: 150, rotation: 0, opacity: 1 };
    updateElements([...elements, el]); setSelectedId(el.id); setUrlInput("");
  };

  const deleteSelected = useCallback(() => {
  const { selectedId, selectedIds, elements } = stateRef.current;
  const ids = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
  if (!ids.length) return;
  const newEls = elements.filter(e => !ids.includes(e.id));
  setElements(newEls); pushHistory(newEls); setSelectedId(null); setSelectedIds([]);
}, [pushHistory]);

  const duplicateSelected = useCallback(() => {
    const { selectedId, elements } = stateRef.current;
    const sel = elements.find(e => e.id === selectedId); if (!sel) return;
    const el = { ...JSON.parse(JSON.stringify(sel)), id: Date.now(), x: sel.x + 20, y: sel.y + 20 };
    const newEls = [...elements, el];
    setElements(newEls); pushHistory(newEls); setSelectedId(el.id);
  }, [pushHistory]);

  const updateSelected = (field, value) => { if (!selectedId) return; setElements(elements.map(e => e.id === selectedId ? { ...e, [field]: value } : e)); };
  const updateSelectedCommit = (field, value) => { if (!selectedId) return; updateElements(elements.map(e => e.id === selectedId ? { ...e, [field]: value } : e)); };

  const moveLayer = (dir) => {
    if (!selectedId) return;
    const idx = elements.findIndex(e => e.id === selectedId);
    const sel = elements.find(e => e.id === selectedId);
    if (dir === "up" && idx < elements.length - 1) { const n = [...elements]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; updateElements(n); }
    else if (dir === "down" && idx > 0) { const n = [...elements]; [n[idx], n[idx-1]] = [n[idx-1], n[idx]]; updateElements(n); }
    else if (dir === "front") updateElements([...elements.filter(e => e.id !== selectedId), sel]);
    else if (dir === "back") updateElements([sel, ...elements.filter(e => e.id !== selectedId)]);
  };

  const align = (type) => {
  if (!selected) return;
  const w = selected.width || 0, h = selected.height || selected.fontSize || 20;
  let x = selected.x, y = selected.y;
  if (type === "left") x = 0; else if (type === "centerH") x = pageW/2-w/2; else if (type === "right") x = pageW-w;
  else if (type === "top") y = 0; else if (type === "centerV") y = pageH/2-h/2; else if (type === "bottom") y = pageH-h;
  updateElements(elements.map(e => e.id === selectedId ? { ...e, x, y } : e));
};

  const loadServerTemplate = async (id) => {
  const tpl = await getTemplate(id); if (!tpl.xml_data) return;
  const { pw, ph, orientation: ori, bg: newBg, elements: newEls } = parseFromXML(tpl.xml_data);
  setPageW(pw); setPageH(ph); setOrientation(ori); setBg(newBg);
  setElements(newEls);
  setHistory([JSON.parse(JSON.stringify(newEls))]);
  setHistIdx(0);
  setSelectedId(null);
  setProjectName(tpl.name);
};

  const applyPreset = (key) => {
    const p = PRESETS[key]; if (!p) return;
    if (orientation === "portrait") { setPageW(p.w); setPageH(p.h); } else { setPageW(p.h); setPageH(p.w); }
  };

  const toggleOrientation = () => { setOrientation(o => o === "portrait" ? "landscape" : "portrait"); setPageW(pageH); setPageH(pageW); };

  const exportXML = () => {
    const xml = serializeToXML(elements, bg, pageW, pageH, orientation);
    const blob = new Blob([xml], { type: "application/xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `flyer_${Date.now()}.xml`; a.click();
  };

  const importXML = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { pw, ph, orientation: ori, bg: newBg, elements: newEls } = parseFromXML(ev.target.result);
      setPageW(pw); setPageH(ph); setOrientation(ori); setBg(newBg);
      setElements(newEls); pushHistory(newEls); setSelectedId(null);
    };
    reader.readAsText(file); e.target.value = "";
  };
  const showToast = useCallback((message, type = "success", sub = "") => {
  const id = Date.now();
  setToasts(prev => [...prev, { id, message, type, sub }]);
  setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
}, []);

  const saveToServer = useCallback(async () => {
    const { elements, bg, pageW, pageH, orientation, currentProjectId, projectName, currentUser } = stateRef.current;
    setSaveStatus("saving");
    const xml = serializeToXML(elements, bg, pageW, pageH, orientation);
    try {
      if (currentProjectId) {
        await updateProject(currentProjectId, { name: projectName, xml_data: xml, page_width: pageW, page_height: pageH, orientation });
      } else {
        const result = await createProject({ name: projectName, xml_data: xml, page_width: pageW, page_height: pageH, orientation, user_id: currentUser?.id || null });
        if (result.id) setCurrentProjectId(result.id);
      }
      showToast("Проект сохранён", "success", projectName);
    } catch { showToast("Ошибка сохранения", "error", "Проверьте подключение к серверу"); }
  }, []);

  const handleLoadProject = (project) => {
    const { pw, ph, orientation: ori, bg: newBg, elements: newEls } = parseFromXML(project.xml_data);
    setPageW(pw); setPageH(ph); setOrientation(ori); setBg(newBg);
    setElements(newEls); pushHistory(newEls); setSelectedId(null);
    setCurrentProjectId(project.id); setProjectName(project.name);
  };
  
  const saveAsTemplate = useCallback(async () => {
  const { elements, bg, pageW, pageH, orientation, projectName } = stateRef.current;
  const name = prompt("Название шаблона:", projectName);
  if (!name) return;
  const category = prompt("Категория:", "реклама");
  if (!category) return;
  const xml = serializeToXML(elements, bg, pageW, pageH, orientation);
  try {
    await createTemplate({ name, category, xml_data: xml, page_width: pageW, page_height: pageH, orientation });
    showToast("Шаблон сохранён", "success", "Появится в списке шаблонов");
    getTemplates().then(data => { if (Array.isArray(data)) setServerTemplates(data); });
  } catch { showToast("Ошибка сохранения шаблона", "error", "Проверьте подключение к серверу"); }
}, []);

  const renderCanvas = () => new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width = pageW * 2; canvas.height = pageH * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2); ctx.fillStyle = bg; ctx.fillRect(0, 0, pageW, pageH);
    const drawNext = (idx) => {
      if (idx >= elements.length) { resolve(canvas); return; }
      const el = elements[idx]; ctx.save(); ctx.globalAlpha = el.opacity ?? 1;
      const cx = el.x + (el.width||0)/2, cy = el.y + (el.height||el.fontSize||0)/2;
      ctx.translate(cx, cy); ctx.rotate(((el.rotation||0)*Math.PI)/180); ctx.translate(-cx, -cy);
      if (el.type === "text") {
        ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`; ctx.fillStyle = el.fill; ctx.textAlign = el.textAlign||"left";
        const startX = el.textAlign==="center" ? el.x+el.width/2 : el.textAlign==="right" ? el.x+el.width : el.x;
        el.text.split("\n").forEach((line, i) => ctx.fillText(line, startX, el.y+el.fontSize+i*el.fontSize*1.3, el.width));
        ctx.restore(); drawNext(idx+1);
      } else if (el.type === "image") {
        const img = new window.Image(); img.crossOrigin = "anonymous";
        img.onload = () => { ctx.drawImage(img, el.x, el.y, el.width, el.height); ctx.restore(); drawNext(idx+1); };
        img.onerror = () => { ctx.restore(); drawNext(idx+1); };
        img.src = el.src;
      } else { ctx.restore(); drawNext(idx+1); }
    };
    drawNext(0);
  });

  const exportPNG = async () => { const canvas = await renderCanvas(); const a = document.createElement("a"); a.download = `flyer_${Date.now()}.png`; a.href = canvas.toDataURL("image/png"); a.click(); };
  const exportJPEG = async () => { const canvas = await renderCanvas(); const a = document.createElement("a"); a.download = `flyer_${Date.now()}.jpg`; a.href = canvas.toDataURL("image/jpeg", 0.92); a.click(); };
  const exportSVGFile = () => {
    const elsSVG = elements.map(el => {
      const rot = el.rotation ? ` transform="rotate(${el.rotation},${el.x+(el.width||0)/2},${el.y+(el.height||0)/2})"` : "";
      if (el.type === "text") {
        const anchor = el.textAlign==="center"?"middle":el.textAlign==="right"?"end":"start";
        const tx = el.textAlign==="center"?el.x+el.width/2:el.textAlign==="right"?el.x+el.width:el.x;
        return `<text x="${tx}" y="${el.y+el.fontSize}" font-size="${el.fontSize}" fill="${el.fill}" font-family="${el.fontFamily}" font-weight="${el.fontWeight}" font-style="${el.fontStyle}" text-anchor="${anchor}" opacity="${el.opacity??1}"${rot}>${el.text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</text>`;
      } else if (el.type === "image") {
        return `<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity??1}"${rot}/>`;
      }
      return "";
    }).join("\n  ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}">\n  <rect width="${pageW}" height="${pageH}" fill="${bg}"/>\n  ${elsSVG}\n</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `flyer_${Date.now()}.svg`; a.click();
  };
  const exportPDF = async () => {
  const { default: jsPDF } = await import("jspdf");
  const canvas = await renderCanvas();
  const imgData = canvas.toDataURL("image/jpeg", 1.0);
  const pdf = new jsPDF({
    orientation: pageW > pageH ? "landscape" : "portrait",
    unit: "px",
    format: [pageW, pageH],
  });
  pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  pdf.save(`flyer_${Date.now()}.pdf`);
};

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (stateRef.current.editingText) return;
      if ((e.ctrlKey||e.metaKey) && e.key==="z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="d") { e.preventDefault(); duplicateSelected(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="s") { e.preventDefault(); saveToServer(); }
      if (e.key==="Delete") { e.preventDefault(); deleteSelected(); }
      if (e.key==="Escape") { setSelectedId(null); setShowExportMenu(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, duplicateSelected, deleteSelected, saveToServer]);

  const handleCanvasClick = (e) => {
  if (e.target === canvasWrapRef.current || e.target === canvasRef.current) {
    setSelectedId(null);
    setSelectedIds([]);
  }
  setShowExportMenu(false);
};
  const startEditText = (el) => { setEditingText(el.id); setEditingVal(el.text); };
  const commitTextEdit = () => {
    if (editingText) {
      const newEls = stateRef.current.elements.map(e => e.id === editingText ? { ...e, text: editingVal } : e);
      setElements(newEls); pushHistory(newEls); setEditingText(null);
    }
  };
  
  

  const s = {
    app: { display:"flex", height:"100vh", width:"100vw", fontFamily:"system-ui,sans-serif", background:"#111827", overflow:"hidden", userSelect:"none" },
    leftPanel: { width:260, background:"#1f2937", color:"#f9fafb", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0, borderRight:"1px solid #374151" },
    leftHeader: { padding:"16px 16px 12px", borderBottom:"1px solid #374151", display:"flex", alignItems:"center", gap:8 },
    leftBody: { flex:1, overflowY:"auto", overflowX:"hidden", padding:"12px 10px" },
    rightPanel: { width:260, background:"#1f2937", color:"#f9fafb", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0, borderLeft:"1px solid #374151" },
    rightBody: { flex:1, overflowY:"auto", padding:"12px 10px" },
    center: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#0d1117" },
    toolbar: { height:44, background:"#161b22", borderBottom:"1px solid #30363d", display:"flex", alignItems:"center", padding:"0 12px", gap:4, flexShrink:0, minWidth:0 },
    canvasArea: { flex:1, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", padding:0 },
    section: { marginBottom:12 },
    sectionTitle: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:2 },
    btn: { background:"#374151", border:"1px solid #4b5563", color:"#f9fafb", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:500 },
    btnPrimary: { background:"#3b82f6", border:"1px solid #2563eb", color:"#fff", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:500 },
    btnDanger: { background:"#ef4444", border:"1px solid #dc2626", color:"#fff", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:500 },
    btnSuccess: { background:"#10b981", border:"1px solid #059669", color:"#fff", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:500 },
    btnSmall: { background:"#374151", border:"1px solid #4b5563", color:"#f9fafb", borderRadius:5, padding:"4px 8px", cursor:"pointer", fontSize:11 },
    btnFull: { width:"100%", marginBottom:6 },
    btnLabel: { width:"100%", marginBottom:6, background:"#374151", border:"1px solid #4b5563", color:"#f9fafb", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", gap:5, boxSizing:"border-box" },
    input: { width:"100%", background:"#374151", border:"1px solid #4b5563", color:"#f9fafb", borderRadius:6, padding:"6px 8px", fontSize:12, boxSizing:"border-box" },
    label: { fontSize:11, color:"#9ca3af", display:"block", marginBottom:4 },
    row: { display:"flex", gap:6, marginBottom:6 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 },
    grid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginBottom:6 },
    select: { width:"100%", background:"#374151", border:"1px solid #4b5563", color:"#f9fafb", borderRadius:6, padding:"6px 8px", fontSize:12, boxSizing:"border-box", marginBottom:6 },
    layerItem: (active) => ({ display:"flex", alignItems:"center", gap:6, padding:"6px 8px", borderRadius:6, cursor:"pointer", marginBottom:4, background: active?"#3b82f6":"#374151", color: active?"#fff":"#d1d5db", fontSize:12 }),
    tabBtn: (active) => ({ flex:1, padding:"6px 0", background: active?"#3b82f6":"transparent", border:"none", color: active?"#fff":"#9ca3af", borderRadius:5, cursor:"pointer", fontSize:12, fontWeight:500 }),
  };

  const tbBtn = (icon, onClick, title, active) => (
    <button style={{ background: active?"#3b82f6":"#21262d", border:"1px solid #30363d", color:"#f9fafb", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:4, flexShrink:0 }} onClick={onClick} title={title}>{icon}</button>
  );

  const saveStatusColor = saveStatus==="saved"?"#10b981":saveStatus==="error"?"#ef4444":"#9ca3af";
  const saveStatusText = saveStatus==="saving"?"Сохранение...":saveStatus==="saved"?"✓ Сохранено":saveStatus==="error"?"✗ Ошибка":"";

  const ResizeHandles = ({ el }) => {
    const w = el.width, h = el.height || (el.type==="text" ? el.fontSize*1.5 : 100);
    return <>
      {HANDLES.map(handle => (
        <div key={handle.id} style={{
          position:"absolute", left: handle.x * w - 5, top: handle.y * h - 5,
          width:10, height:10, background:"#fff", border:"2px solid #3b82f6",
          borderRadius:2, cursor:handle.cursor, zIndex:10,
        }} onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, el.id, handle.id); }} />
      ))}
    </>;
  };

  return (
    <div style={s.app} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {(showAuth || !currentUser) && <AuthModal onClose={() => setShowAuth(false)} onAuth={(user) => { setCurrentUser(user); setShowAuth(false); }} />}
      {showProjects && <ProjectsModal onClose={() => setShowProjects(false)} onLoad={handleLoadProject} currentUser={currentUser} />}

      <div style={s.leftPanel}>
        <div style={s.leftHeader}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
          <div style={{flex:1}}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f9fafb" }}>FlyerStudio</div>
            <div style={{ fontSize:10, color:"#6b7280" }}>XML-редактор листовок</div>
          </div>
          {currentUser ? (
  <div style={{position:"relative"}}>
    <div style={{fontSize:11, color:"#10b981", cursor:"pointer", display:"flex", alignItems:"center", gap:4}}
      onClick={() => setShowUserMenu(v => !v)}>
      {ic("user", 12)} {currentUser.username} ▾
    </div>
    {showUserMenu && (
      <div style={{position:"absolute", right:0, top:"130%", background:"#1f2937", border:"1px solid #374151", borderRadius:8, overflow:"hidden", zIndex:100, minWidth:160}}>
        <div style={{padding:"10px 14px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #374151"}}>
          {currentUser.username}
        </div>
        <button style={{display:"flex", alignItems:"center", gap:8, width:"100%", background:"none", border:"none", color:"#f9fafb", padding:"10px 14px", cursor:"pointer", fontSize:12}}
          onMouseEnter={e=>e.currentTarget.style.background="#374151"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}
          onClick={() => { setCurrentUser(null); setShowUserMenu(false); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          Выйти
        </button>
      </div>
    )}
  </div>
) : (
  <button style={{...s.btnSmall, fontSize:10}} onClick={() => setShowAuth(true)}>Войти</button>
)}
        </div>
        <div style={{ display:"flex", padding:"8px 10px", gap:4, borderBottom:"1px solid #374151" }}>
          {["tools","templates","page"].map(p => (
            <button key={p} style={s.tabBtn(activePanel===p)} onClick={() => setActivePanel(p)}>
              {p==="tools" ? "Инструменты" : p==="templates" ? "Шаблоны" : "Страница"}
            </button>
          ))}
        </div>
        <div style={s.leftBody}>
          {activePanel === "tools" && <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Добавить</div>
              <button style={{...s.btn, ...s.btnFull}} onClick={addText}>+ Текст</button>
              <label style={s.btnLabel}>
                + Изображение (файл)
                <input type="file" accept="image/*" onChange={uploadImage} style={{display:"none"}} />
              </label>
              <div style={{...s.row, marginTop:6}}>
                <input style={{...s.input, flex:1}} placeholder="URL изображения..." value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && loadImageFromURL()} />
                <button style={{...s.btnPrimary, display:"flex", alignItems:"center", gap:4}} onClick={loadImageFromURL}>{ic("image")} +</button>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Редактирование</div>
              <div style={s.grid2}>
                <button style={s.btn} onClick={duplicateSelected} disabled={!selectedId}>Дублировать</button>
                <button style={{...s.btn, ...s.btnDanger}} onClick={deleteSelected} disabled={!selectedId}>Удалить</button>
                <button style={s.btn} onClick={undo} disabled={histIdx===0}>↩ Отменить</button>
                <button style={s.btn} onClick={redo} disabled={histIdx>=history.length-1}>Повторить ↪</button>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Выравнивание {selectedIds.length > 1 ? `(${selectedIds.length} эл.)` : ""}</div>
              <div style={s.grid3}>
                {[["⬅","left","Влево"],["⬌","centerH","По центру H"],["➡","right","Вправо"],["⬆","top","Вверх"],["⬍","centerV","По центру V"],["⬇","bottom","Вниз"]].map(([ico,type,title])=>(
                  <button key={type} style={s.btnSmall} onClick={()=>align(type)} title={title} disabled={!selectedId}>{ico}</button>
                ))}
              </div>
            </div>
            
            <div style={s.section}>
              <div style={s.sectionTitle}>Оформление</div>
              <div style={{...s.row, alignItems:"center"}}>
                <span style={{fontSize:12, color:"#9ca3af", flex:1}}>Цвет фона</span>
                <input type="color" value={bg} onChange={e=>setBg(e.target.value)} style={{width:40, height:32, borderRadius:6, border:"none", cursor:"pointer", background:"none"}} />
              </div>
              <div style={{...s.row, marginTop:4}}>
                <button style={{...s.btnSmall, flex:1, background: showGrid?"#3b82f6":undefined}} onClick={()=>setShowGrid(v=>!v)}>{showGrid?"✓ ":""}Сетка</button>
                <button style={{...s.btnSmall, flex:1, background: gridSnap?"#3b82f6":undefined}} onClick={()=>setGridSnap(v=>!v)}>{gridSnap?"✓ ":""}Привязка</button>
              </div>
            </div>
          </>}

          {activePanel === "templates" && <>
            {serverTemplates.length > 0 ? (
              <div style={s.section}>
                <div style={s.sectionTitle}>Шаблоны</div>
                {serverTemplates.map(tpl => (
  <div key={tpl.id} style={{display:"flex", gap:4, marginBottom:6, alignItems:"stretch"}}>
    <button style={{...s.btn, flex:1, textAlign:"left"}} onClick={()=>loadServerTemplate(tpl.id)}>
      <div style={{fontWeight:600}}>{tpl.name}</div>
      <div style={{fontSize:10, color:"#9ca3af", marginTop:2}}>{tpl.category}</div>
    </button>
    <button style={{...s.btn, ...s.btnDanger, padding:"4px 8px", flexShrink:0}} onClick={async()=>{
      if(!confirm(`Удалить шаблон "${tpl.name}"?`)) return;
      await fetch(`http://localhost:3001/api/templates/${tpl.id}`, {method:"DELETE"});
      getTemplates().then(data => { if(Array.isArray(data)) setServerTemplates(data); });
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
    </button>
  </div>
))}
              </div>
            ) : (
              <div style={{textAlign:"center", padding:"30px 10px", color:"#4b5563", fontSize:13}}>Запустите сервер чтобы загрузить шаблоны</div>
            )}
          </>}

          {activePanel === "page" && <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Формат</div>
              <select style={s.select} value={selectedPreset} onChange={e=>{setSelectedPreset(e.target.value); applyPreset(e.target.value);}}>
  <option value="">— выбрать формат —</option>
  {Object.entries(PRESETS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
</select>
              <div style={s.grid2}>
                <div><div style={s.label}>Ширина (px)</div><input type="number" style={s.input} value={pageW} onChange={e=>{setPageW(Number(e.target.value)); setSelectedPreset("");}} min={100} max={2000} /></div>
                <div><div style={s.label}>Высота (px)</div><input type="number" style={s.input} value={pageH} onChange={e=>{setPageH(Number(e.target.value)); setSelectedPreset("");}} min={100} max={2000} /></div>
              </div>
              <button style={{...s.btn, ...s.btnFull}} onClick={toggleOrientation}>⟳ {orientation==="portrait"?"Книжная → Альбомная":"Альбомная → Книжная"}</button>
              <div style={{marginTop:8, fontSize:11, color:"#6b7280", textAlign:"center"}}>{pageW} × {pageH} · {orientation==="portrait"?"Книжная":"Альбомная"}</div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>XML-проект</div>
              <button style={{...s.btn, ...s.btnFull}} onClick={exportXML}>Скачать XML</button>
              <label style={s.btnLabel}>
                {ic("upload")} Загрузить XML
                <input type="file" accept=".xml" onChange={importXML} style={{display:"none"}} />
              </label>
            </div>
          </>}
        </div>
      </div>

      <div style={s.center}>
        <div style={s.toolbar}>
          {tbBtn("↩", undo, "Ctrl+Z", false)}
          {tbBtn("↪", redo, "Ctrl+Y", false)}
          <div style={{width:1, background:"#30363d", margin:"0 2px", height:20}} />
          {tbBtn("+T", addText, "Добавить текст", false)}
          {tbBtn(<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>, deleteSelected, "Удалить", false)}
          {tbBtn(<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>, duplicateSelected, "Дублировать", false)}
          <div style={{width:1, background:"#30363d", margin:"0 2px", height:20}} />
          {tbBtn("Сетка", ()=>setShowGrid(v=>!v), "Сетка", showGrid)}
          {tbBtn("Привязка", ()=>setGridSnap(v=>!v), "Привязка", gridSnap)}
          <div style={{flex:1}} />
          <input style={{background:"transparent", border:"1px solid #30363d", color:"#f9fafb", borderRadius:5, padding:"3px 8px", fontSize:12, width:140, flexShrink:0}} value={projectName} onChange={e=>setProjectName(e.target.value)} title="Название проекта"/>
          
          <div style={{width:1, background:"#30363d", margin:"0 2px", height:20}} />
          <button style={{...s.btnSuccess, fontSize:11, padding:"4px 10px", display:"flex", alignItems:"center", gap:5, flexShrink:0}} onClick={saveToServer}>
            {ic("save")} Сохранить
          </button>
          <button style={{background:"#21262d", border:"1px solid #30363d", color:"#f9fafb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:5, flexShrink:0}} onClick={()=>setShowProjects(true)}>
            {ic("folder")} Проекты
          </button>
          <button style={{background:"#21262d", border:"1px solid #30363d", color:"#f9fafb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:5, flexShrink:0}} onClick={() => {
            setElements([]); setBg("#ffffff"); setCurrentProjectId(null); setProjectName("Новый проект"); setSelectedId(null); setHistory([[]]); setHistIdx(0);
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
            Новый
          </button>
          <button style={{background:"#21262d", border:"1px solid #30363d", color:"#f9fafb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:5, flexShrink:0}} onClick={saveAsTemplate}>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
  Шаблон
</button>
          <div style={{width:1, background:"#30363d", margin:"0 2px", height:20}} />
          <div style={{position:"relative", flexShrink:0}}>
            <button style={{...s.btnPrimary, fontSize:11, padding:"4px 10px", display:"flex", alignItems:"center", gap:5}} onClick={()=>setShowExportMenu(v=>!v)}>
              {ic("download")} Экспорт ▾
            </button>
            {showExportMenu && (
              <div style={{position:"absolute", right:0, top:"110%", background:"#1f2937", border:"1px solid #374151", borderRadius:8, overflow:"hidden", zIndex:100, minWidth:130}}>
                {[["PNG", exportPNG],["JPEG", exportJPEG],["SVG", exportSVGFile],["PDF", exportPDF],["XML", exportXML]].map(([label, fn]) => (
                  <button key={label} style={{display:"flex", alignItems:"center", gap:8, width:"100%", background:"none", border:"none", color:"#f9fafb", padding:"8px 14px", cursor:"pointer", fontSize:12}}
                    onMouseEnter={e=>e.currentTarget.style.background="#374151"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}
                    onClick={()=>{ fn(); setShowExportMenu(false); }}>
                    {ic("download")} {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div ref={containerRef} style={s.canvasArea} onClick={handleCanvasClick}>
          <div ref={canvasWrapRef} style={{ transform:`scale(${canvasScale})`, transformOrigin:"center center", cursor:"default", position:"relative" }}>
            <div ref={canvasRef} style={{ width:pageW, height:pageH, background:bg, position:"relative", overflow:"hidden", boxShadow:"0 0 0 1px #30363d, 0 20px 60px rgba(0,0,0,0.6)" }}>
              {showGrid && (
                <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",opacity:0.25}} xmlns="http://www.w3.org/2000/svg">
                  <defs><pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#6b7280" strokeWidth="0.5"/></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}
              {elements.map(el => {
                const isSel = el.id === selectedId;
                const isEditing = editingText === el.id;
                const rot = el.rotation || 0;
                const elStyle = { position:"absolute", left:el.x, top:el.y, transform:`rotate(${rot}deg)`, transformOrigin:"center center", opacity: el.opacity??1, cursor:"move" };
                if (el.type === "text") {
                  if (isEditing) return (
                    <textarea key={el.id} style={{...elStyle, cursor:"text", width:el.width, minHeight:el.fontSize*1.5, fontSize:el.fontSize, color:el.fill, fontFamily:el.fontFamily, fontWeight:el.fontWeight, fontStyle:el.fontStyle, textAlign:el.textAlign, background:"rgba(59,130,246,0.1)", border:"2px solid #3b82f6", resize:"none", outline:"none", padding:2, lineHeight:1.4, boxSizing:"border-box"}}
                      autoFocus value={editingVal} onChange={e=>setEditingVal(e.target.value)} onBlur={commitTextEdit} onKeyDown={e=>{ if(e.key==="Escape") commitTextEdit(); }} />
                  );
                  return (
                    <div key={el.id} style={{...elStyle, width:el.width, fontSize:el.fontSize, color:el.fill, fontFamily:el.fontFamily, fontWeight:el.fontWeight, fontStyle:el.fontStyle, textAlign:el.textAlign, whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.4, outline: (isSel || selectedIds.includes(el.id))?"2px solid #3b82f6":"2px solid transparent", outlineOffset:2}}
                      onMouseDown={e=>handleMouseDown(e, el.id)} onDoubleClick={()=>{ setSelectedId(el.id); startEditText(el); }}>
                      {el.text}
                      {isSel && <div style={{position:"absolute", right:-6, bottom:-6, width:10, height:10, background:"#fff", border:"2px solid #3b82f6", borderRadius:2, cursor:"se-resize"}} onMouseDown={e=>{e.stopPropagation(); handleMouseDown(e, el.id, "se");}} />}
                    </div>
                  );
                } else if (el.type === "image") {
                  return (
                    <div key={el.id} style={{...elStyle, width:el.width, height:el.height, outline: (isSel || selectedIds.includes(el.id))?"2px solid #3b82f6":"2px solid transparent", outlineOffset:2}} onMouseDown={e=>handleMouseDown(e, el.id)}>
                      <img src={el.src} style={{width:"100%", height:"100%", objectFit:"fill", display:"block", pointerEvents:"none", userSelect:"none"}} alt="" draggable={false} />
                      {isSel && <ResizeHandles el={el} />}
                      {isSel && resizeSize && (
                        <div style={{position:"absolute", bottom:-28, left:"50%", transform:"translateX(-50%)", background:"#3b82f6", color:"#fff", fontSize:11, padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap"}}>
                          {resizeSize.w} × {resizeSize.h}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={s.rightPanel}>
        <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid #374151", fontSize:13, fontWeight:600, color:"#f9fafb" }}>
          {selected ? (selected.type==="text" ? "Текст" : "Изображение") : "Свойства"}
        </div>
        <div style={s.rightBody}>
          {selected?.type === "text" && <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Содержимое</div>
              <textarea style={{...s.input, height:70, resize:"vertical", lineHeight:1.5}} value={selected.text} onChange={e=>updateSelected("text", e.target.value)} onBlur={e=>updateSelectedCommit("text", e.target.value)} />
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Шрифт</div>
              <select style={s.select} value={selected.fontFamily} onChange={e=>updateSelectedCommit("fontFamily",e.target.value)}>
                {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
              <div style={s.grid2}>
                <div><div style={s.label}>Размер</div><input type="number" style={s.input} value={selected.fontSize} min={6} max={300} onChange={e=>updateSelectedCommit("fontSize",Number(e.target.value))} /></div>
                <div><div style={s.label}>Цвет</div><input type="color" style={{...s.input, padding:2, height:34}} value={selected.fill} onChange={e=>updateSelectedCommit("fill",e.target.value)} /></div>
              </div>
              <div style={s.grid3}>
                <button style={{...s.btnSmall, background: selected.fontWeight==="bold"?"#3b82f6":undefined}} onClick={()=>updateSelectedCommit("fontWeight", selected.fontWeight==="bold"?"normal":"bold")}>Ж</button>
                <button style={{...s.btnSmall, fontStyle:"italic", background: selected.fontStyle==="italic"?"#3b82f6":undefined}} onClick={()=>updateSelectedCommit("fontStyle", selected.fontStyle==="italic"?"normal":"italic")}>К</button>
                <button style={s.btnSmall}>—</button>
              </div>
              <div style={s.grid3}>
                {["left","center","right"].map(a=>(
                  <button key={a} style={{...s.btnSmall, background:selected.textAlign===a?"#3b82f6":undefined}} onClick={()=>updateSelectedCommit("textAlign",a)}>
                    <span style={{fontSize:9, display:"block"}}>{a==="left"?"влево":a==="center"?"центр":"вправо"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Позиция</div>
              <div style={s.grid2}>
                {[["x","X"],["y","Y"],["width","Ширина"]].map(([f,l])=>(
                  <div key={f}><div style={s.label}>{l}</div><input type="number" style={s.input} value={Math.round(selected[f])} onChange={e=>updateSelectedCommit(f,Number(e.target.value))} /></div>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Доп. параметры</div>
              <div style={s.label}>Прозрачность: {Math.round((selected.opacity??1)*100)}%</div>
              <input type="range" min={0} max={1} step={0.01} value={selected.opacity??1} style={{width:"100%",marginBottom:8}} onChange={e=>updateSelectedCommit("opacity",Number(e.target.value))} />
              <div style={s.label}>Поворот: {selected.rotation||0}°</div>
              <input type="range" min={-180} max={180} step={1} value={selected.rotation||0} style={{width:"100%"}} onChange={e=>updateSelectedCommit("rotation",Number(e.target.value))} />
            </div>
          </>}
          {selected?.type === "image" && <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Размер и позиция</div>
              <div style={s.grid2}>
                {[["width","Ширина"],["height","Высота"],["x","X"],["y","Y"]].map(([f,l])=>(
                  <div key={f}><div style={s.label}>{l}</div><input type="number" style={s.input} value={Math.round(selected[f])} min={10} onChange={e=>updateSelectedCommit(f,Number(e.target.value))} /></div>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Вид</div>
              <div style={s.label}>Прозрачность: {Math.round((selected.opacity??1)*100)}%</div>
              <input type="range" min={0} max={1} step={0.01} value={selected.opacity??1} style={{width:"100%",marginBottom:8}} onChange={e=>updateSelectedCommit("opacity",Number(e.target.value))} />
              <div style={s.label}>Поворот: {selected.rotation||0}°</div>
              <input type="range" min={-180} max={180} step={1} value={selected.rotation||0} style={{width:"100%"}} onChange={e=>updateSelectedCommit("rotation",Number(e.target.value))} />
            </div>
          </>}
          {!selected && <div style={{ textAlign:"center", padding:"30px 10px", color:"#4b5563", fontSize:13 }}>Кликните на элемент чтобы изменить его свойства</div>}
          <div style={{borderTop:"1px solid #374151", paddingTop:12, marginTop:8}}>
            <div style={s.sectionTitle}>Слои ({elements.length})</div>
            {[...elements].reverse().map((el) => (
              <div key={el.id} style={s.layerItem(el.id===selectedId)} onClick={()=>setSelectedId(el.id)}>
                <span style={{fontSize:10}}>{el.type==="text"?"T":"IMG"}</span>
                <span style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:11}}>
                  {el.type==="text" ? el.text.substring(0,20) : "Изображение"}
                </span>
                <div style={{display:"flex",gap:2}}>
                  <button style={{...s.btnSmall, padding:"2px 5px", fontSize:10}} onClick={e=>{e.stopPropagation();moveLayer("up")}}>↑</button>
                  <button style={{...s.btnSmall, padding:"2px 5px", fontSize:10}} onClick={e=>{e.stopPropagation();moveLayer("down")}}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{position:"fixed", bottom:24, right:24, display:"flex", flexDirection:"column", gap:8, zIndex:9999, maxWidth:340}}>
        {toasts.map(t => (
          <div key={t.id} style={{display:"flex", alignItems:"center", gap:10, background:"#1f2937", border:"1px solid #374151", borderLeft:`4px solid ${t.type==="success"?"#10b981":t.type==="error"?"#ef4444":"#3b82f6"}`, borderRadius:8, padding:"12px 16px", minWidth:280, maxWidth:340, boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
            {t.type==="success" && <svg width="18" height="18" viewBox="0 0 24 24" fill="#10b981" style={{flexShrink:0}}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
            {t.type==="error" && <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" style={{flexShrink:0}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>}
            {t.type==="info" && <svg width="18" height="18" viewBox="0 0 24 24" fill="#3b82f6" style={{flexShrink:0}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>}
            <div>
              <div style={{fontSize:13, fontWeight:600, color:"#f9fafb"}}>{t.message}</div>
              {t.sub && <div style={{fontSize:11, color:"#9ca3af", marginTop:2}}>{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}