import { useState, useEffect, useRef, useMemo } from "react";

// =====================================================================
// ÖZEL BİLEŞEN: GENİŞLEYEBİLİR JSON AĞACI (Recursive JSON Viewer)
// =====================================================================
const JsonNode = ({ label, value, isLast = true }: { label: string | null, value: any, isLast?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);

  // Eğer değer bir obje/dizi değilse (string, number, boolean, null) direkt yazdır
  if (!isObject) {
    let valColor = "text-green-400"; // Varsayılan String rengi
    if (typeof value === "number") valColor = "text-orange-400";
    else if (typeof value === "boolean") valColor = "text-purple-400";
    else if (value === null) valColor = "text-gray-500";

    return (
      <div className="pl-6 font-mono text-[13px] leading-relaxed">
        {label !== null && <span className="text-blue-300">"{label}": </span>}
        <span className={valColor}>{value === null ? "null" : JSON.stringify(value)}</span>
        {!isLast && <span className="text-gray-500">,</span>}
      </div>
    );
  }

  // Eğer obje veya dizi ise genişleyebilir/daralabilir yapı kur
  const keys = Object.keys(value);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div className="pl-6 font-mono text-[13px] leading-relaxed">
      <div 
        className="cursor-pointer select-none hover:bg-[#2a2a2b] inline-flex items-center rounded px-1 -ml-4 transition-colors" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-gray-400 mr-1 w-3 text-center text-[10px]">
          {isExpanded ? '▼' : '▶'}
        </span>
        {label !== null && <span className="text-blue-300 mr-1">"{label}":</span>}
        <span className="text-yellow-500">{openBracket}</span>
        {!isExpanded && (
          <span className="text-gray-500 italic text-xs ml-2">
            {keys.length} items {closeBracket}{!isLast && ','}
          </span>
        )}
      </div>
      
      {isExpanded && (
        <div>
          {keys.map((key, index) => (
            <JsonNode 
              key={key} 
              label={isArray ? null : key} 
              value={value[key as keyof typeof value]} 
              isLast={index === keys.length - 1} 
            />
          ))}
          <div className="text-yellow-500 pl-2">
            {closeBracket}{!isLast && <span className="text-gray-500">,</span>}
          </div>
        </div>
      )}
    </div>
  );
};


