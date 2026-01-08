import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Square, Play, Send, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

function App() {

  // --- STATE MANAGEMENT ---
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('General');
  const [resumeQuestions, setResumeQuestions] = useState([]);
  const [isAnalysingResume, setIsAnalysingResume] = useState(false);

  // --- REFS ---
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Visualizer Refs
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  // --- TEXT TO SPEECH ---
  const speakText = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  // --- VISUALIZER LOGIC (Fixed Cleanup) ---
  useEffect(() => {
    if (isRecording && streamRef.current && canvasRef.current) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const draw = () => {
        if (!isRecording) return;
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = "rgb(20, 20, 20)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] / 2;
          ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };
      draw();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // FIXED: Only close if not already closed
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  // --- RECORDING FUNCTIONS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Save for visualizer

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Microphone permission denied!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- UPLOAD FUNCTION ---
  const uploadAudio = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    setTranscript("");
    setAnalysis(null);

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("topic", selectedTopic);

    try {
      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTranscript(response.data.transcript);
      setAnalysis(response.data.analysis);

      // Auto-Speak Feedback
      if (response.data.analysis?.feedback) {
        speakText(response.data.analysis.feedback);
      }

      toast.success("Transcription Completed!");
      fetchHistory(); // Refresh list

    } catch (error) {
      console.error("Upload failed: ", error);
      toast.error("Upload failed! Check Console.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- HISTORY FUNCTION ---
  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/history');
      if (Array.isArray(response.data)) {
        setHistory(response.data);
      } else if (response.data && Array.isArray(response.data.rows)) {
        setHistory(response.data.rows);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const chartData = [...history].reverse().map((item, index) => ({
    attempt: index + 1,
    score: item.json_log?.analysis?.score || 0,
    data: new Date(item.created_at).toLocaleDateString()
  }));

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsAnalysingResume(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await axios.post('http://localhost:3000/api/upload-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const questions = response.data.questions || [];
      setResumeQuestions(questions);
      toast.success("Your questions are READY");

      if (response?.data?.questions?.length > 0) {

        speakText("I have analyzed your resume and i will ask you questions based on your resume... Here we go...");
      }
    } catch (error) {
      console.error("Resume Error:", error);
      toast.error("Failed to analyze resume.");
    } finally {
      setIsAnalysingResume(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      <h1 className="text-3xl font-bold mb-8">Interview Copilot</h1>

      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">

        <div className="w-full max-w-2xl bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 animate-fade-in">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            📄 Resume AI Analysis
          </h2>

          {/* File Input */}
          <div className="flex flex-col gap-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <p className="mb-2 text-sm text-gray-400">
                  <span className="font-semibold">Click to upload PDF</span>
                </p>
                <p className="text-xs text-gray-500">AI will generate custom questions</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleResumeUpload}
                disabled={isAnalysingResume}
              />
            </label>

            {/* Loading State */}
            {isAnalysingResume && (
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="animate-spin" size={20} />
                <span>Reading resume and generating questions...</span>
              </div>
            )}

            {/* Display Generated Questions */}
           {resumeQuestions?.length > 0 && (
              <div className="mt-4 bg-slate-900 p-4 rounded-lg border border-slate-700">
                <h3 className="text-green-400 font-bold mb-2">Targeted Questions:</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  {resumeQuestions.map((q, index) => (
                    <li key={index}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>


        {/* TOPIC SELECTOR */}
        <div className="w-full flex flex-col items-center">
          <label className="mb-2 font-bold text-gray-300">Select Interview Topic:</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="p-2 rounded bg-white text-black w-64 text-center font-medium"
          >
            <option value="General">General / Behavioral</option>
            <option value="React">React.js</option>
            <option value="NodeJS">Node.js</option>
            <option value="Python">Python</option>
            <option value="SQL">SQL & Databases</option>
            <option value="DSA">Data Structures</option>
          </select>
        </div>

        {/* VISUALIZER CANVAS */}
        {isRecording && (
          <div className="w-full h-24 bg-black rounded-lg border border-gray-700 overflow-hidden">
            <canvas ref={canvasRef} width="600" height="100" className="w-full h-full" />
          </div>
        )}

        {/* RECORD BUTTON */}
        {!isRecording ? (
          <button onClick={startRecording} className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <Mic size={40} className="text-white" />
          </button>
        ) : (
          <button onClick={stopRecording} className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg animate-pulse">
            <Square size={40} className="text-white" />
          </button>
        )}

        <p className="text-gray-400">
          {isRecording ? "Listening... (Click to Stop)" : "Click mic to record"}
        </p>

        {/* PLAYBACK & UPLOAD */}
        {audioUrl && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg flex flex-col items-center gap-4 w-full">
            <h3 className="text-sm font-semibold text-gray-300">Playback Preview</h3>
            <audio src={audioUrl} controls className="w-full" />

            <button
              onClick={uploadAudio}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {isUploading ? <><Loader2 className="animate-spin" size={18} /> Uploading...</> : <><Send size={18} /> Submit Answer</>}
            </button>
          </div>
        )}

        {/* AI TRANSCRIPT */}
        {transcript && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow-lg w-full text-gray-800 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 text-blue-600">AI Transcript:</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-lg">{transcript}</p>
          </div>
        )}

        {isUploading && !analysis && (
          <div className="mt-8 p-6 bg-slate-800 rounded-xl shadow-2xl w-full border border-slate-700 animate-pulse">

            {/* EXPLAIN: This mimics the 'Score Header' */}
            <div className="flex items-center justify-between mb-6 border-b border-slate-600 pb-4">
              {/* Gray bar representing the Title */}
              <div className="h-8 bg-slate-700 rounded w-1/3"></div>
              {/* Gray circle representing the Score Badge */}
              <div className="h-10 w-24 bg-slate-700 rounded-full"></div>
            </div>

            {/* EXPLAIN: This mimics the 'Feedback Section' */}
            <div className="mb-6">
              <div className="h-4 bg-slate-700 rounded w-1/4 mb-3"></div>
              {/* Large block representing the feedback text paragraph */}
              <div className="h-24 bg-slate-700 rounded-lg w-full"></div>
            </div>

            {/* EXPLAIN: This mimics the 'Improvement Section' */}
            <div>
              <div className="h-4 bg-slate-700 rounded w-1/4 mb-3"></div>
              <div className="h-16 bg-slate-700 rounded-lg w-full"></div>
            </div>

          </div>
        )}

        {/* AI REPORT CARD (With Speak Button) */}
        {analysis && (
          <div className="mt-8 p-6 bg-slate-800 rounded-xl shadow-2xl w-full border border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between mb-6 border-b border-slate-600 pb-4">
              <h2 className="text-2xl font-bold text-white">AI Analysis</h2>
              <div className={`px-4 py-2 rounded-full font-bold text-xl ${(analysis?.score || 0) >= 7 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                Score: {analysis?.score ?? "?"}/10
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase">Feedback</h3>
                <button onClick={() => speakText(analysis.feedback)} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase flex items-center gap-1">
                  <Play size={14} /> Listen
                </button>
              </div>
              <p className="text-gray-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg">{analysis?.feedback}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-blue-400 uppercase mb-2">Improvement</h3>
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-blue-100 italic">
                "{analysis?.better_answer}"
              </div>
            </div>
          </div>
        )}

        <LineChart width={1000} height={300} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="attempt" stroke="#9CA3AF" label={{ value: 'Attempt #', position: 'insideBottom', offset: -5 }} />
          <YAxis stroke="#9CA3AF" domain={[0, 10]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#60A5FA' }}
          />
          <Line
            type="linear"
            dataKey="score"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>

        {/* HISTORY LIST (Safe Mode) */}
        <div className="w-full mt-12 mb-20">
          <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-700 pb-2">Interview History</h2>
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-bold px-2 py-0.5 rounded text-sm ${(item.json_log?.analysis?.score || 0) >= 7 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                      }`}>
                      Score: {item.json_log?.analysis?.score ?? "N/A"}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-400 text-sm truncate w-64">
                    {item.json_log?.transcript || "No transcript"}
                  </p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-gray-500 text-center italic">No history yet.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;