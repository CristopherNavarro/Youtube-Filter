import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Trash2, PlusCircle, BarChart3, History, Save, Download, Upload, FileDown, ArrowUpDown } from 'lucide-react';

interface VideoData {
  id: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  year: number;
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
  const [newVideo, setNewVideo] = useState<Omit<VideoData, 'id' | 'score' | 'warnings'>>({
    url: '',
    views: 0,
    likes: 0,
    comments: 0,
    year: new Date().getFullYear(),
  });
  const [showResults, setShowResults] = useState(false);
  const [filterLowEngagement, setFilterLowEngagement] = useState(false);
  const [filterLowViews, setFilterLowViews] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [sortAscending, setSortAscending] = useState(true);
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
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}$/;
    return regex.test(url);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewVideo({
      ...newVideo,
      [name]: name === 'url' ? value : Number(value),
    });
  };

  const addVideo = () => {
    if (!newVideo.url || !validateYouTubeUrl(newVideo.url)) {
      alert('Por favor ingrese una URL válida de YouTube');
      return;
    }

    if (newVideo.likes < 0 || newVideo.comments < 0) {
      alert('Los likes y comentarios no pueden ser negativos');
      return;
    }
    
    setVideos([
      ...videos,
      {
        ...newVideo,
        id: Date.now().toString(),
      },
    ]);
    
    setNewVideo({
      url: '',
      views: 0,
      likes: 0,
      comments: 0,
      year: new Date().getFullYear(),
    });
  };

  const removeVideo = (id: string) => {
    setVideos(videos.filter(video => video.id !== id));
  };

  const calculateScores = () => {
    if (videos.length === 0) {
      alert('Por favor agregue al menos un video para analizar');
      return;
    }

    const currentYear = new Date().getFullYear();
    const maxViews = Math.max(...videos.map(video => video.views));
    const m = 100; // Constante bayesiana
    
    const processedVideos = videos.map(video => {
      // Cálculo del ER ajustado con enfoque bayesiano
      const adjustedER = ((video.likes + video.comments + m) / (video.views + m)) * 100;
      
      const score = (
        (adjustedER * 0.65) + 
        (1 / Math.sqrt(currentYear - video.year + 1) * 0.25) + 
        (Math.log10(video.views + 1) / Math.log10(maxViews + 1) * 0.1)
      );
      
      const warnings = [];
      if (adjustedER < 1.5) warnings.push('⚠️ Engagement muy bajo');
      if (video.views < 500) warnings.push('⚠️ Vistas sospechosamente bajas');
      
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

  const getVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const filteredVideos = videos
    .filter(video => {
      const adjustedER = ((video.likes + video.comments + 100) / (video.views + 100)) * 100;
      if (filterLowEngagement && adjustedER < 1.5) return false;
      if (filterLowViews && video.views < 500) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortAscending) {
        return (a.score || 0) - (b.score || 0);
      } else {
        return (b.score || 0) - (a.score || 0);
      }
    });

  const generateSummary = () => {
    if (filteredVideos.length === 0) return 'No hay videos para analizar después de aplicar los filtros.';
    
    let summary = '';
    
    if (filteredVideos.length > 0) {
      const bestVideo = sortAscending ? filteredVideos[0] : filteredVideos[filteredVideos.length - 1];
      const adjustedER = ((bestVideo.likes + bestVideo.comments + 100) / (bestVideo.views + 100)) * 100;
      
      summary += `El video #1 tiene un engagement ajustado de ${adjustedER.toFixed(2)}% y ${
        new Date().getFullYear() - bestVideo.year === 0 ? 'es del año actual' : `fue publicado en ${bestVideo.year}`
      }.\n\n`;
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
            Clasifica videos según engagement ajustado, actualidad y popularidad
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de YouTube
              </label>
              <input
                type="text"
                name="url"
                value={newVideo.url}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vistas
              </label>
              <input
                type="number"
                name="views"
                value={newVideo.views}
                onChange={handleInputChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Número de vistas"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Likes
              </label>
              <input
                type="number"
                name="likes"
                value={newVideo.likes}
                onChange={handleInputChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Número de likes"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comentarios
              </label>
              <input
                type="number"
                name="comments"
                value={newVideo.comments}
                onChange={handleInputChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Número de comentarios"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Año de Publicación
              </label>
              <input
                type="number"
                name="year"
                value={newVideo.year}
                onChange={handleInputChange}
                min="2005"
                max={new Date().getFullYear()}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Año de publicación"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={addVideo}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center"
            >
              <PlusCircle size={18} className="mr-1" />
              Agregar Video
            </button>
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
                      Año
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
                        {video.views.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {video.likes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {video.comments.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {video.year}
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
                  <span className="ml-2 text-sm text-gray-700">Filtrar engagement &lt; 1.5%</span>
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
                          Puntuación
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Engagement
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Año
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vistas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Advertencias
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredVideos.map((video, index) => {
                        const adjustedER = ((video.likes + video.comments + 100) / (video.views + 100)) * 100;
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
                              {video.score?.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {adjustedER.toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {video.year}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {video.views.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                              {video.warnings?.join(', ')}
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
                  <p className="mt-2 text-sm text-blue-600">
                    Nota: Las puntuaciones más bajas indican mejor rendimiento.
                  </p>
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
            Fórmula: Puntuación = (ER_Ajustado × 0.65) + (1/sqrt(Antigüedad + 1) × 0.25) + (log10(Vistas)/log10(Vistas_Máx) × 0.1)
          </p>
          <p className="text-sm mt-1 text-gray-400">
            ER_Ajustado = ((Likes + Comentarios + 100)/(Vistas + 100)) × 100
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;