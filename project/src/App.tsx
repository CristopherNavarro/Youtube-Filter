import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Trash2, PlusCircle, BarChart3, History, Save, Download, Upload, FileDown, ArrowUpDown } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface VideoData {
  id: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  publishDate: string;
  score?: number;
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
    // Regular expression for both regular YouTube videos and Shorts
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}$/;
    return regex.test(url);
  };

  const getVideoId = (url: string) => {
    // Updated regex to handle both regular videos and Shorts
    const regex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const fetchVideoData = async (videoId: string) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=AIzaSyAURdq7QTq4UbIOtRztU8qL6Q5BAwsvefg`
      );
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error('No se encontró el video');
      }

      const videoData = data.items[0];
      const statistics = videoData.statistics;
      const snippet = videoData.snippet;

      return {
        views: parseInt(statistics.viewCount ?? '0', 10),
        likes: parseInt(statistics.likeCount ?? '0', 10),
        comments: parseInt(statistics.commentCount ?? '0', 10),
        publishDate: snippet.publishedAt
      };
    } catch (error) {
      console.error('Error fetching video data:', error);
      throw error;
    }
  };

  const addVideo = async () => {
    if (!newVideoUrl || !validateYouTubeUrl(newVideoUrl)) {
      alert('Por favor ingrese una URL válida de YouTube (video normal o Short)');
      return;
    }

    // Check for duplicate URLs
    const isDuplicate = videos.some(video => video.url === newVideoUrl);
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
          url: newVideoUrl,
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
      const daysSincePublish = differenceInDays(new Date(), new Date(video.publishDate));
      
      // Recencia (R) - 40%
      const R = Math.exp(-0.005 * daysSincePublish);
      
      // Compromiso (E) - 50%
      const likesRatio = ((video.likes ?? 0) / (video.views || 1)) * 100;
      const commentsRatio = ((video.comments ?? 0) / (video.views || 1)) * 100;
      const E = ((likesRatio * 70) + (commentsRatio * 30)) / 100;
      
      // Viralidad (V) - 10%
      const V = Math.log10(((video.views ?? 0) / (daysSincePublish || 1)) + 1);
      
      // FEQT Final Score
      const score = (R * 0.4) + (E * 0.5) + (V * 0.1);
      
      const warnings = [];
      if (likesRatio < 1) warnings.push('⚠️ Bajo ratio de likes');
      if (commentsRatio < 0.1) warnings.push('⚠️ Bajo ratio de comentarios');
      if ((video.views ?? 0) / (daysSincePublish || 1) < 100) warnings.push('⚠️ Bajo crecimiento diario');
      
      return {
        ...video,
        score,
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
      date: new Date().toLocaleString(),
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
  };

  const deleteAnalysis = (id: string) => {
    setHistory(history.filter(item => item.id !== id));
  };

  const clearCurrentAnalysis = () => {
    if (confirm('¿Está seguro que desea borrar el análisis actual?')) {
      setVideos([]);
      setShowResults(false);
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

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as ExportData;
        
        if (!importedData.version || !importedData.analysis || !Array.isArray(importedData.analysis.videos)) {
          throw new Error('Formato de archivo inválido');
        }
        
        setVideos(importedData.analysis.videos);
        setShowResults(importedData.analysis.showResults);
        setSaveName(importedData.analysis.name);
        
        alert('Análisis importado correctamente');
      } catch (error) {
        alert('Error al importar el archivo: ' + (error instanceof Error ? error.message : 'Formato inválido'));
      }
    };
    reader.readAsText(file);
    
    if (e.target) {
      e.target.value = '';
    }
  };

  const filteredVideos = videos
    .filter(video => {
      if (!video.score) return true;
      const likesRatio = ((video.likes ?? 0) / (video.views || 1)) * 100;
      const commentsRatio = ((video.comments ?? 0) / (video.views || 1)) * 100;
      if (filterLowEngagement && (likesRatio < 1 || commentsRatio < 0.1)) return false;
      if (filterLowViews && (video.views ?? 0) < 500) return false;
      return true;
    })
    .sort((a, b) => {
      if (!a.score || !b.score) return 0;
      return sortAscending ? a.score - b.score : b.score - a.score;
    });

  const generateSummary = () => {
    if (filteredVideos.length === 0) return 'No hay videos para analizar después de aplicar los filtros.';
    
    let summary = '';
    
    if (filteredVideos.length > 0) {
      const bestVideo = sortAscending ? filteredVideos[filteredVideos.length - 1] : filteredVideos[0];
      const daysSincePublish = differenceInDays(new Date(), new Date(bestVideo.publishDate));
      const likesRatio = ((bestVideo.likes ?? 0) / (bestVideo.views || 1)) * 100;
      const commentsRatio = ((bestVideo.comments ?? 0) / (bestVideo.views || 1)) * 100;
      
      summary += `El video #1 tiene un ratio de likes del ${likesRatio.toFixed(2)}%, ratio de comentarios del ${commentsRatio.toFixed(2)}% y fue publicado hace ${daysSincePublish} días.\n\n`;
    }
    
    return summary;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-6 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold flex items-center">
            <BarChart3 className="mr-2" />
            Analizador de Videos de YouTube
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
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
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
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <History className="mr-2" size={20} />
              Historial de Análisis
            </h2>
            
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
                          {item.date}
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
                          FEQT
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recencia
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Compromiso
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
                      {filteredVideos.map((video, index) => {
                        const daysSincePublish = differenceInDays(new Date(), new Date(video.publishDate));
                        const R = Math.exp(-0.005 * daysSincePublish);
                        const likesRatio = ((video.likes ?? 0) / (video.views || 1)) * 100;
                        const commentsRatio = ((video.comments ?? 0) / (video.views || 1)) * 100;
                        const E = ((likesRatio * 70) + (commentsRatio * 30)) / 100;
                        const V = Math.log10(((video.views ?? 0) / (daysSincePublish || 1)) + 1);
                        
                        return (
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
                              {(video.score ?? 0).toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {R.toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {E.toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {V.toFixed(3)}
                            </td>
                            <td className="px-6 py-4 whitespace-pre-line text-sm text-red-500">
                              {video.warnings?.join('\n')}
                            </td>
                          </tr>
                        );
                      })}
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
          <p className="text-sm mt-2 text-gray-400">
            FEQT = (R × 0.4) + (E × 0.5) + (V × 0.1)
          </p>
          <p className="text-sm mt-1 text-gray-400">
            R = e^(-0.005 × días), E = [(L/V × 70) + (C/V × 30)]/100, V = log10(vistas/días + 1)
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;