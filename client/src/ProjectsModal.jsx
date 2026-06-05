import { useState, useEffect } from "react";
import { getProjects, deleteProject, getProject } from "./api";

export default function ProjectsModal({ onClose, onLoad, currentUser }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    const data = await getProjects(currentUser?.id);
    const filtered = currentUser
      ? data.filter(p => p.user_id === currentUser.id)
      : data.filter(p => !p.user_id);
    setProjects(filtered);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleLoad = async (id) => {
    const project = await getProject(id);
    onLoad(project);
    onClose();
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить проект?")) return;
    await deleteProject(id);
    fetchProjects();
  };

  const s = {
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 },
    modal: { background:"#1f2937", borderRadius:12, padding:24, width:560, maxHeight:"80vh", display:"flex", flexDirection:"column", color:"#f9fafb", boxShadow:"0 25px 60px rgba(0,0,0,0.5)" },
    header: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 },
    title: { fontSize:18, fontWeight:700 },
    closeBtn: { background:"#374151", border:"none", color:"#f9fafb", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:14 },
    list: { overflowY:"auto", flex:1 },
    item: { background:"#374151", borderRadius:8, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" },
    itemInfo: { flex:1 },
    itemName: { fontSize:14, fontWeight:600, marginBottom:4 },
    itemMeta: { fontSize:11, color:"#9ca3af" },
    actions: { display:"flex", gap:8 },
    loadBtn: { background:"#3b82f6", border:"none", color:"#fff", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:500 },
    delBtn: { background:"#ef4444", border:"none", color:"#fff", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12 },
    empty: { textAlign:"center", padding:"40px 0", color:"#6b7280" },
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div style={s.title}>📁 Мои проекты {currentUser ? `(${currentUser.username})` : ""}</div>
          <button style={s.closeBtn} onClick={onClose}>✕ Закрыть</button>
        </div>
        <div style={s.list}>
          {loading && <div style={s.empty}>Загрузка...</div>}
          {!loading && projects.length === 0 && (
            <div style={s.empty}>
              {currentUser ? "Нет сохранённых проектов" : "Войдите чтобы видеть свои проекты"}
            </div>
          )}
          {projects.map(p => (
            <div key={p.id} style={s.item}>
              <div style={s.itemInfo}>
                <div style={s.itemName}>{p.name}</div>
                <div style={s.itemMeta}>
                  {p.page_width}×{p.page_height} · {p.orientation === "landscape" ? "Альбомная" : "Книжная"} · {new Date(p.updated_at).toLocaleString("ru")}
                </div>
              </div>
              <div style={s.actions}>
                <button style={s.loadBtn} onClick={() => handleLoad(p.id)}>Открыть</button>
                <button style={s.delBtn} onClick={() => handleDelete(p.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}