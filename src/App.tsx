import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

const JsonNode = ({ label, value, isLast = true }: { label: string | null, value: any, isLast?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  if (!isObject) {
    let valColor = "text-green-400";
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
          {isExpanded ? "▼" : "▶"}
        </span>
        {label !== null && <span className="text-blue-300 mr-1">"{label}":</span>}
        <span className="text-yellow-500">{openBracket}</span>
        {!isExpanded && (
          <span className="text-gray-500 italic text-xs ml-2">
            {keys.length} items {closeBracket}{!isLast && ","}
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
  const [projectData, setProjectData] = useState<{ endpoints: string[]; requests: any[] }>({
    endpoints: [],
    requests: [],
  });

  const [showUrlDropdown, setShowUrlDropdown] = useState(false);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNameInput, setRequestNameInput] = useState("");

  const [auth, setAuth] = useState<any>({ type: "Gerekmiyor", data: {} });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tempAuth, setTempAuth] = useState<any>({ type: "Gerekmiyor", data: {} });

  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<string[]>("get_projects")
      .then((list) => setProjects(list))
      .catch((err) => console.error("Projeler yüklenemedi:", err));
  }, []);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    if (newWidthPercentage > 20 && newWidthPercentage < 80) {
      setLeftPanelWidth(newWidthPercentage);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = "default";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const confirmCreateProject = async () => {
    if (!projectNameInput || projectNameInput.trim() === "") return;
    const safeName = projectNameInput.trim().replace(/ /g, "_");
    const res = await invoke<{ success?: boolean; error?: string }>("create_project", {
      name: safeName,
    });

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
    const data = await invoke<{ endpoints: string[]; requests: any[] }>("load_project", { name });
    setProjectData({
      endpoints: data.endpoints || [],
      requests: data.requests || [],
    });

    if (data.requests && data.requests.length > 0) {
      loadSavedRequest(data.requests[0]);
    } else {
      setUrl("");
      setBody("{\n  \n}");
      setAuth({ type: "Gerekmiyor", data: {} });
      setTimeoutVal("10");
    }
  };

  const confirmSaveRequest = async () => {
    if (!requestNameInput || requestNameInput.trim() === "" || !currentProject) return;

    const newReq = { name: requestNameInput.trim(), method, url, body, auth, timeout: timeoutVal };
    const updatedEndpoints = [...projectData.endpoints];
    if (url && !updatedEndpoints.includes(url)) {
      updatedEndpoints.push(url);
    }

    const updatedRequests = [...projectData.requests];
    const existingIdx = updatedRequests.findIndex((r) => r.name === newReq.name);
    if (existingIdx >= 0) {
      updatedRequests[existingIdx] = newReq;
    } else {
      updatedRequests.push(newReq);
    }

    const newData = { endpoints: updatedEndpoints, requests: updatedRequests };
    await invoke("save_project", { name: currentProject, data: newData });
    setProjectData(newData);
    setShowRequestModal(false);
    setRequestNameInput("");
  };

  const loadSavedRequest = (req: any) => {
    setMethod(req.method || "GET");
    setUrl(req.url || "");
    setBody(req.body || "{\n  \n}");
    setAuth(req.auth || { type: "Gerekmiyor", data: {} });
    setTimeoutVal(req.timeout || "10");
  };

  const handleSend = async () => {
    if (!url) return;
    setIsLoading(true);
    setStatus("Status: Gönderiliyor...");
    setResponse(null);
    setShowUrlDropdown(false);

    if (currentProject && !projectData.endpoints.includes(url)) {
      const updatedData = {
        ...projectData,
        endpoints: [...projectData.endpoints, url],
      };
      setProjectData(updatedData);
      invoke("save_project", { name: currentProject, data: updatedData });
    }

    try {
      let finalUrl = url;
      const customHeaders: Record<string, string> = {};

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
          } catch {
            console.warn("Geçersiz URL, Query Param eklenemedi.");
          }
        }
      }

      const res = await invoke<{
        ok: boolean;
        status: number;
        statusText: string;
        time: number;
        data: string;
        error?: string;
      }>("make_request", {
        req: {
          method,
          url: finalUrl,
          body,
          customHeaders,
          timeout: timeoutVal,
        },
      });

      if (res.error) {
        setStatus("Status: Hata (Bağlantı Kurulamadı)");
        setResponse(res.error);
        setActiveTab("raw");
      } else {
        setStatus(`Status: ${res.status} ${res.statusText} | Time: ${res.time}ms`);
        let parsedJson = null;
        try {
          parsedJson = JSON.parse(res.data);
        } catch {}

        if (parsedJson) {
          setResponse(parsedJson);
          setActiveTab("tree");
        } else {
          setResponse(res.data);
          setActiveTab("raw");
        }
      }
    } catch (error: any) {
      setStatus("Status: Sistem Hatası");
      setResponse(String(error));
      setActiveTab("raw");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-gray-200 font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {showProjectModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#333333] p-6 rounded-lg shadow-2xl w-96">
            <h2 className="text-lg font-bold mb-4 text-gray-100">Yeni Proje Oluştur</h2>
            <input
              type="text"
              autoFocus
              placeholder="Örn: CPCM_Catalog_API"
              className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2 outline-none focus:border-blue-500 text-gray-100 mb-6"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmCreateProject()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={confirmCreateProject}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#333333] p-6 rounded-lg shadow-2xl w-96">
            <h2 className="text-lg font-bold mb-4 text-gray-100">İsteği Kaydet</h2>
            <input
              type="text"
              autoFocus
              placeholder="Örn: Get Offer Details"
              className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-4 py-2 outline-none focus:border-emerald-500 text-gray-100 mb-6"
              value={requestNameInput}
              onChange={(e) => setRequestNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmSaveRequest()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={confirmSaveRequest}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded"
              >
                Kaydet
              </button>
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
              <select
                className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                value={tempAuth.type}
                onChange={(e) => setTempAuth({ type: e.target.value, data: {} })}
              >
                <option value="Gerekmiyor">Gerekmiyor</option>
                <option value="Bearer Token">Bearer Token</option>
                <option value="Basic Auth">Basic Auth</option>
                <option value="API Key">API Key</option>
              </select>
            </div>
            <div className="min-h-[140px]">
              {tempAuth.type === "Gerekmiyor" && (
                <div className="flex h-full items-center justify-center text-sm text-gray-500 mt-8">
                  Bu istek için kimlik doğrulama kullanılmayacak.
                </div>
              )}
              {tempAuth.type === "Bearer Token" && (
                <div className="mt-4">
                  <label className="block text-sm text-gray-400 mb-2">Token</label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1Ni..."
                    className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500 font-mono text-sm"
                    value={tempAuth.data.token || ""}
                    onChange={(e) =>
                      setTempAuth({ ...tempAuth, data: { ...tempAuth.data, token: e.target.value } })
                    }
                  />
                </div>
              )}
              {tempAuth.type === "Basic Auth" && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Username</label>
                    <input
                      type="text"
                      className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                      value={tempAuth.data.username || ""}
                      onChange={(e) =>
                        setTempAuth({
                          ...tempAuth,
                          data: { ...tempAuth.data, username: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Password</label>
                    <input
                      type="password"
                      className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                      value={tempAuth.data.password || ""}
                      onChange={(e) =>
                        setTempAuth({
                          ...tempAuth,
                          data: { ...tempAuth.data, password: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              )}
              {tempAuth.type === "API Key" && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Key</label>
                    <input
                      type="text"
                      placeholder="x-api-key"
                      className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                      value={tempAuth.data.key || "x-api-key"}
                      onChange={(e) =>
                        setTempAuth({ ...tempAuth, data: { ...tempAuth.data, key: e.target.value } })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Value</label>
                    <input
                      type="text"
                      className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                      value={tempAuth.data.value || ""}
                      onChange={(e) =>
                        setTempAuth({
                          ...tempAuth,
                          data: { ...tempAuth.data, value: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Eklenecek Yer</label>
                    <select
                      className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-3 py-2 outline-none focus:border-purple-500"
                      value={tempAuth.data.addTo || "Header"}
                      onChange={(e) =>
                        setTempAuth({
                          ...tempAuth,
                          data: { ...tempAuth.data, addTo: e.target.value },
                        })
                      }
                    >
                      <option value="Header">Header</option>
                      <option value="Query Params">Query Params</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 rounded text-gray-400 hover:bg-[#333333]"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  setAuth(tempAuth);
                  setShowAuthModal(false);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-64 bg-[#252526] border-r border-[#333333] flex flex-col shrink-0">
        <div className="p-5 border-b border-[#333333] flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-wide text-gray-100">
            <span className="text-blue-500">API</span> Tester
          </h1>
          <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded font-mono">
            Rust/Tauri
          </span>
        </div>

        <div className="p-4">
          <button
            onClick={() => {
              setProjectNameInput("");
              setShowProjectModal(true);
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors shadow-sm"
          >
            + Yeni Proje
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {projects.length === 0 ? (
            <div className="text-xs text-gray-500 text-center mt-4">Henüz proje yok</div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj}
                onClick={() => handleLoadProject(proj)}
                className={`px-3 py-2 rounded cursor-pointer text-sm font-medium transition-colors ${
                  currentProject === proj
                    ? "bg-[#37373d] text-blue-400 border-l-2 border-blue-500"
                    : "hover:bg-[#2d2d2d] text-gray-400"
                }`}
              >
                {proj}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        <div className="p-6 border-b border-[#333333] bg-[#1e1e1e] shrink-0">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold text-yellow-500">
              {currentProject ? `Seçili Proje: ${currentProject}` : "Lütfen bir proje seçin"}
            </span>
            {currentProject && projectData.requests.length > 0 && (
              <select
                className="bg-[#2d2d2d] border border-[#3c3c3c] text-gray-300 text-sm rounded px-3 py-1 outline-none"
                onChange={(e) => {
                  const req = projectData.requests.find((r) => r.name === e.target.value);
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
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              className="bg-[#2d2d2d] border border-[#3c3c3c] text-green-400 font-bold rounded px-4 py-2.5 outline-none focus:border-blue-500 w-28 appearance-none"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST" className="text-yellow-400">POST</option>
              <option value="PUT" className="text-blue-400">PUT</option>
              <option value="DELETE" className="text-red-400">DELETE</option>
              <option value="PATCH" className="text-orange-400">PATCH</option>
            </select>

            <div className="flex-1 relative">
              <div className="flex items-center bg-[#181818] border border-[#3c3c3c] rounded focus-within:border-blue-500">
                <input
                  type="text"
                  placeholder="https://api.example.com/v1/users"
                  className="flex-1 bg-transparent px-4 py-2.5 outline-none text-gray-100 font-mono text-sm"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => setShowUrlDropdown(true)}
                  onBlur={() => setTimeout(() => setShowUrlDropdown(false), 180)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                {projectData.endpoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowUrlDropdown(!showUrlDropdown)}
                    className="px-3 py-2 text-gray-400 hover:text-gray-200 text-xs"
                    title="Kayıtlı URL Geçmişi"
                  >
                    ▼
                  </button>
                )}
              </div>

              {showUrlDropdown && projectData.endpoints.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl max-h-52 overflow-y-auto z-40">
                  {projectData.endpoints.map((ep) => (
                    <div
                      key={ep}
                      onMouseDown={() => {
                        setUrl(ep);
                        setShowUrlDropdown(false);
                      }}
                      className="px-4 py-2 text-sm font-mono text-gray-300 hover:bg-blue-600/30 hover:text-white cursor-pointer truncate"
                    >
                      {ep}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center ml-2 mr-1">
              <span className="text-[10px] text-gray-500 uppercase font-bold">Timeout</span>
              <input
                type="number"
                className="w-14 bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-center text-xs text-orange-400 outline-none focus:border-orange-500"
                value={timeoutVal}
                onChange={(e) => setTimeoutVal(e.target.value)}
              />
            </div>

            <button
              onClick={() => {
                setTempAuth(auth);
                setShowAuthModal(true);
              }}
              className={`px-4 py-2.5 rounded font-medium border ${
                auth.type === "Gerekmiyor"
                  ? "bg-[#2d2d2d] hover:bg-[#3d3d3d] border-[#3c3c3c] text-gray-300"
                  : "bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/50 text-purple-400"
              }`}
            >
              <span>🔑</span> {auth.type === "Gerekmiyor" ? "Auth" : auth.type}
            </button>

            <button
              onClick={handleSend}
              disabled={isLoading}
              className={`${
                isLoading
                  ? "bg-blue-800 text-gray-400 cursor-wait"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              } px-8 py-2.5 rounded font-bold shadow-md transition-all active:scale-95`}
            >
              {isLoading ? "..." : "GÖNDER"}
            </button>

            <button
              onClick={() => {
                if (!currentProject) {
                  alert("Lütfen önce bir proje seçin!");
                  return;
                }
                setRequestNameInput("");
                setShowRequestModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded font-medium transition-colors"
              title="İsteği Projeye Kaydet"
            >
              💾
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
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

          <div
            className="w-1.5 bg-[#333333] hover:bg-blue-500 cursor-col-resize flex flex-col justify-center items-center group transition-colors relative z-10"
            onMouseDown={handleMouseDown}
            title="Genişliği Ayarlamak İçin Sürükleyin"
          >
            <div className="h-10 w-0.5 bg-gray-500 group-hover:bg-white rounded"></div>
          </div>

          <div
            className="flex flex-col h-full bg-[#1e1e1e]"
            style={{ width: `${100 - leftPanelWidth}%` }}
          >
            <div className="px-6 py-3 border-b border-[#333333] flex justify-between items-center bg-[#252526]">
              <div className="flex space-x-6">
                <button
                  onClick={() => setActiveTab("tree")}
                  className={`text-sm font-semibold pb-3 -mb-3 transition-colors ${
                    activeTab === "tree"
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  JSON Tree
                </button>
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`text-sm font-semibold pb-3 -mb-3 transition-colors ${
                    activeTab === "raw"
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Raw
                </button>
              </div>
              <span
                className={`text-xs font-mono font-bold ${
                  status.includes("200") || status.includes("201")
                    ? "text-green-400"
                    : status.includes("Hata")
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="flex-1 p-4 text-gray-300 font-mono overflow-auto bg-[#1e1e1e]">
              {!response && !isLoading && (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  Yanıt burada görüntülenecek...
                </div>
              )}

              {response && activeTab === "tree" && (
                <div className="py-2">
                  <JsonNode value={response} label={null} />
                </div>
              )}

              {response && activeTab === "raw" && (
                <pre className="whitespace-pre-wrap break-all text-gray-400 text-[13px] px-2">
                  {typeof response === "string" ? response : JSON.stringify(response, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
