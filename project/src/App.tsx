import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Trash2, PlusCircle, BarChart3, History, Save, Download, Upload, FileDown, ArrowUpDown, Download as DownloadIcon } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface VideoData {
  id: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  publishDate: string;
  score?: number;
  normalizedScore?: number;
  recencyFactor?: number;
  engagementFactor?: number;
  viralityFactor?: number;
  warnings?: string[];
}

interface AnalysisHistory {
  id: string;
  name: string;
  date: string;
  videos: VideoData[];
  showResults: boolean;
}

interface ExportData {
  version: string;
  exportDate: string;
  analysis: {
    name: string;
    videos: VideoData[];
    showResults: boolean;
  };
}

// Constants for FEQT calculation
const FEQT_MAX_WITH_RECENCY = 1.5; // Updated max value for recency formula
const FEQT_MAX_WITHOUT_RECENCY = 2.5; // (1×0.7)+(6×0.3)
const VIRALITY_MAX = 6; // log10(1,000,000 + 1) ≈ 6
const RECENCY_DECAY = -0.005;

function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [filterLowEngagement, setFilterLowEngagement] = useState(false);
  const [filterLowViews, setFilterLowViews] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [sortAscending, setSortAscending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [includeRecency, setIncludeRecency] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('videoAnalysisHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('videoAnalysisHistory', JSON.stringify(history));
  }, [history]);

  const validateYouTubeUrl = (url: string) => {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(&t=\d+s)?$/;
    return regex.test(url);
  };

  const getVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getCleanUrl = (url: string) => {
    return url.split('?')[0].replace(/&t=\d+s$/, '');
  };

  const fetchVideoData = async (videoId: string) => {
    const API_KEY = 'AIzaSyBw13DGsQcizr6fLyV-noP3ghNgY7qZPUI';

    try {
      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${API_KEY}`
      );
      
      if (!videoResponse.ok) {
        throw new Error('Error al obtener datos del video');
      }

      const videoData = await videoResponse.json();

      if (!videoData.items || videoData.items.length === 0) {
        throw new Error('No se encontró el video');
      }

      const video = videoData.items[0];
      const statistics = video.statistics;
      const snippet = video.snippet;

      return {
        views: parseInt(statistics.viewCount || '0', 10),
        likes: parseInt(statistics.likeCount || '0', 10),
        comments: parseInt(statistics.commentCount || '0', 10),
        publishDate: snippet.publishedAt
      };
    } catch (error) {
      console.error('Error fetching video data:', error);
      throw new Error('Error al obtener los datos. Por favor, verifica la URL y tu conexión.');
    }
  };

  const addVideo = async () => {
    if (!newVideoUrl || !validateYouTubeUrl(newVideoUrl)) {
      alert('Por favor ingrese una URL válida de YouTube (video normal o Short)');
      return;
    }

    const cleanUrl = newVideoUrl.split('&')[0];
    const isDuplicate = videos.some(video => video.url.split('&')[0] === cleanUrl);
    if (isDuplicate) {
      alert('Este video ya ha sido agregado a la lista');
      return;
    }

    setIsLoading(true);

    try {
      const videoId = getVideoId(newVideoUrl);
      if (!videoId) {
        throw new Error('ID de video inválido');
      }

      const videoData = await fetchVideoData(videoId);

      setVideos([
        ...videos,
        {
          id: Date.now().toString(),
          url: cleanUrl,
          ...videoData
        },
      ]);

      setNewVideoUrl('');
    } catch (error) {
      alert('Error al obtener los datos del video. Por favor, verifique la URL e intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeVideo = (id: string) => {
    setVideos(videos.filter(video => video.id !== id));
  };

  const calculateScores = () => {
    if (videos.length === 0) {
      alert('Por favor agregue al menos un video para analizar');
      return;
    }

    const processedVideos = videos.map(video => {
      const daysSincePublish = Math.max(differenceInDays(new Date(), new Date(video.publishDate)), 1);
      
      // Recency (R) - Exponential decay
      const R = Math.exp(RECENCY_DECAY * daysSincePublish);
      
      // Engagement (E) - Weighted average of likes and comments ratios
      const likesRatio = ((video.likes ?? 0) / (video.views || 1));
      const commentsRatio = ((video.comments ?? 0) / (video.views || 1));
      const E = (likesRatio * 0.7) + (commentsRatio * 0.3);
      
      // Virality (V) - Logarithmic scale of daily views
      const V = Math.min(Math.log10((video.views / daysSincePublish) + 1), VIRALITY_MAX);
      
      // Calculate base FEQT score
      const baseScore = includeRecency
        ? (R * 0.4) + (E * 0.5) + (V * 0.1)
        : (E * 0.7) + (V * 0.3);
      
      // Normalize score to 0-100 range
      const normalizedScore = (baseScore / (includeRecency ? FEQT_MAX_WITH_RECENCY : FEQT_MAX_WITHOUT_RECENCY)) * 100;
      
      const warnings = [];
      if (likesRatio < 0.01) warnings.push('⚠️ Bajo ratio de likes (<1%)');
      if (commentsRatio < 0.001) warnings.push('⚠️ Bajo ratio de comentarios (<0.1%)');
      if ((video.views ?? 0) / daysSincePublish < 100) warnings.push('⚠️ Bajo crecimiento diario (<100 vistas/día)');
      
      return {
        ...video,
        score: baseScore,
        normalizedScore,
        recencyFactor: R,
        engagementFactor: E,
        viralityFactor: V,
        warnings,
      };
    });
    
    setVideos(processedVideos);
    setShowResults(true);
  };

  const saveCurrentAnalysis = () => {
    if (videos.length === 0) {
      alert('No hay videos para guardar');
      return;
    }

    if (!saveName.trim()) {
      alert('Por favor ingrese un nombre para guardar el análisis');
      return;
    }

    const newAnalysis: AnalysisHistory = {
      id: Date.now().toString(),
      name: saveName,
      date: new Date().toISOString(),
      videos: [...videos],
      showResults
    };

    setHistory([...history, newAnalysis]);
    setSaveName('');
    alert('Análisis guardado correctamente');
  };

  const loadAnalysis = (savedAnalysis: AnalysisHistory) => {
    setVideos(savedAnalysis.videos);
    setShowResults(savedAnalysis.showResults);
    setShowHistory(false);
    setSaveName(savedAnalysis.name);
  };

  const deleteAnalysis = (id: string) => {
    setHistory(history.filter(item => item.id !== id));
  };

  const clearCurrentAnalysis = () => {
    console.log("Clearing videos");
    if (confirm('¿Está seguro que desea borrar el análisis actual?')) {
      setVideos([]);
      console.log("Videos state after clear:", videos);
      setShowResults(false);
      setSaveName('');
    }
  };

  const exportAnalysis = () => {
    if (videos.length === 0) {
      alert('No hay videos para exportar');
      return;
    }

    const exportName = saveName.trim() || 'Análisis de Videos';
    
    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      analysis: {
        name: exportName,
        videos: [...videos],
        showResults
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${exportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportAllAnalyses = () => {
    if (history.length === 0) {
      alert('No hay análisis guardados para exportar');
      return;
    }

    history.forEach(item => {
      const exportData: ExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        analysis: {
          name: item.name,
          videos: item.videos,
          showResults: item.showResults
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `${item.name.replace(/\s+/g, '_')}_${new Date(item.date).toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    });

    alert(`Se han exportado ${history.length} análisis correctamente`);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedAnalyses: AnalysisHistory[] = [];
    const errors: string[] = [];

    const processFile = (file: File) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importedData = JSON.parse(event.target?.result as string) as ExportData;
            if (!importedData.version || !importedData.analysis || !Array.isArray(importedData.analysis.videos)) {
              throw new Error(`Formato de archivo inválido.`);
            }
            
            const analysisName = importedData.analysis.name || file.name.replace(/\.json$/, '') || `Análisis Importado ${new Date().toLocaleString()}`;

            importedAnalyses.push({
              id: Date.now().toString() + importedAnalyses.length, // Simple unique ID
              name: analysisName,
              date: new Date().toISOString(),
              videos: importedData.analysis.videos,
              showResults: importedData.analysis.showResults,
            });
          } catch (error) {
            errors.push(`Error al procesar ${file.name}: ${error instanceof Error ? error.message : 'Formato inválido'}`);
          } finally {
            resolve();
          }
        };
        reader.readAsText(file);
      });
    };

    Promise.all(Array.from(files).map(processFile))
      .then(() => {
        if (importedAnalyses.length > 0) {
          setHistory(prevHistory => [...prevHistory, ...importedAnalyses]);
          alert(`Se importaron ${importedAnalyses.length} análisis correctamente.`);
        }
        
        if (errors.length > 0) {
          alert('Errores durante la importación:\n' + errors.join('\n'));
        }
      })
      .catch(error => {
        alert('Error al importar archivos: ' + error.message);
      });
    
    if (e.target) {
      e.target.value = '';
    }
  };

  const filteredVideos = videos
    .filter(video => {
      if (!video.score) return true;
      const likesRatio = ((video.likes ?? 0) / (video.views || 1));
      const commentsRatio = ((video.comments ?? 0) / (video.views || 1));
      if (filterLowEngagement && (likesRatio < 0.01 || commentsRatio < 0.001)) return false;
      if (filterLowViews && (video.views ?? 0) < 500) return false;
      return true;
    })
    .sort((a, b) => {
      if (!a.normalizedScore || !b.normalizedScore) return 0;
      return sortAscending ? a.normalizedScore - b.normalizedScore : b.normalizedScore - a.normalizedScore;
    });

  const generateSummary = () => {
    if (filteredVideos.length === 0) return 'No hay videos para analizar después de aplicar los filtros.';
    
    let summary = '';
    
    if (filteredVideos.length > 0) {
      const bestVideo = sortAscending ? filteredVideos[filteredVideos.length - 1] : filteredVideos[0];
      const daysSincePublish = differenceInDays(new Date(), new Date(bestVideo.publishDate));
      const likesRatio = ((bestVideo.likes ?? 0) / (bestVideo.views || 1)) * 100;
      const commentsRatio = ((bestVideo.comments ?? 0) / (bestVideo.views || 1)) * 100;
      
      summary += `El video #1 tiene un FEQT normalizado de ${bestVideo.normalizedScore?.toFixed(2)}/100, `;
      summary += `con un ratio de likes del ${likesRatio.toFixed(2)}%, `;
      summary += `ratio de comentarios del ${commentsRatio.toFixed(2)}% `;
      summary += `y fue publicado hace ${daysSincePublish} días.\n\n`;
    }
    
    return summary;
  };

  const getFormulaExplanation = () => {
    if (includeRecency) {
      return (
        <>
          <p className="text-sm mt-2 text-gray-400">
            FEQT = [(R × 0.4) + (E × 0.5) + (V × 0.1)] × (100/1.5)
          </p>
          <p className="text-sm mt-1 text-gray-400">
            R = e^(-0.005 × días), E = (L/V × 0.7) + (C/V × 0.3), V = min(log10(vistas/días + 1), 6)
          </p>
        </>
      );
    } else {
      return (
        <>
          <p className="text-sm mt-2 text-gray-400">
            FEQT = [(E × 0.7) + (V × 0.3)] × (100/2.5)
          </p>
          <p className="text-sm mt-1 text-gray-400">
            E = (L/V × 0.7) + (C/V × 0.3), V = min(log10(vistas/días + 1), 6)
          </p>
        </>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-6 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold flex items-center">
            <BarChart3 className="mr-2" />
 YouTube Filter
          </h1>
          <p className="mt-2 opacity-90">
            Evalúa videos según recencia, compromiso y viralidad
          </p>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center"
            >
              <History size={18} className="mr-1" />
              {showHistory ? 'Ocultar Historial' : 'Mostrar Historial'}
            </button>
            
            <button
              onClick={triggerFileInput}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center"
            >
              <Upload size={18} className="mr-1" />
              Importar Análisis
            </button>{' '}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
              multiple
              className="hidden" 
            />
          </div>
          
          {videos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nombre del análisis"
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={saveCurrentAnalysis}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center"
              >
                <Save size={18} className="mr-1" />
                Guardar
              </button>
              <button
                onClick={exportAnalysis}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center"
              >
                <FileDown size={18} className="mr-1" />
                Descargar
              </button>
              <button
                onClick={clearCurrentAnalysis}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 size={18} className="mr-1" />
                Limpiar
              </button>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <History className="mr-2" size={20} />
                Historial de Análisis
              </h2>
              
              {history.length > 0 && (
                <button
                  onClick={exportAllAnalyses}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center"
                >
                  <DownloadIcon size={18} className="mr-1" />
                  Exportar Todos
                </button>
              )}
            </div>
            
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Videos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.videos.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex space-x-2">
                          <button
                            onClick={() => loadAnalysis(item)}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                          >
                            <Download size={18} className="mr-1" />
                            Cargar
                          </button>
                          <button
                            onClick={() => deleteAnalysis(item.id)}
                            className="text-red-600 hover:text-red-900 flex items-center"
                          >
                            <Trash2 size={18} className="mr-1" />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay análisis guardados en el historial.
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <PlusCircle className="mr-2" size={20} />
            Agregar Video
          </h2>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de YouTube (video normal o Short)
              </label>
              <input
                type="text"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://www.youtube.com/watch?v=... o https://www.youtube.com/shorts/..."
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={addVideo}
                disabled={isLoading}
                className={`bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <PlusCircle size={18} className="mr-1" />
                {isLoading ? 'Cargando...' : 'Agregar Video'}
              </button>
            </div>
          </div>
        </div>

        {videos.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Videos Agregados ({videos.length})</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vistas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Likes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comentarios
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {videos.map(video => (
                    <tr key={video.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {video.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(video.views ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(video.likes ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(video.comments ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(video.publishDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => removeVideo(video.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={calculateScores}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Calculator size={18} className="mr-1" />
                Calcular Puntuaciones
              </button>
            </div>
          </div>
        )}

        {showResults && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Resultados del Análisis</h2>
              
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={includeRecency}
                    onChange={() => setIncludeRecency(!includeRecency)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">Incluir factor de recencia</span>
                </label>

                <button
                  onClick={() => setSortAscending(!sortAscending)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center"
                >
                  <ArrowUpDown size={18} className="mr-1" />
                  {sortAscending ? 'Menor a Mayor' : 'Mayor a Menor'}
                </button>
                
                <label className="inline-flex items-center">
                  
                  <input
                    type="checkbox"
                    checked={filterLowEngagement}
                    onChange={() => setFilterLowEngagement(!filterLowEngagement)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">Filtrar bajo engagement</span>
                </label>
                
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={filterLowViews}
                    onChange={() => setFilterLowViews(!filterLowViews)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">Filtrar vistas &lt; 500</span>
                </label>
              </div>
            </div>
            
            {filteredVideos.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Puesto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          FEQT (0-100)
                        </th>
                        
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recencia
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Engagement
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Viralidad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Advertencias
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredVideos.map((video, index) => (
                        <tr key={video.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              {video.url}
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(video.normalizedScore ?? 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(video.recencyFactor ?? 0).toFixed(3)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(video.engagementFactor ?? 0).toFixed(3)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(video.viralityFactor ?? 0).toFixed(3)}
                          </td>
                          <td className="px-6 py-4 whitespace-pre-line text-sm text-red-500">
                            {video.warnings?.join('\n')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h3 className="text-lg font-medium text-blue-800 mb-2">Resumen del Análisis</h3>
                  <p className="text-blue-700 whitespace-pre-line">{generateSummary()}</p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay videos para mostrar después de aplicar los filtros.
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-800 text-white p-6 mt-12">
        <div className="container mx-auto text-center">
          <p>Analizador de Videos de YouTube © {new Date().getFullYear()}</p>
          {getFormulaExplanation()}
        </div>
      </footer>
    </div>
  );
}

export default App;