// =====================================================================
// ANA UYGULAMA BİLEŞENİ
// =====================================================================
export default function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState(""); 
  const [body, setBody] = useState("{\n  \n}");
  const [timeoutVal, setTimeoutVal] = useState("10");
  
  const [response, setResponse] = useState<any>(null);
  const [status, setStatus] = useState("Bekleniyor...");
  const [activeTab, setActiveTab] = useState<"tree" | "raw">("tree");
  const [isLoading, setIsLoading] = useState(false);

  const [projects, setProjects] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<{endpoints: string[], requests: any[]}>({ endpoints: [], requests: [] });
  const projectDataRef = useRef(projectData);
  projectDataRef.current = projectData;

  const [selectedRequestName, setSelectedRequestName] = useState("");

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNameInput, setRequestNameInput] = useState("");

  const [auth, setAuth] = useState<any>({ type: "Gerekmiyor", data: {} });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tempAuth, setTempAuth] = useState<any>({ type: "Gerekmiyor", data: {} });

  // --- YENİ: SÜRÜKLENEBİLİR PANEL (RESIZABLE) STATE VE REF'LERİ ---
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Yüzde olarak (Varsayılan %50)
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [sidebarWidthPx, setSidebarWidthPx] = useState(256);
  const isDraggingSidebar = useRef(false);
  const rootLayoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // @ts-ignore
    window.api.getProjects().then((list: string[]) => setProjects(list));
  }, []);

  const normalizeUrl = (s: string) => s.trim();

  /** URL kutusu datalist: hem endpoints hem kayıtlı isteklerdeki url'ler (projede eksik endpoints olsa bile). */
  const urlDatalistOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const ep of projectData.endpoints ?? []) {
      const t = normalizeUrl(ep);
      if (t) seen.add(t);
    }
    for (const r of projectData.requests ?? []) {
      const t = normalizeUrl(r?.url ?? "");
      if (t) seen.add(t);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [projectData.endpoints, projectData.requests]);

  /** Combo: yalnızca tam olarak projedeki bir adresle eşleşince seçili görünür; elle yazılan özel URL’de boş kalır. */
  const endpointPickerValue = useMemo(() => {
    const u = normalizeUrl(url);
    return u && urlDatalistOptions.includes(u) ? u : "";
  }, [url, urlDatalistOptions]);

  /** Gönderimde yalnızca endpoints listesine URL ekler; kayıtlı istek (requests) oluşturmaz. */
  const syncUrlToEndpointsOnly = async () => {
    if (!currentProject || !url.trim()) return;
    const u = normalizeUrl(url);
    const prev = projectDataRef.current;
    const already = prev.endpoints.some((e) => normalizeUrl(e) === u);
    if (already) return;
    const newData = { ...prev, endpoints: [...prev.endpoints, u] };
    // @ts-ignore
    await window.api.saveProject(currentProject, newData);
    setProjectData(newData);
    projectDataRef.current = newData;
  };

  const deleteCurrentEndpoint = async () => {
    if (!currentProject) return;
    const u = normalizeUrl(url);
    if (!u) return;
    const prev = projectDataRef.current;
    const newEndpoints = prev.endpoints.filter((e) => normalizeUrl(e) !== u);
    const newRequests = prev.requests.filter((r) => normalizeUrl(r?.url ?? "") !== u);
    const newData = { ...prev, endpoints: newEndpoints, requests: newRequests };
    // @ts-ignore
    await window.api.saveProject(currentProject, newData);
    setProjectData(newData);
    projectDataRef.current = newData;

    const nextUrls: string[] = [];
    const seen = new Set<string>();
    for (const ep of newData.endpoints) {
      const t = normalizeUrl(ep);
      if (t && !seen.has(t)) {
        seen.add(t);
        nextUrls.push(t);
      }
    }
    for (const r of newData.requests) {
      const t = normalizeUrl(r?.url ?? "");
      if (t && !seen.has(t)) {
        seen.add(t);
        nextUrls.push(t);
      }
    }
    nextUrls.sort((a, b) => a.localeCompare(b));
    const nextUrl = nextUrls[0] ?? "";
    setUrl(nextUrl);
    if (nextUrl) {
      const req = newData.requests.find((r) => normalizeUrl(r?.url ?? "") === nextUrl);
      if (req) loadSavedRequest(req);
      else setSelectedRequestName("");
    } else {
      setSelectedRequestName("");
      setMethod("GET");
      setBody("{\n  \n}");
      setAuth({ type: "Gerekmiyor", data: {} });
      setTimeoutVal("10");
    }
  };

  // --- SÜRÜKLEME (RESIZE) FONKSİYONLARI ---
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    // Konteynerın (Sol+Sağ panellerin toplamı) ekrandaki konumunu al
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Farenin X pozisyonuna göre yeni yüzdeyi hesapla
    const newWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Panellerin tamamen kapanmasını engellemek için %20 ile %80 arasında sınırla (Clamp)
    if (newWidthPercentage > 20 && newWidthPercentage < 80) {
      setLeftPanelWidth(newWidthPercentage);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default'; // İmleci normale döndür
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize'; // Tüm ekranda imleci ok yap
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleSidebarMouseMove = (e: MouseEvent) => {
    if (!isDraggingSidebar.current || !rootLayoutRef.current) return;
    const rect = rootLayoutRef.current.getBoundingClientRect();
    const w = e.clientX - rect.left;
    const minW = 160;
    const mainMin = 320;
    const maxW = Math.max(minW, rect.width - mainMin);
    const clamped = Math.max(minW, Math.min(maxW, w));
    setSidebarWidthPx(clamped);
  };

  const handleSidebarMouseUp = () => {
    isDraggingSidebar.current = false;
    document.body.style.cursor = "default";
    document.removeEventListener("mousemove", handleSidebarMouseMove);
    document.removeEventListener("mouseup", handleSidebarMouseUp);
  };

  const handleSidebarMouseDown = () => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", handleSidebarMouseMove);
    document.addEventListener("mouseup", handleSidebarMouseUp);
  };

  // --- PROJE FONKSİYONLARI ---
  const confirmCreateProject = async () => {
    if (!projectNameInput || projectNameInput.trim() === "") return;
    const safeName = projectNameInput.trim().replace(/ /g, "_");
    // @ts-ignore
    const res = await window.api.createProject(safeName);
    
    if (res.error) {
      alert(res.error);
    } else {
      setProjects([...projects, safeName]);
      handleLoadProject(safeName);
      setShowProjectModal(false);
      setProjectNameInput("");
    }
  };

  const handleLoadProject = async (name: string) => {
    setCurrentProject(name);
    // @ts-ignore
    const raw = await window.api.loadProject(name);
    const data = {
      endpoints: Array.isArray(raw?.endpoints) ? raw.endpoints : [],
      requests: Array.isArray(raw?.requests) ? raw.requests : [],
    };
    const urlSet = new Set<string>();
    for (const ep of data.endpoints) {
      const t = normalizeUrl(ep);
      if (t) urlSet.add(t);
    }
    for (const r of data.requests) {
      const t = normalizeUrl(r?.url ?? "");
      if (t) urlSet.add(t);
    }
    const mergedEndpoints = [...urlSet].sort((a, b) => a.localeCompare(b));
    const needsEndpointSync =
      mergedEndpoints.length !== data.endpoints.length ||
      mergedEndpoints.some((u, i) => u !== normalizeUrl(data.endpoints[i] ?? ""));
    const dataToUse = needsEndpointSync ? { ...data, endpoints: mergedEndpoints } : data;
    setProjectData(dataToUse);
    projectDataRef.current = dataToUse;
    if (needsEndpointSync) {
      // @ts-ignore
      void window.api.saveProject(name, dataToUse);
    }
    
    if (data.requests && data.requests.length > 0) {
      loadSavedRequest(data.requests[0]);
    } else {
      clearFormToDefault();
    }
  };

  const confirmSaveRequest = async () => {
    if (!requestNameInput || requestNameInput.trim() === "") return;

    const newReq = { name: requestNameInput.trim(), method, url, body, auth, timeout: timeoutVal };
    const newData = { ...projectData };
    
    if (url && !newData.endpoints.includes(url)) {
      newData.endpoints.push(url);
    }

    const existingIdx = newData.requests.findIndex(r => r.name === newReq.name);
    if (existingIdx >= 0) {
      newData.requests[existingIdx] = newReq;
    } else {
      newData.requests.push(newReq);
    }

    // @ts-ignore
    await window.api.saveProject(currentProject, newData);
    setProjectData(newData);
    projectDataRef.current = newData;
    setSelectedRequestName(newReq.name);
    setShowRequestModal(false);
    setRequestNameInput("");
  };

  const loadSavedRequest = (req: any) => {
    setSelectedRequestName(req.name || "");
    setMethod(req.method || "GET");
    setUrl(req.url || "");
    setBody(req.body || "{\n  \n}");
    setAuth(req.auth || { type: "Gerekmiyor", data: {} });
    setTimeoutVal(req.timeout || "10");
  };

  const clearFormToDefault = () => {
    setSelectedRequestName("");
    setUrl("");
    setBody("{\n  \n}");
    setAuth({ type: "Gerekmiyor", data: {} });
    setTimeoutVal("10");
  };

  const deleteSelectedSavedRequest = async () => {
    if (!currentProject || !selectedRequestName) return;
    const prev = projectDataRef.current;
    const idx = prev.requests.findIndex((r) => r.name === selectedRequestName);
    if (idx < 0) return;
    const newRequests = prev.requests.filter((r) => r.name !== selectedRequestName);
    const newData = { ...prev, requests: newRequests };
    // @ts-ignore
    await window.api.saveProject(currentProject, newData);
    setProjectData(newData);
    projectDataRef.current = newData;

    if (newRequests.length === 0) {
      clearFormToDefault();
      return;
    }
    if (idx < newRequests.length) {
      loadSavedRequest(newRequests[idx]);
    } else {
      loadSavedRequest(newRequests[idx - 1]);
    }
  };

  const handleSend = async () => {
    if (!url) return;
    setIsLoading(true);
    setStatus("Status: Gönderiliyor...");
    setResponse(null);
    if (currentProject) {
      await syncUrlToEndpointsOnly();
    }
    try {
      let finalUrl = url;
      let customHeaders: any = {};

      if (auth.type === "Bearer Token") {
        customHeaders["Authorization"] = `Bearer ${auth.data.token || ""}`;
      } else if (auth.type === "Basic Auth") {
        const encoded = btoa(`${auth.data.username || ""}:${auth.data.password || ""}`);
        customHeaders["Authorization"] = `Basic ${encoded}`;
      } else if (auth.type === "API Key") {
        if (auth.data.addTo === "Header") {
          customHeaders[auth.data.key || "x-api-key"] = auth.data.value || "";
        } else if (auth.data.addTo === "Query Params") {
          try {
            const urlObj = new URL(finalUrl);
            urlObj.searchParams.append(auth.data.key || "api_key", auth.data.value || "");
            finalUrl = urlObj.toString();
          } catch (e) {
            console.warn("Geçersiz URL, Query Param eklenemedi.");
          }
        }
      }

      // @ts-ignore
      const res = await window.api.makeRequest({ method, url: finalUrl, body, customHeaders, timeout: timeoutVal });
      
      if (res.error) {
        setStatus("Status: Hata (Bağlantı Kurulamadı)");
        setResponse(res.error);
        setActiveTab("raw");
      } else {
        setStatus(`Status: ${res.status} ${res.statusText} | Time: ${res.time}ms`);
        let parsedJson = null;
        try { parsedJson = JSON.parse(res.data); } catch (e) { }

        if (parsedJson) {
          setResponse(parsedJson);
          setActiveTab("tree"); // Başarılı JSON ise Tree'ye geç
        } else {
          setResponse(res.data);
          setActiveTab("raw"); // Değilse Raw'a geç
        }
      }
    } catch (error: any) {
      setStatus("Status: Sistem Hatası");
      setResponse(error.message);
      setActiveTab("raw");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={rootLayoutRef}
      className="flex h-screen bg-[#1e1e1e] text-gray-200 font-sans selection:bg-blue-500/30 relative overflow-hidden"
    >
      
      {/* ================= MODALLAR BURADA (Aynı kalıyor) ================= */}
      {showProjectModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#333333] p-6 rounded-lg shadow-2xl w-96">
            <h2 className="text-lg font-bold mb-4 text-gray-100">Yeni Proje Oluştur</h2>
            <input 
              type="text" autoFocus placeholder="Örn: E-Ticaret_API"
              className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2 outline-none focus:border-blue-500 text-gray-100 mb-6"
              value={projectNameInput} onChange={(e) => setProjectNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmCreateProject()}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333] transition-colors">İptal</button>
              <button onClick={confirmCreateProject} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">Oluştur</button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#333333] p-6 rounded-lg shadow-2xl w-96">
            <h2 className="text-lg font-bold mb-4 text-gray-100">İsteği Kaydet</h2>
            <input 
              type="text" autoFocus placeholder="Örn: Get User List"
              className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2 outline-none focus:border-emerald-500 text-gray-100 mb-6"
              value={requestNameInput} onChange={(e) => setRequestNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmSaveRequest()}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333] transition-colors">İptal</button>
              <button onClick={confirmSaveRequest} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#333333] p-6 rounded-lg shadow-2xl w-[450px]">
            <h2 className="text-lg font-bold mb-4 text-gray-100">Authentication Ayarları</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Auth Türü</label>
              <select className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.type} onChange={(e) => setTempAuth({ type: e.target.value, data: {} })}>
                <option value="Gerekmiyor">Gerekmiyor</option><option value="Bearer Token">Bearer Token</option><option value="Basic Auth">Basic Auth</option><option value="API Key">API Key</option>
              </select>
            </div>
            <div className="min-h-[140px]">
              {tempAuth.type === "Gerekmiyor" && <div className="flex h-full items-center justify-center text-sm text-gray-500 mt-8">Bu istek için kimlik doğrulama kullanılmayacak.</div>}
              {tempAuth.type === "Bearer Token" && (
                <div className="mt-4"><label className="block text-sm text-gray-400 mb-2">Token</label><input type="text" placeholder="eyJhbGciOiJIUzI1Ni..." className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500 font-mono text-sm" value={tempAuth.data.token || ""} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, token: e.target.value } })}/></div>
              )}
              {tempAuth.type === "Basic Auth" && (
                <div className="mt-4 space-y-3">
                  <div><label className="block text-sm text-gray-400 mb-2">Username</label><input type="text" className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.data.username || ""} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, username: e.target.value } })}/></div>
                  <div><label className="block text-sm text-gray-400 mb-2">Password</label><input type="password" className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.data.password || ""} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, password: e.target.value } })}/></div>
                </div>
              )}
              {tempAuth.type === "API Key" && (
                <div className="mt-4 space-y-3">
                  <div><label className="block text-sm text-gray-400 mb-2">Key</label><input type="text" placeholder="x-api-key" className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.data.key || "x-api-key"} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, key: e.target.value } })}/></div>
                  <div><label className="block text-sm text-gray-400 mb-2">Value</label><input type="text" className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.data.value || ""} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, value: e.target.value } })}/></div>
                  <div><label className="block text-sm text-gray-400 mb-2">Eklenecek Yer</label><select className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500" value={tempAuth.data.addTo || "Header"} onChange={(e) => setTempAuth({ ...tempAuth, data: { ...tempAuth.data, addTo: e.target.value } })}><option value="Header">Header</option><option value="Query Params">Query Params</option></select></div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333]">İptal</button>
              <button onClick={() => { setAuth(tempAuth); setShowAuthModal(false); }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded">Uygula</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SOL SIDEBAR ================= */}
      <div
        className="bg-[#252526] flex flex-col shrink-0 min-w-[160px] overflow-hidden"
        style={{ width: sidebarWidthPx }}
      >
        <div className="p-5 border-b border-[#333333] shrink-0">
          <h1 className="text-xl font-bold tracking-wide text-gray-100">
            <span className="text-blue-500">API</span> Tester
          </h1>
        </div>

        <div className="p-4 shrink-0">
          <button onClick={() => { setProjectNameInput(""); setShowProjectModal(true); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors shadow-sm">
            + Yeni Proje
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 min-h-0">
          {projects.length === 0 ? (
             <div className="text-xs text-gray-500 text-center mt-4">Henüz proje yok</div>
          ) : (
            projects.map((proj) => (
              <div 
                key={proj} onClick={() => handleLoadProject(proj)}
                className={`px-3 py-2 rounded cursor-pointer text-sm font-medium transition-colors truncate ${currentProject === proj ? 'bg-[#37373d] text-blue-400 border-l-2 border-blue-500' : 'hover:bg-[#2d2d2d] text-gray-400'}`}
                title={proj}
              >
                {proj}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className="w-1.5 shrink-0 bg-[#333333] hover:bg-blue-500 cursor-col-resize flex flex-col justify-center items-center group transition-colors z-20"
        onMouseDown={handleSidebarMouseDown}
        title="Proje listesi genişliği"
      >
        <div className="h-10 w-0.5 bg-gray-500 group-hover:bg-white rounded" />
      </div>

      {/* ================= SAĞ ANA EKRAN ================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        
        {/* Üst Bar (URL ve Butonlar) */}
        <div className="p-6 border-b border-[#333333] bg-[#1e1e1e] shrink-0">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold text-yellow-500">
              {currentProject ? `${currentProject}` : "Lütfen bir proje seçin"}
            </span>
            {currentProject && (
              <div className="flex items-center gap-1 shrink-0">
                <select
                  className="bg-[#2d2d2d] border border-[#3c3c3c] text-gray-300 text-sm rounded px-3 py-1 outline-none max-w-[min(28rem,50vw)]"
                  value={
                    selectedRequestName &&
                    projectData.requests.some((r) => r.name === selectedRequestName)
                      ? selectedRequestName
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedRequestName(v);
                    const req = projectData.requests.find((r) => r.name === v);
                    if (req) loadSavedRequest(req);
                  }}
                >
                  <option value="">-- Kayıtlı İstek Seç --</option>
                  {projectData.requests.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void deleteSelectedSavedRequest()}
                  disabled={
                    !selectedRequestName ||
                    !projectData.requests.some((r) => r.name === selectedRequestName)
                  }
                  className="shrink-0 px-2 py-1 rounded border border-[#3c3c3c] bg-[#2d2d2d] text-red-400 hover:bg-[#3d3d3d] disabled:opacity-40 disabled:pointer-events-none text-sm leading-none"
                  title="İstek sil"
                >
                  🗑
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select className="bg-[#2d2d2d] border border-[#3c3c3c] text-green-400 font-bold rounded px-4 py-2.5 outline-none focus:border-blue-500 w-28 appearance-none shrink-0" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="GET">GET</option><option value="POST" className="text-yellow-400">POST</option><option value="PUT" className="text-blue-400">PUT</option><option value="DELETE" className="text-red-400">DELETE</option><option value="PATCH" className="text-orange-400">PATCH</option>
            </select>

            {currentProject ? (
              <>
                <select
                  className="shrink-0 w-[min(17rem,34vw)] max-w-full bg-[#181818] border border-[#3c3c3c] text-amber-300/95 text-xs font-mono rounded px-2 py-2.5 outline-none focus:border-amber-500"
                  title="Projede kayıtlı endpoint adresleri"
                  value={endpointPickerValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setUrl(v);
                    const req = projectData.requests.find(
                      (r) => normalizeUrl(r?.url ?? "") === normalizeUrl(v)
                    );
                    if (req) loadSavedRequest(req);
                    else setSelectedRequestName("");
                  }}
                >
                  <option value="">— Projede kayıtlı adres seç —</option>
                  {urlDatalistOptions.map((ep) => (
                    <option key={ep} value={ep} title={ep}>
                      {ep.length > 48 ? `${ep.slice(0, 45)}…` : ep}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="URL (düzenlenebilir; projede yoksa odak çıkınca eklenir)"
                  className="flex-1 min-w-[8rem] bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2.5 outline-none focus:border-blue-500 text-gray-100 font-mono text-sm"
                  title="Gönderilecek endpoint URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => {
                    void syncUrlToEndpointsOnly();
                  }}
                />
                <button
                  type="button"
                  onClick={() => void deleteCurrentEndpoint()}
                  disabled={!normalizeUrl(url)}
                  className="shrink-0 px-2.5 py-2 rounded border border-[#3c3c3c] bg-[#2d2d2d] text-red-400 hover:bg-[#3d3d3d] disabled:opacity-40 disabled:pointer-events-none text-sm"
                  title="Endpoint sil"
                >
                  🗑
                </button>
              </>
            ) : (
              <input
                type="text"
                placeholder="Önce proje seçin veya URL yazın"
                className="flex-1 min-w-[12rem] bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2.5 outline-none focus:border-blue-500 text-gray-100 font-mono text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            )}

            <div className="flex flex-col items-center ml-2 mr-1">
              <span className="text-[10px] text-gray-500 uppercase font-bold">Timeout</span>
              <input type="number" className="w-14 bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-center text-xs text-orange-400 outline-none focus:border-orange-500" value={timeoutVal} onChange={(e) => setTimeoutVal(e.target.value)} />
            </div>

            <button onClick={() => { setTempAuth(auth); setShowAuthModal(true); }} className={`px-4 py-2.5 rounded font-medium border ${auth.type === 'Gerekmiyor' ? 'bg-[#2d2d2d] hover:bg-[#3d3d3d] border-[#3c3c3c] text-gray-300' : 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/50 text-purple-400'}`}>
              <span>🔑</span> {auth.type === 'Gerekmiyor' ? 'Auth' : auth.type}
            </button>
            
            <button onClick={handleSend} disabled={isLoading} className={`${isLoading ? 'bg-blue-800 text-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white'} px-8 py-2.5 rounded font-bold shadow-md transition-all active:scale-95`}>
              {isLoading ? '...' : 'GÖNDER'}
            </button>
            
            <button onClick={() => { if (!currentProject) { alert("Lütfen önce bir proje seçin!"); return; } setRequestNameInput(""); setShowRequestModal(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded font-medium transition-colors" title="İsteği Projeye Kaydet">
              💾
            </button>
          </div>
        </div>

        {/* Alt Kısım: Request ve Response (RESIZABLE BÖLÜM) */}
        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          
          {/* SOL: Request Body */}
          <div className="flex flex-col h-full bg-[#1e1e1e]" style={{ width: `${leftPanelWidth}%` }}>
            <div className="px-6 py-3 border-b border-[#333333] flex justify-between items-center bg-[#252526]">
              <span className="text-sm font-semibold text-gray-300">Request Body (JSON)</span>
            </div>
            <textarea 
              className="flex-1 bg-[#1e1e1e] text-gray-300 font-mono text-[13px] p-6 outline-none resize-none focus:bg-[#1a1a1a]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck="false"
            />
          </div>

          {/* SÜRÜKLENEBİLİR AYRAÇ (RESIZER HANDLE) */}
          <div 
            className="w-1.5 bg-[#333333] hover:bg-blue-500 cursor-col-resize flex flex-col justify-center items-center group transition-colors relative z-10"
            onMouseDown={handleMouseDown}
            title="Genişliği Ayarlamak İçin Sürükleyin"
          >
             <div className="h-10 w-0.5 bg-gray-500 group-hover:bg-white rounded"></div>
          </div>

          {/* SAĞ: Response */}
          <div className="flex flex-col h-full bg-[#1e1e1e]" style={{ width: `${100 - leftPanelWidth}%` }}>
            <div className="px-6 py-3 border-b border-[#333333] flex justify-between items-center bg-[#252526]">
              <div className="flex space-x-6">
                <button onClick={() => setActiveTab("tree")} className={`text-sm font-semibold pb-3 -mb-3 transition-colors ${activeTab === 'tree' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  JSON Tree
                </button>
                <button onClick={() => setActiveTab("raw")} className={`text-sm font-semibold pb-3 -mb-3 transition-colors ${activeTab === 'raw' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  Raw
                </button>
              </div>
              <span className={`text-xs font-mono font-bold ${status.includes('200') || status.includes('201') ? 'text-green-400' : status.includes('Hata') ? 'text-red-400' : 'text-gray-400'}`}>
                {status}
              </span>
            </div>
            
            <div className="flex-1 p-4 text-gray-300 font-mono overflow-auto bg-[#1e1e1e]">
              {!response && !isLoading && (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">Yanıt burada görüntülenecek...</div>
              )}
              
              {/* YENİ: Ağaç Görünümü Bileşeni */}
              {response && activeTab === "tree" && (
                <div className="py-2">
                  <JsonNode value={response} label={null} />
                </div>
              )}

              {/* ESKİ: Ham Metin Görünümü */}
              {response && activeTab === "raw" && (
                <pre className="whitespace-pre-wrap break-all text-gray-400 text-[13px] px-2">
                  {typeof response === 'string' ? response : JSON.stringify(response, null, 2)}
                </pre>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}